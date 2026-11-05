import type { AppSettings, Course, CourseTemplate, ExportFile, Schedule } from '@/types/course'
import { DEFAULT_SETTINGS } from '@/types/course'
import { findConflicts } from './conflict'
import { isValidDate, isValidTime } from './time'

export const EXPORT_APP_ID = 'teacher-schedule'
export const SCHEMA_VERSION = 1

/** 构造导出对象（schedules 为多课表信息，旧版本调用方可不传） */
export function buildExportFile(courses: Course[], templates: CourseTemplate[], settings: AppSettings, schedules?: Schedule[]): ExportFile {
  return {
    app: EXPORT_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    courses,
    templates,
    schedules,
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
    if (c.endDate !== c.startDate)
      return { ok: false, error: `${label}：暂不支持跨天/多日课程（开始日期与结束日期需一致）` }
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
      scheduleId: typeof c.scheduleId === 'string' && c.scheduleId ? c.scheduleId : undefined,
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

  // 多课表信息（旧版本备份无此字段）：宽松校验，id/name 合法即保留
  const schedules: Schedule[] = Array.isArray(obj.schedules)
    ? (obj.schedules as unknown[]).flatMap((item) => {
        const s = item as Record<string, unknown>
        if (typeof s?.id !== 'string' || !s.id || typeof s.name !== 'string' || !s.name.trim())
          return []
        return [{
          id: s.id,
          name: s.name.trim(),
          createdAt: typeof s.createdAt === 'number' ? s.createdAt : 0,
          updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : 0,
        }]
      })
    : []

  return {
    ok: true,
    data: {
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0,
      courses,
      templates,
      schedules,
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

                      // Native.js 桥接对象无类型定义，取 any 句柄使用
                      const JavaFile: any = plus.android.importClass('java.io.File')
                      // 确保目录存在
                      const dirFile = new JavaFile(downloadDir)
                      if (!dirFile.exists())
                        dirFile.mkdirs()

                      // 直接用 FileWriter 写入 JSON 字符串，无需文件流复制
                      const FileWriter: any = plus.android.importClass('java.io.FileWriter')
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
 * 小程序端导出：同步写入小程序文件系统，然后立即调起「转发到聊天」让用户保存
 *
 * 小程序无法直接下载文件到本地相册/文件夹，标准做法是转发到聊天（文件传输助手）长期保存。
 *
 * 关键约束：wx.shareFileMessage 官方限制「仅在点击行为时调用」——必须与用户的点击手势
 * 处于同一个同步调用栈。若放进 writeFile 等异步回调里触发，真机会报
 * "shareFileMessage:fail can only be invoked by user TAP gesture."。
 * 因此这里用 writeFileSync 同步写入（备份 JSON 体积小，耗时可忽略），紧接着直接调用分享。
 */
export function exportFileMp(data: ExportFile, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef MP
    const fs = uni.getFileSystemManager()
    // uni.env 在部分版本的类型定义中缺失，用 wx.env 兜底（二者在小程序端等价）
    const userDataPath = (uni as unknown as { env?: { USER_DATA_PATH: string } }).env?.USER_DATA_PATH
      ?? (globalThis as unknown as { wx?: { env?: { USER_DATA_PATH: string } } }).wx?.env?.USER_DATA_PATH
      ?? ''
    if (!userDataPath) {
      reject(new Error('无法获取小程序文件目录'))
      return
    }
    const filePath = `${userDataPath}/${filename}`
    // 同步写入：保持与用户点击手势同一调用栈，避免 shareFileMessage 报 TAP gesture 错误
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    }
    catch (e) {
      console.error('[exportFileMp] writeFileSync failed:', e)
      reject(new Error('写入文件失败'))
      return
    }
    uni.shareFileMessage({
      filePath,
      fileName: filename,
      success: () => resolve(filePath),
      fail: (err) => {
        const msg = String(err?.errMsg || '')
        console.warn('[exportFileMp] shareFileMessage fail:', err)
        // 用户取消分享不算失败，文件仍在本地，下次可重新导出
        if (msg.includes('cancel')) {
          resolve(filePath)
          return
        }
        if (msg.includes('TAP gesture')) {
          reject(new Error('分享面板未能打开，请重新点击导出'))
          return
        }
        // 开发者工具模拟器不支持该接口，给出明确指引，避免被误判为功能异常
        if (uni.getSystemInfoSync().platform === 'devtools') {
          reject(new Error('开发者工具不支持转发文件，请用手机预览后再试'))
          return
        }
        reject(new Error('打开分享面板失败'))
      },
    })
    // #endif
    // #ifndef MP
    reject(new Error('仅支持小程序端'))
    // #endif
  })
}

/**
 * 小程序端导入：从聊天记录选择文件并读取 JSON 内容
 *
 * 小程序无法浏览本地文件系统，唯一可控的入口是「从聊天记录选择文件」
 * （用户需先把备份文件发到任意聊天/文件传输助手）。
 */
export function pickImportFileMp(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // #ifdef MP
    let settled = false
    const finish = (fn: () => void) => {
      if (settled)
        return
      settled = true
      fn()
    }

    uni.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const file = res?.tempFiles?.[0]
        if (!file?.path) {
          finish(() => reject(new Error('未选择文件')))
          return
        }
        const fs = uni.getFileSystemManager()
        fs.readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (r) => {
            finish(() => {
              try {
                resolve(JSON.parse(String(r.data)))
              }
              catch {
                reject(new Error('文件不是合法的 JSON'))
              }
            })
          },
          fail: () => finish(() => reject(new Error('读取文件失败'))),
        })
      },
      fail: () => finish(() => reject(new Error('未选择文件'))),
    })
    // #endif
    // #ifndef MP
    reject(new Error('仅支持小程序端'))
    // #endif
  })
}

