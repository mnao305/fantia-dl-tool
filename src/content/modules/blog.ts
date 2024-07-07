import { PostContentBlog } from '../../types'
import { Blog } from '../../types/blog'
import { urlToExt } from '../index'
import { fileDownload } from './download'

export const blogDL = (postContent: PostContentBlog, filepath: string): void => {
  const json = JSON.parse(postContent.comment) as Blog
  const blog = json.ops

  let blogText = ''

  for (let i = 0; i < blog.length; i++) {
    const element = blog[i]
    if (typeof element.insert !== 'string' && element.insert.fantiaImage) {
      // Fantiaの画像
      const url = `https://fantia.jp/${element.insert.fantiaImage.original_url}`
      fileDownload(url, filepath, element.insert.fantiaImage.id + urlToExt(element.insert.fantiaImage.url))
    } else if (typeof element.insert !== 'string' && element.insert.image) {
      // 外部を参照している画像
      fileDownload(element.insert.image, filepath, String(i) + urlToExt(element.insert.image))
    } else if (typeof element.insert === 'string') {
      // テキスト
      // TODO: リンクなどへの対応。Markdown化するかは検討
      blogText += element.insert + '\n'
    }
  }

  // テキストのダウンロード
  if (blogText !== '') {
    fileDownload(`data:text/plain;charset=UTF-8,${blogText}`, filepath, 'text.txt')
  }
}
