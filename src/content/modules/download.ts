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
export const fileDownload = (url: string, filepath: string, filename: string): Promise<void> => {
  const sendData = {
    msg: 'download',
    url: url,
    // ガチャコン絵文字が入るとエラーになるので分割します
    filepath: filepath.replaceAll('\u200d', ''),
    filename: filename
  }
  return browser.runtime.sendMessage(sendData)
}
