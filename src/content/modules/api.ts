import ky from 'ky'

/**
 * Fantiaのget APIにアクセスするためのヘッダーなどを設定済みのラッパー
 */
export const get = async <T>(url: string) => {
  const csrfToken = document.getElementsByName('csrf-token')[0].getAttribute('content') ?? ''

  return await ky.get(url, { headers: { 'x-csrf-token': csrfToken, 'x-requested-with': 'XMLHttpRequest' } }).json<T>()
}
