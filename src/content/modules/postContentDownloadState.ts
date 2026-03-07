import { browser } from 'webextension-polyfill-ts'
import { saveStatusRecordWithPrune } from './statusStorage'

const STORAGE_KEY_PREFIX = 'postContentDownloadState_'
const STORAGE_VERSION = 1 as const

type LastAttemptStatus = 'downloading' | 'downloaded' | 'download_failed'

export type PostContentDownloadStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'download_failed'

type PostContentDownloadStateRecord = {
  version: typeof STORAGE_VERSION
  postId: number
  contentId: number
  lastAttemptStatus: LastAttemptStatus
  lastAttemptStartedAt: string
  lastAttemptFinishedAt: string | null
  lastFailedCount: number
  lastSuccessfulDownloadedAt: string | null
}

export type PostContentDownloadStatusResult = {
  status: PostContentDownloadStatus
  downloadedAt: string | null
  failedCount: number | null
}

/**
 * 値が許可された最終試行状態かを判定します。
 */
const isLastAttemptStatus = (value: unknown): value is LastAttemptStatus => {
  return value === 'downloading' || value === 'downloaded' || value === 'download_failed'
}

/**
 * 投稿IDとコンテンツIDから保存キーを生成します。
 */
const storageKey = (postId: number, contentId: number): string => `${STORAGE_KEY_PREFIX}${postId}_${contentId}`

/**
 * 保存値がpost-content状態レコードかを判定します。
 */
const isPostContentDownloadStateRecord = (value: unknown): value is PostContentDownloadStateRecord => {
  if (typeof value !== 'object' || value == null) return false

  const record = value as Record<string, unknown>
  const lastAttemptStatus = record.lastAttemptStatus
  return (
    record.version === STORAGE_VERSION &&
    typeof record.postId === 'number' &&
    typeof record.contentId === 'number' &&
    isLastAttemptStatus(lastAttemptStatus) &&
    typeof record.lastAttemptStartedAt === 'string' &&
    (record.lastAttemptFinishedAt == null || typeof record.lastAttemptFinishedAt === 'string') &&
    typeof record.lastFailedCount === 'number' &&
    (record.lastSuccessfulDownloadedAt == null || typeof record.lastSuccessfulDownloadedAt === 'string')
  )
}

/**
 * 指定post-contentの保存済み状態を読み出します。
 */
const readPostContentDownloadState = async (
  postId: number,
  contentId: number
): Promise<PostContentDownloadStateRecord | null> => {
  const key = storageKey(postId, contentId)
  const storage = await browser.storage.local.get(key) as Record<string, unknown>
  const record = storage[key]
  if (isPostContentDownloadStateRecord(record)) return record
  return null
}

/**
 * post-content状態をstorage.localへ保存します。
 */
const savePostContentDownloadState = async (record: PostContentDownloadStateRecord): Promise<void> => {
  await saveStatusRecordWithPrune(storageKey(record.postId, record.contentId), record)
}

/**
 * 指定post-contentの表示用ステータスを解決します。
 */
export const resolvePostContentDownloadStatus = async (
  postId: number,
  contentId: number
): Promise<PostContentDownloadStatusResult> => {
  const saved = await readPostContentDownloadState(postId, contentId)
  if (!saved) return { status: 'not_downloaded', downloadedAt: null, failedCount: null }

  if (saved.lastAttemptStatus === 'downloading') {
    return {
      status: 'downloading',
      downloadedAt: saved.lastSuccessfulDownloadedAt,
      failedCount: null
    }
  }

  if (saved.lastAttemptStatus === 'download_failed') {
    return {
      status: 'download_failed',
      downloadedAt: saved.lastSuccessfulDownloadedAt,
      failedCount: saved.lastFailedCount
    }
  }

  if (!saved.lastSuccessfulDownloadedAt) {
    return { status: 'not_downloaded', downloadedAt: null, failedCount: null }
  }

  return {
    status: 'downloaded',
    downloadedAt: saved.lastSuccessfulDownloadedAt,
    failedCount: null
  }
}

/**
 * post-contentの一括DL開始状態を記録します。
 */
export const markPostContentDownloadStarted = async (postId: number, contentId: number): Promise<void> => {
  const now = new Date().toISOString()
  const saved = await readPostContentDownloadState(postId, contentId)
  const record: PostContentDownloadStateRecord = {
    version: STORAGE_VERSION,
    postId,
    contentId,
    lastAttemptStatus: 'downloading',
    lastAttemptStartedAt: now,
    lastAttemptFinishedAt: null,
    lastFailedCount: 0,
    lastSuccessfulDownloadedAt: saved?.lastSuccessfulDownloadedAt ?? null
  }
  await savePostContentDownloadState(record)
}

/**
 * post-contentの一括DL成功状態を記録します。
 */
export const markPostContentDownloadSucceeded = async (postId: number, contentId: number): Promise<void> => {
  const now = new Date().toISOString()
  const saved = await readPostContentDownloadState(postId, contentId)
  const record: PostContentDownloadStateRecord = {
    version: STORAGE_VERSION,
    postId,
    contentId,
    lastAttemptStatus: 'downloaded',
    lastAttemptStartedAt: saved?.lastAttemptStartedAt ?? now,
    lastAttemptFinishedAt: now,
    lastFailedCount: 0,
    lastSuccessfulDownloadedAt: now
  }
  await savePostContentDownloadState(record)
}

/**
 * post-contentの一括DL失敗状態を記録します。
 */
export const markPostContentDownloadFailed = async (
  postId: number,
  contentId: number,
  failedCount: number
): Promise<void> => {
  const now = new Date().toISOString()
  const saved = await readPostContentDownloadState(postId, contentId)
  const record: PostContentDownloadStateRecord = {
    version: STORAGE_VERSION,
    postId,
    contentId,
    lastAttemptStatus: 'download_failed',
    lastAttemptStartedAt: saved?.lastAttemptStartedAt ?? now,
    lastAttemptFinishedAt: now,
    lastFailedCount: failedCount,
    lastSuccessfulDownloadedAt: saved?.lastSuccessfulDownloadedAt ?? null
  }
  await savePostContentDownloadState(record)
}
