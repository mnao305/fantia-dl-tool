import { browser } from 'webextension-polyfill-ts'

const STATUS_KEY_PREFIXES = ['postDownloadState_', 'postContentDownloadState_']
const MAX_SAVE_RETRY_COUNT = 5
const MIN_PRUNE_COUNT = 20

/**
 * storage保存エラーが容量超過に起因するかを判定します。
 */
const isQuotaExceededError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  return /quota|QUOTA_BYTES|exceeded/i.test(error.message)
}

/**
 * 任意値を日時ミリ秒へ変換します。
 */
const parseDateMs = (value: unknown): number => {
  if (typeof value !== 'string' || value === '') return 0
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * 保存レコードから新しさ判定用の時刻を推定します。
 */
const resolveRecordUpdatedAtMs = (value: unknown): number => {
  if (typeof value !== 'object' || value == null) return 0
  const record = value as Record<string, unknown>
  const candidates = [
    parseDateMs(record.lastAttemptFinishedAt),
    parseDateMs(record.lastAttemptStartedAt),
    parseDateMs(record.lastSuccessfulDownloadedAt),
    parseDateMs(record.downloadedAt)
  ]
  return Math.max(...candidates)
}

/**
 * 状態保存キーかを判定します。
 */
const isStatusStorageKey = (key: string): boolean => {
  return STATUS_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
}

/**
 * 古いステータスレコードを間引いて保存容量を確保します。
 */
const pruneOldStatusRecords = async (keepKeys: readonly string[]): Promise<number> => {
  const keepKeySet = new Set(keepKeys)
  const all = await browser.storage.local.get(null) as Record<string, unknown>
  const targets = Object.entries(all)
    .filter(([key]) => isStatusStorageKey(key))
    .filter(([key]) => !keepKeySet.has(key))
    .map(([key, value]) => ({
      key,
      updatedAtMs: resolveRecordUpdatedAtMs(value)
    }))
    .sort((a, b) => a.updatedAtMs - b.updatedAtMs)

  if (targets.length === 0) return 0

  const removeCount = Math.max(MIN_PRUNE_COUNT, Math.ceil(targets.length * 0.1))
  const removeKeys = targets.slice(0, removeCount).map(v => v.key)
  await browser.storage.local.remove(removeKeys)
  return removeKeys.length
}

/**
 * 容量超過時に古いレコードを削除しつつステータスを保存します。
 */
export const saveStatusRecordWithPrune = async (key: string, value: unknown): Promise<void> => {
  for (let attempt = 0; attempt < MAX_SAVE_RETRY_COUNT; attempt++) {
    try {
      await browser.storage.local.set({ [key]: value })
      return
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error

      const removedCount = await pruneOldStatusRecords([key])
      if (removedCount === 0) throw error
      console.warn(`storage quota reached. pruned old status records: ${removedCount}`)
    }
  }

  throw new Error('failed_to_save_status_record_due_to_quota')
}
