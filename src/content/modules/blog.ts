import { PostContentBlog } from '../../types'
import { Blog } from '../../types/blog'
import { urlToExt } from '../index'
import { fileDownload } from './download'

export const blogDL = (postContent: PostContentBlog, filepath: string): void => {
  const json = JSON.parse(postContent.comment) as Blog
  const blog = json.ops
  for (let i = 0; i < blog.length; i++) {
    const element = blog[i]
    if (typeof element.insert !== 'string') {
      const url = `https://fantia.jp/${element.insert.fantiaImage.original_url}`
      fileDownload(url, filepath, element.insert.fantiaImage.id + urlToExt(element.insert.fantiaImage.url))
    }
  }
  // TODO: テキストのダウンロード
}
