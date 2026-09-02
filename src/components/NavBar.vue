<script setup lang="ts">
/**
 * 自定义导航栏（配合 navigationStyle: 'custom' 使用）
 * - pt-safe 自动适配状态栏
 * - 左侧返回按钮（可隐藏）
 * - 居中标题
 * - 右侧插槽
 */
withDefaults(defineProps<{
  title?: string
  /** 是否显示返回按钮，默认显示 */
  showBack?: boolean
}>(), {
  title: '',
  showBack: true,
})

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  }
  else {
    // 页面栈中没有上一页（如直接通过 URL 访问），回退到首页
    uni.reLaunch({ url: '/pages/index/index' })
  }
}
</script>

<template>
  <view
    class="shrink-0 flex items-center bg-white border-b border-gray-100 px-3 pt-safe"
    style="height: calc(env(safe-area-inset-top) + 44px);"
  >
    <!-- 左侧：返回按钮 -->
    <view class="flex w-12 shrink-0 items-center">
      <view
        v-if="showBack"
        class="flex h-8 w-8 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
        @click="goBack"
      >
        <view class="i-carbon-arrow-left text-xl" />
      </view>
    </view>
    <!-- 中间：标题 -->
    <view class="min-w-0 flex-1 text-center">
      <text class="truncate text-base text-gray-900 font-semibold">{{ title }}</text>
    </view>
    <!-- 右侧：插槽 -->
    <view class="flex w-12 shrink-0 justify-end">
      <slot name="right" />
    </view>
  </view>
</template>
