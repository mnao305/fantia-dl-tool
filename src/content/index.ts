import { browser } from 'webextension-polyfill-ts'
import ky from 'ky'

const fetchPostData = async () => {
  const id = location.pathname.split('/posts/')[1]
  const json = await ky.get(`https://fantia.jp/api/v1/posts/${id}`).json()

  console.log(json)
}

const btnCreate = () => {
  const btn = document.createElement('button')
  btn.textContent = 'Save'
  btn.onclick = fetchPostData
  return btn
}

const injectBtn = () => {
  const btn = btnCreate()
  const el = document.getElementsByClassName('post-btns')
  el[0].appendChild(btn)
}

const main = () => {
  const target = document.getElementById('page')
  if (!target) return
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if ((mutation.target as HTMLElement).className === 'post-btns' && (mutation.addedNodes[0] as HTMLElement).nodeName === 'POST-LIKE-BUTTON') {
        injectBtn()
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

  window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded')
    injectBtn()
  })
}
main()
