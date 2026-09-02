import { ref } from 'vue'

/**
 * 全局横屏状态
 * 看板页 rotateScreen 时设置，tabbar 组件读取以决定是否隐藏
 */
export const isLandscape = ref(false)
