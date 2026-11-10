import { createApp } from './app'
import { d1Db } from './d1'
import type { D1Like } from './d1'

interface KVLike {
  get: (key: string) => Promise<string | null>
}

export interface Env {
  DB: D1Like
  /** 旧版同步 KV（迁移期保留，用于把历史整份备份导入 D1） */
  SYNC_DATA?: KVLike
  WRITER_TOKEN: string
  VIEWER_TOKEN: string
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      db: d1Db(env.DB as unknown as D1Like),
      writerToken: env.WRITER_TOKEN,
      viewerToken: env.VIEWER_TOKEN,
      kv: env.SYNC_DATA ? { get: key => env.SYNC_DATA!.get(key) } : undefined,
    })
    return app.fetch(request)
  },
}
