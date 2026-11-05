import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExportFile } from '@/types/course'
import { useCourseStore } from '@/store/course'
import { useSyncStore } from '@/store/sync'
import { fetchCloudBackup, saveCloudBackup } from '@/api/sync'
import { pullNow, pushNow } from './sync-service'

vi.mock('@/api/sync', () => ({
  fetchCloudBackup: vi.fn(),
  saveCloudBackup: vi.fn(),
}))

const remoteBackup: ExportFile = {
  app: 'teacher-schedule',
  schemaVersion: 1,
  exportedAt: 1,
  courses: [],
  templates: [],
  schedules: [],
}

function makeCourse(id: string) {
  return {
    id,
    scheduleId: 'default',
    studentName: id,
    startDate: '2026-11-01',
    endDate: '2026-11-01',
    startTime: '10:00',
    endTime: '11:00',
    notes: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('manual push/pull sync', () => {
  beforeEach(() => {
    vi.mocked(fetchCloudBackup).mockReset()
    vi.mocked(saveCloudBackup).mockReset().mockResolvedValue(2)
  })

  it('push uploads the current local backup to the username slot', async () => {
    useSyncStore().username = 'Teacher'
    useCourseStore().courses = [makeCourse('local')]

    expect(await pushNow()).toBe(true)
    expect(saveCloudBackup).toHaveBeenCalledOnce()
    const [username, backup] = vi.mocked(saveCloudBackup).mock.calls[0]
    expect(username).toBe('teacher')
    expect(backup.courses.map(course => course.id)).toEqual(['local'])
    expect(useSyncStore().lastSyncAt).toBeGreaterThan(0)
  })

  it('pull replaces local data with the cloud backup', async () => {
    useSyncStore().username = 'teacher'
    useCourseStore().courses = [makeCourse('stale-local')]
    vi.mocked(fetchCloudBackup).mockResolvedValue({
      backup: { ...remoteBackup, courses: [makeCourse('cloud-a'), makeCourse('cloud-b')] },
      updatedAt: 9,
    })

    expect(await pullNow()).toBe(true)
    expect(useCourseStore().courses.map(course => course.id)).toEqual(['cloud-a', 'cloud-b'])
  })

  it('pull fails gently when the cloud has no backup', async () => {
    useSyncStore().username = 'teacher'
    useCourseStore().courses = [makeCourse('keep')]
    vi.mocked(fetchCloudBackup).mockResolvedValue(null)

    expect(await pullNow()).toBe(false)
    expect(useSyncStore().lastSyncError).toBe('云端还没有备份数据')
    // 云端为空时本机数据保持不变
    expect(useCourseStore().courses.map(course => course.id)).toEqual(['keep'])
  })

  it('requires a username before any operation', async () => {
    useSyncStore().username = ''
    expect(await pushNow()).toBe(false)
    expect(await pullNow()).toBe(false)
    expect(useSyncStore().lastSyncError).toBe('请先填写用户名')
  })
})
