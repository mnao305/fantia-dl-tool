import { browser } from 'webextension-polyfill-ts'
import { saveImages } from '../index'

/**
 * ダウンロードアイコンを返す
 * @param {number} iconSize アイコンサイズをpxの数値で指定する
 */
const createDownloadIcon = (iconSize: number) => {
  return (
    `<svg style="width:${iconSize}px;height:${iconSize}px;margin-right:5px;" viewBox="0 0 24 24">
      <path fill="currentColor" d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
    </svg>`
  )
}

/**
 * 画像ギャラリーを一括保存するボタンを作る
 */
const createGalleryAllDlBtn = (contentId: string): HTMLButtonElement => {
  const btn = document.createElement('button')
  btn.textContent = browser.i18n.getMessage('download_all')
  btn.setAttribute('style', 'display: block;margin: 20px auto;padding: 20px 40px;background-color: #22c283;border: none;color: #fff;border-radius: 10px;')
  btn.setAttribute('content-id', contentId)
  btn.onclick = saveImages
  return btn
}

/**
 * 画像ギャラリーを一括保存するボタンを配置する
 */
export const injectGalleryAllDlBtn = (el: HTMLElement, contentId: string): void => {
  const btn = createGalleryAllDlBtn(contentId)
  el.appendChild(btn)
}

/**
 * ページコンテンツを全てDLするボタンを作る
 */
const createPageAllContentsDlBtn = (): HTMLButtonElement => {
  const btn = document.createElement('button')
  btn.innerHTML = `${createDownloadIcon(16)}<span>${browser.i18n.getMessage('download_all')}</span>`
  btn.setAttribute('style', 'margin-left: 5px; border: 1px solid #dddddd; background-color: #ffffff; color: #999999; display: inline-flex; align-items: center;')
  btn.className = 'btn btn-sm'

  btn.onmouseover = () => {
    btn.setAttribute('style', 'margin-left: 5px; border: 1px solid #dddddd; background-color: #ffffff; color: #22c283; display: inline-flex; align-items: center;')
  }

  btn.onmouseout = () => {
    btn.setAttribute('style', 'margin-left: 5px; border: 1px solid #dddddd; background-color: #ffffff; color: #999999; display: inline-flex; align-items: center;')
  }
  return btn
}

const createPostDlStatusLabel = (): HTMLSpanElement => {
  const statusLabel = document.createElement('span')
  statusLabel.setAttribute('style', 'font-size: 12px; color: #999999; display: inline-flex; align-items: center; white-space: nowrap;')
  return statusLabel
}

export type PageAllContentsDlElements = {
  button: HTMLButtonElement
  statusLabel: HTMLSpanElement
}

/**
 * ページコンテンツを全てDLするボタンを配置する
 */
export const injectPageAllContentsDlBtn = (el: HTMLElement): PageAllContentsDlElements => {
  const btn = createPageAllContentsDlBtn()
  const statusLabel = createPostDlStatusLabel()
  el.appendChild(btn)
  return {
    button: btn,
    statusLabel
  }
}
