import JSZIP from 'jszip'
import ky from 'ky'
import sanitize from 'sanitize-filename'
import { ImgContents, ImgData, PostData, PostDataResponse } from '../types/index'

const fetchPostData = async () => {
  const id = location.pathname.split('/posts/')[1]
  const json = await ky.get(`https://fantia.jp/api/v1/posts/${id}`).json<PostDataResponse>()

  return json
}

const getImgList = (data: PostData, cnt: number) => {
  const ary = []
  const photoContents = data.post_contents.filter(v => v.category === 'photo_gallery')[cnt].post_content_photos

  for (let i = 0; i < photoContents.length; i++) {
    ary.push({ name: photoContents[i].id, url: photoContents[i].url.original })
  }

  return ary
}

const mimeToExtension = (mime: string) => {
  const mimeExtension: {[index: string]: string} = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
  }
  return mimeExtension[mime]
}

const getImgListContents = async (urls: ImgData[]) => {
  const promises = urls.map(async url => {
    const res = await ky.get(url.url)
    const content = await res.blob()

    const name = String(url.name) + mimeToExtension(content.type)
    return { name, content }
  })

  const pairs = []

  for (const promise of promises) {
    pairs.push(await promise)
  }

  return pairs
}

const generateZip = (imgListContents: ImgContents[], name: string) => {
  const zip = new JSZIP()
  const folder = zip.folder(sanitize(name))
  imgListContents.forEach(content => {
    if (folder) {
      folder.file(sanitize(content.name), content.content)
    }
  })
  return zip.generateAsync({ type: 'blob' })
}

const saveImages = async (event: MouseEvent) => {
  const btnCount = (event.target as HTMLElement).attributes.getNamedItem('gallery-count')
  if (!btnCount) return
  const data = await fetchPostData()
  const imgList = getImgList(data.post, Number(btnCount.value))
  const imgListContents = await getImgListContents(imgList)
  const name = `${data.post.id}_${btnCount.value}`
  const zip = await generateZip(imgListContents, name)

  const a = document.createElement('a')
  a.href = URL.createObjectURL(zip)
  a.download = `${name}.zip`

  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

let num = 0

const btnCreate = () => {
  const btn = document.createElement('button')
  btn.textContent = '一括DL'
  btn.setAttribute('style', 'display: block;margin: 20px auto;padding: 20px 40px;background-color: #22c283;border: none;color: #fff;border-radius: 10px;')
  btn.setAttribute('gallery-count', String(num))
  num++
  btn.onclick = saveImages
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
