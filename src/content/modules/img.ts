import ky from 'ky'
import { Backnumber } from '../../types/backnumber'
import { ImgData, PostData } from '../../types/index'

interface ImgPair {
  name: number
  url: string
}

export const getImgList = (data: PostData | Backnumber, contentId: number): ImgPair[] => {
  const ary: ImgPair[] = []
  if ('post_contents' in data) {
    const photoContents = data.post_contents.filter(v => v.id === contentId)[0].post_content_photos

    for (let i = 0; i < photoContents.length; i++) {
      ary.push({ name: photoContents[i].id, url: photoContents[i].url.original })
    }
  } else if ('backnumber_contents' in data) {
    const photoContents = data.backnumber_contents.filter(v => v.id === contentId)[0].post_content_photos

    for (let i = 0; i < photoContents.length; i++) {
      ary.push({ name: photoContents[i].id, url: photoContents[i].url.original })
    }
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
