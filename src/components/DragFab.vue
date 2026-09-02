<script setup lang="ts">
/**
 * 可拖拽悬浮按钮
 * - 支持拖拽移动位置，松手后自动吸附到最近的屏幕左/右边缘
 * - 单击（未发生拖拽）时触发 @click
 * - 使用 position: fixed + touch 事件实现，兼容 H5 / 小程序 / APP
 */
import { lightTap } from '@/utils/feedback'

const emit = defineEmits<{
  click: []
}>()

/** 按钮尺寸（px） */
const SIZE = 48
/** 初始距底部距离（px） */
const INIT_BOTTOM = 80
/** 初始距右侧距离（px） */
const INIT_RIGHT = 16
/** 吸附边缘后保留的间距（px） */
const EDGE_MARGIN = 16
/** 判定为「拖拽」而非「点击」的阈值（px） */
const DRAG_THRESHOLD = 5

// 按钮左上角坐标（相对视口）
const x = ref(0)
const y = ref(0)

// 初始位置标记，延迟到 mounted 后计算
const inited = ref(false)

// 拖拽过程中记录
let startX = 0
let startY = 0
let originX = 0
let originY = 0
let moved = false

// 视口尺寸
let vw = 0
let vh = 0

function initPosition() {
  const info = uni.getWindowInfo()
  vw = info.windowWidth
  vh = info.windowHeight
  // 初始放在右下角
  x.value = vw - SIZE - INIT_RIGHT
  y.value = vh - SIZE - INIT_BOTTOM - 50 // 减去 tabbar 高度估算
  inited.value = true
}

function onTouchStart(e: any) {
  const t = e.touches[0]
  startX = t.clientX
  startY = t.clientY
  originX = x.value
  originY = y.value
  moved = false
}

function onTouchMove(e: any) {
  const t = e.touches[0]
  const dx = t.clientX - startX
  const dy = t.clientY - startY
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
    moved = true
  let nx = originX + dx
  let ny = originY + dy
  // 限制在视口内
  nx = Math.max(0, Math.min(nx, vw - SIZE))
  ny = Math.max(0, Math.min(ny, vh - SIZE))
  x.value = nx
  y.value = ny
}

function onTouchEnd() {
  if (moved) {
    // 吸附到最近的左/右边缘
    const center = x.value + SIZE / 2
    if (center < vw / 2)
      x.value = EDGE_MARGIN
    else
      x.value = vw - SIZE - EDGE_MARGIN
    // 确保 y 不超出
    y.value = Math.max(0, Math.min(y.value, vh - SIZE))
  }
  else {
    // 未拖拽 → 触发点击
    lightTap()
    emit('click')
  }
}

onMounted(() => {
  initPosition()
})

// APP 端旋转屏幕时重新计算位置
function onResize() {
  if (inited.value) {
    const info = uni.getWindowInfo()
    vw = info.windowWidth
    vh = info.windowHeight
    // 保持相对位置比例，吸附到最近的边缘
    const center = x.value + SIZE / 2
    if (center < vw / 2)
      x.value = EDGE_MARGIN
    else
      x.value = vw - SIZE - EDGE_MARGIN
    y.value = Math.max(0, Math.min(y.value, vh - SIZE))
  }
}
uni.onWindowResize?.(onResize)

onUnmounted(() => {
  uni.offWindowResize?.(onResize)
})
</script>

<template>
  <view
    v-if="inited"
    class="fixed z-50 flex items-center justify-center rounded-full bg-indigo-500 text-white shadow-float active:scale-90 transition-transform"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${SIZE}px`, height: `${SIZE}px` }"
    @touchstart="onTouchStart"
    @touchmove.stop.prevent="onTouchMove"
    @touchend="onTouchEnd"
  >
    <view class="i-carbon-add text-xl" />
  </view>
</template>
