import { computed, ref } from 'vue'
import { isLandscape } from './landscape'

/** 窗口尺寸（pt），onWindowResize 时更新（旋转/分屏） */
export const windowWidth = ref(0)
export const windowHeight = ref(0)

function updateWindowSize() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
  windowWidth.value = info.windowWidth
  windowHeight.value = info.windowHeight
}

/** 平板判定沿用 Android sw600dp 约定：屏幕较短边 >= 600pt，横竖屏都成立 */
export const isTablet = computed(() => Math.min(windowWidth.value, windowHeight.value) >= 600)

/** 平板端显示侧边导航栏（横屏看板除外，横屏时与手机一致全屏铺开） */
export const showSideRail = computed(() => isTablet.value && !isLandscape.value)

/** 底部 tabbar 的占位高度：平板（侧边导航接管）/ 横屏时为 0 */
export const bottomBarHeight = computed(() => (showSideRail.value || isLandscape.value) ? 0 : 50)

let inited = false

/** App onLaunch 时调用，注册窗口尺寸监听（旋转/分屏时更新） */
export function initDeviceState() {
  if (inited) {
    return
  }
  inited = true
  updateWindowSize()
  uni.onWindowResize?.(() => updateWindowSize())
}
