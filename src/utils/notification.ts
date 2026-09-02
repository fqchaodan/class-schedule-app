/**
 * APP 端系统通知 + 后台保活工具
 *
 * 功能：
 * 1. 课前通知：根据课程表定时发送系统级通知
 * 2. 后台保活：通过 Android 前台 Service 保持应用活跃
 * 3. 通知权限请求与检查
 *
 * 使用条件编译：仅在 APP-PLUS 端生效
 */

import type { Course } from '@/types/course'
import type { AppSettings } from '@/types/course'
import { dayjs } from '@/utils/time'

/** 通知通道 ID */
const CHANNEL_ID = 'course_reminder'
/** 前台服务通知 ID */
const FOREGROUND_NOTIFICATION_ID = -1
/** 课前通知 ID 基数 */
const COURSE_NOTIFICATION_BASE = 1000

/**
 * 创建通知渠道（Android 8.0+ 需要）
 */
export function createNotificationChannel() {
  // #ifdef APP-PLUS
  if (plus.os.name !== 'Android')
    return

  try {
    const NotificationManager = plus.android.importClass('android.app.NotificationManager')
    const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')

    if (!NotificationManager || !NotificationChannel)
      return

    const Context = plus.android.importClass('android.content.Context')
    const mainActivity = plus.android.runtimeMainActivity()
    const notificationManager = mainActivity.getSystemService(Context.NOTIFICATION_SERVICE)

    // 检查渠道是否已存在
    const existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)
    if (existingChannel) {
      // 已存在则删除重建，确保配置最新
      notificationManager.deleteNotificationChannel(CHANNEL_ID)
    }

    const importance = NotificationManager.IMPORTANCE_HIGH
    const channel = new NotificationChannel(CHANNEL_ID, '课前提醒', importance)
    channel.setDescription('上课前提醒通知')
    channel.enableVibration(true)
    channel.enableLights(true)
    channel.setShowBadge(true)

    notificationManager.createNotificationChannel(channel)
  }
  catch (e) {
    console.error('创建通知渠道失败', e)
  }
  // #endif
}

/**
 * 请求通知权限（Android 13+ 需要运行时请求 POST_NOTIFICATIONS）
 */
export function requestNotificationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    if (plus.os.name !== 'Android') {
      resolve(true)
      return
    }

    try {
      const sdkInt = plus.os.version ? Number(plus.os.version) : 0
      // Android 13 (SDK 33) 以下不需要运行时请求
      if (sdkInt < 33) {
        resolve(true)
        return
      }

      const mainActivity = plus.android.runtimeMainActivity()
      const PackageManager = plus.android.importClass('android.content.pm.PackageManager')
      if (!PackageManager) {
        resolve(false)
        return
      }

      // 检查是否已授予权限
      const granted = mainActivity.checkSelfPermission('android.permission.POST_NOTIFICATIONS')
      if (granted === PackageManager.PERMISSION_GRANTED) {
        resolve(true)
        return
      }

      // 请求权限
      plus.android.requestPermissions(
        ['android.permission.POST_NOTIFICATIONS'],
        () => resolve(true),
        () => resolve(false),
      )
    }
    catch (e) {
      console.error('请求通知权限失败', e)
      resolve(false)
    }
    // #endif
    // #ifndef APP-PLUS
    resolve(true)
    // #endif
  })
}

/**
 * 获取应用图标 resource id
 * 通过 R.id.app_icon 获取，兼容不同 uni-app 版本
 */
function getAppIconResId(): number {
  // #ifdef APP-PLUS
  try {
    const mainActivity = plus.android.runtimeMainActivity()
    const packageName = mainActivity.getPackageName()
    const resources = mainActivity.getResources()
    const R_id = plus.android.importClass(`${packageName}.R$id`)
    // 尝试获取 app_icon，失败则用默认值
    if (R_id) {
      const fields = R_id.getFields()
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i]
        const name = String(field.getName())
        if (name === 'app_icon' || name === 'icon') {
          return field.getInt(null)
        }
      }
    }
    // 降级：通过资源名查找
    const R_drawable = plus.android.importClass(`${packageName}.R$drawable`)
    if (R_drawable) {
      const drawFields = R_drawable.getFields()
      for (let i = 0; i < drawFields.length; i++) {
        const field = drawFields[i]
        const name = String(field.getName())
        if (name === 'icon' || name === 'app_icon' || name === 'ic_launcher') {
          return field.getInt(null)
        }
      }
    }
  }
  catch {
    // 忽略，返回默认值
  }
  // #endif
  return 0x7f020001
}

