import { browser } from 'webextension-polyfill-ts'
import ky from 'ky'

const fetchPostData = async () => {
  const id = location.pathname.split('/posts/')[1]
  const json = await ky.get(`https://fantia.jp/api/v1/posts/${id}`).json()

  console.log(json)
}

const btnCreate = () => {
  const btn = document.createElement('button')
  btn.textContent = '一括DL'
  btn.setAttribute('style', 'display: block;margin: 20px auto;')
  btn.onclick = fetchPostData
  return btn
}

const injectBtn = (el: HTMLElement) => {
  const btn = btnCreate()
  el.appendChild(btn)
}

const main = () => {
  const target = document.getElementById('page')
  if (!target) return
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if ((mutation.target as HTMLElement).className === 'content-block type-photo-gallery ng-scope') {
        injectBtn((mutation.target as HTMLElement))
        observer.disconnect()
      }
    })
  })

  const config = {
    characterData: false,
    childList: true,
    subtree: true,
  }

  observer.observe(target, config)
}
main()
