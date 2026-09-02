<p align="center">
  <img width="80" src="favicon.ico">
</p>

<h1 align="center">番茄课表</h1>

<p align="center">轻量级家教课程管理工具 · 课表 / 看板 / 统计 / 模板 / 回收站</p>

---

## 简介

**番茄课表** 是一款面向个人家教老师的课程管理 App，基于 [unibest](https://github.com/feige996/unibest) 跨平台框架开发，支持 H5、微信小程序和 APP 三端运行。

所有数据本地存储，无需联网、无需注册，开箱即用。

### 核心功能

| 功能 | 说明 |
|------|------|
| 📅 **课表** | 周/日双视图，按天分组展示课程，支持快速翻页与"回到今天" |
| 🗓️ **每周看板** | 时间轴看板，7 列纵览整周课程，支持缩放与横屏全屏 |
| 📊 **课时统计** | 按日/周/月/年统计课时数、总时长、预计收入、已收/未收，支持按学生或课程分组 |
| ✏️ **课程编辑** | 学生姓名、课程名、起止日期/时间、课时费、腾讯会议链接，支持跨天课程 |
| 📋 **模板管理** | 课程模板（快速填充）与周期排课模板（按周批量生成），生成前冲突预览 |
| 🗑️ **回收站** | 删除的课程可恢复，恢复时自动检测时间冲突 |
| 📝 **课程备注** | 教学内容 / 学生情况 / 作业 / 课后反馈四类备注 |
| ⚠️ **冲突检测** | 新增/编辑课程时自动检测时间冲突，可强制保存 |
| 💾 **数据导入导出** | JSON 格式备份，支持合并覆盖 / 仅追加两种导入模式 |
| 🔒 **本地持久化** | Pinia + persistedstate，数据仅存于本机 |

## 技术栈

| 技术 | 说明 |
|------|------|
| [uniapp](https://uniapp.dcloud.net.cn/) | 跨平台框架，一套代码多端运行 |
| [Vue 3](https://vuejs.org/) | Composition API + `<script setup>` |
| [TypeScript](https://www.typescriptlang.org/) | 全量类型 |
| [Vite 5](https://vitejs.dev/) | 构建工具 |
| [UnoCSS](https://unocss.dev/) | 原子化 CSS |
| [Pinia](https://pinia.vuejs.org/) | 状态管理 + 持久化 |
| [Wot UI](https://wot-ui.cn/) | UI 组件库 |
| [dayjs](https://day.js.org/) | 日期处理 |

## 平台兼容性

| H5 | iOS | Android | 微信小程序 |
|:--:|:--:|:------:|:--------:|
| ✅ | ✅ | ✅ | ✅ |

> 文件导入导出功能仅在 H5 和 APP 端可用，小程序端暂不支持。

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9

### 安装与运行

```bash
# 安装依赖
pnpm install

# H5 开发（http://localhost:9000）
pnpm dev

# 微信小程序开发
pnpm dev:mp

# APP 开发
pnpm dev:app
```

### 构建生产版本

```bash
# H5
pnpm build

# 微信小程序
pnpm build:mp

# APP
pnpm build:app
```

## 目录结构

```
src/
├── pages/
│   ├── index/          # 课表（周/日视图）
│   ├── list/           # 每周看板（时间轴）
│   ├── stats/          # 课时统计
│   ├── course/
│   │   ├── detail.vue  # 课程详情
│   │   └── edit.vue    # 新增/编辑课程
│   ├── templates/      # 模板管理
│   ├── recycle/        # 回收站
│   └── settings/       # 设置（导入导出/偏好）
├── components/         # CourseCard / NavBar / DragFab / ConflictDialog
├── store/              # course / template / recycle / app
├── hooks/              # useCourseForm 等
├── utils/              # time / conflict / avatar / file-io 等
├── types/              # course.ts 数据模型
└── tabbar/             # 自定义底部导航
```

## 功能截图

<!-- TODO: 补充截图 -->

## License

[MIT](https://opensource.org/license/mit/)
