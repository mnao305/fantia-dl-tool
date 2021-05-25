import ky from 'ky'
import { PostData, PostDataResponse } from '../../types/index'

export const fetchPostData = async (): Promise<PostData> => {
  const id = location.pathname.split('/posts/')[1]
  const json = await ky.get(`https://fantia.jp/api/v1/posts/${id}`).json<PostDataResponse>()

  return json.post
}
