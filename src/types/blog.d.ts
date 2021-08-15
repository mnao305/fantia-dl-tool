interface FantiaImage {
  fantiaImage: {
    id: string
    url: string
    'original_url': string
  }
}

export interface BlogBlock {
  insert: string | FantiaImage
}

export interface Blog {
  ops: BlogBlock[]
}
