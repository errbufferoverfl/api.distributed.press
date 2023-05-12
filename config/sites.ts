import { NewSite, ProtocolStatus, Site } from '../api/schemas.js'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { AbstractLevel } from 'abstract-level'
import { ProtocolManager } from '../protocols/index.js'
import { Ctx } from '../protocols/interfaces.js'
import isValidHostname from 'is-valid-hostname'

export class SiteConfigStore extends Config<Static<typeof Site>> {
  protocols: ProtocolManager

  constructor (db: AbstractLevel<any, string, any>, protocols: ProtocolManager) {
    super(db)
    this.protocols = protocols
  }

  async create (cfg: Static<typeof NewSite>): Promise<Static<typeof Site>> {
    const id = cfg.domain
    if (!isValidHostname(id)) {
      throw new Error('Invalid hostname. Please ensure you leave out the port and protocol specifiers (e.g. no https://)')
    }

    const obj: Static<typeof Site> = {
      ...cfg,
      id,
      links: {}
    }
    return await this.db.put(id, obj).then(() => obj)
  }

  async sync (siteId: string, filePath: string, ctx?: Ctx): Promise<void> {
    const site = await this.get(siteId)

    const promises = []
    if (site.protocols.http) {
      const promise = this.protocols.http
        .sync(siteId, filePath, undefined, ctx)
        .then((protocolLinks) => {
          site.links.http = protocolLinks
        })

      promises.push(promise)
    }

    if (site.protocols.hyper) {
      const promise = this.protocols.hyper
        .sync(siteId, filePath, undefined, ctx)
        .then((protocolLinks) => {
          site.links.hyper = protocolLinks
        })

      promises.push(promise)
    }

    if (site.protocols.ipfs) {
      const promise = this.protocols.ipfs
        .sync(siteId, filePath, undefined, ctx)
        .then((protocolLinks) => {
          site.links.ipfs = protocolLinks
        })

      promises.push(promise)
    }

    await Promise.all(promises)
    await this.db.put(siteId, site)
  }

  /// Updates status of protocols for a given site
  async update (id: string, cfg: Static<typeof ProtocolStatus>): Promise<void> {
    const old = await this.get(id)
    const site = {
      ...old,
      protocols: cfg
    }
    return await this.db.put(id, site)
  }

  async get (id: string): Promise<Static<typeof Site>> {
    return await this.db.get(id)
  }

  async delete (id: string, ctx?: Ctx): Promise<void> {
    const site = await this.get(id)

    const promises = []
    if (site.links.http != null) {
      promises.push(this.protocols.http.unsync(id, site.links.http, ctx))
    }
    if (site.links.ipfs != null) {
      promises.push(this.protocols.ipfs.unsync(id, site.links.ipfs, ctx))
    }
    if (site.links.hyper != null) {
      promises.push(this.protocols.hyper.unsync(id, site.links.hyper, ctx))
    }

    await Promise.all(promises)
    await this.db.del(id)
  }
}