import { Backnumber, BacknumberResponse } from '../../types/backnumber'
import { get } from './api'

export const fetchBacknumberData = async (): Promise<Backnumber> => {
  const url = new URL((document.getElementsByClassName('tab-item tab-item-text active')[1] as HTMLAnchorElement).href)
  const plan = url.searchParams.get('plan')
  const month = url.searchParams.get('month')
  const json = await get<BacknumberResponse>(`https://fantia.jp/api/v1/fanclub/backnumbers/monthly_contents/plan/${plan}/month/${month}`)

  return json.backnumber
}
