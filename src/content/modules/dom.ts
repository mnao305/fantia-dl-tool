import { browser } from 'webextension-polyfill-ts'
import { saveImages } from '../index'

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