/**
 * 构建点击通知后打开应用的 PendingIntent
 *
 * 不使用 getPackageManager().getLaunchIntentForPackage()，
 * 因为该方法在 plus.android 桥接下存在方法代理丢失问题（方法链丢失）。
 * 改用 Intent.setClassName() 显式指定启动 Activity。
 */
function buildLaunchPendingIntent(notificationId: number): any {
  // #ifdef APP-PLUS
  try {
    const mainActivity = plus.android.runtimeMainActivity()
    const Intent = plus.android.importClass('android.content.Intent')
    const PendingIntent = plus.android.importClass('android.app.PendingIntent')

    // 获取应用包名
    const packageName = mainActivity.getPackageName()

    // 获取主 Activity 类名（通常是 io.dcloud.PandoraEntry 或类似）
    const mainActivityClass = mainActivity.getClass()
    const mainActivityName = mainActivityClass.getName()

    // 用 setClassName 显式构建启动 Intent，绕过 getLaunchIntentForPackage
    const intent = new Intent(Intent.ACTION_MAIN)
    intent.addCategory(Intent.CATEGORY_LAUNCHER)
    intent.setClassName(packageName, mainActivityName)
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)

    // Android 12+ (SDK 31) 要求 PendingIntent 必须指定 mutability flag
    // FLAG_IMMUTABLE = 0x04000000 (1 << 6 = 64, 但实际值是 67108864)
    const FLAG_IMMUTABLE = 0x04000000
    return PendingIntent.getActivity(mainActivity, notificationId, intent, FLAG_IMMUTABLE)
  }
  catch (e) {
    console.error('构建 PendingIntent 失败', e)
    return null
  }
  // #endif
  // #ifndef APP-PLUS
  return null
  // #endif
}

/**
 * 发送单条系统通知
 */
