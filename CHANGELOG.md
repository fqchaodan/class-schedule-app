# 更新日志

## 0.1.2 (2026-09-02)

### Bug 修复

#### 通知发送失败修复
- 修复 `sendNotification()` 中 `getPackageManager().getLaunchIntentForPackage()` 方法链在 plus.android 桥接下丢失的问题
- 新增 `buildLaunchPendingIntent()`：改用 `Intent.setClassName()` 显式构建启动 Intent，绕过链式调用限制
- 新增 `getAppIconResId()`：通过反射 `R$id` / `R$drawable` 动态查找应用图标，替代硬编码 resource id
- 修复 `startForegroundService()` 中不存在的 `mainActivity.startForeground` 调用，统一使用 `notificationManager.notify()`
- PendingIntent 使用 `FLAG_IMMUTABLE` 满足 Android 12+ 强制要求

## 0.1.1 (2026-09-02)

### 新增功能

#### 触觉反馈系统
- 新增 `src/utils/feedback.ts`：封装 APP 端触觉反馈（`lightTap`/`successTap`），支持 Android 振动和 iOS UIImpactFeedbackGenerator
- 新增加载状态管理器 `showLoading`/`hideLoading`/`resetLoading`，防止多个加载弹窗叠加
- 全局所有交互按钮（导航、切换、增删、跳转等）均接入触觉反馈

#### APP 端系统通知与后台保活
- 新增 `src/utils/notification.ts`：完整实现 Android 系统级通知
  - 通知渠道创建（Android 8.0+ 兼容）
  - 运行时通知权限请求（Android 13+ POST_NOTIFICATIONS）
  - 课前提醒通知调度（基于课程表 + 可配置提前时间）
  - 前台服务保活（Android foreground service）
  - 通知内容模板支持变量：`{student}`/`{course}`/`{time}`
- `App.vue` 集成通知生命周期：
  - `onLaunch`：创建渠道 → 请求权限 → 启动前台服务 → 调度今日通知
  - `onShow`：从后台恢复时重新调度通知
  - `onHide`：进入后台时启动前台服务保活
- 设置页新增通知设置面板：开关、提前提醒时间（5/10/15/30/60 分钟）、通知模板编辑

#### 看板页横屏重构
- 新增 `src/store/landscape.ts`：全局横屏状态 `isLandscape`，供看板页和 tabbar 共享
- 看板页横屏模式全面重构：
  - 移除 H5 CSS 旋转方案，改用物理屏幕旋转 + 全屏 API
  - 新增旋转过渡蒙层（淡入淡出动画），提升旋转体验
  - 横屏时自适应列宽填满屏幕，增大行高，卡片内容显示更完整
  - 横屏时隐藏标题栏和工具栏，显示浮动旋转按钮
  - 横屏时自动隐藏 tabbar（通过全局 `isLandscape` 状态联动）

#### 课程卡片长按删除
- `CourseCard.vue` 新增长按删除功能（500ms 长按 → 确认对话框 → 移入回收站）
- 新增 `disableDelete` 属性，支持禁用长按删除
- 接入 touch 事件模拟长按，兼容 H5 / 小程序 / APP

### 优化改进

#### 交互体验
- 时间选择器粒度从 5 分钟改为 1 分钟，支持更精确的时间设定
- 日期选择器从 `wd-datetime-picker` 升级为 `wd-calendar`，日历视图更直观
- 课程详情页和编辑页新增键盘高度适配，底部操作栏随键盘弹起动态上移
- 回收站页 `scroll-view` 改为 `overflow-y-auto`，布局更稳定
- 回收站页日期信息改为 flex 布局，避免长文本溢出

#### 代码质量
- `src/store/course.ts`：使用统一的 `addDays` 工具函数替代内联日期计算
- 回收站页和课程详情页使用 `formatDateTime` 替代 `toLocaleString`，时间格式统一
- 设置页导出文件名使用 `today()` 替代 `new Date().toISOString()`

#### UI 视觉
- tabbar 选中色从深灰 `#111827` 改为主题色 indigo `#6366f1`
- tabbar 新增「设置」入口
- 首页移除设置按钮入口（改由 tabbar 进入）
- 设置页改为自定义导航栏，与首页风格统一

#### 配置更新
- `manifest.config.ts`：Android `targetSdkVersion` 升级至 33
- 新增 Android 权限：前台服务、开机启动、通知、精确定时等
- `pages.config.ts`：APP 端新增页面切换动画（slide-in-right, 300ms）
- `DragFab.vue`：新增屏幕旋转时重新计算位置的 `onResize` 逻辑

### 提交记录

| 提交 | 说明 |
|------|------|
| `00a1b0f` | feat: 新增触觉反馈、系统通知、横屏状态工具模块 |
| `52a1ea6` | chore: 更新全局配置(APP权限/页面动画/版本号) |
| `ba154f0` | refactor: store和hooks重构 |
| `2a308e2` | feat: 公共组件增强(长按删除/触觉反馈/屏幕旋转适配) |
| `cdde8f3` | feat: app.vue 集成 APP 端通知与前台服务 |
| `77a6b65` | feat: 页面交互增强(触觉反馈+日历选择器+键盘适配) |
| `dbc6ab0` | feat: 看板页横屏重构(物理旋转+过渡动画+自适应列宽) |
| `164591d` | feat: 设置页新增课前通知功能模块 |
| `db70e93` | feat: tabbar 优化(主题色/横屏隐藏/设置入口) |
