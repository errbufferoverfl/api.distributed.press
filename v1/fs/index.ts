import path from 'path'
import fs from 'fs'
import tar from 'tar-fs'
import gunzip from 'gunzip-maybe'

export class SiteFileSystem {
  path: string
  constructor (rootPath: string) {
    this.path = path.join(rootPath, 'sites')
  }

  async clear (siteId: string): Promise<void> {
    const sitePath = this.getPath(siteId)
    fs.rmSync(sitePath, { recursive: true, force: true })
  }

  getPath (siteId: string): string {
    return path.join(this.path, siteId)
  }

  /// Reads a .tar or .tar.gz from given `tarballPath` and extracts it to
  /// the target directory. Deletes original tarball when done
  async extract (tarballPath: string, siteId: string): Promise<void> {
    return await new Promise((resolve, reject) => {
      const sitePath = this.getPath(siteId)
      fs.createReadStream(tarballPath).on('error', reject)
        .pipe(gunzip()).on('error', reject)
        .pipe(tar.extract(sitePath, {
          readable: true,
          writable: false
        })).on('error', reject)
        .on('finish', () => {
          fs.unlinkSync(tarballPath)
          resolve()
        })
    })
  }
}
