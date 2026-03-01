import { browser, Downloads } from 'webextension-polyfill-ts'
import { Settings } from '../options'
import {
  markPostDownloadFailed,
  markPostDownloadStarted,
  markPostDownloadSucceeded
} from '../content/modules/postDownloadState'
import {
  markPostContentDownloadFailed,
  markPostContentDownloadStarted,
  markPostContentDownloadSucceeded
} from '../content/modules/postContentDownloadState'

type ActivePostDownloadBatch = {
  postId: number
  downloadIds: Set<number>
  endSignaled: boolean
  failedCount: number
}

type ActivePostContentDownloadBatch = {
  postId: number
  contentId: number
  downloadIds: Set<number>
  endSignaled: boolean
  failedCount: number
}

type PostContentBatchKey = string

const activePostDownloadBatches = new Map<number, ActivePostDownloadBatch>()
const downloadIdToPostIdMap = new Map<number, number>()
const activePostContentDownloadBatches = new Map<PostContentBatchKey, ActivePostContentDownloadBatch>()
const downloadIdToPostContentBatchKeyMap = new Map<number, PostContentBatchKey>()

/**
 * 与えられた文字列からunicode制御/書式文字を取り除く
 */
const removeControlCharacters = (str: string) => {
  // この正規表現は以下のUnicode制御/書式文字を削除する:
  // - \u0000-\u001F : C0 制御文字
  // - \u007F-\u009F : C1 制御文字
  // - \u00AD       : ソフトハイフン (soft hyphen)
  // - \u061C       : Arabic Letter Mark (ALM)
  // - \u180E       : Mongolian Vowel Separator (MVS, 廃止済みだが互換のため除去)
  // - \u200B-\u200F: ゼロ幅スペース/結合子/非結合子および左右マーク (zero-width space/joiner/non-joiner, LRM, RLM)
  // - \u202A-\u202E: 方向性埋め込み/上書き記号 (bidirectional embedding/override)
  // - \u2060       : Word Joiner (WJ)
  // - \u2066-\u2069: 双方向分離記号 (LRI, RLI, FSI, PDI)
  // - \uFEFF      : ゼロ幅ノーブレークスペース/BOM
  // - \uFE00-\uFE0F: バリエーションセレクタ (variation selectors)
  // eslint-disable-next-line no-control-regex
  return str.replaceAll(/(?:[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]|[\uFE00-\uFE0F])/g, '')
}

// 拡張機能インストール時にコンテキストメニューを設定する
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    type: 'normal',
    id: 'download_everything_from_a_post',
    title: browser.i18n.getMessage('download_everything_from_a_post'),
    documentUrlPatterns: ['https://fantia.jp/posts/*']
  })
})

// コンテキストメニューがクリックされたら
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (tab == null || tab.id == null) return
  // コンテンツスクリプト側にメッセージを送信
  browser.tabs.sendMessage(tab.id, { text: 'download_everything_from_a_post', tabID: tab.id, info, tab })
    .catch(err => { console.error(err) })
})

/**
 * 1つのフォルダに全てのファイルを保存する場合のファイル名を生成する
 */
const generateOneFolderFileName = (filepath: string, filename: string) => {
  const splitFilepath = filepath.split('/')
  const fanclubName = splitFilepath[0].split('_')[1]
  const titleName = splitFilepath[1].split('_')[1]
  return `${fanclubName}_${titleName}_${filename}`
}

/**
 * post-contentバッチ管理用キーを生成します。
 */
const postContentBatchKey = (postId: number, contentId: number): PostContentBatchKey => `${postId}_${contentId}`

/**
 * ダウンロード終端状態を投稿バッチへ反映します。
 */
const handlePostDownloadTerminalState = (downloadId: number, state: 'complete' | 'interrupted'): void => {
  const postId = downloadIdToPostIdMap.get(downloadId)
  if (postId == null) return

  const batch = activePostDownloadBatches.get(postId)
  if (!batch) {
    downloadIdToPostIdMap.delete(downloadId)
    return
  }

  if (!batch.downloadIds.has(downloadId)) {
    downloadIdToPostIdMap.delete(downloadId)
    return
  }

  batch.downloadIds.delete(downloadId)
  downloadIdToPostIdMap.delete(downloadId)
  if (state === 'interrupted') {
    batch.failedCount += 1
  }

  maybeCompletePostDownloadBatch(postId).catch(err => { console.error(err) })
}

/**
 * ダウンロード終端状態をpost-contentバッチへ反映します。
 */
