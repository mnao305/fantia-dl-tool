export interface Fanclub {
  category: unknown
  cover: unknown
  'creator_name': string
  'fan_count': number
  'fanclub_name': string
  'fanclub_name_or_creator_name': string
  'fanclub_name_with_creator_name': string
  icon: unknown
  id: number
  'is_blocked': boolean
  'is_join': boolean
  name: string
  plans: unknown
  'posts_count': number
  'products_count': number
  'recent_posts': unknown
  'recent_products': unknown
  title: string
  uri: unknown
  user: unknown
}

export interface ParentPost {
  date: string
  deadline: string
  title: string
  url: string
}

export interface PostContentPhoto {
  'id': number
  'url': {
    'thumb': string
    'medium': string
    'large': string
    'main': string
    'original': string
  }
  'comment': null
  'show_original_uri': string
  'is_converted': boolean
}

/** 全てのカテゴリで共通 */
interface PostContent {
  'id': number
  'category': string
  'title': null | string
  'visible_status': string
  'published_state': string
  'comment': null | string
  'embed_api_url': string
  'embed_url': null
  'content_type': null | string
  'comments': unknown
  'comments_reactions': unknown
  'reactions': unknown
  'reaction_types_url': string
  'post_content_photos_micro': string[]
  'plan': unknown
  'product': null
  'onsale_backnumber': string
  'backnumber_link': null | string
  'join_status': null
  'parent_post': ParentPost
}

interface PostContentPhotoGallery extends PostContent {
  'category': 'photo_gallery'
  'content_type': null
  'post_content_photos': PostContentPhoto[]
}

interface PostContentFile extends PostContent {
  'category': 'file'
  'content_type': string
  'download_uri': string
  'filename': string
  'hls_uri': string
  'is_converted': boolean
}

export interface PostData {
  'id': number
  'title': string
  'comment': string
  'rating': string
  'thumb': {
    thumb: string
    medium: string
    large: string
    main: string
    ogp: string
    micro: string
    original: string
  }
  'thumb_micro': string
  'show_adult_thumb': boolean
  'posted_at': string
  'likes_count': number
  'liked': boolean
  'is_contributor': boolean
  'uri': {
    'show': string
    'edit': null
  }
  'is_pulish_open': boolean
  'is_blog': boolean
  'converted_at': string
  'fanclub_brand': number
  'special_reaction': null
  'redirect_url_from_save': string
  'fanclub': Fanclub
  'tags': []
  'status': 'open'
  'post_contents': (PostContentPhotoGallery | PostContentFile)[]
  'deadline': string
  'publish_reserved_at': null
  'comments': unknown
  'blog_comment': ''
  'comments_reactions': unknown
  'reactions': unknown
  'reaction_types_url': string
  'ogp_api_url': string
  'links': unknown
  'is_fanclub_tip_accept': boolean
  'is_fanclub_joined': boolean
}

export interface PostDataResponse {
  post: PostData
}

export interface ImgData {
  name: number
  url: string
}

export interface ImgContents {
  name: string;
  content: Blob;
}
