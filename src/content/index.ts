import JSZIP from 'jszip'
import sanitize from 'sanitize-filename'
import { ImgContents } from '../types/index'
import { fetchBacknumberData } from './modules/backnumberPage'
import { injectBtn } from './modules/dom'
import { getImgList, getImgListContents } from './modules/img'
import { fetchPostData } from './modules/postPage'

// TODO 削除予定
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

export const saveImages = async (event: MouseEvent): Promise<void> => {
  const contentId = (event.target as HTMLElement).attributes.getNamedItem('content-id')
  if (!contentId) return
  const data = /.+\/backnumbers.*/.test(location.href)
    ? await fetchBacknumberData()
    : await fetchPostData()

  const imgList = getImgList(data, Number(contentId.value))
  const imgListContents = await getImgListContents(imgList)
  const name = contentId.value
  const zip = await generateZip(imgListContents, name)

  const a = document.createElement('a')
  a.href = URL.createObjectURL(zip)
  a.download = `${name}.zip`

  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const elementIdTocontentId = (id: string) => {
  return id.split('post-content-id-')[1]
}

const main = () => {
  const target = document.getElementById('page')
  if (!target) return
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if ((mutation.target as HTMLElement).className === 'content-block type-photo-gallery ng-scope') {
        const elId = (mutation.target as HTMLElement).closest('.post-content-inner')?.id
        if (elId) {
          const contentId = elementIdTocontentId(elId)
          injectBtn((mutation.target as HTMLElement), contentId)
          observer.disconnect()
        }
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
