import sanitize from 'sanitize-filename'
import { browser } from 'webextension-polyfill-ts'
import { PostData } from '../types'
import { Backnumber } from '../types/backnumber'
import { fetchBacknumberData } from './modules/backnumberPage'
import { injectGalleryAllDlBtn, injectPageAllContentsDlBtn } from './modules/dom'
import { endPostContentDownloadBatch, fileDownload, startPostContentDownloadBatch } from './modules/download'
import { getImgList, getPhotoContents } from './modules/img'
import { downloadEverythingFromPost, fetchPostData } from './modules/postPage'
import {
  PostDownloadStatus,
  resolvePostDownloadAttemptStatus,
  resolvePostDownloadStatus
} from './modules/postDownloadState'
import {
  PostContentDownloadStatus,
  resolvePostContentDownloadStatus
} from './modules/postContentDownloadState'

type PostDownloadStatusLabel = PostDownloadStatus | 'checking' | 'error'

let runPostDownload: null | (() => Promise<void>) = null
const DOWNLOAD_STATUS_POLL_TIMEOUT_MS = 5 * 60 * 1000

type PopupPostDownloadStatusResponse =
  | {
    ok: true
    postId: number
    title: string
    status: PostDownloadStatus
    downloadedAt: string | null
    updatedAt: string | null
    failedCount: number | null
  }
  | {
    ok: false
    error: string
  }

type PopupPostContentDownloadStatusResponse =
  | {
    ok: true
    postId: number
    contents: {
      contentId: number
      title: string
      category: string
      visibleStatus: string
      status: PostContentDownloadStatus
      downloadedAt: string | null
      failedCount: number | null
    }[]
  }
  | {
    ok: false
    error: string
  }

/**
 * 現在の投稿ステータスを取得してpopup向けのレスポンスに整形します。
 */
const getCurrentPostDownloadStatus = async (): Promise<PopupPostDownloadStatusResponse> => {
  try {
    const postData = await fetchPostData()
    const status = await resolvePostDownloadStatus(postData)
    return {
      ok: true,
      postId: postData.id,
      title: postData.title,
      status: status.status,
      downloadedAt: status.downloadedAt,
      updatedAt: postData.converted_at ?? null,
      failedCount: status.failedCount
    }
  } catch (e) {
    console.error(e)
    return {
      ok: false,
      error: 'failed_to_get_current_post_status'
    }
  }
}

/**
 * 現在の投稿内post-contentごとのDL状態を取得してpopup向けレスポンスに整形します。
 */
const getCurrentPostContentDownloadStatuses = async (): Promise<PopupPostContentDownloadStatusResponse> => {
  try {
    const postData = await fetchPostData()
    const contents = await Promise.all(postData.post_contents.map(async (postContent) => {
      const status = await resolvePostContentDownloadStatus(postData.id, postContent.id)
      return {
        contentId: postContent.id,
        title: postContent.title ?? '',
        category: postContent.category,
        visibleStatus: postContent.visible_status,
        status: status.status,
        downloadedAt: status.downloadedAt,
        failedCount: status.failedCount
      }
    }))

    return {
      ok: true,
      postId: postData.id,
      contents
    }
  } catch (e) {
    console.error(e)
    return {
      ok: false,
      error: 'failed_to_get_current_post_content_status'
    }
  }
}

/**
 * 投稿DLステータスラベルの文言と色を更新します。
 */
const setPostDownloadStatusLabel = (
  statusLabel: HTMLSpanElement,
  status: PostDownloadStatusLabel,
  downloadedAt: string | null = null,
  failedCount: number | null = null
) => {
  const statusMessageMap: Record<PostDownloadStatusLabel, string> = {
    checking: 'download_status_checking',
    not_downloaded: 'download_status_not_downloaded',
    downloading: 'download_status_downloading',
    downloaded: 'download_status_downloaded',
    updated_after_download: 'download_status_updated_after_download',
    download_failed: 'download_status_failed',
    error: 'download_status_error'
  }
  const statusColorMap: Record<PostDownloadStatusLabel, string> = {
    checking: '#999999',
    not_downloaded: '#999999',
    downloading: '#999999',
    downloaded: '#22c283',
    updated_after_download: '#f39c12',
    download_failed: '#e74c3c',
    error: '#e74c3c'
  }
  const messageKey = statusMessageMap[status]
  statusLabel.textContent = browser.i18n.getMessage(messageKey)
  statusLabel.style.color = statusColorMap[status]
  statusLabel.title = downloadedAt != null ? downloadedAt : ''
  if (status === 'download_failed' && failedCount != null) {
    statusLabel.title = `failed:${failedCount}`
  }
}

/**
 * 投稿DLステータスラベルを配置します。
 */
const mountPostDownloadStatusLabel = (statusLabel: HTMLSpanElement, postButtons: HTMLElement): void => {
  const postMeta = document.querySelector<HTMLElement>('.post-header .post-meta')
  if (postMeta) {
    statusLabel.style.marginLeft = '8px'
    postMeta.appendChild(statusLabel)
    return
  }

  // フォールバック: post-metaが取得できない場合は従来位置へ配置
  statusLabel.style.marginLeft = '8px'
  postButtons.appendChild(statusLabel)
}

