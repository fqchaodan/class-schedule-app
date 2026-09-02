import type { AppSettings, Course, CourseTemplate, ExportFile } from '@/types/course'
import { DEFAULT_SETTINGS } from '@/types/course'
import { findConflicts } from './conflict'
import { isValidDate, isValidTime } from './time'

export const EXPORT_APP_ID = 'teacher-schedule'
export const SCHEMA_VERSION = 1

/** 构造导出对象 */
export function buildExportFile(courses: Course[], templates: CourseTemplate[], settings: AppSettings): ExportFile {
  return {
    app: EXPORT_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    courses,
    templates,
    settings,
  }
}

/**
 * 校验导入文件，返回错误信息；通过时返回规范化后的数据
 */
export function validateImportFile(raw: unknown):
  | { ok: true, data: ExportFile }
  | { ok: false, error: string } {
  if (raw == null || typeof raw !== 'object')
    return { ok: false, error: '文件内容不是合法的 JSON 对象' }
  const obj = raw as Record<string, unknown>
  if (obj.app !== EXPORT_APP_ID)
    return { ok: false, error: '不是本应用导出的文件（缺少 app 标识）' }
  if (obj.schemaVersion !== SCHEMA_VERSION)
    return { ok: false, error: `文件版本不支持（schemaVersion=${String(obj.schemaVersion)}，当前支持 ${SCHEMA_VERSION}）` }
  if (!Array.isArray(obj.courses) || !Array.isArray(obj.templates))
    return { ok: false, error: '缺少 courses 或 templates 数组' }

  const courses: Course[] = []
  for (let i = 0; i < (obj.courses as unknown[]).length; i++) {
    const c = obj.courses[i] as Record<string, unknown>
    const label = `课程#${i + 1}`
    if (typeof c.id !== 'string' || !c.id)
      return { ok: false, error: `${label}：缺少 id` }
    if (typeof c.studentName !== 'string' || !c.studentName.trim())
      return { ok: false, error: `${label}：学生姓名不能为空` }
    if (c.name != null && (typeof c.name !== 'string' || !c.name.trim()))
      return { ok: false, error: `${label}：课程名格式错误` }
    if (typeof c.startDate !== 'string' || !isValidDate(c.startDate))
      return { ok: false, error: `${label}：开始日期格式错误（${String(c.startDate)}）` }
    if (typeof c.endDate !== 'string' || !isValidDate(c.endDate))
      return { ok: false, error: `${label}：结束日期格式错误（${String(c.endDate)}）` }
    if (c.endDate < c.startDate)
      return { ok: false, error: `${label}：结束日期早于开始日期` }
    if (typeof c.startTime !== 'string' || !isValidTime(c.startTime))
      return { ok: false, error: `${label}：开始时间格式错误（${String(c.startTime)}）` }
    if (typeof c.endTime !== 'string' || !isValidTime(c.endTime))
      return { ok: false, error: `${label}：结束时间格式错误（${String(c.endTime)}）` }
    if (Number(c.endTime.replace(':', '')) <= Number(c.startTime.replace(':', '')))
      return { ok: false, error: `${label}：结束时间需晚于开始时间` }
    const notes = Array.isArray(c.notes) ? c.notes : []
    if (c.fee != null && (typeof c.fee !== 'number' || c.fee < 0))
      return { ok: false, error: `${label}：课时费格式错误` }
    courses.push({
      id: c.id,
      studentName: c.studentName.trim(),
      name: typeof c.name === 'string' ? c.name.trim() : undefined,
      startDate: c.startDate,
      endDate: c.endDate,
      startTime: c.startTime,
      endTime: c.endTime,
      fee: typeof c.fee === 'number' ? c.fee : undefined,
      meetingUrl: typeof c.meetingUrl === 'string' && c.meetingUrl ? c.meetingUrl : undefined,
      completed: c.completed === true,
      notes: notes as Course['notes'],
      templateId: typeof c.templateId === 'string' ? c.templateId : undefined,
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0,
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
    })
  }

  const templates: CourseTemplate[] = []
  for (let i = 0; i < (obj.templates as unknown[]).length; i++) {
    const t = obj.templates[i] as Record<string, unknown>
    const label = `模板#${i + 1}`
    if (typeof t.id !== 'string' || !t.id)
      return { ok: false, error: `${label}：缺少 id` }
    if (typeof t.name !== 'string' || !t.name.trim())
      return { ok: false, error: `${label}：模板名不能为空` }
    if (!Array.isArray(t.weekdays) || t.weekdays.some(d => typeof d !== 'number' || d < 0 || d > 6))
      return { ok: false, error: `${label}：weekdays 格式错误` }
    if (typeof t.startTime !== 'string' || !isValidTime(t.startTime))
      return { ok: false, error: `${label}：开始时间格式错误` }
    if (typeof t.endTime !== 'string' || !isValidTime(t.endTime))
      return { ok: false, error: `${label}：结束时间格式错误` }
    if (typeof t.weeks !== 'number' || t.weeks < 1)
      return { ok: false, error: `${label}：生成周数需 ≥ 1` }
    templates.push({
      id: t.id,
      name: t.name.trim(),
      kind: t.kind === 'course' ? 'course' : undefined,
      studentName: typeof t.studentName === 'string' && t.studentName ? t.studentName : undefined,
      courseName: typeof t.courseName === 'string' && t.courseName ? t.courseName : undefined,
      meetingUrl: typeof t.meetingUrl === 'string' && t.meetingUrl ? t.meetingUrl : undefined,
      weekdays: t.weekdays as number[],
      startTime: t.startTime,
      endTime: t.endTime,
      fee: typeof t.fee === 'number' ? t.fee : undefined,
      weeks: t.weeks,
      startDate: typeof t.startDate === 'string' ? t.startDate : undefined,
      enabled: t.enabled !== false,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : 0,
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : 0,
    })
  }

  const settings = (obj.settings && typeof obj.settings === 'object')
    ? { ...DEFAULT_SETTINGS, ...(obj.settings as AppSettings) }
    : { ...DEFAULT_SETTINGS }

  return {
    ok: true,
    data: {
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0,
      courses,
      templates,
      settings,
    },
  }
}

