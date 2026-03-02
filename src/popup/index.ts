import { browser } from 'webextension-polyfill-ts'

type PostDownloadStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'updated_after_download'
  | 'download_failed'

type PostContentDownloadStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'download_failed'

type CurrentStatusLabel = PostDownloadStatus | 'checking' | 'error'

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

type LegacyStateRecord = {
  version: 1
  postId: number
  downloadedAt: string
  snapshotHash: string
}

type LatestStateRecord = {
  version: 2
  postId: number
  lastAttemptStatus: 'downloading' | 'downloaded' | 'download_failed'
  lastAttemptStartedAt: string
  lastAttemptFinishedAt: string | null
  lastFailedCount: number
  lastSuccessfulDownloadedAt: string | null
}

type SavedStatusView = {
  postId: number
  status: PostDownloadStatus
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  failedCount: number | null
}

const statusMessageMap: Record<CurrentStatusLabel, string> = {
  checking: 'download_status_checking',
  not_downloaded: 'download_status_not_downloaded',
  downloading: 'download_status_downloading',
  downloaded: 'download_status_downloaded',
  updated_after_download: 'download_status_updated_after_download',
  download_failed: 'download_status_failed',
  error: 'download_status_error'
}

const currentStatusSummary = document.querySelector<HTMLParagraphElement>('#currentStatusSummary')
const currentPostId = document.querySelector<HTMLElement>('#currentPostId')
const currentPostTitle = document.querySelector<HTMLElement>('#currentPostTitle')
const currentDownloadedAt = document.querySelector<HTMLElement>('#currentDownloadedAt')
const currentUpdatedAt = document.querySelector<HTMLElement>('#currentUpdatedAt')
const currentFailedCount = document.querySelector<HTMLElement>('#currentFailedCount')
const refreshCurrentStatus = document.querySelector<HTMLButtonElement>('#refreshCurrentStatus')
const savedEmpty = document.querySelector<HTMLParagraphElement>('#savedEmpty')
const savedTable = document.querySelector<HTMLTableElement>('#savedTable')
const savedTbody = document.querySelector<HTMLTableSectionElement>('#savedTbody')
const currentContentsEmpty = document.querySelector<HTMLParagraphElement>('#currentContentsEmpty')
const currentContentsTable = document.querySelector<HTMLTableElement>('#currentContentsTable')
const currentContentsTbody = document.querySelector<HTMLTableSectionElement>('#currentContentsTbody')

if (
  !currentStatusSummary ||
  !currentPostId ||
  !currentPostTitle ||
  !currentDownloadedAt ||
  !currentUpdatedAt ||
  !currentFailedCount ||
  !refreshCurrentStatus ||
  !savedEmpty ||
  !savedTable ||
  !savedTbody ||
  !currentContentsEmpty ||
  !currentContentsTable ||
  !currentContentsTbody
) {
  throw new Error('popup elements are not found')
}

/**
 * v1形式の保存レコードかを判定します。
 */
const isLegacyStateRecord = (value: unknown): value is LegacyStateRecord => {
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
 * v2形式の保存レコードかを判定します。
 */
const isLatestStateRecord = (value: unknown): value is LatestStateRecord => {
  if (typeof value !== 'object' || value == null) return false
  const record = value as Record<string, unknown>

  return (
    record.version === 2 &&
    typeof record.postId === 'number' &&
    typeof record.lastAttemptStatus === 'string' &&
    typeof record.lastAttemptStartedAt === 'string' &&
    (record.lastAttemptFinishedAt == null || typeof record.lastAttemptFinishedAt === 'string') &&
    typeof record.lastFailedCount === 'number' &&
    (record.lastSuccessfulDownloadedAt == null || typeof record.lastSuccessfulDownloadedAt === 'string')
  )
}

/**
 * ステータス値をi18nメッセージへ変換します。
 */
const statusToI18nMessage = (status: CurrentStatusLabel): string => {
  return browser.i18n.getMessage(statusMessageMap[status])
}

/**
 * data-locale属性を持つ要素へ翻訳文言を適用します。
 */
const setLocalizedText = () => {
  document.querySelectorAll<HTMLElement>('[data-locale]').forEach((elem) => {
    const key = elem.dataset.locale
    elem.textContent = key ? browser.i18n.getMessage(key) : ''
  })
}

/**
 * ISO文字列をローカル日時表示へ整形します。
 */
const formatDateTime = (value: string | null): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

/**
 * ISO文字列をミリ秒へ変換します。無効値は0を返します。
 */
const parseDateMs = (value: string | null): number => {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * 受信側未接続のruntimeエラーかを判定します。
 */
const isReceivingEndMissingError = (value: unknown): boolean => {
  if (!(value instanceof Error)) return false
  return value.message.includes('Could not establish connection. Receiving end does not exist.')
}

/**
 * 現在のアクティブタブIDを取得します。
 */
const getActiveTabId = async (): Promise<number | null> => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab?.id == null) return null
  return tab.id
}

