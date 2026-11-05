import type { ExportFile } from '@/types/course'

const API_BASE = (import.meta.env.VITE_SYNC_SERVER_URL || 'https://api.fqcdan1001.dpdns.org').replace(/\/+$/, '')

function request<T>(method: 'GET' | 'PUT', username: string, data?: ExportFile): Promise<{ statusCode: number, data: T }> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE}/api/sync?username=${encodeURIComponent(username)}`,
      method,
      data: data as never,
      header: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
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

export interface CloudBackup {
  backup: ExportFile
  updatedAt: number
}

export async function fetchCloudBackup(username: string): Promise<CloudBackup | null> {
  const response = await request<unknown>('GET', username)
  if (response.statusCode === 404)
    return null
  if (response.statusCode < 200 || response.statusCode >= 300)
    throw new Error(`同步读取失败（${response.statusCode}）`)
  if (!response.data || typeof response.data !== 'object')
    throw new Error('云端备份格式不正确')
  const envelope = response.data as Partial<CloudBackup>
  if (!isExportFile(envelope.backup) || typeof envelope.updatedAt !== 'number')
    throw new Error('云端备份格式不正确')
  return envelope as CloudBackup
}

export async function saveCloudBackup(username: string, data: ExportFile): Promise<number> {
  const response = await request<{ error?: string, updatedAt?: number }>('PUT', username, data)
  if (response.statusCode < 200 || response.statusCode >= 300)
    throw new Error(response.data?.error || `同步写入失败（${response.statusCode}）`)
  if (typeof response.data?.updatedAt !== 'number')
    throw new Error('同步写入响应格式不正确')
  return response.data.updatedAt
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
