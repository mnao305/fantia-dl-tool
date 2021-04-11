import { browser } from 'webextension-polyfill-ts'
import ky from 'ky'

interface postContentPhoto {
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

interface postContent {
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
  'post_content_photos': postContentPhoto[]
  'post_content_photos_micro': string[]
  'plan': unknown
  'product': null
  'onsale_backnumber': false
  'backnumber_link': null
  'join_status': null
  'parent_post': unknown
}

interface postData {
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
  'post_contents': postContent[]
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

interface postDataResponse {
  post: postData
}

const fetchPostData = async () => {
  const id = location.pathname.split('/posts/')[1]
  const json = await ky.get(`https://fantia.jp/api/v1/posts/${id}`).json<postDataResponse>()

  return json
}

const getImgList = (data: postData, cnt: number) => {
  const ary: string[] = []
  const photoContents = data.post_contents.filter(v => v.category === 'photo_gallery')[cnt].post_content_photos

  for (let i = 0; i < photoContents.length; i++) {
    ary.push(photoContents[i].url.original)
  }

  return ary
}

const saveImages = async (event: MouseEvent) => {
  const btnCount = (event.target as HTMLElement).attributes.getNamedItem('gallery-count')
  if (!btnCount) return
  const data = await fetchPostData()
  const imgList = getImgList(data.post, Number(btnCount.value))
  console.log(imgList)
}

let num = 0

const btnCreate = () => {
  const btn = document.createElement('button')
  btn.textContent = '一括DL'
  btn.setAttribute('style', 'display: block;margin: 20px auto;')
  btn.setAttribute('gallery-count', String(num))
  num++
  btn.onclick = saveImages
  return btn
}

const injectBtn = (el: HTMLElement) => {
  const btn = btnCreate()
  el.appendChild(btn)
}

const main = () => {
  const target = document.getElementById('page')
  if (!target) return
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if ((mutation.target as HTMLElement).className === 'content-block type-photo-gallery ng-scope') {
        injectBtn((mutation.target as HTMLElement))
        observer.disconnect()
      }
    })
  })

  const config = {
    characterData: false,
    childList: true,
    subtree: true,
  }

  observer.observe(target, config)
}
main()