/**
 * 現在投稿のステータス見出しを更新します。
 */
const setCurrentStatusSummary = (status: CurrentStatusLabel, customText: string | null = null) => {
  currentStatusSummary.textContent = customText ?? statusToI18nMessage(status)
  currentStatusSummary.className = `status status-${status}`
}

/**
 * 現在投稿のメタ情報表示を更新します。
 */
const setCurrentMetaValues = (
  postIdValue: string,
  postTitleValue: string,
  downloadedAtValue: string,
  updatedAtValue: string,
  failedCountValue: string
) => {
  currentPostId.textContent = postIdValue
  currentPostTitle.textContent = postTitleValue
  currentDownloadedAt.textContent = downloadedAtValue
  currentUpdatedAt.textContent = updatedAtValue
  currentFailedCount.textContent = failedCountValue
}

/**
 * アクティブタブの投稿ステータスを取得して表示に反映します。
 */
const requestCurrentPostStatus = async (): Promise<void> => {
  setCurrentStatusSummary('checking')
  setCurrentMetaValues('-', '-', '-', '-', '-')

  const tabId = await getActiveTabId()
  if (tabId == null) {
    setCurrentStatusSummary('error', browser.i18n.getMessage('popup_status_no_active_tab'))
    return
  }

  let response: PopupPostDownloadStatusResponse
  try {
    response = (await browser.tabs.sendMessage(tabId, { text: 'get_post_download_status' })) as PopupPostDownloadStatusResponse
  } catch (e) {
    console.error(e)
    if (isReceivingEndMissingError(e)) {
      setCurrentStatusSummary('error', browser.i18n.getMessage('popup_reload_post_page'))
      return
    }
    setCurrentStatusSummary('error', browser.i18n.getMessage('popup_open_post_page'))
    return
  }

  if (!response.ok) {
    setCurrentStatusSummary('error', browser.i18n.getMessage('popup_status_unavailable'))
    return
  }

  const failedCountText = response.failedCount != null ? String(response.failedCount) : '-'
  setCurrentMetaValues(
    String(response.postId),
    response.title,
    formatDateTime(response.downloadedAt),
    formatDateTime(response.updatedAt),
    failedCountText
  )
  setCurrentStatusSummary(response.status)
}

/**
 * post-contentの補足情報を表示用文字列へ整形します。
 */
const formatPostContentInfo = (title: string, category: string, visibleStatus: string): string => {
  const titleText = title === '' ? '-' : title
  return `${category} / ${visibleStatus} / ${titleText}`
}

/**
 * 現在投稿のpost-content状態一覧を描画します。
 */
const requestCurrentPostContentStatuses = async (): Promise<void> => {
  currentContentsTbody.innerHTML = ''
  currentContentsEmpty.hidden = false
  currentContentsTable.hidden = true
  currentContentsEmpty.textContent = browser.i18n.getMessage('popup_current_contents_empty')

  const tabId = await getActiveTabId()
  if (tabId == null) {
    currentContentsEmpty.textContent = browser.i18n.getMessage('popup_status_no_active_tab')
    return
  }

  let response: PopupPostContentDownloadStatusResponse
  try {
    response = (await browser.tabs.sendMessage(tabId, { text: 'get_post_content_download_statuses' })) as PopupPostContentDownloadStatusResponse
  } catch (e) {
    console.error(e)
    if (isReceivingEndMissingError(e)) {
      currentContentsEmpty.textContent = browser.i18n.getMessage('popup_reload_post_page')
      return
    }
    currentContentsEmpty.textContent = browser.i18n.getMessage('popup_open_post_page')
    return
  }

  if (!response.ok) {
    currentContentsEmpty.textContent = browser.i18n.getMessage('popup_status_unavailable')
    return
  }

  if (response.contents.length === 0) {
    currentContentsEmpty.textContent = browser.i18n.getMessage('popup_current_contents_empty')
    return
  }

  currentContentsEmpty.hidden = true
  currentContentsTable.hidden = false

  for (const content of response.contents) {
    const row = document.createElement('tr')
    const contentIdCell = document.createElement('td')
    const statusCell = document.createElement('td')
    const successCell = document.createElement('td')
    const infoCell = document.createElement('td')

    contentIdCell.textContent = String(content.contentId)
    const statusText = statusToI18nMessage(content.status)
    if (content.status === 'download_failed' && content.failedCount != null) {
      statusCell.textContent = `${statusText} (${content.failedCount})`
    } else {
      statusCell.textContent = statusText
    }
    successCell.textContent = formatDateTime(content.downloadedAt)
    infoCell.textContent = formatPostContentInfo(content.title, content.category, content.visibleStatus)

    row.appendChild(contentIdCell)
    row.appendChild(statusCell)
    row.appendChild(successCell)
    row.appendChild(infoCell)
    currentContentsTbody.appendChild(row)
  }
}

