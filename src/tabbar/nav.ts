import { lightTap } from '@/utils/feedback'
import { tabbarCacheEnable } from './config'
import { tabbarList, tabbarStore } from './store'

/**
 * 切换到指定 tab 的导航逻辑
 * 底部 tabbar（index.vue）与平板侧边导航（SideRail.vue）共用
 */
export function navigateToTab(index: number) {
  // 当前高亮和真实页面都已经是目标 tab 时，不重复跳转
  if (index === tabbarStore.curIdx && tabbarStore.isCurrentRouteTabbarItem(index)) {
    return
  }
  lightTap()
  const item = tabbarList.value[index]
  if (!item) {
    return
  }
  const url = item.pagePath
  const prevIdx = tabbarStore.curIdx
  tabbarStore.setCurIdx(index)
  const syncTabbarAfterNavigation = () => {
    tabbarStore.syncCurIdxByCurrentPageAsync()
  }
  const restoreTabbarWhenNavigationFailed = () => {
    tabbarStore.setCurIdx(prevIdx)
  }
  if (tabbarCacheEnable) {
    uni.switchTab({
      url,
      success: syncTabbarAfterNavigation,
      fail: restoreTabbarWhenNavigationFailed,
    })
  }
  else {
    uni.navigateTo({
      url,
      success: syncTabbarAfterNavigation,
      fail: restoreTabbarWhenNavigationFailed,
    })
  }
}
