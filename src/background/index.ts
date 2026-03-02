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
  lastActivityAt: string
}

type ActivePostContentDownloadBatch = {
  postId: number
  contentId: number
  downloadIds: Set<number>
  endSignaled: boolean
  failedCount: number
  lastActivityAt: string
}

type PostContentBatchKey = string

type PersistedActivePostDownloadBatch = {
  postId: number
  downloadIds: number[]
  endSignaled: boolean
  failedCount: number
  lastActivityAt: string
}

type PersistedActivePostContentDownloadBatch = {
  postId: number
  contentId: number
  downloadIds: number[]
  endSignaled: boolean
  failedCount: number
  lastActivityAt: string
}

const activePostDownloadBatches = new Map<number, ActivePostDownloadBatch>()
const downloadIdToPostIdMap = new Map<number, number>()
const activePostContentDownloadBatches = new Map<PostContentBatchKey, ActivePostContentDownloadBatch>()
const downloadIdToPostContentBatchKeyMap = new Map<number, PostContentBatchKey>()
const postDownloadBatchFinalizeTimers = new Map<number, ReturnType<typeof setTimeout>>()
const postContentDownloadBatchFinalizeTimers = new Map<PostContentBatchKey, ReturnType<typeof setTimeout>>()
const ACTIVE_POST_DOWNLOAD_BATCHES_STORAGE_KEY = 'activePostDownloadBatches'
const ACTIVE_POST_CONTENT_DOWNLOAD_BATCHES_STORAGE_KEY = 'activePostContentDownloadBatches'
const BATCH_INACTIVITY_TIMEOUT_MS = 20 * 1000

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
 * 現在時刻をISO文字列で返します。
 */
const nowIsoString = (): string => new Date().toISOString()

/**
 * 日時文字列をミリ秒へ変換します。
 */
