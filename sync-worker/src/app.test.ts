import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { MemoryDb } from './memory-db'

const WRITER = 'writer-token'
const VIEWER = 'viewer-token'

function makeApp(opts: { kvGet?: (key: string) => Promise<string | null> } = {}) {
  const db = new MemoryDb()
  const app = createApp({
    db,
    writerToken: WRITER,
    viewerToken: VIEWER,
    kv: opts.kvGet ? { get: opts.kvGet } : undefined,
  })
  const call = (path: string, init: RequestInit = {}, token?: string) => {
    const headers = new Headers(init.headers)
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
    if (init.body && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json')
    return app.request(path, { ...init, headers })
  }
  return { app, db, call }
}

const sampleCourse = {
  id: 'c1',
  studentName: '小明',
  startDate: '2026-11-10',
  endDate: '2026-11-10',
  startTime: '09:00',
  endTime: '10:00',
  notes: [],
  createdAt: 1,
  updatedAt: 1,
}

describe('hono api', () => {
  it('serves health without auth', async () => {
    const { call } = makeApp()
    const res = await call('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects requests without a token', async () => {
    const { call } = makeApp()
    const res = await call('/api/snapshot')
    expect(res.status).toBe(401)
  })

  it('reports role from token via /api/me', async () => {
    const { call } = makeApp()
    expect((await (await call('/api/me', {}, WRITER)).json()).role).toBe('writer')
    expect((await (await call('/api/me', {}, VIEWER)).json()).role).toBe('viewer')
    expect((await call('/api/me')).status).toBe(401)
  })

  it('lets viewer read but not write', async () => {
    const { call } = makeApp()
    const get = await call('/api/snapshot', {}, VIEWER)
    expect(get.status).toBe(200)
    const put = await call('/api/snapshot', {
      method: 'PUT',
      body: JSON.stringify({ courses: [], templates: [], schedules: [] }),
    }, VIEWER)
    expect(put.status).toBe(403)
  })

  it('writer can replace and read back a snapshot (with default schedule)', async () => {
    const { call } = makeApp()
    const put = await call('/api/snapshot', {
      method: 'PUT',
      body: JSON.stringify({
        courses: [sampleCourse],
        templates: [],
        schedules: [{ id: 'default', name: '默认课表', createdAt: 1, updatedAt: 1 }],
        settings: { defaultFee: 100 },
      }),
    }, WRITER)
    expect(put.status).toBe(200)
    expect((await put.json()).version).toBe(1)

    const get = await call('/api/snapshot', {}, VIEWER)
    const snap = await get.json()
    expect(snap.courses).toHaveLength(1)
    expect(snap.courses[0].studentName).toBe('小明')
    expect(snap.settings.defaultFee).toBe(100)
    expect(snap.schedules.some((s: { id: string }) => s.id === 'default')).toBe(true)
  })

  it('course CRUD works for writer', async () => {
    const { call } = makeApp()
    const created = await call('/api/courses', { method: 'POST', body: JSON.stringify(sampleCourse) }, WRITER)
    expect(created.status).toBe(201)

    const patched = await call('/api/courses/c1', { method: 'PATCH', body: JSON.stringify({ fee: 200 }) }, WRITER)
    expect(patched.status).toBe(200)
    expect((await patched.json()).fee).toBe(200)

    const got = await call('/api/courses/c1', {}, VIEWER)
    expect((await got.json()).fee).toBe(200)

    const del = await call('/api/courses/c1', { method: 'DELETE' }, WRITER)
    expect(del.status).toBe(200)
    const list = await call('/api/courses', {}, VIEWER)
    expect((await list.json()).courses).toHaveLength(0)
  })

  it('rejects an invalid course payload', async () => {
    const { call } = makeApp()
    const res = await call('/api/courses', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) }, WRITER)
    expect(res.status).toBe(400)
  })

  it('legacy /api/sync works without auth and returns ExportFile shape', async () => {
    const { call } = makeApp()
    const put = await call('/api/sync', {
      method: 'PUT',
      body: JSON.stringify({ app: 'teacher-schedule', schemaVersion: 1, courses: [sampleCourse], templates: [], schedules: [] }),
    })
    expect(put.status).toBe(200)
    const get = await call('/api/sync')
    expect(get.status).toBe(200)
    const body = await get.json()
    expect(body.backup.app).toBe('teacher-schedule')
    expect(body.backup.courses).toHaveLength(1)
    expect(typeof body.updatedAt).toBe('number')
  })

  it('imports a legacy KV entry via admin route', async () => {
    const stored = JSON.stringify({
      backup: { app: 'teacher-schedule', schemaVersion: 1, exportedAt: 1, courses: [sampleCourse], templates: [] },
      updatedAt: 123,
    })
    const { call } = makeApp({ kvGet: async key => (key === 'user:alice' ? stored : null) })
    const res = await call('/api/admin/import-kv?username=Alice', { method: 'POST' }, WRITER)
    expect(res.status).toBe(200)
    const snap = await (await call('/api/snapshot', {}, VIEWER)).json()
    expect(snap.courses).toHaveLength(1)
  })
})
