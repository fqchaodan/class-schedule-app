# 教培老师课程表 App —— 实现方案（基于 unibest）

> 状态：已确认（3 tab + 右上角设置入口）
> 日期：2026-08-31

## 一、技术选型

1. **框架**：`pnpm create unibest` 生成项目（uni-app + Vue3 + `<script setup>` + TypeScript + Vite + UnoCSS），保留约定式路由、layout 布局、自动导入等脚手架能力。
2. **UI 库**：wot-design-uni（unibest 默认集成、多端一致）。
3. **状态管理**：Pinia + `pinia-plugin-persistedstate`（unibest 内置），持久化到 uni 本地 storage。
4. **不引入**：请求封装（http）层、登录拦截、i18n。
5. **目标端**：先 H5（`pnpm dev`，浏览器验证），代码兼容小程序/App 端。
6. **文件导入导出**：JSON 文件。H5 用 Blob/`<a download>`，App/小程序端用 `uni.chooseFile / saveFile` 适配（封装 `file-io.ts` 做多端分支）。

## 二、目录结构（unibest 约定上的扩展）

```
src/
├─ pages/
│  ├─ index/index.vue        # 周视图（首页 tab，内含周/日切换）
│  ├─ list/index.vue         # 课程列表 + 搜索筛选（tab2）
│  ├─ stats/index.vue        # 课时/课时费统计（tab3）
│  ├─ course/edit.vue        # 课程新建/编辑
│  ├─ course/detail.vue      # 课程详情（含备注）
│  ├─ settings/index.vue     # 设置：导入导出、回收站、模板
│  ├─ recycle/index.vue      # 回收站
│  └─ templates/index.vue    # 周期排课模板管理
├─ layouts/default.vue       # 全局 tabbar 布局（3 tab + 右上角设置入口）
├─ components/
│  ├─ CourseCard.vue         # 课程卡片（周/日视图共用）
│  ├─ CourseForm.vue         # 课程表单（edit 页复用）
│  ├─ NoteList.vue / NoteEditor.vue
│  ├─ ConflictDialog.vue     # 冲突提示
│  ├─ ImportPreview.vue      # 导入前校验预览
│  └─ StatisticsSummary.vue
├─ store/
│  ├─ course.ts              # 课程 CRUD/冲突检测
│  ├─ note.ts                # 备注
│  ├─ template.ts            # 排课模板
│  ├─ recycle.ts             # 回收站
│  └─ app.ts                 # 设置项（默认视图、默认课时费等）
├─ utils/
│  ├─ time.ts                # 时间解析、比较、跨天判断
│  ├─ conflict.ts            # 时间重叠/冲突算法
│  ├─ file-io.ts             # 多端导入导出
│  └─ validate.ts            # 导入数据校验
└─ types/course.ts           # 全部 TS 类型定义
```

## 三、数据模型设计

### Course（课程）
| 字段 | 说明 |
|---|---|
| `id` | UUID |
| `name` | 课程名 |
| `studentName` | 学生姓名（支持搜索筛选，可空） |
| `startDate` / `endDate` | `YYYY-MM-DD`，支持跨天与多日课程 |
| `startTime` / `endTime` | `HH:mm`，完全自定义，不用固定节次格 |
| `fee` | 单次课时费（可空） |
| `notes: Note[]` | 内嵌备注数组 |
| `templateId?` | 来源模板（便于追溯） |
| `createdAt` / `updatedAt` | 时间戳 |

### Note（备注）
`id`、`type`（教学内容/学生情况/作业/课后反馈，枚举可扩展）、`content`、`createdAt`。

### Template（周期排课模板）
`id`、`name`、`weekdays`（0–6 数组）、`startTime/endTime`、`fee`、`weeks`（连续生成周数）、`enabled`。
应用模板 = 按周数批量生成 Course 实例（可预览再确认）。

### RecycleBinItem
删除时把 Course 快照移入 `recycle.ts`，保留 `deletedAt`，不自动清空，手动或一键清空。

### 导出文件结构
`{ app: "teacher-schedule", schemaVersion: 1, exportedAt, courses, templates, settings }`
—— 带 `schemaVersion` 为后续字段演进留迁移口。

## 四、本地存储与状态管理方案

1. 全部数据集中在 4 个 Pinia store，每个 store 配 `persist: true`，由插件写入 uni storage。
2. 单一数据源原则：视图只读 store + computed，所有增删改走 store action。
3. 冲突检测在 action 内做（新增/编辑/复制/应用模板时调用 `utils/conflict.ts`）：跨天课程按"每天的起止时间段"参与重叠判断，`(startA < endB) && (startB < endA)` 逐日比较。
4. 冲突不阻断保存：保存前弹窗展示冲突课程列表，可选择"仍要保存"或返回修改。
5. 导入策略：解析 → 校验（schemaVersion、必填字段、时间格式）→ ImportPreview 列出新增/覆盖/冲突数量 → 用户选择"合并（覆盖同 id）/ 仅追加 / 取消"→ 写入 store。

## 五、页面清单

| 页面 | 内容 |
|---|---|
| 周视图（首页 tab） | 按周切换，7 列课程卡片，冲突红色标记，头部切换周/日视图 |
| 日视图 | 单日时间轴排列，按开始时间排序，突出备注预览 |
| 课程编辑 | 自定义时间选择、跨天开关、复制课程入口、保存时冲突检测 |
| 课程详情 | 完整信息 + 备注列表/快速添加 |
| 课程列表（tab2） | 搜索（课程名/学生名模糊匹配）+ 筛选（按星期/学生） |
| 统计（tab3） | 本周/本月课时数、时长、收入，按学生/课程分组 |
| 设置（右上角入口） | 导出/导入、模板管理、回收站、默认课时费设置 |

### PM 视角补充与取舍
1. **周/日视图**：教培老师核心是"排课总览 + 当天上什么课"，两个都要。
2. **搜索筛选**：用学生名而非独立"学生表"，避免过度建模；一期不做学生档案页。
3. **课时与课时费统计**：只做简单次数×费率汇总，不做结算/账单。
4. **周期模板**：解决重复录入；生成后与模板**解耦**（单节可独立改），避免双向同步复杂度。
5. **回收站**：软删除，防误删。
6. **不做**：云同步、登录、Excel 导出、签到打卡——超出纯前端工具范围，留二期候选。

## 六、分阶段实现步骤

1. **阶段 0**：CLI 创建项目（选 base、wot-ui、不选 i18n/login），跑通 `pnpm dev`，清理示例页，配置 3 tab + 布局。
2. **阶段 1（核心）**：types + time/conflict 工具 → course store → 课程编辑页 → 周视图 + 日视图 → 冲突检测弹窗。
3. **阶段 2**：课程详情 + 备注体系，列表页 + 搜索筛选。
4. **阶段 3**：模板管理 + 批量生成（带预览），复制课程。
5. **阶段 4**：统计页（周/月汇总、按学生分组）。
6. **阶段 5**：回收站、导入导出（多端 file-io + 校验 + 导入预览）、设置页收尾。
7. **阶段 6**：H5 端整体走查（冲突提示、空状态、时间边界 00:00/23:59、跨天课显示），逐轮调细节。

## 七、已确认决策

- Tab 结构：**3 tab（课表 / 列表 / 统计）+ 右上角设置入口**。
- 目标端：先只跑 H5 验证。
