import { browser, Downloads } from 'webextension-polyfill-ts'
import { Settings } from '../options'

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

export const download = async (url: string, filename: string, filepath: string): Promise<void> => {
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
  browser.downloads.download(options).catch((e) => {
    console.error(e, options)
    alert(`ダウンロードに失敗しました。\n\n${e}\n${options.filename}`)
  }
  )
}

interface DownloadEventMsg {
  msg: 'download'
  url: string
  filepath: string
  filename: string
}

browser.runtime.onMessage.addListener((msg: DownloadEventMsg) => {
  if (msg.msg === 'download') {
    download(msg.url, msg.filename, msg.filepath)
  }
})
