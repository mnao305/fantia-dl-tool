import { browser } from 'webextension-polyfill-ts'


// interface dpwmloadSendData {
//   msg: 'download',
//   url: string,
//   filepath: string,
//   filename: string,
// }

/**
 * ダウンロードする予定のリストを作ります。
 * fileDownload()に受け渡せるオブジェクトの配列を返します。
 */
// const createDownloadList = (): dpwmloadSendData[] => {
// TODO
//   return []
// }

/**
 * backgroundのdownloads.downloadを呼び出します。
 */
export const fileDownload = (url: string, filepath: string, filename: string): void => {
  const sendData = {
    msg: 'download',
    url: url,
    filepath: filepath,
    filename: filename,
  }
  browser.runtime.sendMessage(sendData)
}