const handlePostContentDownloadTerminalState = (downloadId: number, state: 'complete' | 'interrupted'): void => {
  const key = downloadIdToPostContentBatchKeyMap.get(downloadId)
  if (key == null) return

  const batch = activePostContentDownloadBatches.get(key)
  if (!batch) {
    downloadIdToPostContentBatchKeyMap.delete(downloadId)
    return
  }

  if (!batch.downloadIds.has(downloadId)) {
    downloadIdToPostContentBatchKeyMap.delete(downloadId)
    return
  }

  batch.downloadIds.delete(downloadId)
  downloadIdToPostContentBatchKeyMap.delete(downloadId)
  if (state === 'interrupted') {
    batch.failedCount += 1
  }

  maybeCompletePostContentDownloadBatch(key).catch(err => { console.error(err) })
}

/**
 * ダウンロード終端状態を全バッチへ反映します。
 */
const handleDownloadTerminalState = (downloadId: number, state: 'complete' | 'interrupted'): void => {
  handlePostDownloadTerminalState(downloadId, state)
  handlePostContentDownloadTerminalState(downloadId, state)
}

/**
 * download作成直後に既に終端済みの場合を補正します。
 */
const settleAlreadyCompletedDownload = async (downloadId: number) => {
  const results = await browser.downloads.search({ id: downloadId })
  const latest = results[0]
  if (!latest) return

  if (latest.state === 'complete' || latest.state === 'interrupted') {
    handleDownloadTerminalState(downloadId, latest.state)
  }
}

/**
 * 投稿/ post-contentバッチにdownloadIdを紐付けます。
 */
const registerDownloadId = (postId: number | null, contentId: number | null, downloadId: number): void => {
  if (postId != null) {
    const postBatch = activePostDownloadBatches.get(postId)
    if (postBatch) {
      postBatch.downloadIds.add(downloadId)
      downloadIdToPostIdMap.set(downloadId, postId)
    }
  }

  if (postId != null && contentId != null) {
    const key = postContentBatchKey(postId, contentId)
    const contentBatch = activePostContentDownloadBatches.get(key)
    if (contentBatch) {
      contentBatch.downloadIds.add(downloadId)
      downloadIdToPostContentBatchKeyMap.set(downloadId, key)
    }
  }

  settleAlreadyCompletedDownload(downloadId).catch(err => { console.error(err) })
}

/**
 * 投稿バッチの失敗件数を加算します。
 */
const increasePostDownloadFailure = (postId: number): void => {
  const batch = activePostDownloadBatches.get(postId)
  if (!batch) return
  batch.failedCount += 1
  maybeCompletePostDownloadBatch(postId).catch(err => { console.error(err) })
}

/**
 * post-contentバッチの失敗件数を加算します。
 */
const increasePostContentDownloadFailure = (postId: number, contentId: number): void => {
  const key = postContentBatchKey(postId, contentId)
  const batch = activePostContentDownloadBatches.get(key)
  if (!batch) return
  batch.failedCount += 1
  maybeCompletePostContentDownloadBatch(key).catch(err => { console.error(err) })
}

/**
 * 投稿バッチの完了条件を満たした場合に状態を確定します。
 */
const maybeCompletePostDownloadBatch = async (postId: number): Promise<void> => {
  const batch = activePostDownloadBatches.get(postId)
  if (!batch) return
  if (!batch.endSignaled) return
  if (batch.downloadIds.size > 0) return

  if (batch.failedCount > 0) {
    await markPostDownloadFailed(postId, batch.failedCount)
  } else {
    await markPostDownloadSucceeded(postId)
  }

  activePostDownloadBatches.delete(postId)
}

/**
 * post-contentバッチの完了条件を満たした場合に状態を確定します。
 */
const maybeCompletePostContentDownloadBatch = async (key: PostContentBatchKey): Promise<void> => {
  const batch = activePostContentDownloadBatches.get(key)
  if (!batch) return
  if (!batch.endSignaled) return
  if (batch.downloadIds.size > 0) return

  if (batch.failedCount > 0) {
    await markPostContentDownloadFailed(batch.postId, batch.contentId, batch.failedCount)
  } else {
    await markPostContentDownloadSucceeded(batch.postId, batch.contentId)
  }

  activePostContentDownloadBatches.delete(key)
}

/**
 * 投稿バッチを開始し、状態をDL中へ更新します。
 */
const startPostDownloadBatch = async (postId: number): Promise<void> => {
  const existing = activePostDownloadBatches.get(postId)
  if (existing) {
    for (const downloadId of existing.downloadIds) {
      downloadIdToPostIdMap.delete(downloadId)
    }
  }

  activePostDownloadBatches.set(postId, {
    postId,
    downloadIds: new Set<number>(),
    endSignaled: false,
    failedCount: 0
  })
  await markPostDownloadStarted(postId)
}

