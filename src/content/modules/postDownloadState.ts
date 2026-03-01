import { browser } from 'webextension-polyfill-ts'
import { PostData } from '../../types'
import { saveStatusRecordWithPrune } from './statusStorage'

const STORAGE_KEY_PREFIX = 'postDownloadState_'
const STORAGE_VERSION = 2 as const

type LastAttemptStatus = 'downloading' | 'downloaded' | 'download_failed'

export type PostDownloadStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'updated_after_download'
  | 'download_failed'

type LatestPostDownloadStateRecord = {
  version: typeof STORAGE_VERSION
  postId: number
  lastAttemptStatus: LastAttemptStatus
  lastAttemptStartedAt: string
  lastAttemptFinishedAt: string | null
  lastFailedCount: number
  lastSuccessfulDownloadedAt: string | null
}

type LegacyPostDownloadStateRecord = {
  version: 1
  postId: number
  downloadedAt: string
  snapshotHash: string
}

export type PostDownloadStatusResult = {
  status: PostDownloadStatus
  downloadedAt: string | null
  failedCount: number | null
}

export type PostDownloadAttemptStatusResult = {
  status: 'not_downloaded' | LastAttemptStatus
  downloadedAt: string | null
  failedCount: number | null
}

/**
 * 投稿IDから保存キーを生成します。
 */
const storageKey = (postId: number) => `${STORAGE_KEY_PREFIX}${postId}`

/**
 * v2形式の保存レコードかを判定します。
 */
const isLatestPostDownloadStateRecord = (value: unknown): value is LatestPostDownloadStateRecord => {
  if (typeof value !== 'object' || value == null) return false

  const record = value as Record<string, unknown>
  return (
    record.version === STORAGE_VERSION &&
    typeof record.postId === 'number' &&
    typeof record.lastAttemptStatus === 'string' &&
    typeof record.lastAttemptStartedAt === 'string' &&
    (record.lastAttemptFinishedAt == null || typeof record.lastAttemptFinishedAt === 'string') &&
    typeof record.lastFailedCount === 'number' &&
    (record.lastSuccessfulDownloadedAt == null || typeof record.lastSuccessfulDownloadedAt === 'string')
  )
}

/**
 * v1形式の保存レコードかを判定します。
 */
const isLegacyPostDownloadStateRecord = (value: unknown): value is LegacyPostDownloadStateRecord => {
  if (typeof value !== 'object' || value == null) return false

  const record = value as Record<string, unknown>
  return (
    record.version === 1 &&
    typeof record.postId === 'number' &&
    typeof record.downloadedAt === 'string' &&
    typeof record.snapshotHash === 'string'
  )
}

/**
 * v1レコードをv2レコードへ変換します。
 */
const legacyToLatestRecord = (record: LegacyPostDownloadStateRecord): LatestPostDownloadStateRecord => {
  return {
    version: STORAGE_VERSION,
    postId: record.postId,
    lastAttemptStatus: 'downloaded',
    lastAttemptStartedAt: record.downloadedAt,
    lastAttemptFinishedAt: record.downloadedAt,
    lastFailedCount: 0,
    lastSuccessfulDownloadedAt: record.downloadedAt
  }
}

/**
 * ISO日時文字列をミリ秒へ変換します。
 */
const parseDateMs = (value: string | null): number | null => {
  if (!value) return null
  const ms = new Date(value).getTime()
  if (Number.isNaN(ms)) return null
  return ms
}

/**
 * 投稿が最終DL完了後に更新されているかを判定します。
 */
const isPostUpdatedAfterDownload = (post: PostData, downloadedAt: string): boolean => {
  const downloadedAtMs = parseDateMs(downloadedAt)
  const convertedAtMs = parseDateMs(post.converted_at ?? null)
  if (downloadedAtMs == null || convertedAtMs == null) return false
  return convertedAtMs > downloadedAtMs
}

/**
 * 保存済み投稿ステータスを読み出します。
 */
const readPostDownloadState = async (postId: number): Promise<LatestPostDownloadStateRecord | null> => {
  const key = storageKey(postId)
  const storage = await browser.storage.local.get(key) as Record<string, unknown>
  const record = storage[key]

  if (isLatestPostDownloadStateRecord(record)) return record
  if (isLegacyPostDownloadStateRecord(record)) return legacyToLatestRecord(record)
  return null
}

/**
 * 投稿ステータスをstorage.localへ保存します。
 */
const savePostDownloadState = async (record: LatestPostDownloadStateRecord): Promise<void> => {
  await saveStatusRecordWithPrune(storageKey(record.postId), record)
}

/**
 * 現在の投稿状態から表示用ステータスを解決します。
 */
export const resolvePostDownloadStatus = async (post: PostData): Promise<PostDownloadStatusResult> => {
  const saved = await readPostDownloadState(post.id)
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

  if (isPostUpdatedAfterDownload(post, saved.lastSuccessfulDownloadedAt)) {
    return {
      status: 'updated_after_download',
      downloadedAt: saved.lastSuccessfulDownloadedAt,
      failedCount: null
    }
  }

  return {
    status: 'downloaded',
    downloadedAt: saved.lastSuccessfulDownloadedAt,
    failedCount: null
  }
}

/**
 * 投稿の最終試行状態のみを解決します（投稿更新判定は行いません）。
 */
export const resolvePostDownloadAttemptStatus = async (postId: number): Promise<PostDownloadAttemptStatusResult> => {
  const saved = await readPostDownloadState(postId)
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

  return {
    status: 'downloaded',
    downloadedAt: saved.lastSuccessfulDownloadedAt,
    failedCount: null
  }
}

/**
 * 投稿の一括DL開始状態を記録します。
 */
export const markPostDownloadStarted = async (postId: number): Promise<void> => {
  const now = new Date().toISOString()
  const saved = await readPostDownloadState(postId)
  const record: LatestPostDownloadStateRecord = {
    version: STORAGE_VERSION,
    postId,
    lastAttemptStatus: 'downloading',
    lastAttemptStartedAt: now,
    lastAttemptFinishedAt: null,
    lastFailedCount: 0,
    lastSuccessfulDownloadedAt: saved?.lastSuccessfulDownloadedAt ?? null
  }
  await savePostDownloadState(record)
}

/**
 * 投稿の一括DL成功状態を記録します。
 */
export const markPostDownloadSucceeded = async (postId: number): Promise<void> => {
  const now = new Date().toISOString()
  const saved = await readPostDownloadState(postId)
  const record: LatestPostDownloadStateRecord = {
    version: STORAGE_VERSION,
    postId,
    lastAttemptStatus: 'downloaded',
    lastAttemptStartedAt: saved?.lastAttemptStartedAt ?? now,
    lastAttemptFinishedAt: now,
    lastFailedCount: 0,
    lastSuccessfulDownloadedAt: now
  }
  await savePostDownloadState(record)
}

/**
 * 投稿の一括DL失敗状態を記録します。
 */
export const markPostDownloadFailed = async (postId: number, failedCount: number): Promise<void> => {
  const now = new Date().toISOString()
  const saved = await readPostDownloadState(postId)
  const record: LatestPostDownloadStateRecord = {
    version: STORAGE_VERSION,
    postId,
    lastAttemptStatus: 'download_failed',
    lastAttemptStartedAt: saved?.lastAttemptStartedAt ?? now,
    lastAttemptFinishedAt: now,
    lastFailedCount: failedCount,
    lastSuccessfulDownloadedAt: saved?.lastSuccessfulDownloadedAt ?? null
  }
  await savePostDownloadState(record)
}