const parseDateMs = (value: string): number | null => {
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * バッチが一定時間アクティビティなしで放置されているかを判定します。
 */
const isBatchInactive = (lastActivityAt: string): boolean => {
  const lastActivityMs = parseDateMs(lastActivityAt)
  if (lastActivityMs == null) return true
  return Date.now() - lastActivityMs >= BATCH_INACTIVITY_TIMEOUT_MS
}

/**
 * 値が数値配列かを判定します。
 */
const isNumberArray = (value: unknown): value is number[] => {
  return Array.isArray(value) && value.every(v => typeof v === 'number')
}

/**
 * 永続化された投稿バッチ形式かを判定します。
 */
const isPersistedActivePostDownloadBatch = (value: unknown): value is PersistedActivePostDownloadBatch => {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>

  return (
    typeof record.postId === 'number' &&
    isNumberArray(record.downloadIds) &&
    typeof record.endSignaled === 'boolean' &&
    typeof record.failedCount === 'number' &&
    typeof record.lastActivityAt === 'string'
  )
}

/**
 * 永続化されたpost-contentバッチ形式かを判定します。
 */
const isPersistedActivePostContentDownloadBatch = (value: unknown): value is PersistedActivePostContentDownloadBatch => {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>

  return (
    typeof record.postId === 'number' &&
    typeof record.contentId === 'number' &&
    isNumberArray(record.downloadIds) &&
    typeof record.endSignaled === 'boolean' &&
    typeof record.failedCount === 'number' &&
    typeof record.lastActivityAt === 'string'
  )
}

/**
 * 投稿バッチの最終アクティビティ時刻を更新します。
 */
const touchPostDownloadBatch = (batch: ActivePostDownloadBatch): void => {
  batch.lastActivityAt = nowIsoString()
}

/**
 * post-contentバッチの最終アクティビティ時刻を更新します。
 */
const touchPostContentDownloadBatch = (batch: ActivePostContentDownloadBatch): void => {
  batch.lastActivityAt = nowIsoString()
}

/**
 * 投稿バッチ関連のdownloadId逆引きを削除します。
 */
const clearPostDownloadBatchMappings = (batch: ActivePostDownloadBatch): void => {
  for (const downloadId of batch.downloadIds) {
    downloadIdToPostIdMap.delete(downloadId)
  }
}

/**
 * post-contentバッチ関連のdownloadId逆引きを削除します。
 */
const clearPostContentDownloadBatchMappings = (batch: ActivePostContentDownloadBatch): void => {
  for (const downloadId of batch.downloadIds) {
    downloadIdToPostContentBatchKeyMap.delete(downloadId)
  }
}

/**
 * アクティブバッチをstorage.localへ永続化します。
 */
const persistActiveBatches = async (): Promise<void> => {
  const postBatches: PersistedActivePostDownloadBatch[] = [...activePostDownloadBatches.values()].map(batch => ({
    postId: batch.postId,
    downloadIds: [...batch.downloadIds],
    endSignaled: batch.endSignaled,
    failedCount: batch.failedCount,
    lastActivityAt: batch.lastActivityAt
  }))
  const postContentBatches: PersistedActivePostContentDownloadBatch[] = [...activePostContentDownloadBatches.values()].map(batch => ({
    postId: batch.postId,
    contentId: batch.contentId,
    downloadIds: [...batch.downloadIds],
    endSignaled: batch.endSignaled,
    failedCount: batch.failedCount,
    lastActivityAt: batch.lastActivityAt
  }))

  await browser.storage.local.set({
    [ACTIVE_POST_DOWNLOAD_BATCHES_STORAGE_KEY]: postBatches,
    [ACTIVE_POST_CONTENT_DOWNLOAD_BATCHES_STORAGE_KEY]: postContentBatches
  })
}

/**
 * 永続化済みアクティブバッチを読み出してメモリへ復元します。
 */
const restoreActiveBatches = async (): Promise<void> => {
  const storage = await browser.storage.local.get({
    [ACTIVE_POST_DOWNLOAD_BATCHES_STORAGE_KEY]: [],
    [ACTIVE_POST_CONTENT_DOWNLOAD_BATCHES_STORAGE_KEY]: []
  }) as Record<string, unknown>

  const rawPostBatches = storage[ACTIVE_POST_DOWNLOAD_BATCHES_STORAGE_KEY]
  const rawPostContentBatches = storage[ACTIVE_POST_CONTENT_DOWNLOAD_BATCHES_STORAGE_KEY]

  activePostDownloadBatches.clear()
  activePostContentDownloadBatches.clear()
  downloadIdToPostIdMap.clear()
  downloadIdToPostContentBatchKeyMap.clear()

  if (Array.isArray(rawPostBatches)) {
    for (const value of rawPostBatches) {
      if (!isPersistedActivePostDownloadBatch(value)) continue

      const batch: ActivePostDownloadBatch = {
        postId: value.postId,
        downloadIds: new Set(value.downloadIds),
        endSignaled: value.endSignaled,
        failedCount: value.failedCount,
        lastActivityAt: value.lastActivityAt
      }
      activePostDownloadBatches.set(batch.postId, batch)
      for (const downloadId of batch.downloadIds) {
        downloadIdToPostIdMap.set(downloadId, batch.postId)
      }
    }
  }

  if (Array.isArray(rawPostContentBatches)) {
    for (const value of rawPostContentBatches) {
      if (!isPersistedActivePostContentDownloadBatch(value)) continue

      const key = postContentBatchKey(value.postId, value.contentId)
      const batch: ActivePostContentDownloadBatch = {
        postId: value.postId,
        contentId: value.contentId,
        downloadIds: new Set(value.downloadIds),
        endSignaled: value.endSignaled,
        failedCount: value.failedCount,
        lastActivityAt: value.lastActivityAt
      }
      activePostContentDownloadBatches.set(key, batch)
      for (const downloadId of batch.downloadIds) {
        downloadIdToPostContentBatchKeyMap.set(downloadId, key)
      }
    }
  }
}

/**
 * 投稿バッチの遅延確定タイマーを解除します。
 */
const clearPostDownloadBatchFinalizeTimer = (postId: number): void => {
  const timerId = postDownloadBatchFinalizeTimers.get(postId)
  if (timerId == null) return
  clearTimeout(timerId)
  postDownloadBatchFinalizeTimers.delete(postId)
}

/**
 * post-contentバッチの遅延確定タイマーを解除します。
 */
const clearPostContentDownloadBatchFinalizeTimer = (key: PostContentBatchKey): void => {
  const timerId = postContentDownloadBatchFinalizeTimers.get(key)
  if (timerId == null) return
  clearTimeout(timerId)
  postContentDownloadBatchFinalizeTimers.delete(key)
}

/**
 * 投稿バッチの遅延確定タイマーを設定します。
 */
const schedulePostDownloadBatchAutoFinalize = (postId: number): void => {
  clearPostDownloadBatchFinalizeTimer(postId)
  const timerId = setTimeout(() => {
    postDownloadBatchFinalizeTimers.delete(postId)
    maybeCompletePostDownloadBatch(postId).catch(err => { console.error(err) })
  }, BATCH_INACTIVITY_TIMEOUT_MS + 100)
  postDownloadBatchFinalizeTimers.set(postId, timerId)
}

/**
 * post-contentバッチの遅延確定タイマーを設定します。
 */
const schedulePostContentDownloadBatchAutoFinalize = (key: PostContentBatchKey): void => {
  clearPostContentDownloadBatchFinalizeTimer(key)
  const timerId = setTimeout(() => {
    postContentDownloadBatchFinalizeTimers.delete(key)
    maybeCompletePostContentDownloadBatch(key).catch(err => { console.error(err) })
  }, BATCH_INACTIVITY_TIMEOUT_MS + 100)
  postContentDownloadBatchFinalizeTimers.set(key, timerId)
}

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
  touchPostDownloadBatch(batch)
  persistActiveBatches().catch(err => { console.error(err) })

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
  touchPostContentDownloadBatch(batch)
  persistActiveBatches().catch(err => { console.error(err) })

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
 * 指定downloadIdの終端状態を解決します。
 */
const resolveDownloadTerminalState = async (downloadId: number): Promise<'complete' | 'interrupted' | null> => {
  const results = await browser.downloads.search({ id: downloadId })
  const latest = results[0]
  if (!latest) return 'interrupted'
  if (latest.state === 'complete' || latest.state === 'interrupted') return latest.state
  return null
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
      touchPostDownloadBatch(postBatch)
      clearPostDownloadBatchFinalizeTimer(postId)
    }
  }

  if (postId != null && contentId != null) {
    const key = postContentBatchKey(postId, contentId)
    const contentBatch = activePostContentDownloadBatches.get(key)
    if (contentBatch) {
      contentBatch.downloadIds.add(downloadId)
      downloadIdToPostContentBatchKeyMap.set(downloadId, key)
      touchPostContentDownloadBatch(contentBatch)
      clearPostContentDownloadBatchFinalizeTimer(key)
    }
  }

  persistActiveBatches().catch(err => { console.error(err) })
  settleAlreadyCompletedDownload(downloadId).catch(err => { console.error(err) })
}

