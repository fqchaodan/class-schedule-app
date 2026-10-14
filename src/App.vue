<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { onMounted, onUnmounted } from 'vue'
import { navigateToInterceptor } from '@/router/interceptor'
import { flushPersistStorage } from '@/store/persist-storage'
import { initDeviceState } from '@/store/device'
import { tabbarStore } from '@/tabbar/store'
import { createNotificationChannel, requestNotificationPermission, rescheduleNotifications, scheduleCourseNotifications, startForegroundService, stopForegroundService } from '@/utils/notification'
// #ifdef MP-WEIXIN
import checkUpdate from '@/utils/updateManager.wx'
// #endif

onLaunch((options) => {
  console.log('App.vue onLaunch', options)
  // 初始化窗口尺寸监听（平板判定 / 旋转 / 分屏）
  initDeviceState()
  // #ifdef MP-WEIXIN
  // 检查小程序新版本（有更新时提示重启应用）
  checkUpdate()
  // #endif
  // #ifdef APP-PLUS
  // APP 启动时：创建通知渠道；仅当用户开启了课前提醒时才请求权限、启动前台服务并调度
  createNotificationChannel()
  const appStore = useAppStore()
  const courseStore = useCourseStore()
  if (appStore.settings.notificationEnabled) {
    requestNotificationPermission().then((granted) => {
      if (!granted) {
        console.warn('通知权限未授予，课前提醒功能将无法正常工作')
      }
    })
    startForegroundService()
    scheduleCourseNotifications(courseStore.activeCourses, appStore.settings)
  }
  else {
    // 用户未开启提醒：清理历史版本可能残留在状态栏的常驻通知
    stopForegroundService()
  }
  // #endif
})
onShow((options) => {
  console.log('App.vue onShow', options)
  // 处理直接进入页面路由的情况：如h5直接输入路由、微信小程序分享后进入等
  // https://github.com/unibest-tech/unibest/issues/192
  if (options?.path) {
    navigateToInterceptor.invoke({ url: `/${options.path}`, query: options.query })
  }
  else {
    navigateToInterceptor.invoke({ url: '/' })
  }
  // #ifdef APP-PLUS
  // 应用从后台回到前台：重新调度通知
  const appStore = useAppStore()
  const courseStore = useCourseStore()
  if (appStore.settings.notificationEnabled) {
    rescheduleNotifications(courseStore.activeCourses, appStore.settings)
  }
  // #endif
})
onHide(() => {
  console.log('App Hide')
  // 进入后台前把防抖中的持久化数据强制落盘，避免未写入窗口内进程被回收
  flushPersistStorage()
  // #ifdef APP-PLUS
  // 仅在开启课前提醒时保活，避免用户看到关不掉的常驻通知
  const appStore = useAppStore()
  if (appStore.settings.notificationEnabled) {
    startForegroundService()
  }
  // #endif
})

// #ifdef H5
function syncTabbarWhenPageVisible() {
  if (document.visibilityState === 'visible') {
    tabbarStore.syncCurIdxByCurrentPageAsync()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', syncTabbarWhenPageVisible)
  window.addEventListener('pageshow', syncTabbarWhenPageVisible)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', syncTabbarWhenPageVisible)
  window.removeEventListener('pageshow', syncTabbarWhenPageVisible)
})
// #endif
</script>

<style lang="scss">

</style>
