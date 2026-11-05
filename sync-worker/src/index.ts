interface KVNamespace {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string) => Promise<void>
}

export interface Env {
  SYNC_DATA: KVNamespace
}

interface ExportFile {
  app: 'teacher-schedule'
  schemaVersion: 1
  exportedAt: number
  courses: unknown[]
  templates: unknown[]
  schedules?: unknown[]
}

const MAX_BODY_BYTES = 24 * 1024 * 1024
const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]{1,32}$/u

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'cache-control': 'no-store',
    },
  })
}

function isExportFile(value: unknown): value is ExportFile {
  if (!value || typeof value !== 'object')
    return false
  const data = value as Partial<ExportFile>
  return data.app === 'teacher-schedule'
    && data.schemaVersion === 1
    && Array.isArray(data.courses)
    && Array.isArray(data.templates)
    && (data.schedules === undefined || Array.isArray(data.schedules))
}

function userKey(username: string): string | null {
  const normalized = username.trim().normalize('NFC')
  if (!USERNAME_PATTERN.test(normalized))
    return null
  return `user:${normalized.toLowerCase()}`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, PUT, OPTIONS',
          'access-control-allow-headers': 'Content-Type',
        },
      })
    }

    if (url.pathname === '/health' && request.method === 'GET')
      return json({ ok: true })

    if (url.pathname !== '/api/sync')
      return json({ error: 'not found' }, 404)

    const username = url.searchParams.get('username')
    const key = username ? userKey(username) : null
    if (!key)
      return json({ error: 'username must be 1-32 letters, numbers, _, . or -' }, 400)

    if (request.method === 'GET') {
      const value = await env.SYNC_DATA.get(key)
      if (!value)
        return json({ error: 'not found' }, 404)
      try {
        const stored = JSON.parse(value) as { backup?: unknown, updatedAt?: unknown }
        if (typeof stored.updatedAt !== 'number' || !isExportFile(stored.backup))
          return json({ error: 'stored backup is invalid' }, 500)
        return json({ backup: stored.backup, updatedAt: stored.updatedAt })
      }
      catch {
        return json({ error: 'stored backup is invalid' }, 500)
      }
    }

    if (request.method !== 'PUT')
      return json({ error: 'method not allowed' }, 405)

    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > MAX_BODY_BYTES)
      return json({ error: 'backup exceeds 24 MiB limit' }, 413)

    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES)
      return json({ error: 'backup exceeds 24 MiB limit' }, 413)

    let data: unknown
    try {
      data = JSON.parse(text)
    }
    catch {
      return json({ error: 'invalid JSON' }, 400)
    }
    if (!isExportFile(data))
      return json({ error: 'invalid backup structure' }, 400)

    const updatedAt = Date.now()
    await env.SYNC_DATA.put(key, JSON.stringify({ backup: data, updatedAt }))
    return json({ ok: true, username: username.trim(), updatedAt })
  },
}
