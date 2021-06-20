import ky from 'ky'
import { Backnumber } from '../../types/backnumber'
import { ImgData, PostContentPhoto, PostData } from '../../types/index'

interface ImgPair {
  name: number
  url: string
}

export const getPhotoContents = (data: PostData | Backnumber, contentId: number): PostContentPhoto[] => {
  if ('post_contents' in data) {
    const content = data.post_contents.filter(v => v.id === contentId)[0]
    return content.category === 'photo_gallery' ? content.post_content_photos : []
  } else if ('backnumber_contents' in data) {
    return data.backnumber_contents.filter(v => v.id === contentId)[0].post_content_photos
  } else {
    return []
  }
}

export const getImgList = (photoContents: PostContentPhoto[]): ImgPair[] => {
  const ary: ImgPair[] = []
  for (let i = 0; i < photoContents.length; i++) {
    ary.push({ name: photoContents[i].id, url: photoContents[i].url.original })
  }
  return ary
}

export const mimeToExtension = (mime: string): string => {
  const mimeExtension: { [index: string]: string } = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
  }
  return mimeExtension[mime]
}

interface ContentPair {
  name: string
  content: Blob
}

export const getImgListContents = async (urls: ImgData[]): Promise<ContentPair[]> => {
  const promises = urls.map(async url => {
    const res = await ky.get(url.url)
    const content = await res.blob()

    const name = String(url.name) + mimeToExtension(content.type)
    return { name, content }
  })

  const pairs: ContentPair[] = []

  for (const promise of promises) {
    pairs.push(await promise)
  }

  return pairs
}
