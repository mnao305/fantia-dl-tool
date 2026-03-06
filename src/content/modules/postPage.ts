import { idAndTitlePath, contentIdToTitle, urlToExt } from '../index'
import { BlogComment, PostData, PostDataResponse } from '../../types/index'
import { getImgList } from './img'
import {
  endPostContentDownloadBatch,
  endPostDownloadBatch,
  fileDownload,
  startPostContentDownloadBatch,
  startPostDownloadBatch
} from './download'
import { blogDL } from './blog'
import { get } from './api'

const POST_DATA_CACHE_MAX_AGE_MS = 5000

type FetchPostDataOptions = {
  forceRefresh?: boolean
}

type PostDataCache = {
  postId: string
  data: PostData
  fetchedAt: number
}

type InflightPostDataRequest = {
  postId: string
  promise: Promise<PostData>
}

let postDataCache: PostDataCache | null = null
let inflightPostDataRequest: InflightPostDataRequest | null = null

/**
 * 現在のURLから投稿IDを抽出します。
 */
const getCurrentPostId = (): string => {
  const matched = location.pathname.match(/\/posts\/(\d+)/)
  if (!matched?.[1]) {
    throw new Error('failed_to_parse_post_id_from_location')
  }
  return matched[1]
}

/**
 * キャッシュが有効期限内かを判定します。
 */
const isPostDataCacheAlive = (cache: PostDataCache, postId: string): boolean => {
  if (cache.postId !== postId) return false
  return Date.now() - cache.fetchedAt <= POST_DATA_CACHE_MAX_AGE_MS
}

/**
 * 投稿APIを呼び出して投稿データを取得します。
 */
const requestPostData = async (postId: string): Promise<PostData> => {
  const json = await get<PostDataResponse>(`https://fantia.jp/api/v1/posts/${postId}`)
  return json.post
}

/**
 * 投稿データを取得します。同一投稿への短時間連続アクセスではキャッシュを返します。
 */
export const fetchPostData = async (options: FetchPostDataOptions = {}): Promise<PostData> => {
  const { forceRefresh = false } = options
  const postId = getCurrentPostId()

  if (!forceRefresh && postDataCache && isPostDataCacheAlive(postDataCache, postId)) {
    return postDataCache.data
  }

  if (!forceRefresh && inflightPostDataRequest && inflightPostDataRequest.postId === postId) {
    return await inflightPostDataRequest.promise
  }

  const request = requestPostData(postId)
  inflightPostDataRequest = {
    postId,
    promise: request
  }

  try {
    const post = await request
    postDataCache = {
      postId,
      data: post,
      fetchedAt: Date.now()
    }
    return post
  } finally {
    if (inflightPostDataRequest?.postId === postId) {
      inflightPostDataRequest = null
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 投稿ページのダウンロード可能コンテンツを一括で保存します。
 */
export const downloadEverythingFromPost = async (postData: PostData | null = null): Promise<void> => {
  const data = postData ?? await fetchPostData()
  const postLevelDownloadTasks: Promise<void>[] = []
  let hasStartedPostBatch = false

  try {
    await startPostDownloadBatch(data.id)
    hasStartedPostBatch = true
    const baseFilepath = `${idAndTitlePath(data.fanclub.id, data.fanclub.fanclub_name_with_creator_name)}/${idAndTitlePath(data.id, data.title)}`

    if (data.thumb?.original) {
      // サムネイル画像がある場合
      const ext = data.thumb.original.split('.').at(-1)
      postLevelDownloadTasks.push(fileDownload(data.thumb.original, baseFilepath, `thumbnail.${ext}`, data.id))
    }

    if (data.comment) {
      // リード文がある場合
      const text = `data:text/plain;charset=UTF-8,${data.comment}`
      postLevelDownloadTasks.push(fileDownload(text, baseFilepath, 'text.txt', data.id))
    }

    // リード文に存在する画像のダウンロード
    if (data.blog_comment) {
      try {
        const blogComment = JSON.parse(data.blog_comment) as BlogComment
        const ops = blogComment.ops
        const imgList = ops.flatMap(v =>
          typeof v.insert === 'object' && v.insert?.image ? v.insert.image : []
        )

        // NOTE: 外部画像の可能性あり
        for (let i = 0; i < imgList.length; i++) {
          if (i % 10 === 0) await sleep(500)
          const url = imgList[i]
          const filename = `image${i}${urlToExt(url)}`
          postLevelDownloadTasks.push(fileDownload(url, baseFilepath, filename, data.id))
        }
      } catch (e) {
        // ! リード文はあるがその中に画像がない場合、JSON形式では無く文字列になるためパースエラーになる
        console.warn(e)
      }
    }

    // post_contents内をループしてダウンロードしていく
    for (const postContent of data.post_contents) {
      // 表示できるもの以外はスキップします
      if (postContent.visible_status !== 'visible') continue

      const contentId = postContent.id
      const filepath = `${baseFilepath}/${idAndTitlePath(contentId, contentIdToTitle(data, Number(contentId)))}`
      const contentDownloadTasks: Promise<void>[] = []
      let hasStartedPostContentBatch = false

      try {
        await startPostContentDownloadBatch(data.id, contentId)
        hasStartedPostContentBatch = true
        if (postContent.category === 'photo_gallery') {
          const imgList = getImgList(postContent.post_content_photos)
          for (let i = 0; i < imgList.length; i++) {
            if (i % 10 === 0) await sleep(500)
            const url = imgList[i].url
            const filename = imgList[i].name + urlToExt(url)
            contentDownloadTasks.push(fileDownload(url, filepath, filename, data.id, contentId))
          }
        } else if (postContent.category === 'file') {
          const url = 'https://fantia.jp/' + postContent.download_uri
          contentDownloadTasks.push(fileDownload(url, filepath, postContent.filename, data.id, contentId))
          if (postContent.comment) {
            // 文字がなにか書いてある場合
            const text = `data:text/plain;charset=UTF-8,${postContent.comment}`
            contentDownloadTasks.push(fileDownload(text, filepath, 'text.txt', data.id, contentId))
          }
          await sleep(500)
        } else if (postContent.category === 'text') {
          const text = `data:text/plain;charset=UTF-8,${postContent.comment}`
          contentDownloadTasks.push(fileDownload(text, filepath, 'text.txt', data.id, contentId))
        } else if (postContent.category === 'blog') {
          contentDownloadTasks.push(...blogDL(postContent, filepath, data.id, contentId))
        }
        await Promise.allSettled(contentDownloadTasks)
      } finally {
        if (hasStartedPostContentBatch) {
          await endPostContentDownloadBatch(data.id, contentId)
        }
      }
    }

    await Promise.allSettled(postLevelDownloadTasks)
  } finally {
    if (hasStartedPostBatch) {
      await endPostDownloadBatch(data.id)
    }
  }
}