function sendNotification(title: string, content: string, notificationId: number) {
  // #ifdef APP-PLUS
  if (plus.os.name !== 'Android')
    return

  try {
    const mainActivity = plus.android.runtimeMainActivity()
    const Context = plus.android.importClass('android.content.Context')
    const notificationManager = mainActivity.getSystemService(Context.NOTIFICATION_SERVICE)

    // 构建点击 Intent
    const pendingIntent = buildLaunchPendingIntent(notificationId)

    // 获取应用图标 resource id
    const iconResId = getAppIconResId()

    // 尝试使用 NotificationCompat（AndroidX）
    const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')
    if (NotificationCompat) {
      const builder = new NotificationCompat.Builder(mainActivity, CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(content)
        .setSmallIcon(iconResId)
        .setAutoCancel(true)
        .setDefaults(-1) // 声音 + 振动 + 灯光

      if (pendingIntent)
        builder.setContentIntent(pendingIntent)

      const notification = builder.build()
      notificationManager.notify(notificationId, notification)
      return
    }

    // 降级：旧版 Notification API（Android 7.x 及以下）
    const Notification = plus.android.importClass('android.app.Notification')
    if (Notification) {
      const notification = new Notification()
      notification.defaults = -1 // 全部默认（声音+振动+灯光）
      try {
        notification.icon = iconResId
        notification.tickerText = title
      }
      catch {
        // 忽略属性设置失败
      }
      if (pendingIntent && notification.setLatestEventInfo)
        notification.setLatestEventInfo(mainActivity, title, content, pendingIntent)
      notificationManager.notify(notificationId, notification)
      return
    }

    console.warn('无法构建通知：NotificationCompat 和 Notification 均不可用')
  }
  catch (e) {
    console.error('发送通知失败', e)
  }
  // #endif
}

/**
 * 格式化通知内容
 */
function formatNotificationContent(course: Course, template: string): string {
  return template
    .replace(/\{student\}/g, course.studentName || '未命名')
    .replace(/\{course\}/g, course.name || '课程')
    .replace(/\{time\}/g, `${course.startTime}-${course.endTime}`)
}

/**
 * 调度课前通知
 *
 * 策略：查找今天尚未开始的课程，在上课前 advanceMinutes 分钟发送通知。
 * 使用 setTimeout 实现（APP 后台时由前台服务保活维持）。
 *
 * @param courses 全部课程
 * @param settings 应用设置
 */
export function scheduleCourseNotifications(courses: Course[], settings: AppSettings) {
  // #ifdef APP-PLUS
  if (!settings.notificationEnabled) {
    return
  }

  const advance = settings.notificationAdvanceMinutes ?? 15
  const template = settings.notificationTemplate ?? '即将上课：{student} 的 {course}，时间 {time}'
  const now = dayjs()
  const todayStr = now.format('YYYY-MM-DD')

  // 找出今天覆盖的课程
  const todayCourses = courses.filter(c =>
    c.startDate <= todayStr && c.endDate >= todayStr,
  )

  for (const course of todayCourses) {
    // 计算上课时间的时间戳
    const courseStartTime = dayjs(`${course.startDate}T${course.startTime}:00`)
    const notifyTime = courseStartTime.subtract(advance, 'minute')

    // 如果通知时间已经过了，跳过
    if (notifyTime.isBefore(now))
      continue

    // 如果课程已经结束，跳过
    const courseEndTime = dayjs(`${course.endDate}T${course.endTime}:00`)
    if (courseEndTime.isBefore(now))
      continue

    const delayMs = notifyTime.diff(now)
    // 使用 course.id 生成稳定的 notificationId
    let idHash = 0
    for (let i = 0; i < course.id.length; i++)
      idHash = ((idHash << 5) - idHash + course.id.charCodeAt(i)) | 0
    const notificationId = COURSE_NOTIFICATION_BASE + Math.abs(idHash)
    const content = formatNotificationContent(course, template)

    const timer = setTimeout(() => {
      // 再次检查当前时间是否在通知窗口内
      const currentNow = dayjs()
      const currentCourseStart = dayjs(`${course.startDate}T${course.startTime}:00`)
      const diff = currentCourseStart.diff(currentNow, 'minute')
      // 如果距离上课时间在 0~advance 分钟内，发送通知
      if (diff >= 0 && diff <= advance + 1) {
        sendNotification('课前提醒', content, notificationId)
      }
      // 执行完毕后从 timerMap 中移除
      timerMap.delete(timer)
    }, delayMs)
    timerMap.set(timer, course.id)
  }
  // #endif
}

/**
 * 启动前台服务（后台保活）
 *
 * 通过创建一个持续运行的 Android 前台通知，
 * 让系统认为应用在前台运行，避免被杀死。
 */
export function startForegroundService() {
  // #ifdef APP-PLUS
  if (plus.os.name !== 'Android')
    return

  try {
    createNotificationChannel()

    const mainActivity = plus.android.runtimeMainActivity()
    const Context = plus.android.importClass('android.content.Context')
    const notificationManager = mainActivity.getSystemService(Context.NOTIFICATION_SERVICE)

    const iconResId = getAppIconResId()
    const pendingIntent = buildLaunchPendingIntent(FOREGROUND_NOTIFICATION_ID)

    // 尝试使用 NotificationCompat
    const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')

    let foregroundNotification: any

    if (NotificationCompat) {
      const builder = new NotificationCompat.Builder(mainActivity, CHANNEL_ID)
        .setContentTitle('课程表运行中')
        .setContentText('正在为您监测课程安排')
        .setSmallIcon(iconResId)
        .setOngoing(true) // 不可滑动删除
        .setPriority(-1) // PRIORITY_LOW，不发出声音

      if (pendingIntent)
        builder.setContentIntent(pendingIntent)

      foregroundNotification = builder.build()
    }

    if (foregroundNotification) {
      // 使用 NotificationManager 持续显示（最可靠的方案）
      notificationManager.notify(FOREGROUND_NOTIFICATION_ID, foregroundNotification)
    }
    else {
      // 降级方案：使用普通持续通知
      sendNotification('课程表运行中', '正在为您监测课程安排', FOREGROUND_NOTIFICATION_ID)
    }

    console.log('前台服务已启动')
  }
  catch (e) {
    console.error('启动前台服务失败', e)
  }
  // #endif
}

/**
 * 停止前台服务
 */
export function stopForegroundService() {
  // #ifdef APP-PLUS
  if (plus.os.name !== 'Android')
    return

  try {
    const mainActivity = plus.android.runtimeMainActivity()
    const Context = plus.android.importClass('android.content.Context')
    const notificationManager = mainActivity.getSystemService(Context.NOTIFICATION_SERVICE)
    notificationManager.cancel(FOREGROUND_NOTIFICATION_ID)

    console.log('前台服务已停止')
  }
  catch (e) {
    console.error('停止前台服务失败', e)
  }
  // #endif
}

/**
 * 应用从后台恢复时，重新调度通知
 */
export function rescheduleNotifications(courses: Course[], settings: AppSettings) {
  // #ifdef APP-PLUS
  if (!settings.notificationEnabled)
    return
  // 清除旧的定时器（由全局管理）
  clearAllNotificationTimers()
  // 重新调度
  scheduleCourseNotifications(courses, settings)
  // #endif
}

// ====== 定时器管理 ======
const timerMap = new Map<ReturnType<typeof setTimeout>, string>()

/**
 * 清除所有通知定时器
 */
export function clearAllNotificationTimers() {
  for (const [timer] of timerMap) {
    clearTimeout(timer)
  }
  timerMap.clear()
}
