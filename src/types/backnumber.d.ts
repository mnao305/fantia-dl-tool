import { Fanclub, ParentPost, PostContentPhoto } from './index'

type UnknownRecord = Record<string, unknown>

export type Plan = {
  description: string
  id: number
  limit: number
  name: string
  price: number
  thumb: string
} & UnknownRecord

export type BacknumberContents = {
  backnumber_link: string
  category: string
  comment: string | null
  comments: unknown
  comments_reactions: unknown
  content_type: string | null
  embed_api_url: string
  embed_url: null
  id: number
  join_status: string
  onsale_backnumber: string
  parent_post: ParentPost
  plan: Plan
  post_content_photos: PostContentPhoto[]
  post_content_photos_micro: unknown[]
  product: null
  published_state: string
  reaction_types_url: string
  reactions: unknown
  title: null | string
  visible_status: string
} & UnknownRecord

export type Backnumber = {
  backnumber_contents: BacknumberContents[]
  comment: string
  converted_at: string
  fanclub: Fanclub
  fanclub_brand: number
  id: number
  is_blog: boolean
  is_contributor: boolean
  is_publish_open?: boolean
  is_pulish_open?: boolean
  liked: boolean
  likes_count: number
  posted_at: string
  rating: 'adult' | string
  redirect_url_from_save: string
  show_adult_thumb: boolean
  special_reaction: null
  thumb: unknown
  thumb_micro: string
  title: string
  uri: {
    show: string
    edit: null
  } & UnknownRecord
}

export type BacknumberResponse = {
  backnumber: Backnumber
}
