# class-schedule-app 项目笔记

## 技术栈与结构
- unibest v4.4.1 base 模板（uni-app + Vue3 + TS + Vite + UnoCSS + Pinia + pinia-plugin-persistedstate），未引入 UI 库，纯 UnoCSS + 原生组件。
- 3 tab：pages/index/index（**课表，仅周视图**：7 天分组卡片，顶部「标题行 + 日期导航行」（‹ 日期 › 今天 + 本周共 N 节课），无右上角控件）、pages/list/list（**每周看板**：课程表网格，时间轴 06:00-24:00 sticky 左 + 7 列 + 课程绝对定位，scroll-x 横滚整表 + scroll-y 纵滚，列宽 120×缩放[0.8,1,1.2,1.4]，右上角 zoom +/-；周导航 ‹/›/今天）、pages/stats/stats（统计）；非 tab 页：course/edit、course/detail、settings、recycle、templates。
- 数据模型见 src/types/course.ts：Course（**studentName 必填为主体**、name 选填备注、自定义起止时间、跨天、notes、fee、meetingUrl 会议链接、completed 已上状态、templateId）、CourseTemplate（kind: cycle周期排课 | course课程模板，课程模板含 studentName/courseName/meetingUrl）、RecycleItem、ExportFile（schemaVersion:1）。
- store：course（CRUD/冲突检测/toggleCompleted/备注/搜索/insertMany/replaceById）、recycle、template（buildCourses 批量生成 + saveCourseAsTemplate 存课程模板）、app（defaultFee/通知设置）。
- 冲突规则：边界相接不算冲突；跨天课按每天时间段比较；保存时弹 ConflictDialog 可"仍要保存"。
- **视觉规范（2026-09-02 全面去渐变化）**：主色 indigo-500 仅做小面积点缀（FAB 纯色 bg-indigo-500、图标、进度条、激活态 tag），**全站不再使用大面积 indigo→blue 渐变块**（gradient-primary/gradient-primary-br shortcut 已从 uno.config 删除）；头部/工具条统一 `bg-gradient-to-b from-indigo-50 to-white` 浅染色（勿改回纯白或品牌渐变，用户两头都嫌丑），标题 text-gray-900；tabbar **无品牌激活色**：激活 #111827（+font-medium）/未激活 #9ca3af，顶部渐变指示条已删；卡片 rounded-2xl + bg-white + shadow-card，CourseCard 无外框线、仅左侧 border-l-4 状态色条（已上 emerald-400/未上 amber-400）+ 渐变首字头像（6 组渐变在 uno safelist，保留）；统计页汇总卡头部 indigo-50 染色 + 数字 tabular-nums；列表空状态用紧凑虚线空槽（border-dashed）而非 wd-empty 大图标。
- **页面布局铁律**：所有页面根容器 `flex h-screen flex-col overflow-hidden bg-gray-50`（页面不滚动、背景撑满）；顶部工具条/搜索/tab `shrink-0` 固定；内容区统一 `h-0 min-h-0 flex-1 overflow-y-auto`（h-0 防 flex 子项溢出、与头部一起撑满视口）；**有输入/textarea 的页（edit/detail）底部操作条用 `fixed bottom-0 left-0 right-0 z-20`**，内容区 pb-32 让位；FAB `fixed bottom-26 right-6` 放滚动容器外；tab 页内容区需 pb-28 避开自定义 tabbar。
- **课程模板流程**：编辑/详情页"存为模板"（模板名=学生姓名，同名覆盖）→ 模板管理页"用于新增"跳 `edit?tplId=xx` 预填 → 编辑页顶部"从模板填充"选择器。导入校验强制学生姓名非空、课程名可空。
- **胶囊安全区（2026-10-10 结论：已放弃让位方案）**：首页原本右上角的「周/日」`wd-segmented` 在小程序下总被微信胶囊遮挡，试过 paddingRight 让位、flex 预留区等三种方案均未彻底解决，**最终按用户要求直接删掉周/日切换功能**，首页只保留周视图。`src/utils/platform.ts` 已删除，NavBar/stats 的让位改动已还原。**当前所有页面右上角都没有自定义控件，不需要做胶囊让位**；今后若再往右上角加东西，记住：微信胶囊固定绘制在右上角（约 87×32pt、距右 10pt），元素压上去必被挡且不可点击，最稳妥是**别把控件放右上角**。
- **`wx.getMenuButtonBoundingClientRect()` 必须等页面 ready 再调（关键坑）**：在 `<script setup>` 顶层（模块求值期）调用拿到的是异常/空值，让位计算会静默失效并 fallback 到普通边距 → 元素仍压在胶囊下。要在 `onMounted` 里测、`onReady(nextTick)` 补测。另：测不到时**绝不能** fall through 到普通平台的 16px 分支。
- **微信小程序没有 `window`（踩坑）**：appservice 里 `window` 是 undefined，`window.addEventListener?.()` 这种**可选链只保护方法不存在、不保护对象不存在**，读属性即抛 `TypeError: Cannot read property 'addEventListener' of undefined`。正确写法是先 `typeof window !== 'undefined'` 判断；App.vue 里同类代码用 `// #ifdef H5` 包裹。
- **顶部工具条不要用 wd-segmented（踩坑）**：wot-ui 的 segmented 默认 `width:100%`（配 justify-between 无法靠右），且 presetUni 给它注入 `vertical-align: middle`，在自定义导航栏行内会向上浮动压住标题。**结论：顶部工具条里的分段切换一律手写**（`flex items-center rounded-lg bg-gray-100 p-0.5` + 固定尺寸 `h-7 w-9` 子项 + 激活态 `bg-indigo-500 text-white`），不依赖第三方组件。stats.vue 的范围切换仍用 wd-segmented（用户暂未反馈问题）。
- **`AppSettings.defaultView` 已删除（2026-10-10）**：周/日切换功能移除后该字段无引用，已从 `src/types/course.ts` 的 `AppSettings` 与 `DEFAULT_SETTINGS` 中删除。
- **微信小程序平台能力边界与降级约定（2026-10-10）**：
  - **横屏（看板）**：小程序**不支持运行时切屏**（`pageOrientation` 只能 pages.json 静态配），因此 `list.vue` 用 `canRotate`（`#ifdef MP` 置 false）隐藏工具条旋转按钮与右上角浮动旋转按钮；`rotateScreen()` 的 MP 分支直接 toast 并 `return undefined`；另在 MP 段强制 `isLandscape.value = false` 兜底。**关键风险**：`isLandscape` 是全局状态，置真会同时隐藏标题/工具条/tabbar，小程序端若无旋转能力就会卡死在「假横屏」，任何新增入口都必须保证能退出。小程序端看板竖屏 + 缩放（ZOOM_LEVELS 8 档）仍可用。
  - **文件导入导出**：小程序无 DOM（无 Blob/`a.download`/`<input type=file>`），但**可以实现**：导出 = `uni.getFileSystemManager().writeFile()` 写 `${USER_DATA_PATH}/xxx.json` → `uni.shareFileMessage()` 转发到聊天长期保存（用户取消分享不算失败）；导入 = `uni.chooseMessageFile({ type:'file', extension:['json'] })` 从聊天记录选文件 → `fs.readFile` → `JSON.parse`。实现在 `src/utils/file-io.ts` 的 `exportFileMp` / `pickImportFileMp`（配 `#ifndef MP → reject` 兜底），settings.vue 的 `#ifdef MP` 分支调用它们，**后续解析/校验/预览/doImport 流程完全复用，无需区分平台**。
  - **`uni.env` 无类型声明（踩坑）**：`@dcloudio/types` 里 `Uni` 没有 `env`，写 `uni.env.USER_DATA_PATH` 会报 TS2339（即使外层有 `#ifdef MP`，MP 构建的类型检查照样报）。用 `(uni as unknown as { env?: {...} }).env?.USER_DATA_PATH ?? globalThis.wx?.env?.USER_DATA_PATH ?? ''` 兜底。而 `getFileSystemManager` / `shareFileMessage` / `chooseMessageFile` **有**类型，直接 `uni.xxx` 即可，不要写 `(uni as any)`。
  - **`return` 后紧跟条件编译块会被 esbuild 警告**：`// #ifdef XXX` 段落里以裸 `return` 结尾时，esbuild 自动插分号会产生 `The following expression is not returned because of an automatically-inserted semicolon`。写成 `return undefined` 即可。

## 环境注意事项（必读）
- dev 用 `npx pnpm@10 dev`（全局 pnpm 被 safe-delete 补丁损坏）。
- vite.config.ts 的三个 dts 已设 false；@uni-helper 两个插件的写文件调用已加 try/catch（重装 node_modules 后要重新打补丁）。
- src/pages.json 与 src/manifest.json 是手动维护的生成文件（沙箱禁止 vite 改写）；新增页面时需手动把路由加进 src/pages.json。
- 沙箱内新建文件可以，改写/删除已有文件不行；Write/Edit 工具不受限。
- AutoImport dirs 已含 'src/store'；新增 store 文件无需手动配，但手维护的 src/types/auto-import.d.ts 需同步补声明（模板约定 dts:false 手维护）。
