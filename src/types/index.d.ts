interface PostContentPhoto {
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

interface PostContent {
  'id': number
  'title': null
  'visible_status': string
  'published_state': string
  'category': string
  'comment': null
  'embed_url': null
  'content_type': null
  'comments': unknown
  'comments_reactions': unknown
  'embed_api_url': string
  'reactions': unknown
  'reaction_types_url': string
  'post_content_photos': PostContentPhoto[]
  'post_content_photos_micro': string[]
  'plan': unknown
  'product': null
  'onsale_backnumber': false
  'backnumber_link': null
  'join_status': null
  'parent_post': unknown
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
  'fanclub': unknown
  'tags': []
  'status': 'open'
  'post_contents': PostContent[]
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
