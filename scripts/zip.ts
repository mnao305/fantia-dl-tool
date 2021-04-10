import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import { name, version } from '../package.json'

/**
 * 吐き出されるzipファイルを置くディレクトリを作る
 * @param {string} dir 生成されるディレクトリ名
 */
const createDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
}

/**
 * zip化する
 * @param {string} src zip化するディレクトリ
 * @param {string} output zipファイルが置かれるディレクトリ
 * @param {string} zipFilename 生成するzipファイルの名前
 */
const makeZip = (src: string, output: string, zipFilename: string): void => {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = fs.createWriteStream(path.join(output, zipFilename))
  archive.directory(src, false).pipe(stream)
  archive.finalize()
    .catch(e => {
      console.error(e)
    })
}

const main = (): void => {
  const SRC_DIR = path.join(__dirname, '../dist')
  const OUTPUT_DIR = path.join(__dirname, '../dist_zip')
  const OUTPUT_FILE = `${name}_v${version}.zip`

  createDir(OUTPUT_DIR)
  makeZip(SRC_DIR, OUTPUT_DIR, OUTPUT_FILE)
}

main()