/** 导入预统计：与现有数据比对 */
export function summarizeImport(
  incoming: Course[],
  existing: Course[],
): { addCount: number, overwriteCount: number, conflictCount: number } {
  const existingIds = new Set(existing.map(c => c.id))
  const addCount = incoming.filter(c => !existingIds.has(c.id)).length
  const overwriteCount = incoming.length - addCount
  const conflictCount = incoming.filter(
    c => findConflicts(existing, c, c.id).length > 0,
  ).length
  return { addCount, overwriteCount, conflictCount }
}

/** H5 导出为文件下载 */
export function downloadJsonH5(data: ExportFile, filename: string) {
  // #ifdef H5
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  // #endif
}

/**
 * APP 端导出：将 JSON 数据写入文件，返回文件路径
 *
 * 策略：
 *   1. 先用 plus.io 写入应用沙盒 _doc 目录（保证成功）
 *   2. Android 上再通过 Native.js (java.io.File) 复制到公共 Download 目录
 *   3. iOS 上只能写到沙盒，通过 plus.runtime.openFile 打开
 */
export function exportFileApp(data: ExportFile, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef APP
    const jsonStr = JSON.stringify(data, null, 2)
    const sandboxPath = `_doc/${filename}`

    // Step 1: 写入 _doc 沙盒目录
    plus.io.resolveLocalFileSystemURL(
      '_doc',
      (dirEntry) => {
        dirEntry.getFile(
          filename,
          { create: true, exclusive: false },
          (fileEntry) => {
            fileEntry.createWriter(
              (writer) => {
                writer.onwrite = () => {
                  // Step 2: Android 上尝试写入公共 Download 目录
                  // 使用 Native.js (java.io) 绕过 Android 10+ Scoped Storage 限制
                  const osName = plus.os.name
                  if (osName === 'Android') {
                    try {
                      const downloadDir = '/storage/emulated/0/Download'
                      const downloadFullPath = `${downloadDir}/${filename}`

                      const JavaFile = plus.android.importClass('java.io.File')
                      // 确保目录存在
                      const dirFile = new JavaFile(downloadDir)
                      if (!dirFile.exists())
                        dirFile.mkdirs()

                      // 直接用 FileWriter 写入 JSON 字符串，无需文件流复制
                      const FileWriter = plus.android.importClass('java.io.FileWriter')
                      const fw = new FileWriter(downloadFullPath)
                      fw.write(jsonStr)
                      fw.close()

                      // 写入公共目录成功，返回公共路径
                      resolve(downloadFullPath)
                      return
                    }
                    catch {
                      // 公共目录写入失败，回退到沙盒路径（Step 1 已写入成功）
                      resolve(sandboxPath)
                      return
                    }
                  }
                  // iOS 直接返回沙盒路径
                  resolve(sandboxPath)
                }
                writer.onerror = (e: unknown) => reject(e)
                writer.write(jsonStr)
              },
              (e: unknown) => reject(e),
            )
          },
          (e: unknown) => reject(e),
        )
      },
      (e: unknown) => reject(e),
    )
    // #endif
    // #ifndef APP
    reject(new Error('仅支持 APP 端'))
    // #endif
  })
}

