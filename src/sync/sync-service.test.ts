import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { fetchSnapshot, getMe, saveSnapshot } from '@/api/sync'
import { useCourseStore } from '@/store/course'
import { useSyncStore } from '@/store/sync'
import { applySnapshot, hydrate, login, pullSnapshot } from './sync-service'

vi.mock('@/api/sync', () => ({
  getMe: vi.fn(),
  fetchSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
}))

const emptySnap = {
  schedules: [],
  courses: [],
  templates: [],
  recycle: [],
  settings: {},
  version: 0,
  updatedAt: 0,
}

const aCourse = {
  id: 'c1',
  studentName: '小红',
  startDate: '2026-11-10',
  endDate: '2026-11-10',
  startTime: '09:00',
  endTime: '10:00',
  notes: [],
  createdAt: 1,
  updatedAt: 1,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('sync-service', () => {
  it('login validates account and sets writer session', async () => {
    ;(getMe as any).mockResolvedValue('writer')
    ;(fetchSnapshot as any).mockResolvedValue(emptySnap)
    const role = await login('18150867766')
    expect(role).toBe('writer')
    const store = useSyncStore()
    expect(store.account).toBe('18150867766')
    expect(store.role).toBe('writer')
    expect(store.readOnly).toBe(false)
  })

  it('login sets read-only for viewer role', async () => {
    ;(getMe as any).mockResolvedValue('viewer')
    ;(fetchSnapshot as any).mockResolvedValue(emptySnap)
    await login('15250906963')
    expect(useSyncStore().readOnly).toBe(true)
  })

  it('login rejects an invalid account', async () => {
    ;(getMe as any).mockRejectedValue(new Error('账号无效或未授权'))
    await expect(login('000')).rejects.toThrow('账号无效')
  })

  it('applySnapshot overwrites local stores', () => {
    applySnapshot({ ...emptySnap, courses: [aCourse] } as any)
    expect(useCourseStore().courses).toHaveLength(1)
    expect(useCourseStore().courses[0]!.studentName).toBe('小红')
  })

  it('hydrate migrates local data up when server is empty', async () => {
    useSyncStore().setSession('acc', 'writer')
    useCourseStore().courses.push(aCourse as any)
    ;(fetchSnapshot as any).mockResolvedValue(emptySnap)
    ;(saveSnapshot as any).mockResolvedValue({ version: 1, updatedAt: Date.now() })
    await hydrate()
    expect(saveSnapshot).toHaveBeenCalled()
    expect(useCourseStore().courses).toHaveLength(1)
  })

  it('hydrate applies server data when present', async () => {
    useSyncStore().setSession('acc', 'viewer')
    ;(fetchSnapshot as any).mockResolvedValue({ ...emptySnap, courses: [{ ...aCourse, id: 's1', studentName: '服务端' }] })
    await hydrate()
    expect(useCourseStore().courses).toHaveLength(1)
    expect(useCourseStore().courses[0]!.studentName).toBe('服务端')
  })

  it('writer with empty local pulls server data on a fresh device', async () => {
    useSyncStore().setSession('acc', 'writer')
    ;(fetchSnapshot as any).mockResolvedValue({ ...emptySnap, courses: [{ ...aCourse, id: 's1', studentName: '服务端' }] })
    await hydrate()
    expect(useCourseStore().courses).toHaveLength(1)
    expect(useCourseStore().courses[0]!.studentName).toBe('服务端')
    expect(saveSnapshot).not.toHaveBeenCalled()
  })

  it('writer with STALE local does NOT overwrite server (applies server)', async () => {
    useSyncStore().setSession('acc', 'writer')
    // 模拟器旧数据：updatedAt 很小
    useCourseStore().courses.push({ ...aCourse, id: 'old', studentName: '旧的', updatedAt: 1 } as any)
    ;(fetchSnapshot as any).mockResolvedValue({ ...emptySnap, updatedAt: 999, courses: [{ ...aCourse, id: 's1', studentName: '服务端', updatedAt: 500 }] })
    await hydrate()
    expect(saveSnapshot).not.toHaveBeenCalled()
    expect(useCourseStore().courses.some(c => c.studentName === '服务端')).toBe(true)
    expect(useCourseStore().courses.some(c => c.id === 'old')).toBe(false)
  })

  it('pullSnapshot skips re-applying when server version is unchanged', async () => {
    const store = useSyncStore()
    store.setSession('acc', 'viewer')
    store.setServerVersion(3)
    ;(fetchSnapshot as any).mockResolvedValue({ ...emptySnap, version: 3, courses: [{ ...aCourse, studentName: '服务端' }] })
    const applied = await pullSnapshot()
    expect(applied).toBe(false)
    expect(useCourseStore().courses).toHaveLength(0)
  })

  it('pullSnapshot applies when server version moves forward', async () => {
    const store = useSyncStore()
    store.setSession('acc', 'viewer')
    store.setServerVersion(3)
    ;(fetchSnapshot as any).mockResolvedValue({ ...emptySnap, version: 4, courses: [{ ...aCourse, studentName: '新数据' }] })
    const applied = await pullSnapshot()
    expect(applied).toBe(true)
    expect(useCourseStore().courses[0]!.studentName).toBe('新数据')
    expect(store.serverVersion).toBe(4)
  })
})
