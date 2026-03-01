type UnknownRecord = Record<string, unknown>

export type Fanclub = {
  category: unknown
  cover: unknown
  creator_name: string
  fan_count: number
  fanclub_name: string
  fanclub_name_or_creator_name: string
  fanclub_name_with_creator_name: string
  icon: unknown
  id: number
  is_blocked: boolean
  is_join: boolean
  name: string
  plans: unknown
  posts_count: number
  products_count: number
  recent_posts: unknown
  recent_products: unknown
  title: string
  uri: unknown
  user: unknown
} & UnknownRecord

export type ParentPost = {
  date: string
  deadline: string
  title: string
  url: string
} & UnknownRecord

export type PostContentPhoto = {
  id: number
  url: {
    thumb: string
    medium: string
    large: string
    main: string
    original: string
  } & UnknownRecord
  comment: string | null
  show_original_uri: string
  is_converted: boolean
} & UnknownRecord

/** 全てのカテゴリで共通 */
type PostContentBase = {
  id: number
  category: string
  title: string | null
  visible_status: 'visible' | 'catchable' | 'uncatchable'
  published_state: string
  comment: string | null
  embed_api_url: string
  embed_url: null
  content_type: string | null
  comments: unknown
  comments_reactions: unknown
  reactions: unknown
  reaction_types_url: string
  post_content_photos_micro: string[]
  plan: unknown
  product: null
  onsale_backnumber: string
  backnumber_link: string | null
  join_status: null
  parent_post: ParentPost
} & UnknownRecord

type PostContentPhotoGallery = PostContentBase & {
  category: 'photo_gallery'
  content_type: null
  post_content_photos: PostContentPhoto[]
}

type PostContentFile = PostContentBase & {
  category: 'file'
  content_type: string
  download_uri: string
  filename: string
  hls_uri: string
  is_converted: boolean
}

type PostContentText = PostContentBase & {
  category: 'text'
  content_type: null
  comment: string
  filename: string
}

export type PostContentBlog = PostContentBase & {
  category: 'blog'
  comment: string
}

export type PostContent = PostContentPhotoGallery | PostContentFile | PostContentText | PostContentBlog

export type PostData = {
  id: number
  title: string
  comment: string | null
  rating: string
  thumb: {
    thumb: string
    medium: string
    large: string
    main: string
    ogp: string
    micro: string
    original: string
  } | null
  thumb_micro: string
  show_adult_thumb: boolean
  posted_at: string
  likes_count: number
  liked: boolean
  is_contributor: boolean
  uri: {
    show: string
    edit: null
  }
  is_publish_open?: boolean
  is_pulish_open?: boolean
  is_blog: boolean
  converted_at: string
  fanclub_brand: number
  special_reaction: null
  redirect_url_from_save: string
  fanclub: Fanclub
  tags: unknown[]
  status: string
  post_contents: PostContent[]
  deadline: string | null
  publish_reserved_at: string | null
  comments: unknown
  blog_comment: string | null
  comments_reactions: unknown
  reactions: unknown
  reaction_types_url: string
  ogp_api_url: string
  links: unknown
  is_fanclub_tip_accept: boolean
  is_fanclub_joined: boolean
}

export type PostDataResponse = {
  post: PostData
}

export type ImgData = {
  name: number
  url: string
}

export type ImgContents = {
  name: string
  content: Blob
}

export type BlogComment = {
  ops: {
    insert?: string | {
      image?: string
    }
    attributes?: Record<string, unknown>
  }[]
}