/**
 * APP 端导入：弹出文件选择器，读取用户选择的 JSON 文件
 *
 * 使用 plus.io.chooseFile 选择文件，然后通过 Native.js (java.io.FileInputStream)
 * 读取文件内容，避免 plus.io.resolveLocalFileSystemURL 在 Android 10+ 上
 * 因 Scoped Storage 限制无法解析外部路径的问题。
 */
export function pickImportFileApp(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // #ifdef APP
    // plus.io.chooseFile 不在 @dcloudio/types 类型定义中，使用 as any 绕过
    const io = plus.io as any
    let settled = false // 防止回调被多次触发（某些机型 chooseFile 回调可能被调用两次）
    io.chooseFile(
      {
        title: '选择备份文件',
        filetypes: ['json'],
        multiple: false,
      },
      (e: { files: string[] } | null | undefined) => {
        if (settled)
          return
        settled = true

        // 用户取消选择时 e 可能为 null/undefined 或 files 为空数组
        if (!e || !e.files || !e.files.length || !e.files[0]) {
          reject(new Error('未选择文件'))
          return
        }
        const filePath = e.files[0]

        // 使用 Native.js (java.io) 读取文件，兼容 Android 10+ Scoped Storage
        const osName = plus.os.name
        if (osName === 'Android') {
          try {
            const File = plus.android.importClass('java.io.File')
            const fileObj = new File(filePath)
            if (!fileObj.exists()) {
              reject(new Error('文件不存在'))
              return
            }
            // 用 Scanner 读取整个文件为字符串，简单可靠
            const FileInputStream = plus.android.importClass('java.io.FileInputStream')
            const Scanner = plus.android.importClass('java.util.Scanner')
            const fis = new FileInputStream(filePath)
            const scanner = new Scanner(fis, 'UTF-8')
            // useDelimiter("\\A") 是常见技巧：匹配文件开头，hasNext 等价于「还有内容」
            scanner.useDelimiter('\\A')
            const content = scanner.hasNext() ? scanner.next() : ''
            scanner.close()
            fis.close()
            try {
              const raw = JSON.parse(String(content))
              resolve(raw)
            }
            catch {
              reject(new Error('文件不是合法的 JSON'))
            }
            return
          }
          catch {
            reject(new Error('读取文件失败'))
            return
          }
        }

        // iOS 使用 plus.io 的 FileReader 读取
        plus.io.resolveLocalFileSystemURL(
          filePath,
          (entry) => {
            ;(entry as unknown as PlusIoFileEntry).file(
              (file) => {
                const reader = new plus.io.FileReader()
                reader.onloadend = (ev) => {
                  try {
                    const result = (ev.target as any)?.result as string
                    if (!result) {
                      reject(new Error('读取文件失败'))
                      return
                    }
                    const raw = JSON.parse(result)
                    resolve(raw)
                  }
                  catch {
                    reject(new Error('文件不是合法的 JSON'))
                  }
                }
                reader.onerror = () => reject(new Error('读取文件失败'))
                reader.readAsText(file, 'utf-8')
              },
              (err: unknown) => reject(err),
            )
          },
          (err: unknown) => reject(err),
        )
      },
      // 错误回调（用户取消时某些机型会走这里）
      () => {
        if (settled)
          return
        settled = true
        reject(new Error('未选择文件'))
      },
    )
    // #endif
    // #ifndef APP
    reject(new Error('仅支持 APP 端'))
    // #endif
  })
}