/**
 * 投稿バッチの失敗件数を加算します。
 */
const increasePostDownloadFailure = (postId: number): void => {
  const batch = activePostDownloadBatches.get(postId)
  if (!batch) return
  batch.failedCount += 1
  touchPostDownloadBatch(batch)
  persistActiveBatches().catch(err => { console.error(err) })
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
  touchPostContentDownloadBatch(batch)
  persistActiveBatches().catch(err => { console.error(err) })
  maybeCompletePostContentDownloadBatch(key).catch(err => { console.error(err) })
}

/**
 * 投稿バッチの完了条件を満たした場合に状態を確定します。
 */
const maybeCompletePostDownloadBatch = async (postId: number): Promise<void> => {
  const batch = activePostDownloadBatches.get(postId)
  if (!batch) return
  if (batch.downloadIds.size > 0) return
  if (!batch.endSignaled && !isBatchInactive(batch.lastActivityAt)) {
    schedulePostDownloadBatchAutoFinalize(postId)
    return
  }

  if (batch.failedCount > 0) {
    await markPostDownloadFailed(postId, batch.failedCount)
  } else {
    await markPostDownloadSucceeded(postId)
  }

  clearPostDownloadBatchFinalizeTimer(postId)
  clearPostDownloadBatchMappings(batch)
  activePostDownloadBatches.delete(postId)
  await persistActiveBatches()
}

/**
 * post-contentバッチの完了条件を満たした場合に状態を確定します。
 */
const maybeCompletePostContentDownloadBatch = async (key: PostContentBatchKey): Promise<void> => {
  const batch = activePostContentDownloadBatches.get(key)
  if (!batch) return
  if (batch.downloadIds.size > 0) return
  if (!batch.endSignaled && !isBatchInactive(batch.lastActivityAt)) {
    schedulePostContentDownloadBatchAutoFinalize(key)
    return
  }

  if (batch.failedCount > 0) {
    await markPostContentDownloadFailed(batch.postId, batch.contentId, batch.failedCount)
  } else {
    await markPostContentDownloadSucceeded(batch.postId, batch.contentId)
  }

  clearPostContentDownloadBatchFinalizeTimer(key)
  clearPostContentDownloadBatchMappings(batch)
  activePostContentDownloadBatches.delete(key)
  await persistActiveBatches()
}

/**
 * 投稿バッチを開始し、状態をDL中へ更新します。
 */
