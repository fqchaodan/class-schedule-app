# 分支与版本切换

本项目在演进过程中形成三个可切换的版本，全部保留为独立分支 + 不可变 tag。
`master` 是可自由移动的工作指针，随时可以指向其中任意一个版本。

## 版本对照

| 模式 | 分支 | tag | 数据存哪 | 关键差异 |
|------|------|-----|----------|----------|
| 纯本地 | `backup/local-storage` | `v0.4.0-local` | 仅设备本地 storage | 无登录、无网络请求，导入导出走文件 |
| 手动同步 | `backup/cloud-sync-manual` | `v0.4.0-manual` | Cloudflare Worker + KV | 设置页手动「推送/拉取」，需填服务器与令牌 |
| 纯后端 | `backup/cloud-sync-hono-d1` | `v0.4.0-backend` | Cloudflare D1 | 登录账号、启动水合、自动同步、前台轮询 |

> tag 是锚点，不会随分支移动；分支上的提交若被改动，以 tag 指向的提交为准。

## 切换方式

**切到纯后端（Hono + D1）**

```bash
git reset --hard backup/cloud-sync-hono-d1
npx pnpm@10 install
```

**切到纯本地**

```bash
git reset --hard backup/local-storage
npx pnpm@10 install
```

**切到手动同步**

```bash
git reset --hard backup/cloud-sync-manual
npx pnpm@10 install
```

## 切换必做

1. **先确认工作区干净**：`git status`。`reset --hard` 会丢弃未提交改动，也会丢弃 master 上不属于目标分支的提交（这些提交在别的分支上有，但当前指针会丢）。
2. **重跑依赖安装**：三个版本依赖不同（纯后端多 `hono` / `wrangler`），不装会直接构建失败。
3. **重新打包客户端**：手机 APK / 小程序都要重新构建安装，旧包仍是旧模式。纯后端版启动会强制登录，纯本地版直接进课表。
4. **数据不用迁移**：`src/types/course.ts` 的 `updatedAt` / `schemaVersion: 1` 在三版之间一致，本地 storage 互通。但纯后端版登录后以 D1 为准水合本机，切回本地版前建议先在旧包里确认数据已落到本机。

## 生成物说明

`src/pages.json`、`src/manifest.json` 被 gitignore，切换分支不会跟着变。
`@uni-helper/vite-plugin-uni-pages` 构建时按 `src/pages/` 目录**重新扫描**生成路由，所以切到纯后端后 `pages/login/login` 会自动出现，切到纯本地后自动消失，无需手改。若产物路由异常，跑一次 `npx pnpm@10 dev` 让插件重写文件即可。

## 远程状态

`class-schedule-app/master` 当前停在 `cc04f52`（手动同步版）。本地三个备份分支均未推送。
要把远程改成某个版本，需要 `git push --force-with-lease class-schedule-app master`，推之前务必确认目标 tag。
