import { PostContentBlog } from '../../types'
import { Blog } from '../../types/blog'
import { urlToExt } from '../index'
import { fileDownload } from './download'

/**
 * blogコンテンツ内の画像/テキストDLタスクを生成します。
 */
export const blogDL = (
  postContent: PostContentBlog,
  filepath: string,
  postId: number | null = null,
  contentId: number | null = null
): Promise<void>[] => {
  const json = JSON.parse(postContent.comment) as Blog
  const blog = json.ops
  const downloadTasks: Promise<void>[] = []

  let blogText = ''

  for (let i = 0; i < blog.length; i++) {
    const element = blog[i]
    if (typeof element.insert !== 'string' && element.insert.fantiaImage) {
      // Fantiaの画像
      const url = `https://fantia.jp/${element.insert.fantiaImage.original_url}`
      downloadTasks.push(fileDownload(
        url,
        filepath,
        element.insert.fantiaImage.id + urlToExt(element.insert.fantiaImage.url),
        postId,
        contentId
      ))
    } else if (typeof element.insert !== 'string' && element.insert.image) {
      // 外部を参照している画像
      downloadTasks.push(fileDownload(
        element.insert.image,
        filepath,
        String(i) + urlToExt(element.insert.image),
        postId,
        contentId
      ))
    } else if (typeof element.insert === 'string') {
      // テキスト
      // TODO: リンクなどへの対応。Markdown化するかは検討
      blogText += element.insert + '\n'
    }
  }

  // テキストのダウンロード
  if (blogText !== '') {
    downloadTasks.push(fileDownload(
      `data:text/plain;charset=UTF-8,${blogText}`,
      filepath,
      'text.txt',
      postId,
      contentId
    ))
  }

  return downloadTasks
}
