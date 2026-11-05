import { describe, expect, it } from 'vitest'
import worker from './index'

class MemoryKV {
  values = new Map<string, string>()

  async get(key: string) {
    return this.values.get(key) ?? null
  }

  async put(key: string, value: string) {
    this.values.set(key, value)
  }
}

const backup = {
  app: 'teacher-schedule',
  schemaVersion: 1,
  exportedAt: 1,
  courses: [],
  templates: [],
  schedules: [],
}

function call(path: string, init: RequestInit = {}, kv = new MemoryKV()) {
  const response = worker.fetch(new Request(`https://example.test${path}`, init), { SYNC_DATA: kv })
  return { response, kv }
}

describe('sync worker', () => {
  it('serves health checks', async () => {
    const response = await call('/health').response
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('requires and validates a username', async () => {
    const response = await call('/api/sync').response
    expect(response.status).toBe(400)
    const invalid = call('/api/sync?username=bad%20name')
    expect((await invalid.response).status).toBe(400)
  })

  it('stores backups separately for each username', async () => {
    const kv = new MemoryKV()
    const first = await call('/api/sync?username=Alice', { method: 'PUT', body: JSON.stringify(backup) }, kv).response
    expect(first.status).toBe(200)
    const stored = await call('/api/sync?username=alice', {}, kv).response
    expect(stored.status).toBe(200)
    expect(await stored.json()).toEqual({ backup, updatedAt: expect.any(Number) })
    expect((await call('/api/sync?username=Bob', {}, kv).response).status).toBe(404)
  })

  it('rejects invalid backup documents', async () => {
    const response = await call('/api/sync?username=alice', {
      method: 'PUT',
      body: JSON.stringify({ courses: [] }),
    }).response
    expect(response.status).toBe(400)
  })
})
