import { browser } from 'webextension-polyfill-ts'
import { Backnumber } from '../types/backnumber'
import { fetchBacknumberData } from './modules/backnumberPage'
import { injectBtn } from './modules/dom'
import { getImgList } from './modules/img'
import { fetchPostData } from './modules/postPage'

const urlToExt = (url: string): string => {
  const matchedFileName = url.match(/^(?:[^:/?#]+:)?(?:\/\/[^/?#]*)?(?:([^?#]*\/)([^/?#]*))?(\?[^#]*)?(?:#.*)?$/) ?? []
  const [, dir, fileName, query] = matchedFileName.map(match => match ?? '')

  const matchedExt = fileName.match(/^(.+?)(\.[^.]+)?$/) ?? []
  const [, name, ext] = matchedExt.map(match => match ?? '')

  return ext
}

const backnumberToPostIdAndTitle = (data: Backnumber, contentId: number) => {
  const backnumberContents = data.backnumber_contents.filter(v => v.id === contentId)[0]
  return `${backnumberContents.parent_post.url.split('/').pop()}_${backnumberContents.parent_post.title}`
}

const contentIdToTitle = () => {
  // TODO contentごとのタイトルを取得する
}

export const saveImages = async (event: MouseEvent): Promise<void> => {
  const contentIdAttr = (event.target as HTMLElement).attributes.getNamedItem('content-id')
  if (!contentIdAttr) return
  const contentId = contentIdAttr.value
  const data = /.+\/backnumbers.*/.test(location.href)
    ? await fetchBacknumberData()
    : await fetchPostData()
  console.log(contentId)

  const filepath = 'post_contents' in data
    ? `${data.fanclub.id}_${data.fanclub.fanclub_name_with_creator_name}/${data.id}_${data.title}/${contentId}`
    : `${data.fanclub.id}_${data.fanclub.fanclub_name_with_creator_name}/${backnumberToPostIdAndTitle(data, Number(contentId))}/${contentId}`

  const imgList = getImgList(data, Number(contentId))
  for (let i = 0; i < imgList.length; i++) {
    const url = imgList[i].url
    const filename = imgList[i].name + urlToExt(url)
    const sendData = {
      msg: 'download',
      url: url,
      filepath: filepath,
      filename: filename,
    }

    browser.runtime.sendMessage(sendData)
  }
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
