import type { CustomTabBarItem, CustomTabBarItemBadge } from './types'
import { computed, reactive } from 'vue'

import { tabbarList as _tabbarList, selectedTabbarStrategy, TABBAR_STRATEGY_MAP } from './config'

/** tabbarList 里面的 path 从 pages.config.ts 得到 */
const baseTabbarList = reactive<CustomTabBarItem[]>(_tabbarList.map(item => ({
  ...item,
  pagePath: item.pagePath.startsWith('/') ? item.pagePath : `/${item.pagePath}`, // 统一成 '/' 开头的路径
})))

/** tabbar 列表（本项目无角色体系，全量展示；保留 computed 以维持既有调用方式） */
const tabbarList = computed(() => baseTabbarList)

export function isPageTabbar(path: string) {
  if (selectedTabbarStrategy === TABBAR_STRATEGY_MAP.NO_TABBAR) {
    return false
  }
  const _path = normalizeRoutePath(path)
  return _path === '/' || tabbarList.value.some(item => item.pagePath === _path)
}

export function normalizeRoutePath(path?: string) {
  if (!path) {
    return ''
  }
  const _path = path.split('?')[0]
  return _path.startsWith('/') ? _path : `/${_path}`
}

function getCurrentPagePath() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return normalizeRoutePath(currentPage?.route)
}

function findTabbarIndexByPath(path?: string) {
  const normalizedPath = normalizeRoutePath(path)
  if (normalizedPath === '/') {
    return 0
  }
  return tabbarList.value.findIndex(item => item.pagePath === normalizedPath)
}

/**
 * 自定义 tabbar 的状态管理，原生 tabbar 无需关注本文件
 * tabbar 状态，增加 storageSync 保证刷新浏览器时在正确的 tabbar 页面
 * 使用reactive简单状态，而不是 pinia 全局状态
 */
const tabbarStore = reactive({
  curIdx: uni.getStorageSync('app-tabbar-index') || 0,
  prevIdx: uni.getStorageSync('app-tabbar-index') || 0,
  setCurIdx(idx: number) {
    // 值未变化时不写 storage，避免每次导航 / onShow 都触发一次同步写盘
    if (this.curIdx === idx)
      return
    this.curIdx = idx
    uni.setStorageSync('app-tabbar-index', idx)
  },
  setTabbarItemBadge(idx: number, badge: CustomTabBarItemBadge) {
    const list = tabbarList.value
    if (list[idx]) {
      list[idx].badge = badge
    }
  },
  setAutoCurIdx(path: string) {
    const list = tabbarList.value
    if (list.length === 0) {
      this.setCurIdx(0)
      return
    }

    const index = findTabbarIndexByPath(path)
    if (index >= 0) {
      this.setCurIdx(index)
      return
    }

    if (this.curIdx < 0 || this.curIdx >= list.length) {
      this.setCurIdx(0)
    }
  },
  syncCurIdxByCurrentPage() {
    const currentPath = getCurrentPagePath()
    if (currentPath) {
      this.setAutoCurIdx(currentPath)
    }
  },
  syncCurIdxByCurrentPageAsync() {
    setTimeout(() => {
      this.syncCurIdxByCurrentPage()
    }, 0)
  },
  isCurrentRouteTabbarItem(index: number) {
    const item = tabbarList.value[index]
    if (!item) {
      return false
    }
    return findTabbarIndexByPath(getCurrentPagePath()) === index
  },
  restorePrevIdx() {
    if (this.prevIdx === this.curIdx)
      return
    this.setCurIdx(this.prevIdx)
    this.prevIdx = uni.getStorageSync('app-tabbar-index') || 0
  },
})

export { tabbarList, tabbarStore }