/**
 * 投稿ステータス保存キーを生成します。
 */
const postDownloadStateStorageKey = (postId: number): string => `postDownloadState_${postId}`

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
  const downloadTasks: Promise<void>[] = []

  if ('post_contents' in data) {
    await startPostContentDownloadBatch(data.id, Number(contentId))
    try {
      for (let i = 0; i < imgList.length; i++) {
        const url = imgList[i].url
        const filename = imgList[i].name + urlToExt(url)
        downloadTasks.push(fileDownload(url, filepath, filename, data.id, Number(contentId)))
      }
      await Promise.allSettled(downloadTasks)
    } finally {
      await endPostContentDownloadBatch(data.id, Number(contentId))
    }
    return
  }

  for (let i = 0; i < imgList.length; i++) {
    const url = imgList[i].url
    const filename = imgList[i].name + urlToExt(url)
    downloadTasks.push(fileDownload(url, filepath, filename))
  }
  await Promise.allSettled(downloadTasks)
}

const elementIdTocontentId = (id: string) => {
  return id.split('post-content-id-')[1]
}

const main = () => {
  const target = document.getElementById('page')
  if (!target) return

  let postBtnFlag = false
  const observer = new MutationObserver(() => {
    // 投稿ページ全体一括保存ボタン作成
    if (!postBtnFlag && document.getElementsByClassName('post-btns').length > 0) {
      const postBtnEl = document.getElementsByClassName('post-btns')
      const postButtons = postBtnEl[0] as HTMLElement
      const { button, statusLabel } = injectPageAllContentsDlBtn(postButtons)
      mountPostDownloadStatusLabel(statusLabel, postButtons)

      /**
       * 投稿DLステータスを再取得してラベルへ反映します。
       */
      const refreshPostDownloadStatus = async (withCheckingState: boolean = true): Promise<PostDownloadStatusLabel> => {
        if (withCheckingState) {
          setPostDownloadStatusLabel(statusLabel, 'checking')
        }
        try {
          const postData = await fetchPostData()
          const status = await resolvePostDownloadStatus(postData)
          setPostDownloadStatusLabel(statusLabel, status.status, status.downloadedAt, status.failedCount)
          return status.status
        } catch (e) {
          console.error(e)
          setPostDownloadStatusLabel(statusLabel, 'error')
          return 'error'
        }
      }

      /**
       * DL中ステータスが終端状態に遷移するまでstorage変更を監視します。
       */
      const waitForPostDownloadToSettle = async (postId: number): Promise<boolean> => {
        return await new Promise<boolean>((resolve) => {
          const storageKey = postDownloadStateStorageKey(postId)
          let settled = false
          const timeoutId = setTimeout(() => {
            cleanup()
            resolve(false)
          }, DOWNLOAD_STATUS_POLL_TIMEOUT_MS)

          const cleanup = () => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            browser.storage.onChanged.removeListener(handleStorageChanged)
          }

          const checkSettled = async () => {
            try {
              const status = await resolvePostDownloadAttemptStatus(postId)
              if (status.status === 'downloading') return
              cleanup()
              resolve(true)
            } catch (e) {
              console.error(e)
              cleanup()
              resolve(false)
            }
          }

          const handleStorageChanged = (
            changes: Record<string, unknown>,
            areaName: string
          ) => {
            if (areaName !== 'local') return
            if (!(storageKey in changes)) return
            checkSettled().catch(e => { console.error(e) })
          }

          browser.storage.onChanged.addListener(handleStorageChanged)
          checkSettled().catch(e => {
            console.error(e)
            cleanup()
            resolve(false)
          })
        })
      }

      /**
       * 投稿全体の一括DL実行とステータス更新を行います。
       */
      runPostDownload = async () => {
        button.disabled = true
        setPostDownloadStatusLabel(statusLabel, 'downloading')
        try {
          const postData = await fetchPostData()
          await downloadEverythingFromPost(postData)
          const isSettled = await waitForPostDownloadToSettle(postData.id)
          if (!isSettled) {
            setPostDownloadStatusLabel(statusLabel, 'error')
            return
          }

          const status = await resolvePostDownloadStatus(postData)
          setPostDownloadStatusLabel(statusLabel, status.status, status.downloadedAt, status.failedCount)
        } catch (e) {
          console.error(e)
          setPostDownloadStatusLabel(statusLabel, 'error')
        } finally {
          button.disabled = false
        }
      }

      button.onclick = runPostDownload
      refreshPostDownloadStatus().catch(e => { console.error(e) })
      postBtnFlag = true
    }

    // 対象のElementが見つかるまでループ
    if (document.getElementsByClassName('content-block').length > 0) {
      // ギャラリーの一括保存ボタン作成
      const galleryElements = document.getElementsByClassName('content-block type-photo-gallery')
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
  if (message.text === 'get_post_download_status') {
    return await getCurrentPostDownloadStatus()
  }
  if (message.text === 'get_post_content_download_statuses') {
    return await getCurrentPostContentDownloadStatuses()
  }
  if (message.text === 'download_everything_from_a_post') {
    if (runPostDownload) {
      await runPostDownload()
    } else {
      await downloadEverythingFromPost()
    }
  }
})
