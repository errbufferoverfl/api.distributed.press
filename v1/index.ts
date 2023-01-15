import apiBuilder from './api/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
const paths = envPaths('distributed-press')

const argv = yargs(hideBin(process.argv)).options({
  port: { type: 'number' },
  host: { type: 'string' },
  data: { type: 'string' }
}).parseSync()

export interface ServerI {
  port: number
  host: string
  storage: string
}

const cfg: ServerI = {
  port: Number(argv.port ?? process.env.PORT ?? '8080'),
  host: argv.host ?? process.env.HOST ?? 'localhost',
  storage: argv.data ?? paths.data
}

const server = await apiBuilder({ ...cfg, useLogging: true, useSwagger: true, usePrometheus: true })
server.listen(cfg, (err, _address) => {
  if (err != null) {
    server.log.error(err)
    process.exit(1)
  }
})
