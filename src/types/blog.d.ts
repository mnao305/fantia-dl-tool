interface FantiaImage {
  fantiaImage?: {
    id: string
    url: string
    'original_url': string
  },
  image?: string
}

export interface BlogBlock {
  insert: string | FantiaImage
}

export interface Blog {
  ops: BlogBlock[]
}
