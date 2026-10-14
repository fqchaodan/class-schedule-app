# 更新日志

## 0.4.0 (2026-10-14)

### 新增功能

#### 多课表管理（每张课表对应一位老师）
- 数据模型新增 `Schedule` 实体与 `Course.scheduleId`（`src/types/course.ts`）：课程归属某张课表，**缺省即默认课表，历史数据零迁移**
- 新增 `src/store/schedule.ts`（持久化）：创建 / 重命名 / 切换 / 删除课表；`ensureValid` 保证默认课表条目存在、激活 id 失效自动回退
- 设置页新增「课表管理」区块：列表展示课程数、行首对勾标记当前课表；「+ 新建课表」为虚线按钮；非默认课表可删除（其下课程移入回收站，可恢复），默认课表不可删
- 首页标题显示当前课表名，点击弹出快速切换面板（超过 6 张时引导去设置页）
- 数据隔离：课表页 / 看板 / 统计 / 冲突检测 / 周期模板生成 / 课前通知均只针对当前课表；新增课程自动归入当前课表
- 导入导出携带课表定义：导出文件新增 `schedules` 字段；导入自动合并课表并保留课程归属；**旧版备份文件完全兼容**（自动归默认课表）
- 回收站恢复时校验归属：原课表已删除的课程回退默认课表，不产生「孤儿课程」

#### 平台能力补全
- 小程序端设置页「课前提醒」不再显示空开关，改为平台能力降级说明；App 启动接入 `wx.getUpdateManager` 小程序更新提示
- 安卓通知生命周期修正：前台服务仅在开启提醒时启动/保活，关闭开关即时停止并清理常驻通知，启动时清理历史残留

### Bug 修复

#### 小程序端导出「打开分享面板失败」
- **根因**：`wx.shareFileMessage` 官方限制「仅在点击行为时调用」，必须与用户点击手势处于同一同步调用栈；原实现在 `writeFile` 异步回调中调用，真机报 `can only be invoked by user TAP gesture`
- **修复**：`exportFileMp` 改为 `fs.writeFileSync` 同步写入后直接调起分享（点击 → 写文件 → 分享面板全程同步）；失败提示区分手势限制 / 开发者工具 / 其他原因，并输出原始 errMsg 便于排查

#### 课表管理交互修复
- 修复设置页「默认课表重命名失败」「从其他课表切回默认失败」：弹窗按钮不再按模式动态增删（小程序端条件渲染的同类型组件实例复用导致事件失效），改为固定结构 + 禁用态；store 操作失败不再静默报成功
- 修复「清空全部数据」遗漏课表：`clearAll` 补充课表重置（新增 `scheduleStore.reset()`），并清理已排定的通知定时器

#### 其他修复
- wot-ui `confirmButtonColor` 全库失效（2.3.2 无此字段，红色确认按钮实际未生效）→ 6 处改用 `confirmButtonProps: { type: 'danger' }`
- `isValidDate('2026-02-30')` 误判合法：`time.ts` 补 dayjs `customParseFormat` 插件（新增测试抓出的真实 bug）
- 导入校验拒绝跨天课程，与「仅单日课程」数据模型对齐
- 安卓 11+ 分区存储下导出到公共目录必失败 → 存储权限仅 Android ≤10 申请，其余自动回退应用沙盒

### 优化改进

#### 性能
- 课表页 / 看板页改用 `computed Map<day, Course[]>` 单次遍历建索引，`courseCoversDay` 改纯字符串比较（原实现每次渲染约 28 / 14 次全量过滤 + 逐课 dayjs 计算）
- `CourseCard` 不再自带 `useDialog` / `useToast`（首页 N 张卡片会产生 2N 个弹窗实例）→ 页面级单例 + `@delete` 事件上浮
- 持久化防抖：新增 `src/store/persist-storage.ts`（300ms 防抖 + App `onHide` flush 兜底）；tabbar 激活索引未变化不再写 storage
- 首页补「时间冲突」标记（冲突课程卡片显示红色标签）

#### 工程与依赖
- 死代码清理约 3000 行：移除 unibest 模板残留（`src/http`、`src/api`、`src/service`、`router/permission`、`store/token`、`store/user`、`hooks/useScroll|useRequest|useUpload`、`utils/uploadFile|debounce|toLoginPage` 等），产物中 http/api/service 目录消失
- 依赖精简：移除 alova 三件套 / abortcontroller-polyfill / vue-i18n / z-paging；`@changesets/cli` 移至 devDependencies
- `.gitignore` 修复：移除 `src/types` 整目录忽略规则（原规则会连同核心 `course.ts` 一起忽略，新克隆无法构建），类型文件纳入版本管理
- `tsconfig.json` 补 `target: esnext`；生产构建保留 console.warn/error（不再全量删除）
- 测试体系建立：新增 time / conflict / file-io / course store / template store / schedule store 共 6 个测试文件；`type-check` 42 错清零、`lint` 32 错清零

#### 界面
- 课表管理改版：「当前」文字标识 → 行首对勾图标（固定占位保证名称对齐）；「新建课表」由列表行改为虚线加号按钮
- 安卓权限精简：manifest 权限 22 → 9（移除未使用权限，存储权限补 `maxSdkVersion=32`）

### 构建与资源
- 8 个页面全在主包，产物体积远低于 2MB 主包上限
- 版本号 0.3.0 → 0.4.0（package.json / manifest.config.ts versionCode 400）

## 0.3.0 (2026-10-10)

### 新增功能

