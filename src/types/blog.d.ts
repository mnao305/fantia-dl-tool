type FantiaImage = {
  fantiaImage?: {
    id: string
    url: string
    'original_url': string
  }
  image?: string
}

export type BlogBlock = {
  insert: string | FantiaImage
}

export type Blog = {
  ops: BlogBlock[]
}
