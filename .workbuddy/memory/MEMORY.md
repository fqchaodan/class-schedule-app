# class-schedule-app 项目笔记

## 技术栈与结构
- unibest v4.4.1 base 模板（uni-app + Vue3 + TS + Vite + UnoCSS + Pinia + pinia-plugin-persistedstate），未引入 UI 库，纯 UnoCSS + 原生组件。
- 3 tab：pages/index/index（课表，周/日切换 + 右上角设置）、pages/list/list（**每周看板**：课程表网格，时间轴 06:00-24:00 sticky 左 + 7 列 + 课程绝对定位，scroll-x 横滚整表 + scroll-y 纵滚，列宽 120×缩放[0.8,1,1.2,1.4]，右上角 zoom +/-；周导航 ‹/›/今天）、pages/stats/stats（统计）；非 tab 页：course/edit、course/detail、settings、recycle、templates。
- 数据模型见 src/types/course.ts：Course（**studentName 必填为主体**、name 选填备注、自定义起止时间、跨天、notes、fee、meetingUrl 会议链接、completed 已上状态、templateId）、CourseTemplate（kind: cycle周期排课 | course课程模板，课程模板含 studentName/courseName/meetingUrl）、RecycleItem、ExportFile（schemaVersion:1）。
- store：course（CRUD/冲突检测/toggleCompleted/备注/搜索/insertMany/replaceById）、recycle、template（buildCourses 批量生成 + saveCourseAsTemplate 存课程模板）、app（defaultView/defaultFee）。
- 冲突规则：边界相接不算冲突；跨天课按每天时间段比较；保存时弹 ConflictDialog 可"仍要保存"。
- **视觉规范（2026-09-02 全面去渐变化）**：主色 indigo-500 仅做小面积点缀（FAB 纯色 bg-indigo-500、图标、进度条、激活态 tag），**全站不再使用大面积 indigo→blue 渐变块**（gradient-primary/gradient-primary-br shortcut 已从 uno.config 删除）；头部/工具条统一 `bg-gradient-to-b from-indigo-50 to-white` 浅染色（勿改回纯白或品牌渐变，用户两头都嫌丑），标题 text-gray-900；tabbar **无品牌激活色**：激活 #111827（+font-medium）/未激活 #9ca3af，顶部渐变指示条已删；卡片 rounded-2xl + bg-white + shadow-card，CourseCard 无外框线、仅左侧 border-l-4 状态色条（已上 emerald-400/未上 amber-400）+ 渐变首字头像（6 组渐变在 uno safelist，保留）；统计页汇总卡头部 indigo-50 染色 + 数字 tabular-nums；列表空状态用紧凑虚线空槽（border-dashed）而非 wd-empty 大图标。
- **页面布局铁律**：所有页面根容器 `flex h-screen flex-col overflow-hidden bg-gray-50`（页面不滚动、背景撑满）；顶部工具条/搜索/tab `shrink-0` 固定；内容区统一 `h-0 min-h-0 flex-1 overflow-y-auto`（h-0 防 flex 子项溢出、与头部一起撑满视口）；**有输入/textarea 的页（edit/detail）底部操作条用 `fixed bottom-0 left-0 right-0 z-20`**，内容区 pb-32 让位；FAB `fixed bottom-26 right-6` 放滚动容器外；tab 页内容区需 pb-28 避开自定义 tabbar。
- **课程模板流程**：编辑/详情页"存为模板"（模板名=学生姓名，同名覆盖）→ 模板管理页"用于新增"跳 `edit?tplId=xx` 预填 → 编辑页顶部"从模板填充"选择器。导入校验强制学生姓名非空、课程名可空。

## 环境注意事项（必读）
- dev 用 `npx pnpm@10 dev`（全局 pnpm 被 safe-delete 补丁损坏）。
- vite.config.ts 的三个 dts 已设 false；@uni-helper 两个插件的写文件调用已加 try/catch（重装 node_modules 后要重新打补丁）。
- src/pages.json 与 src/manifest.json 是手动维护的生成文件（沙箱禁止 vite 改写）；新增页面时需手动把路由加进 src/pages.json。
- 沙箱内新建文件可以，改写/删除已有文件不行；Write/Edit 工具不受限。
- AutoImport dirs 已含 'src/store'；新增 store 文件无需手动配，但手维护的 src/types/auto-import.d.ts 需同步补声明（模板约定 dts:false 手维护）。
