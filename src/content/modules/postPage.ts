import { idAndTitlePath, contentIdToTitle, urlToExt } from '../index'
import { BlogComment, PostData, PostDataResponse } from '../../types/index'
import { getImgList } from './img'
import { fileDownload } from './download'
import { blogDL } from './blog'
import { get } from './api'

export const fetchPostData = async (): Promise<PostData> => {
  const id = location.pathname.split('/posts/')[1]
  const json = await get<PostDataResponse>(`https://fantia.jp/api/v1/posts/${id}`)

  return json.post
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const downloadEverythingFromPost = async (): Promise<void> => {
  const data = await fetchPostData()

  const baseFilepath = `${idAndTitlePath(data.fanclub.id, data.fanclub.fanclub_name_with_creator_name)}/${idAndTitlePath(data.id, data.title)}`

  if (data.thumb?.original) {
    // サムネイル画像がある場合
    const ext = data.thumb.original.split('.').at(-1)
    fileDownload(data.thumb.original, baseFilepath, `thumbnail.${ext}`)
  }

  if (data.comment) {
    // リード文がある場合
    const text = `data:text/plain;charset=UTF-8,${data.comment}`
    fileDownload(text, baseFilepath, 'text.txt')

  }

  // リード文に存在する画像のダウンロード
  if (data.blog_comment) {
    try {
      const blogComment = JSON.parse(data.blog_comment) as BlogComment
      const ops = blogComment.ops
      const imgList = ops.flatMap(v =>
        typeof v.insert === "object" && v.insert?.image ? v.insert.image :  []
      )

      // NOTE: 外部画像の可能性あり
      for (let i = 0; i < imgList.length; i++) {
        if (i % 10 === 0) await sleep(500)
        const url = imgList[i]
        const filename = `image${i}${urlToExt(url)}`
        fileDownload(url, baseFilepath, filename).catch(e => {
          console.error(e)
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  // post_contents内をループしてダウンロードしていく
  for (const postContent of data.post_contents) {
    // 表示できるもの以外はスキップします
    if (postContent.visible_status !== 'visible') continue

    const contentId = postContent.id
    const filepath = `${baseFilepath}/${idAndTitlePath(contentId, contentIdToTitle(data, Number(contentId)))}`

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
      if (postContent.comment) {
        // 文字がなにか書いてある場合
        const text = `data:text/plain;charset=UTF-8,${postContent.comment}`
        fileDownload(text, filepath, 'text.txt')
      }
      await sleep(500)
    } else if (postContent.category === 'text') {
      const text = `data:text/plain;charset=UTF-8,${postContent.comment}`
      fileDownload(text, filepath, 'text.txt')
    } else if (postContent.category === 'blog') {
      blogDL(postContent, filepath)
    }
  }
}
