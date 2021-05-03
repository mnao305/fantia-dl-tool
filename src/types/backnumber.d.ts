// eslint-disable-next-line semi
import { PostContentPhoto } from './index';

export interface Plan {
  description: string
  id: number
  limit: number
  name: string
  price: number
  thumb: string
}

export interface BacknumberContents {
  'backnumber_link': '/fanclubs/126510/backnumbers?month=202103&plan=189964'
  category: string
  comment: null
  comments: unknown
  'comments_reactions': unknown
  'content_type': null
  'embed_api_url': string
  'embed_url': null
  id: number
  'join_status': string
  'onsale_backnumber': string
  'parent_post': unknown
  plan: Plan
  'post_content_photos': PostContentPhoto[]
  'post_content_photos_micro': []
  product: null
  'published_state': string
  'reaction_types_url': string
  reactions: unknown
  title: null
  'visible_status': string
}

export interface Backnumber {
  'backnumber_contents': BacknumberContents[]
  comment: string
  'converted_at': string
  fanclub: unknown
  'fanclub_brand': number
  id: number
  'is_blog': boolean
  'is_contributor': boolean
  'is_pulish_open': true
  liked: boolean
  'likes_count': number
  'posted_at': string
  rating: 'adult'
  'redirect_url_from_save': string
  'show_adult_thumb': boolean
  'special_reaction': null
  thumb: unknown
  'thumb_micro': string
  title: string
  uri: { show: string, edit: null }
}

export interface BacknumberResponse {
  backnumber: Backnumber
}
