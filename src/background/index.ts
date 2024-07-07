import { browser, Downloads } from 'webextension-polyfill-ts'
import { Settings } from '../options'

/**
 * 与えられた文字列からunicode制御文字を取り除く
 */
const removeControlCharacters = (str: string) => {
  // eslint-disable-next-line no-control-regex
  return str.replaceAll(/[\u0000-\u001F\u007F-\u009F\u061C\u200b\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
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
  return `${fanclubName}_${titleName}_${removeControlCharacters(filename)}`
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
    : `${removeControlCharacters(filepath)}/${removeControlCharacters(
        filename
      )}`

  const options: Downloads.DownloadOptionsType = {
    url,
    // スペースは削除
    filename: `fantia/${downloadFilename}`.replaceAll(' ', '').replaceAll('　', ''),
    saveAs: false,
    conflictAction: 'overwrite'
  }
  browser.downloads.download(options).catch((e) => {
    console.error(e, options)
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
