/**
 * 内存版 Db 实现，用于单测路由逻辑（不依赖真实 D1）。
 */
import type { AppSettings, Course, CourseTemplate, Db, RecycleItem, Schedule, SnapshotInput, SnapshotResult, WriteResult } from './types'
import { DEFAULT_SETTINGS, ensureDefaultSchedule, normalizeCourse, normalizeSchedule, normalizeSettings, normalizeTemplate } from './types'

export class MemoryDb implements Db {
  private schedules: Schedule[] = []
  private courses: Course[] = []
  private templates: CourseTemplate[] = []
  private recycle: RecycleItem[] = []
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private version = 0
  private updatedAt = 0

  async getSnapshot(): Promise<SnapshotResult> {
    return {
      schedules: this.schedules,
      courses: this.courses,
      templates: this.templates,
      recycle: this.recycle,
      settings: this.settings,
      version: this.version,
      updatedAt: this.updatedAt,
    }
  }

  async replaceSnapshot(input: SnapshotInput): Promise<WriteResult> {
    this.schedules = ensureDefaultSchedule((input.schedules ?? []).map(normalizeSchedule).filter((s): s is Schedule => !!s))
    this.courses = (input.courses ?? []).map(normalizeCourse).filter((c): c is Course => !!c)
    this.templates = (input.templates ?? []).map(normalizeTemplate).filter((t): t is CourseTemplate => !!t)
    this.recycle = (input.recycle ?? []).filter((r): r is RecycleItem => !!r && !!normalizeCourse(r.course))
    this.settings = normalizeSettings(input.settings)
    this.version += 1
    this.updatedAt = Date.now()
    return { version: this.version, updatedAt: this.updatedAt }
  }

  async listCourses() { return this.courses }
  async getCourse(id: string) { return this.courses.find(c => c.id === id) ?? null }
  async upsertCourse(course: Course) {
    const idx = this.courses.findIndex(c => c.id === course.id)
    if (idx >= 0)
      this.courses[idx] = course
    else this.courses.push(course)
    await this.bump()
  }

  async deleteCourse(id: string) {
    this.courses = this.courses.filter(c => c.id !== id)
    await this.bump()
  }

  async listTemplates() { return this.templates }
  async upsertTemplate(template: CourseTemplate) {
    const idx = this.templates.findIndex(t => t.id === template.id)
    if (idx >= 0)
      this.templates[idx] = template
    else this.templates.push(template)
    await this.bump()
  }

  async deleteTemplate(id: string) {
    this.templates = this.templates.filter(t => t.id !== id)
    await this.bump()
  }

  async listSchedules() { return this.schedules }
  async upsertSchedule(schedule: Schedule) {
    const idx = this.schedules.findIndex(s => s.id === schedule.id)
    if (idx >= 0)
      this.schedules[idx] = schedule
    else this.schedules.push(schedule)
    await this.bump()
  }

  async deleteSchedule(id: string) {
    this.schedules = this.schedules.filter(s => s.id !== id)
    await this.bump()
  }

  async listRecycle() { return this.recycle }
  async addRecycle(item: RecycleItem) {
    this.recycle.push(item)
    await this.bump()
  }

  async deleteRecycle(id: string) {
    this.recycle = this.recycle.filter(r => r.course.id !== id)
    await this.bump()
  }

  async getSettings() { return this.settings }
  async putSettings(settings: AppSettings) {
    this.settings = settings
    await this.bump()
  }

  private async bump() {
    this.version += 1
    this.updatedAt = Date.now()
  }
}
