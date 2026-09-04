<script setup lang="ts">
import { showSideRail } from '@/store/device'
</script>

<template>
  <!-- 平板端给左侧导航栏让出 80px；h-full 保持页面内部的 flex/高度链不被打断 -->
  <view class="h-full" :style="showSideRail ? { paddingLeft: '80px' } : undefined">
    <slot />
  </view>
</template>
