<script setup lang="ts">
// 平板端侧边导航栏（MD3 Navigation Rail 风格）
// 与底部 tabbar 复用同一份 tabbarList 配置与 tabbarStore 状态
import { safeAreaBottom, statusBarHeight } from '@/utils/systemInfo'
import { isLandscape } from '@/store/landscape'
import { tabbarList, tabbarStore } from './store'
import { navigateToTab } from './nav'

// 激活态使用主题色（与底部 tabbar 一致的 indigo-500），非激活态用灰色
const activeColor = '#6366f1'
const inactiveColor = '#9ca3af'

function getColorByIndex(index: number) {
  return tabbarStore.curIdx === index ? activeColor : inactiveColor
}
</script>

<template>
  <view v-if="!isLandscape" class="side-rail-glass border-and-fixed" @touchmove.stop.prevent>
    <view :style="{ height: `${statusBarHeight}px` }" />
    <view class="flex flex-1 flex-col items-center gap-1 pt-2">
      <view
        v-for="(item, index) in tabbarList" :key="index"
        class="flex flex-col items-center justify-center gap-0.5 pb-1 pt-1"
        :style="{ color: getColorByIndex(index) }"
        @click="navigateToTab(index)"
      >
        <view
          class="h-32px w-56px center rounded-2xl transition-colors"
          :class="tabbarStore.curIdx === index ? 'bg-indigo-100/80' : ''"
        >
          <view class="text-24px" :class="item.icon" />
        </view>
        <view class="text-11px" :class="tabbarStore.curIdx === index ? 'font-medium' : ''">
          {{ item.text }}
        </view>
      </view>
    </view>
    <view :style="{ height: `${safeAreaBottom}px` }" />
  </view>
</template>

<style scoped lang="scss">
.border-and-fixed {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* 与底部 tabbar 一致的毛玻璃质感 */
.side-rail-glass {
  width: 80px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-right: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 1px 0 24px rgba(0, 0, 0, 0.06);
}
</style>
