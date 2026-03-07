import { browser } from 'webextension-polyfill-ts'

/**
 * backgroundのdownloads.downloadを呼び出します。
 */
export const fileDownload = (
  url: string,
  filepath: string,
  filename: string,
  postId: number | null = null,
  contentId: number | null = null
): Promise<void> => {
  const sendData = {
    msg: 'download',
    url,
    // ガチャコン絵文字・`~`が入るとエラーになるので置換。
    filepath: filepath.replaceAll('\u200d', '').replaceAll('~', '～'),
    filename,
    postId,
    contentId
  }
  return browser.runtime.sendMessage(sendData)
}

/**
 * 投稿の一括DLバッチ開始をbackgroundへ通知します。
 */
export const startPostDownloadBatch = (postId: number): Promise<void> => {
  return browser.runtime.sendMessage({
    msg: 'post_download_batch_start',
    postId
  })
}

/**
 * 投稿の一括DLバッチ終了をbackgroundへ通知します。
 */
export const endPostDownloadBatch = (postId: number): Promise<void> => {
  return browser.runtime.sendMessage({
    msg: 'post_download_batch_end',
    postId
  })
}

/**
 * post-contentのDLバッチ開始をbackgroundへ通知します。
 */
export const startPostContentDownloadBatch = (postId: number, contentId: number): Promise<void> => {
  return browser.runtime.sendMessage({
    msg: 'post_content_download_batch_start',
    postId,
    contentId
  })
}

/**
 * post-contentのDLバッチ終了をbackgroundへ通知します。
 */
export const endPostContentDownloadBatch = (postId: number, contentId: number): Promise<void> => {
  return browser.runtime.sendMessage({
    msg: 'post_content_download_batch_end',
    postId,
    contentId
  })
}
