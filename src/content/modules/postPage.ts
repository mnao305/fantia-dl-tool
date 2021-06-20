import ky from 'ky'
import { idAndTitlePath, contentIdToTitle, urlToExt } from '../index'
import { PostData, PostDataResponse } from '../../types/index'
import { getImgList } from './img'
import { fileDownload } from './download'

export const fetchPostData = async (): Promise<PostData> => {
  const id = location.pathname.split('/posts/')[1]
  const json = await ky.get(`https://fantia.jp/api/v1/posts/${id}`).json<PostDataResponse>()

  return json.post
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const downloadEverythingFromPost = async (): Promise<void> => {
  const data = await fetchPostData()

  // post_contents内をループしてダウンロードしていく
  for (const postContent of data.post_contents) {
    const contentId = postContent.id
    const filepath = `${idAndTitlePath(data.fanclub.id, data.fanclub.fanclub_name_with_creator_name)}/${idAndTitlePath(data.id, data.title)}/${idAndTitlePath(contentId, contentIdToTitle(data, Number(contentId)))}`

    if (postContent.category === 'photo_gallery') {
      const imgList = getImgList(postContent.post_content_photos)
      for (let i = 0; i < imgList.length; i++) {
        if (i % 10 === 0) await sleep(500)
        const url = imgList[i].url
        const filename = imgList[i].name + urlToExt(url)
        fileDownload(url, filepath, filename)
      }
    } else if (postContent.category === 'file') {
      const url = 'https://fantia.jp/' + postContent.download_uri
      fileDownload(url, filepath, postContent.filename)
      await sleep(500)
    }
  }
}
