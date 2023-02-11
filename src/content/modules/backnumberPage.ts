import ky from 'ky'
import { Backnumber, BacknumberResponse } from '../../types/backnumber'

export const fetchBacknumberData = async (): Promise<Backnumber> => {
  const url = new URL((document.getElementsByClassName('tab-item tab-item-text active')[1] as HTMLAnchorElement).href)
  const plan = url.searchParams.get('plan')
  const month = url.searchParams.get('month')
  const csrfToken = document.getElementsByName('csrf-token')[0].getAttribute('content') ?? ''
  const json = await ky.get(`https://fantia.jp/api/v1/fanclub/backnumbers/monthly_contents/plan/${plan}/month/${month}`, { headers: { 'x-csrf-token': csrfToken } }).json<BacknumberResponse>()

  return json.backnumber
}
