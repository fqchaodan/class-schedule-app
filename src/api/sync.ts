import type { AppSettings, Course, CourseTemplate, RecycleItem, Schedule } from '@/types/course'

/** 服务端快照结构（与 sync-worker/src/types.ts 对齐） */
export interface ServerSnapshot {
  schedules: Schedule[]
  courses: Course[]
  templates: CourseTemplate[]
  recycle: RecycleItem[]
  settings: AppSettings
  version: number
  updatedAt: number
}

export interface SnapshotInput {
  schedules: Schedule[]
  courses: Course[]
  templates: CourseTemplate[]
  recycle: RecycleItem[]
  settings: AppSettings
}

export type Role = 'writer' | 'viewer'

const API_BASE = (import.meta.env.VITE_SYNC_SERVER_URL || 'https://api.fqcdan1001.dpdns.org').replace(/\/+$/, '')

function request<T>(method: 'GET' | 'PUT' | 'POST' | 'DELETE', path: string, token: string, body?: unknown): Promise<{ statusCode: number, data: T }> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${path}`,
      method,
      data: body as never,
      header: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      timeout: 30_000,
      success: (response) => {
        resolve({ statusCode: response.statusCode, data: response.data as T })
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '网络错误'))
      },
    })
  })
}

/** 校验账号并返回角色；账号无效（非两个允许账号）时抛错 */
export async function getMe(account: string): Promise<Role> {
  const res = await request<{ role?: Role, error?: string }>('GET', '/api/me', account)
  if (res.statusCode === 401)
    throw new Error('账号无效或未授权')
  if (res.statusCode < 200 || res.statusCode >= 300)
    throw new Error(`登录失败（${res.statusCode}）`)
  if (res.data?.role !== 'writer' && res.data?.role !== 'viewer')
    throw new Error('登录响应异常')
  return res.data.role
}

export async function fetchSnapshot(token: string): Promise<ServerSnapshot> {
  const res = await request<ServerSnapshot>('GET', '/api/snapshot', token)
  if (res.statusCode < 200 || res.statusCode >= 300)
    throw new Error(`读取云端数据失败（${res.statusCode}）`)
  const d = res.data
  if (!d || !Array.isArray(d.courses))
    throw new Error('云端数据格式不正确')
  return d
}

export async function saveSnapshot(token: string, input: SnapshotInput): Promise<number> {
  const res = await request<{ ok?: boolean, version?: number, updatedAt?: number, error?: string }>('PUT', '/api/snapshot', token, input)
  if (res.statusCode < 200 || res.statusCode >= 300)
    throw new Error(res.data?.error || `保存失败（${res.statusCode}）`)
  return res.data?.updatedAt ?? Date.now()
}
