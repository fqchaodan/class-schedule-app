/**
 * APP 端交互反馈工具
 *
 * 统一封装触觉反馈、加载状态管理，
 * 避免在业务代码中散落 uni API 调用。
 */

/** 触觉反馈类型 */
type FeedbackType = 'light' | 'medium' | 'heavy'

/**
 * 触觉反馈（仅 APP 端生效）
 * 利用 plus 的原生振动 API，轻量级触感提示
 */
export function hapticFeedback(type: FeedbackType = 'light') {
  // #ifdef APP-PLUS
  try {
    // Android 振动时长（毫秒）
    const duration = type === 'heavy' ? 50 : type === 'medium' ? 30 : 15
    if (plus.os.name === 'Android') {
      const Context = plus.android.importClass('android.content.Context')
      const mainActivity = plus.android.runtimeMainActivity()
      const vibrator = mainActivity.getSystemService(Context.VIBRATOR_SERVICE)
      if (vibrator && vibrator.hasVibrator()) {
        vibrator.vibrate(duration)
      }
    }
    else {
      // iOS 使用 UIImpactFeedbackGenerator
      const UIImpactFeedbackGenerator = plus.ios.importClass('UIImpactFeedbackGenerator')
      if (UIImpactFeedbackGenerator) {
        const style = type === 'heavy' ? 0 : type === 'medium' ? 1 : 2
        const generator = UIImpactFeedbackGenerator.alloc().initWithStyle(style)
        generator.impactOccurred()
      }
    }
  }
  catch (e) {
    // 静默失败，触觉反馈是锦上添花
    console.debug('触觉反馈失败', e)
  }
  // #endif
}

/**
 * 轻量级触觉反馈（按钮点击等）
 */
export function lightTap() {
  hapticFeedback('light')
}

/**
 * 成功反馈（保存成功等）
 */
export function successTap() {
  hapticFeedback('medium')
}

/**
 * 加载状态管理器
 * 防止多个加载弹窗叠加显示
 */
let loadingCount = 0

export function showLoading(title = '加载中...') {
  loadingCount++
  if (loadingCount === 1) {
    uni.showLoading({ title, mask: true })
  }
}

export function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) {
    uni.hideLoading()
  }
}

/**
 * 重置加载状态（防止异常情况导致 loading 不消失）
 */
export function resetLoading() {
  loadingCount = 0
  uni.hideLoading()
}