/**
 * 用 Native.js (java.io) 通过绝对路径直接读取文件内容。
 * 仅作为 plus.io FileReader 的降级方案——Android 10+ 分区存储下
 * 读取非本应用创建的外部文件会被系统拒绝（读出空内容）。
 */
function readFileViaNativeJs(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Native.js 桥接对象无类型定义，取 any 句柄使用
      const File: any = plus.android.importClass('java.io.File')
      const fileObj = new File(filePath)
      if (!fileObj.exists()) {
        reject(new Error('文件不存在'))
        return
      }
      const length = Number(fileObj.length())
      if (length === 0) {
        reject(new Error('文件内容为空，请重新导出备份文件'))
        return
      }

      // 用 BufferedReader 按行读取拼接，避免 byte[] 传参
      // （Native.js 不支持把 JS 数组直接当作 Java 原生数组传参）
      const FileInputStream: any = plus.android.importClass('java.io.FileInputStream')
      const InputStreamReader: any = plus.android.importClass('java.io.InputStreamReader')
      const BufferedReader: any = plus.android.importClass('java.io.BufferedReader')
      const fis = new FileInputStream(filePath)
      const reader = new BufferedReader(new InputStreamReader(fis, 'UTF-8'))
      let content = ''
      // readLine() 返回 null 表示 EOF；每行后补回换行符（最后一行多余的不影响 JSON.parse）
      for (;;) {
        const line: string | null = reader.readLine()
        if (line === null)
          break
        content += `${line}\n`
      }
      reader.close()
      fis.close()
      if (!content) {
        reject(new Error('文件内容为空，请重新导出备份文件'))
        return
      }

      // 去掉 UTF-8 BOM（Windows 记事本等编辑器保存的文件可能携带）
      if (content.charCodeAt(0) === 0xFEFF)
        content = content.slice(1)
      resolve(content)
    }
    catch {
      reject(new Error('读取文件失败'))
    }
  })
}

/**
 * 用 plus.io FileReader 读取文件（按绝对/相对路径先解析为 LocalFileEntry）。
 * plus.io 内部走系统 ContentResolver，天然兼容 content:// URI 与
 * Android 10+ 分区存储，是真机上读取用户选择文件的首选方式。
 */