const startPostDownloadBatch = async (postId: number): Promise<void> => {
  clearPostDownloadBatchFinalizeTimer(postId)
  const existing = activePostDownloadBatches.get(postId)
  if (existing) {
    clearPostDownloadBatchMappings(existing)
  }

  activePostDownloadBatches.set(postId, {
    postId,
    downloadIds: new Set<number>(),
    endSignaled: false,
    failedCount: 0,
    lastActivityAt: nowIsoString()
  })
  schedulePostDownloadBatchAutoFinalize(postId)
  await persistActiveBatches()
  await markPostDownloadStarted(postId)
}

/**
 * 投稿バッチの入力終了を通知します。
 */
const endPostDownloadBatch = async (postId: number): Promise<void> => {
  const batch = activePostDownloadBatches.get(postId)
  if (!batch) return
  batch.endSignaled = true
  touchPostDownloadBatch(batch)
  await persistActiveBatches()
  await maybeCompletePostDownloadBatch(postId)
}

/**
 * post-contentバッチを開始し、状態をDL中へ更新します。
 */
const startPostContentDownloadBatch = async (postId: number, contentId: number): Promise<void> => {
  const key = postContentBatchKey(postId, contentId)
  clearPostContentDownloadBatchFinalizeTimer(key)
  const existing = activePostContentDownloadBatches.get(key)
  if (existing) {
    clearPostContentDownloadBatchMappings(existing)
  }

  activePostContentDownloadBatches.set(key, {
    postId,
    contentId,
    downloadIds: new Set<number>(),
    endSignaled: false,
    failedCount: 0,
    lastActivityAt: nowIsoString()
  })
  schedulePostContentDownloadBatchAutoFinalize(key)
  await persistActiveBatches()
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
  touchPostContentDownloadBatch(batch)
  await persistActiveBatches()
  await maybeCompletePostContentDownloadBatch(key)
}

/**
 * 投稿バッチ内downloadIdの状態を照合し、終端済みを取り込みます。
 */
const reconcilePostDownloadBatch = async (postId: number): Promise<void> => {
  const batch = activePostDownloadBatches.get(postId)
  if (!batch) return

  let changed = false
  for (const downloadId of [...batch.downloadIds]) {
    const terminalState = await resolveDownloadTerminalState(downloadId)
    if (terminalState == null) continue

    batch.downloadIds.delete(downloadId)
    downloadIdToPostIdMap.delete(downloadId)
    if (terminalState === 'interrupted') {
      batch.failedCount += 1
    }
    changed = true
  }

  if (changed) {
    touchPostDownloadBatch(batch)
    await persistActiveBatches()
  }
  await maybeCompletePostDownloadBatch(postId)
}

/**
 * post-contentバッチ内downloadIdの状態を照合し、終端済みを取り込みます。
 */
const reconcilePostContentDownloadBatch = async (key: PostContentBatchKey): Promise<void> => {
  const batch = activePostContentDownloadBatches.get(key)
  if (!batch) return

  let changed = false
  for (const downloadId of [...batch.downloadIds]) {
    const terminalState = await resolveDownloadTerminalState(downloadId)
    if (terminalState == null) continue

    batch.downloadIds.delete(downloadId)
    downloadIdToPostContentBatchKeyMap.delete(downloadId)
    if (terminalState === 'interrupted') {
      batch.failedCount += 1
    }
    changed = true
  }

  if (changed) {
    touchPostContentDownloadBatch(batch)
    await persistActiveBatches()
  }
  await maybeCompletePostContentDownloadBatch(key)
}

/**
 * 全アクティブバッチを復元・照合し、完了可能なものを確定します。
 */
const reconcileActiveBatches = async (): Promise<void> => {
  for (const postId of [...activePostDownloadBatches.keys()]) {
    await reconcilePostDownloadBatch(postId)
  }
  for (const key of [...activePostContentDownloadBatches.keys()]) {
    await reconcilePostContentDownloadBatch(key)
  }
}

const restoreActiveBatchesPromise = (async () => {
  await restoreActiveBatches()
  await reconcileActiveBatches()
})().catch(err => { console.error(err) })

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
  const downloadId = delta.id
  const terminalState = delta.state.current
  if (terminalState !== 'complete' && terminalState !== 'interrupted') return

  restoreActiveBatchesPromise
    .then(() => {
      handleDownloadTerminalState(downloadId, terminalState)
    })
    .catch(err => { console.error(err) })
})

browser.runtime.onMessage.addListener(async (msg: RuntimeMessage) => {
  await restoreActiveBatchesPromise

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
