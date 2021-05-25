import { browser, Downloads } from 'webextension-polyfill-ts'

export const download = (url: string, filename: string, filepath: string): void => {
  const options: Downloads.DownloadOptionsType = {
    url: url,
    filename: `fantia/${filepath}/${filename}`,
    saveAs: false,
    conflictAction: 'overwrite',
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