#### 微信小程序端导入导出（真正实现）
- 小程序端不再只给「暂不支持」提示，改为可用：导出写入小程序私有目录后调起微信分享面板，导入从聊天记录选择文件
- `src/utils/file-io.ts` 新增 `exportFileMp(data, filename)`：`FileSystemManager.writeFile()` 写入 `${USER_DATA_PATH}/${filename}` → `uni.shareFileMessage()` 转发到聊天长期保存；用户取消分享不算失败
- `src/utils/file-io.ts` 新增 `pickImportFileMp()`：`uni.chooseMessageFile({ type: 'file', extension: ['json'] })` 从聊天记录选文件 → `readFile` 读取 → `JSON.parse`
- 两函数均以 `#ifndef MP → reject` 兜底，与 APP 版结构对称；解析后的校验/预览/合并流程完全复用，无需区分平台
- 设置页 `exportData()` / `pickImportFile()` 的 `#ifdef MP` 分支接入上述实现（`uni.showLoading` + 结果提示）

### 优化改进

#### 首页移除「周/日」视图切换
- 移除 `wd-segmented` 周/日切换，首页改为固定周视图，删除日视图分支与相关空状态
- 顶部恢复为「标题行 + 日期导航行」两行结构；`prevPeriod`/`nextPeriod`/`goToday` 简化为只操作 `curWeekStart`
- `src/types/course.ts`：删除已无引用的 `AppSettings.defaultView` 字段
- 原因：自定义导航栏右上角始终被微信胶囊遮挡，控件挪走/让位均不可靠，最终从需求层面去掉该入口

#### 看板页小程序端降级
- 新增 `canRotate` 标记，小程序端为 `false`：隐藏工具栏旋转按钮与横屏浮动旋转按钮
- `rotateScreen()` 小程序分支直接 toast 提示并返回，防止 `isLandscape` 被置真后卡在无法退出的「假横屏」
- 小程序端进入看板页时强制复位 `isLandscape`
- 竖屏看板与缩放（8 档）在小程序端保持可用

### 构建与资源
- `uno.config.ts`：safelist 补充 `i-carbon-rotate-clockwise`（替换旋转蒙层图标，原先使用的 `i-carbon-renewal-import` 加载失败）
- `src/components/NavBar.vue`：统一原子类书写顺序（无功能变更）
- `env/.env`：更新微信小程序 AppID

## 0.2.1 (2026-09-08)

### Bug 修复

#### 模板选择器修复
- 修复课程编辑页"从模板填充"功能选择模板无效果的问题
  - **根因**：`wd-picker` 的 `columns` 为字符串数组时，confirm 事件返回的 `value` 是选项值（模板名称字符串），而非数字索引；原代码用 `Number(value[0]) || 0` 转换字符串导致始终为 `0`，只能选中第一个模板
  - **修复**：改为通过模板名称字符串 `findIndex` 查找对应索引，同时修复 `selectedTemplateArr` setter 中的相同问题

### 优化改进

#### 移除跨天课程机制
- 课程不再支持跨天排课，"开始日期"更名为"上课日期"，移除"结束日期"字段
- 涉及改动：
  - `src/hooks/useCourseForm.ts`：移除 `endDate` ref 和 `isCrossDay` computed，`buildDraft()` 中 `endDate` 始终等于 `startDate`
  - `src/pages/course/edit.vue`：移除结束日期的日历选择器 UI 和相关逻辑，"开始日期"改为"上课日期"
  - `src/pages/course/detail.vue`：移除跨天标签和结束日期显示
  - `src/components/CourseCard.vue`：移除跨天标签和结束日期显示
  - `src/store/course.ts`：`duplicateCourse` 中 `endDate` 与 `startDate` 一致，`search` 简化不再检查 `endDow`
  - `src/pages/stats/stats.vue`：`courseDatesInRange` 和 `coursesInRange` 简化为单日期判断
  - `src/pages/recycle/recycle.vue`：移除结束日期显示
- **兼容性**：`Course` 接口保留 `endDate` 字段，已有数据和导入导出不受影响；新建/编辑课程时 `endDate` 始终等于 `startDate`

## 0.2.0 (2026-09-04)

### 新增功能

#### 平板适配与响应式布局
- 新增 `src/store/device.ts`：窗口尺寸监听（`windowWidth`/`windowHeight`）、平板判定（`isTablet`，基于 sw600dp 约定）、侧边导航显示开关（`showSideRail`）、底部 tabbar 占位高度（`bottomBarHeight`）
- 新增 `src/tabbar/SideRail.vue`：平板端侧边导航栏（MD3 Navigation Rail 风格），与底部 tabbar 复用同一份配置和状态
- 新增 `src/tabbar/nav.ts`：将 tabbar 导航逻辑提取为 `navigateToTab()`，底部 tabbar 与侧边导航共用
- `App.ku.vue` 集成 `SideRail` 与 `showSideRail` 状态联动
- `App.vue` `onLaunch` 调用 `initDeviceState()` 注册窗口尺寸监听
- `src/layouts/default.vue` 平板端给左侧导航栏让出 80px 宽度

### 优化改进

#### 各页面平板适配
- **课表页（index）**：周视图在平板上自动切换为多列网格（竖屏 2 列、宽屏 3 列），日视图居中限宽
- **看板页（list）**：横屏/大屏时列宽从固定像素改为百分比自适应填满屏幕，卡片字号和间距随屏幕尺寸动态调整
- **统计页（stats）**：分组条目多列网格排布（竖屏 2 列、宽屏 3 列），分组卡片重构——新增进度条和排行榜序号徽章，收入信息右对齐
- **课程详情/编辑/回收站页**：平板端内容区居中限宽（max-w-180/max-w-200），提升大屏阅读体验
- **设置页**：平板端两列网格排布，底部间距改用 `bottomBarHeight` 适配侧边导航

#### tabbar 代码精简
- `src/tabbar/index.vue` 导航逻辑从内联实现改为调用 `navigateToTab()`，减少约 30 行重复代码

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