/**
 * 投稿バッチの入力終了を通知します。
 */
const endPostDownloadBatch = async (postId: number): Promise<void> => {
  const batch = activePostDownloadBatches.get(postId)
  if (!batch) return
  batch.endSignaled = true
  await maybeCompletePostDownloadBatch(postId)
}

/**
 * post-contentバッチを開始し、状態をDL中へ更新します。
 */
const startPostContentDownloadBatch = async (postId: number, contentId: number): Promise<void> => {
  const key = postContentBatchKey(postId, contentId)
  const existing = activePostContentDownloadBatches.get(key)
  if (existing) {
    for (const downloadId of existing.downloadIds) {
      downloadIdToPostContentBatchKeyMap.delete(downloadId)
    }
  }

  activePostContentDownloadBatches.set(key, {
    postId,
    contentId,
    downloadIds: new Set<number>(),
    endSignaled: false,
    failedCount: 0
  })
  await markPostContentDownloadStarted(postId, contentId)
}

/**
 * post-contentバッチの入力終了を通知します。
 */
const endPostContentDownloadBatch = async (postId: number, contentId: number): Promise<void> => {
  const key = postContentBatchKey(postId, contentId)
  const batch = activePostContentDownloadBatches.get(key)
  if (!batch) return
  batch.endSignaled = true
  await maybeCompletePostContentDownloadBatch(key)
}

export const download = async (
  url: string,
  filename: string,
  filepath: string,
  postId: number | null = null,
  contentId: number | null = null
): Promise<void> => {
  const { allFileOneFolder } = (await browser.storage.local.get({
    allFileOneFolder: false
  })) as Settings
  // 保存先の設定
  const downloadFilename = allFileOneFolder
  // 1つのフォルダーに全てのファイルを保存する場合
    ? generateOneFolderFileName(filepath, filename)
    //
    : `${filepath}/${filename}`
  const normalizedFilename = removeControlCharacters(downloadFilename)

  const options: Downloads.DownloadOptionsType = {
    url,
    // スペースは削除
    filename: `fantia/${normalizedFilename}`.replaceAll(' ', '').replaceAll('　', ''),
    saveAs: false,
    conflictAction: 'overwrite'
  }
  try {
    const downloadId = await browser.downloads.download(options)
    if (downloadId != null) {
      registerDownloadId(postId, contentId, downloadId)
    }
  } catch (e) {
    if (postId != null) {
      increasePostDownloadFailure(postId)
    }
    if (postId != null && contentId != null) {
      increasePostContentDownloadFailure(postId, contentId)
    }
    console.error(e, options)
    alert(`ダウンロードに失敗しました。\n\n${e}\n${options.filename}`)
  }
}

type DownloadEventMsg = {
  msg: 'download'
  url: string
  filepath: string
  filename: string
  postId: number | null
  contentId: number | null
}

type PostDownloadBatchStartEventMsg = {
  msg: 'post_download_batch_start'
  postId: number
}

type PostDownloadBatchEndEventMsg = {
  msg: 'post_download_batch_end'
  postId: number
}

type PostContentDownloadBatchStartEventMsg = {
  msg: 'post_content_download_batch_start'
  postId: number
  contentId: number
}

type PostContentDownloadBatchEndEventMsg = {
  msg: 'post_content_download_batch_end'
  postId: number
  contentId: number
}

type RuntimeMessage =
  | DownloadEventMsg
  | PostDownloadBatchStartEventMsg
  | PostDownloadBatchEndEventMsg
  | PostContentDownloadBatchStartEventMsg
  | PostContentDownloadBatchEndEventMsg

browser.downloads.onChanged.addListener((delta) => {
  if (delta.id == null || delta.state?.current == null) return
  if (delta.state.current !== 'complete' && delta.state.current !== 'interrupted') return

  handleDownloadTerminalState(delta.id, delta.state.current)
})

browser.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.msg === 'download') {
    return download(msg.url, msg.filename, msg.filepath, msg.postId, msg.contentId)
  }
  if (msg.msg === 'post_download_batch_start') {
    return startPostDownloadBatch(msg.postId)
  }
  if (msg.msg === 'post_download_batch_end') {
    return endPostDownloadBatch(msg.postId)
  }
  if (msg.msg === 'post_content_download_batch_start') {
    return startPostContentDownloadBatch(msg.postId, msg.contentId)
  }
  if (msg.msg === 'post_content_download_batch_end') {
    return endPostContentDownloadBatch(msg.postId, msg.contentId)
  }
})
