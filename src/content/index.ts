import sanitize from 'sanitize-filename'
import { browser } from 'webextension-polyfill-ts'
import { PostData } from '../types'
import { Backnumber } from '../types/backnumber'
import { fetchBacknumberData } from './modules/backnumberPage'
import { injectGalleryAllDlBtn, injectPageAllContentsDlBtn } from './modules/dom'
import { fileDownload } from './modules/download'
import { getImgList, getPhotoContents } from './modules/img'
import { downloadEverythingFromPost, fetchPostData } from './modules/postPage'

export const urlToExt = (url: string): string => {
  const matchedFileName = url.match(/^(?:[^:/?#]+:)?(?:\/\/[^/?#]*)?(?:([^?#]*\/)([^/?#]*))?(\?[^#]*)?(?:#.*)?$/) ?? []
  const [, , fileName] = matchedFileName.map(match => match ?? '')

  const matchedExt = fileName.match(/^(.+?)(\.[^.]+)?$/) ?? []
  const [, , ext] = matchedExt.map(match => match ?? '')

  return ext
}

const backnumberToPostIdAndTitle = (data: Backnumber, contentId: number) => {
  const backnumberContents = data.backnumber_contents.filter(v => v.id === contentId)[0]
  return sanitize(`${backnumberContents.parent_post.url.split('/').pop()}_${backnumberContents.parent_post.title}`)
}

export const idAndTitlePath = (id: number | string, title: string) => {
  return title !== '' ? sanitize(`${id}_${title}`) : sanitize(`${id}`)
}

export const contentIdToTitle = (data: PostData | Backnumber, contentId: number) => {
  if ('post_contents' in data) {
    const content = data.post_contents.filter(v => v.id === contentId)[0]
    return content.title == null ? '' : `${content.title}`
  } else if ('backnumber_contents' in data) {
    const content = data.backnumber_contents.filter(v => v.id === contentId)[0]
    return content.title == null ? '' : `${content.title}`
  } else {
    return ''
  }
}

export const saveImages = async (event: MouseEvent): Promise<void> => {
  const contentIdAttr = (event.target as HTMLElement).attributes.getNamedItem('content-id')
  if (!contentIdAttr) return
  const contentId = contentIdAttr.value
  const data = /.+\/backnumbers.*/.test(location.href)
    ? await fetchBacknumberData()
    : await fetchPostData()

  const filepath = 'post_contents' in data
    ? `${idAndTitlePath(data.fanclub.id, data.fanclub.fanclub_name_with_creator_name)}/${idAndTitlePath(data.id, data.title)}/${idAndTitlePath(contentId, contentIdToTitle(data, Number(contentId)))}`
    : `${idAndTitlePath(data.fanclub.id, data.fanclub.fanclub_name_with_creator_name)}/${backnumberToPostIdAndTitle(data, Number(contentId))}/${idAndTitlePath(contentId, contentIdToTitle(data, Number(contentId)))}`

  const photoContents = getPhotoContents(data, Number(contentId))
  const imgList = getImgList(photoContents)
  for (let i = 0; i < imgList.length; i++) {
    const url = imgList[i].url
    const filename = imgList[i].name + urlToExt(url)
    fileDownload(url, filepath, filename)
  }
}

const elementIdTocontentId = (id: string) => {
  return id.split('post-content-id-')[1]
}

const main = () => {
  const target = document.getElementById('page')
  if (!target) return

  let postBtnFlag = false
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // 投稿ページ全体一括保存ボタン作成
      if (!postBtnFlag && (mutation.target as HTMLElement).className.includes('post-btns')) {
        const postBtnEl = document.getElementsByClassName('post-btns')
        injectPageAllContentsDlBtn((postBtnEl[0] as HTMLElement))
        postBtnFlag = true
      }

      // 対象のElementが見つかるまでループ
      if ((mutation.target as HTMLElement).className.includes('content-block')) {
        // ギャラリーの一括保存ボタン作成
        const galleryElements = document.getElementsByClassName('content-block type-photo-gallery ng-scope')
        for (let i = 0; i < galleryElements.length; i++) {
          const element = galleryElements[i] as HTMLElement
          const elId = element.closest('.post-content-inner')?.id
          if (elId) {
            const contentId = elementIdTocontentId(elId)
            injectGalleryAllDlBtn(element, contentId)
          }
        }

        // 対象Elementが見つかりボタンを作成し終わったら終了
        observer.disconnect()
        break
      }
    }
  })

  const config = {
    characterData: false,
    childList: true,
    subtree: true
  }

  observer.observe(target, config)
}
main()

// メッセージ受信で一括ダウンロード
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.text === 'download_everything_from_a_post') {
    await downloadEverythingFromPost()
  }
})