/**
 * 保存レコードを一覧表示用のデータへ変換します。
 */
const recordToSavedStatusView = (record: LatestStateRecord | LegacyStateRecord): SavedStatusView => {
  if (record.version === 1) {
    return {
      postId: record.postId,
      status: 'downloaded',
      lastAttemptAt: record.downloadedAt,
      lastSuccessAt: record.downloadedAt,
      failedCount: null
    }
  }

  const status = record.lastAttemptStatus === 'download_failed'
    ? 'download_failed'
    : record.lastAttemptStatus

  return {
    postId: record.postId,
    status,
    lastAttemptAt: record.lastAttemptFinishedAt ?? record.lastAttemptStartedAt,
    lastSuccessAt: record.lastSuccessfulDownloadedAt,
    failedCount: status === 'download_failed' ? record.lastFailedCount : null
  }
}

/**
 * storage.localの保存済み投稿ステータス一覧を取得します。
 */
const getSavedStatusList = async (): Promise<SavedStatusView[]> => {
  const all = await browser.storage.local.get(null) as Record<string, unknown>
  const records = Object.entries(all)
    .filter(([key]) => key.startsWith('postDownloadState_'))
    .map(([, value]) => value)
    .flatMap(value => {
      if (isLatestStateRecord(value) || isLegacyStateRecord(value)) {
        return [recordToSavedStatusView(value)]
      }
      return []
    })

  records.sort((a, b) => {
    const aTime = parseDateMs(a.lastAttemptAt)
    const bTime = parseDateMs(b.lastAttemptAt)
    return bTime - aTime
  })
  return records
}

/**
 * 保存済みステータス一覧テーブルを描画します。
 */
const renderSavedStatusList = async (): Promise<void> => {
  const records = await getSavedStatusList()
  savedTbody.innerHTML = ''

  if (records.length === 0) {
    savedEmpty.hidden = false
    savedTable.hidden = true
    return
  }

  savedEmpty.hidden = true
  savedTable.hidden = false

  for (const record of records) {
    const row = document.createElement('tr')
    const postIdCell = document.createElement('td')
    const statusCell = document.createElement('td')
    const attemptCell = document.createElement('td')
    const successCell = document.createElement('td')

    const postLink = document.createElement('a')
    postLink.href = `https://fantia.jp/posts/${record.postId}`
    postLink.target = '_blank'
    postLink.rel = 'noopener noreferrer'
    postLink.textContent = String(record.postId)
    postIdCell.appendChild(postLink)
    const statusText = statusToI18nMessage(record.status)
    if (record.status === 'download_failed' && record.failedCount != null) {
      statusCell.textContent = `${statusText} (${record.failedCount})`
    } else {
      statusCell.textContent = statusText
    }
    attemptCell.textContent = formatDateTime(record.lastAttemptAt)
    successCell.textContent = formatDateTime(record.lastSuccessAt)

    row.appendChild(postIdCell)
    row.appendChild(statusCell)
    row.appendChild(attemptCell)
    row.appendChild(successCell)
    savedTbody.appendChild(row)
  }
}

/**
 * 現在投稿ステータスと保存済み一覧を再読み込みします。
 */
const refresh = async () => {
  await requestCurrentPostStatus()
  await requestCurrentPostContentStatuses()
  await renderSavedStatusList()
}

setLocalizedText()
refresh().catch((e) => {
  console.error(e)
  setCurrentStatusSummary('error')
})
refreshCurrentStatus.addEventListener('click', () => {
  refresh().catch((e) => {
    console.error(e)
    setCurrentStatusSummary('error')
  })
})
