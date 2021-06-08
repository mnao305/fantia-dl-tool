import { browser } from 'webextension-polyfill-ts'
import { saveImages } from '../index'

export const btnCreate = (contentId: string) => {
  const btn = document.createElement('button')
  btn.textContent = browser.i18n.getMessage('download_all')
  btn.setAttribute('style', 'display: block;margin: 20px auto;padding: 20px 40px;background-color: #22c283;border: none;color: #fff;border-radius: 10px;')
  btn.setAttribute('content-id', contentId)
  btn.onclick = saveImages
  return btn
}

export const injectBtn = (el: HTMLElement, contentId: string) => {
  const btn = btnCreate(contentId)
  el.appendChild(btn)
}
