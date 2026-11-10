/**
 * Hono 应用：服务端权威的课表 API。
 * - 单一共享数据集：一个写者（writer）+ 一个只读观看者（viewer）。
 * - 主接口 snapshot（GET 全量 / PUT 全量覆盖），辅以行级 CRUD。
 * - /api/sync 保留为向后兼容别名（旧客户端仍可推送/拉取整份备份）。
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppSettings, Db, RecycleItem, SnapshotInput, SnapshotResult } from './types'
import { ensureDefaultSchedule, isRecord, normalizeCourse, normalizeSchedule, normalizeSettings, normalizeTemplate } from './types'
import { extractBearer, roleForToken } from './auth'
import type { Role } from './auth'

export interface AppOptions {
  db: Db
  writerToken: string
  viewerToken: string
  /** 旧版 KV（迁移期），提供后可调用 /api/admin/import-kv 一次性导入历史备份 */
  kv?: { get: (key: string) => Promise<string | null> }
}

interface Env { Variables: { role: Role } }

function toInput(body: unknown): SnapshotInput | null {
  if (!isRecord(body))
    return null
  const b = body as Record<string, unknown>
  return {
    schedules: Array.isArray(b.schedules) ? b.schedules : [],
    courses: Array.isArray(b.courses) ? b.courses : [],
    templates: Array.isArray(b.templates) ? b.templates : [],
    recycle: Array.isArray(b.recycle) ? (b.recycle as RecycleItem[]) : [],
    settings: b.settings as AppSettings | undefined,
  }
}

/** 兼容旧客户端的 ExportFile 结构（不含 recycle） */
function toExportFile(snap: SnapshotResult) {
  return {
    app: 'teacher-schedule' as const,
    schemaVersion: 1 as const,
    exportedAt: snap.updatedAt || Date.now(),
    courses: snap.courses,
    templates: snap.templates,
    schedules: snap.schedules,
    settings: snap.settings,
  }
}