function readFileViaPlusIo(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      filePath,
      (entry) => {
        ;(entry as unknown as PlusIoFileEntry).file(
          (file) => {
            if (!file.size) {
              reject(new Error('FILE_EMPTY'))
              return
            }
            const reader = new plus.io.FileReader()
            reader.onloadend = (ev) => {
              const result = (ev.target as any)?.result as string
              if (!result) {
                reject(new Error('FILE_EMPTY'))
                return
              }
              resolve(result)
            }
            reader.onerror = () => reject(new Error('FILE_READ_ERROR'))
            reader.readAsText(file, 'utf-8')
          },
          () => reject(new Error('FILE_READ_ERROR')),
        )
      },
      () => reject(new Error('FILE_RESOLVE_ERROR')),
    )
  })
}

/** 去掉 file:// 协议前缀：plus.io 认 URL，java.io.File 只认裸路径 */
function stripFileScheme(path: string): string {
  if (!path.startsWith('file://'))
    return path
  const raw = path.slice('file://'.length)
  try {
    return decodeURIComponent(raw)
  }
  catch {
    return raw
  }
}

/**
 * Native.js invoke 薄封装：桥接对象在 @dcloudio/types 中无方法定义，
 * 且「方法返回的实例」在部分 5+ 版本上没有方法代理，统一走 invoke 最稳。
 */
function plusAndroidInvoke(target: any, method: string, ...args: any[]): any {
  return (plus.android as any).invoke(target, method, ...args)
}

/**
 * 在 Java InputStream 上套一层按行读取的 BufferedReader。
 * 优先 newObject（不依赖类代理），失败时退回 new + importClass 的写法。
 */
function createJavaTextReader(stream: any): any {
  try {
    return (plus.android as any).newObject(
      'java.io.BufferedReader',
      (plus.android as any).newObject('java.io.InputStreamReader', stream, 'UTF-8'),
    )
  }
  catch {
    const InputStreamReader: any = plus.android.importClass('java.io.InputStreamReader')
    const BufferedReader: any = plus.android.importClass('java.io.BufferedReader')
    return new BufferedReader(new InputStreamReader(stream, 'UTF-8'))
  }
}

/**
 * 用 Android ContentResolver 读取 content:// URI 的文本内容。
 *
 * plus.io.chooseFile 在 Android 上走系统文档选择器（SAF），返回的是
 * `content://...` 形式的 URI 而不是文件路径。这类 URI：
 *   - plus.io.resolveLocalFileSystemURL 解析不了（返回错误）
 *   - java.io.File 只能构造出一个「不存在」的路径（exists() === false）
 * 唯一可靠的读法是 ContentResolver.openInputStream 拿字节流。
 * SAF 返回 URI 时已附带一次性读取授权，因此无需任何存储权限。
 */
function readFileViaContentResolver(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let reader: any = null
    try {
      const activity: any = plus.android.runtimeMainActivity()
      if (!activity) {
        reject(new Error('FILE_READ_ERROR'))
        return
      }
      const Uri: any = plus.android.importClass('android.net.Uri')
      const uriObj: any = Uri.parse(uri)

      // resolver / stream 都是「方法返回的实例」，没有方法代理，只能走 invoke
      const resolver: any = plusAndroidInvoke(activity, 'getContentResolver')
      if (!resolver) {
        reject(new Error('FILE_READ_ERROR'))
        return
      }
      const stream: any = plusAndroidInvoke(resolver, 'openInputStream', uriObj)
      if (!stream) {
        reject(new Error('FILE_NOT_FOUND'))
        return
      }

      reader = createJavaTextReader(stream)

      let content = ''
      // readLine() 返回 null 表示 EOF（部分机型返回 undefined，一并兜住避免死循环）
      for (;;) {
        const line: string | null | undefined = plusAndroidInvoke(reader, 'readLine')
        if (line === null || line === undefined)
          break
        content += `${line}\n`
      }
      if (!content) {
        reject(new Error('FILE_EMPTY'))
        return
      }

      // 去掉 UTF-8 BOM
      if (content.charCodeAt(0) === 0xFEFF)
        content = content.slice(1)
      resolve(content)
    }
    catch (e) {
      console.error('[readFileViaContentResolver] failed:', uri, e)
      reject(new Error('FILE_READ_ERROR'))
    }
    finally {
      try {
        if (reader)
          plusAndroidInvoke(reader, 'close')
      }
      catch {
        // 关闭失败不影响已读到内容，忽略
      }
    }
  })
}

