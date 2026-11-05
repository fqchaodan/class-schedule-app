import { describe, expect, it } from 'vitest'
import { useCourseStore } from '@/store/course'
import { useRecycleStore } from '@/store/recycle'
import { useSyncStore } from '@/store/sync'
import { switchLocalProfile } from './profiles'

describe('switchLocalProfile', () => {
  it('keeps local data isolated between usernames', () => {
    const syncStore = useSyncStore()
    const courseStore = useCourseStore()
    const recycleStore = useRecycleStore()

    courseStore.courses = [{
      id: 'alice-course',
      studentName: 'Alice',
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      startTime: '10:00',
      endTime: '11:00',
      notes: [],
      createdAt: 1,
      updatedAt: 1,
    }]
    switchLocalProfile('alice')

    switchLocalProfile('bob')
    expect(courseStore.courses).toEqual([])
    courseStore.courses.push({
      id: 'bob-course',
      studentName: 'Bob',
      startDate: '2026-11-02',
      endDate: '2026-11-02',
      startTime: '10:00',
      endTime: '11:00',
      notes: [],
      createdAt: 2,
      updatedAt: 2,
    })

    switchLocalProfile('alice')
    expect(courseStore.courses.map(course => course.id)).toEqual(['alice-course'])
    expect(syncStore.activeDataUsername).toBe('alice')
    expect(recycleStore.items).toEqual([])
  })
})
