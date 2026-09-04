<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { getCurrentInstance, onMounted, onUnmounted } from 'vue'
import { navigateToInterceptor } from '@/router/interceptor'
import { initDeviceState } from '@/store/device'
import { tabbarStore } from '@/tabbar/store'
import { permission } from '@/router/permission'
import { createNotificationChannel, requestNotificationPermission, scheduleCourseNotifications, startForegroundService, rescheduleNotifications } from '@/utils/notification'

const { proxy } = (getCurrentInstance() || {}) as any
const router = proxy?.$router

router && permission.install(router)

onLaunch((options) => {
  console.log('App.vue onLaunch', options)
  // 初始化窗口尺寸监听（平板判定 / 旋转 / 分屏）
  initDeviceState()
  // #ifdef APP-PLUS
  // APP 启动时：创建通知渠道 + 请求权限 + 启动前台服务
  createNotificationChannel()
  requestNotificationPermission().then((granted) => {
    if (!granted) {
      console.warn('通知权限未授予，课前提醒功能将无法正常工作')
    }
  })
  startForegroundService()
  // 启动后调度今日课程通知
  const appStore = useAppStore()
  const courseStore = useCourseStore()
  if (appStore.settings.notificationEnabled) {
    scheduleCourseNotifications(courseStore.courses, appStore.settings)
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
    rescheduleNotifications(courseStore.courses, appStore.settings)
  }
  // #endif
})
onHide(() => {
  console.log('App Hide')
  // #ifdef APP-PLUS
  // 应用进入后台：启动前台服务保活
  startForegroundService()
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