export function createApp(opts: AppOptions) {
  const app = new Hono<Env>()

  app.use('/api/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }))

  app.get('/health', c => c.json({ ok: true }))

  // 返回当前 token 的角色，供客户端决定是否进入只读模式
  app.get('/api/me', async (c) => {
    const role = roleForToken(extractBearer(c.req.header('Authorization')), opts)
    if (!role)
      return c.json({ error: 'unauthorized' }, 401)
    return c.json({ role })
  })

  // 鉴权中间件（/api/sync 旧接口免鉴权以兼容存量客户端）
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/sync'))
      return next()
    const role = roleForToken(extractBearer(c.req.header('Authorization')), opts)
    if (!role)
      return c.json({ error: 'unauthorized' }, 401)
    c.set('role', role)
    return next()
  })

  const requireWriter = async (c: { get: (k: 'role') => Role, json: (b: unknown, s?: number) => Response }, next: () => Promise<void>) => {
    if (c.get('role') !== 'writer')
      return c.json({ error: 'forbidden: read-only token' }, 403)
    return next()
  }

  // ---------- 向后兼容：旧 /api/sync ----------
  app.get('/api/sync', async (c) => {
    const snap = await opts.db.getSnapshot()
    return c.json({ backup: toExportFile(snap), updatedAt: snap.updatedAt })
  })

  app.put('/api/sync', async (c) => {
    const body = await c.req.json().catch(() => null)
    const input = toInput(body)
    if (!input)
      return c.json({ error: 'invalid backup structure' }, 400)
    // 旧客户端不携带 recycle/settings，缺省时保留服务端现值，避免误清空
    const existing = await opts.db.getSnapshot()
    if (!Array.isArray((body as Record<string, unknown>).recycle))
      input.recycle = existing.recycle
    if ((body as Record<string, unknown>).settings === undefined)
      input.settings = existing.settings
    const res = await opts.db.replaceSnapshot(input)
    return c.json({ ok: true, updatedAt: res.updatedAt })
  })

  // ---------- 迁移：把旧 KV 的整份备份一次性导入 D1 ----------
  if (opts.kv) {
    const kv = opts.kv
    app.post('/api/admin/import-kv', requireWriter, async (c) => {
      const username = c.req.query('username')
      if (!username)
        return c.json({ error: 'username required' }, 400)
      const key = `user:${username.trim().normalize('NFC').toLowerCase()}`
      const value = await kv.get(key)
      if (!value)
        return c.json({ error: 'kv entry not found', key }, 404)
      let parsed: unknown
      try {
        parsed = JSON.parse(value)
      }
      catch {
        return c.json({ error: 'invalid kv json' }, 400)
      }
      const backup = isRecord(parsed) && 'backup' in parsed ? (parsed as { backup: unknown }).backup : parsed
      const input = toInput(backup)
      if (!input)
        return c.json({ error: 'invalid backup structure' }, 400)
      const res = await opts.db.replaceSnapshot(input)
      return c.json({ ok: true, version: res.version, updatedAt: res.updatedAt })
    })
  }

  // ---------- 快照（主接口） ----------
  app.get('/api/snapshot', async (c) => {
    const snap = await opts.db.getSnapshot()
    return c.json({ ...snap, schedules: ensureDefaultSchedule(snap.schedules) })
  })

  app.put('/api/snapshot', requireWriter, async (c) => {
    const body = await c.req.json().catch(() => null)
    const input = toInput(body)
    if (!input)
      return c.json({ error: 'invalid snapshot' }, 400)
    const res = await opts.db.replaceSnapshot(input)
    return c.json({ ok: true, version: res.version, updatedAt: res.updatedAt })
  })

  // ---------- 课程 ----------
  app.get('/api/courses', async c => c.json({ courses: await opts.db.listCourses() }))
  app.get('/api/courses/:id', async (c) => {
    const course = await opts.db.getCourse(c.req.param('id'))
    return course ? c.json(course) : c.json({ error: 'not found' }, 404)
  })
  app.post('/api/courses', requireWriter, async (c) => {
    const course = normalizeCourse(await c.req.json().catch(() => null))
    if (!course)
      return c.json({ error: 'invalid course' }, 400)
    await opts.db.upsertCourse(course)
    return c.json(course, 201)
  })
  app.patch('/api/courses/:id', requireWriter, async (c) => {
    const id = c.req.param('id')
    const existing = await opts.db.getCourse(id)
    if (!existing)
      return c.json({ error: 'not found' }, 404)
    const body = await c.req.json().catch(() => null)
    const merged = normalizeCourse({ ...existing, ...(isRecord(body) ? body : {}), id, updatedAt: Date.now() })
    if (!merged)
      return c.json({ error: 'invalid course' }, 400)
    await opts.db.upsertCourse(merged)
    return c.json(merged)
  })
  app.delete('/api/courses/:id', requireWriter, async (c) => {
    await opts.db.deleteCourse(c.req.param('id'))
    return c.json({ ok: true })
  })

  // ---------- 模板 ----------
  app.get('/api/templates', async c => c.json({ templates: await opts.db.listTemplates() }))
  app.post('/api/templates', requireWriter, async (c) => {
    const template = normalizeTemplate(await c.req.json().catch(() => null))
    if (!template)
      return c.json({ error: 'invalid template' }, 400)
    await opts.db.upsertTemplate(template)
    return c.json(template, 201)
  })
  app.patch('/api/templates/:id', requireWriter, async (c) => {
    const id = c.req.param('id')
    const existing = (await opts.db.listTemplates()).find(t => t.id === id)
    if (!existing)
      return c.json({ error: 'not found' }, 404)
    const body = await c.req.json().catch(() => null)
    const merged = normalizeTemplate({ ...existing, ...(isRecord(body) ? body : {}), id, updatedAt: Date.now() })
    if (!merged)
      return c.json({ error: 'invalid template' }, 400)
    await opts.db.upsertTemplate(merged)
    return c.json(merged)
  })
  app.delete('/api/templates/:id', requireWriter, async (c) => {
    await opts.db.deleteTemplate(c.req.param('id'))
    return c.json({ ok: true })
  })

  // ---------- 课表 ----------
  app.get('/api/schedules', async c => c.json({ schedules: await opts.db.listSchedules() }))
  app.post('/api/schedules', requireWriter, async (c) => {
    const schedule = normalizeSchedule(await c.req.json().catch(() => null))
    if (!schedule)
      return c.json({ error: 'invalid schedule' }, 400)
    await opts.db.upsertSchedule(schedule)
    return c.json(schedule, 201)
  })
  app.patch('/api/schedules/:id', requireWriter, async (c) => {
    const id = c.req.param('id')
    const existing = (await opts.db.listSchedules()).find(s => s.id === id)
    if (!existing)
      return c.json({ error: 'not found' }, 404)
    const body = await c.req.json().catch(() => null)
    const merged = normalizeSchedule({ ...existing, ...(isRecord(body) ? body : {}), id, updatedAt: Date.now() })
    if (!merged)
      return c.json({ error: 'invalid schedule' }, 400)
    await opts.db.upsertSchedule(merged)
    return c.json(merged)
  })
  app.delete('/api/schedules/:id', requireWriter, async (c) => {
    await opts.db.deleteSchedule(c.req.param('id'))
    return c.json({ ok: true })
  })

  // ---------- 回收站 ----------
  app.get('/api/recycle', async c => c.json({ recycle: await opts.db.listRecycle() }))
  app.post('/api/recycle', requireWriter, async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!isRecord(body))
      return c.json({ error: 'invalid recycle item' }, 400)
    const course = normalizeCourse(body.course)
    if (!course)
      return c.json({ error: 'invalid course in recycle item' }, 400)
    const item: RecycleItem = { course, deletedAt: typeof body.deletedAt === 'number' ? body.deletedAt : Date.now() }
    await opts.db.addRecycle(item)
    return c.json(item, 201)
  })
  app.delete('/api/recycle/:id', requireWriter, async (c) => {
    await opts.db.deleteRecycle(c.req.param('id'))
    return c.json({ ok: true })
  })

  // ---------- 设置 ----------
  app.get('/api/settings', async c => c.json(await opts.db.getSettings()))
  app.put('/api/settings', requireWriter, async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!isRecord(body))
      return c.json({ error: 'invalid settings' }, 400)
    const settings = normalizeSettings(body)
    await opts.db.putSettings(settings)
    return c.json(settings)
  })

  app.onError((err, c) => {
    console.error('API error:', err)
    return c.json({ error: 'internal error' }, 500)
  })

  app.notFound(c => c.json({ error: 'not found' }, 404))

  return app
}