/**
 * Android 读取用户选中文件：按路径形态依次尝试不同读取链路。
 *
 *   content:// URI（Android 7+ 系统选择器的标准返回格式）
 *     1. ContentResolver.openInputStream —— 唯一正解
 *     2. plus.io FileReader —— 个别 5+ 版本能直接解析，留作兜底
 *   文件路径 / file:// URL（老系统或第三方文件管理器返回）
 *     1. plus.io FileReader
 *     2. java.io.FileInputStream 直接路径读取
 */
async function readPickedFileAndroid(filePath: string): Promise<string> {
  const readers: Array<() => Promise<string>> = filePath.startsWith('content://')
    ? [() => readFileViaContentResolver(filePath), () => readFileViaPlusIo(filePath)]
    : [() => readFileViaPlusIo(filePath), () => readFileViaNativeJs(stripFileScheme(filePath))]

  let lastError: Error = new Error('FILE_READ_ERROR')
  for (const read of readers) {
    try {
      return await read()
    }
    catch (e) {
      lastError = e as Error
      // 文件确实是 0 字节：换任何方式读都是空，直接终止
      if (lastError.message === 'FILE_EMPTY')
        break
    }
  }
  throw lastError
}

/**
 * APP 端导入：弹出文件选择器，读取用户选择的 JSON 文件
 *
 * Android 走 readPickedFileAndroid 的多链路策略（content:// URI 必须用
 * ContentResolver 读），iOS 走 plus.io FileReader（沙盒路径可直接解析）。
 */
export function pickImportFileApp(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // #ifdef APP
    // plus.io.chooseFile 不在 @dcloudio/types 类型定义中，使用 as any 绕过
    const io = plus.io as any
    let settled = false // 防止回调被多次触发（某些机型 chooseFile 回调可能被调用两次）
    const finish = (fn: () => void) => {
      if (settled)
        return
      settled = true
      fn()
    }
    io.chooseFile(
      {
        title: '选择备份文件',
        filetypes: ['json'],
        multiple: false,
      },
      (e: { files: string[] } | null | undefined) => {
        if (settled)
          return

        // 用户取消选择时 e 可能为 null/undefined 或 files 为空数组
        if (!e || !e.files || !e.files.length || !e.files[0]) {
          finish(() => reject(new Error('未选择文件')))
          return
        }
        const filePath = e.files[0]
        const osName = plus.os.name

        const parseAndResolve = (content: string) => {
          try {
            const raw = JSON.parse(content)
            finish(() => resolve(raw))
          }
          catch {
            finish(() => reject(new Error('文件不是合法的 JSON')))
          }
        }

        const failUser = (msg: string) => finish(() => reject(new Error(msg)))

        if (osName === 'Android') {
          // 真机诊断：路径形态（content:// / file:// / 绝对路径）决定走哪条读取链路
          console.warn('[import] picked file:', filePath)
          readPickedFileAndroid(filePath)
            .then(parseAndResolve)
            .catch((err: Error) => {
              if (err.message === 'FILE_EMPTY') {
                failUser('文件内容为空，请重新导出备份文件')
                return
              }
              if (err.message === 'FILE_NOT_FOUND' || err.message === '文件不存在') {
                // 两条链路都判不存在：多半是 URI 授权已失效（文件被移动/删除）
                failUser('无法访问所选文件，请将备份文件复制到「Download」目录后重试')
                return
              }
              console.error('[import] read failed:', filePath, err)
              failUser('读取文件失败，请把备份文件放到手机「下载」目录后再试')
            })
          return
        }

        // iOS：plus.io FileReader 读取（沙盒路径可直接解析）
        readFileViaPlusIo(filePath)
          .then(parseAndResolve)
          .catch(() => failUser('读取文件失败'))
      },
      // 错误回调（用户取消时某些机型会走这里）
      () => {
        finish(() => reject(new Error('未选择文件')))
      },
    )
    // #endif
    // #ifndef APP
    reject(new Error('仅支持 APP 端'))
    // #endif
  })
}
