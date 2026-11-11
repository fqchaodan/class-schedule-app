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

// 默认走 Pages 反代（dpdns 域名在国内被按 SNI 重置，见 sync-worker/pages-proxy）
const API_BASE = (import.meta.env.VITE_SYNC_SERVER_URL || 'https://fanqie-schedule-api.pages.dev').replace(/\/+$/, '')

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
        const raw = error.errMsg || '网络错误'
        // 域名被运营商/网络重置时 errMsg 形如
        // "request:fail abort statusCode:-1 Connection reset"，直接抛给用户看不懂
        if (/abort|reset|refused|timed?\s?out|network/i.test(raw)) {
          console.warn('[sync] 网络请求失败：', raw)
          reject(new Error('无法连接同步服务器，请检查手机网络后重试'))
          return
        }
        reject(new Error(raw))
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

/** 保存成功后顺便带出服务端版本号，便于客户端判断「是否有他人改动」 */
export async function saveSnapshot(token: string, input: SnapshotInput): Promise<{ version: number, updatedAt: number }> {
  const res = await request<{ ok?: boolean, version?: number, updatedAt?: number, error?: string }>('PUT', '/api/snapshot', token, input)
  if (res.statusCode < 200 || res.statusCode >= 300)
    throw new Error(res.data?.error || `保存失败（${res.statusCode}）`)
  return {
    version: res.data?.version ?? 0,
    updatedAt: res.data?.updatedAt ?? Date.now(),
  }
}
