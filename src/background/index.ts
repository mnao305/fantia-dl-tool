import { browser, Downloads } from 'webextension-polyfill-ts'

/**
 * 与えられた文字列からunicode制御文字を取り除く
 */
const removeControlCharacters = (str: string) => {
  // eslint-disable-next-line no-control-regex
  return str.replaceAll(/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
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

export const download = (url: string, filename: string, filepath: string): void => {
  const options: Downloads.DownloadOptionsType = {
    url,
    filename: `fantia/${removeControlCharacters(filepath)}/${removeControlCharacters(filename)}`,
    saveAs: false,
    conflictAction: 'overwrite'
  }

  browser.downloads.download(options)
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
