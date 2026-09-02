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
      const REQUEST_CODE = 200
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

    // 构建通知
    const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')
    if (!NotificationCompat) {
      // 尝试旧版 API
      const Notification = plus.android.importClass('android.app.Notification')
      const notification = new Notification()
      notification.defaults = -1 // 全部默认（声音+振动+灯光）
      const Pi = plus.android.importClass('android.app.PendingIntent')
      const intent = mainActivity.getPackageManager().getLaunchIntentForPackage(mainActivity.getPackageName())
      const pendingIntent = Pi.getActivity(mainActivity, 0, intent, 0)
      notification.setLatestEventInfo(mainActivity, title, content, pendingIntent)
      notificationManager.notify(notificationId, notification)
      return
    }

    const builder = new NotificationCompat.Builder(mainActivity, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(content)
      .setSmallIcon(0x7f020001) // app icon resource id（uni-app 默认图标）
      .setAutoCancel(true)
      .setDefaults(-1) // 声音 + 振动 + 灯光

    // 设置点击后打开应用
    const Intent = plus.android.importClass('android.content.Intent')
    const PendingIntent = plus.android.importClass('android.app.PendingIntent')
    const launchIntent = mainActivity.getPackageManager().getLaunchIntentForPackage(mainActivity.getPackageName())
    const pendingIntent = PendingIntent.getActivity(mainActivity, notificationId, launchIntent, 0)
    builder.setContentIntent(pendingIntent)

    const notification = builder.build()
    notificationManager.notify(notificationId, notification)
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

    // 尝试使用 NotificationCompat
    const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')

    let foregroundNotification: any

    if (NotificationCompat) {
      const builder = new NotificationCompat.Builder(mainActivity, CHANNEL_ID)
        .setContentTitle('课程表运行中')
        .setContentText('正在为您监测课程安排')
        .setSmallIcon(0x7f020001)
        .setOngoing(true) // 不可滑动删除
        .setPriority(-1) // PRIORITY_LOW，不发出声音

      foregroundNotification = builder.build()
    }

    if (foregroundNotification && mainActivity.startForeground) {
      // 尝试通过 Activity 启动前台服务
      try {
        const Intent = plus.android.importClass('android.content.Intent')
        const ServiceIntent = new Intent(mainActivity, null)
        // 设置前台服务
        mainActivity.startForeground(FOREGROUND_NOTIFICATION_ID, foregroundNotification)
      }
      catch {
        // 某些 Android 版本不支持 Activity.startForeground，使用 NotificationManager 持续显示
        notificationManager.notify(FOREGROUND_NOTIFICATION_ID, foregroundNotification)
      }
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

    if (mainActivity.stopForeground) {
      mainActivity.stopForeground(true)
    }
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
