# 番茄课表云同步 Worker（Hono + D1）

服务端权威的课表 API。单一共享数据集：**一个写者**（writer token，可读写）+ **一个只读观看者**（viewer token，只读），供两人使用（一人维护课表，另一人只同步查看）。基于 [Hono](https://hono.dev/) + Cloudflare D1（SQLite）。

## 接口

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/health` | 公开 | 健康检查 |
| GET | `/api/me` | 任一 token | 返回 `{ role: 'writer' \| 'viewer' }`，客户端据此进入只读模式 |
| GET | `/api/snapshot` | 读 | 全量快照 `{ schedules, courses, templates, recycle, settings, version, updatedAt }` |
| PUT | `/api/snapshot` | 写 | 全量覆盖写入（事务），返回 `{ ok, version, updatedAt }` |
| GET/POST/PATCH/DELETE | `/api/courses`(`/:id`) | 读 / 写 | 课程行级 CRUD |
| GET/POST/PATCH/DELETE | `/api/templates`(`/:id`) | 读 / 写 | 模板 CRUD |
| GET/POST/PATCH/DELETE | `/api/schedules`(`/:id`) | 读 / 写 | 课表 CRUD |
| GET/POST/DELETE | `/api/recycle`(`/:id`) | 读 / 写 | 回收站 |
| GET/PUT | `/api/settings` | 读 / 写 | 设置 |
| GET/PUT | `/api/sync?username=` | 公开（兼容） | 旧版整份备份接口，读写映射到同一份 D1 快照 |
| POST | `/api/admin/import-kv?username=` | 写 | 把旧 KV 里 `user:<username>` 的整份备份一次性导入 D1 |

鉴权：`Authorization: Bearer <token>`。写请求用 viewer token 会返回 `403`。

## 首次部署

1. 确认 `class-schedule-db` 已存在（`wrangler.jsonc` 已绑定，database_id `927f59f2-…`）。
2. 应用 schema：

   ```bash
   pnpm sync:schema          # 线上
   pnpm sync:schema:local    # 本地模拟
   ```

3. 配置两个 token（密钥，不入库）：

   ```bash
   pnpm exec wrangler secret put WRITER_TOKEN --config sync-worker/wrangler.jsonc
   pnpm exec wrangler secret put VIEWER_TOKEN --config sync-worker/wrangler.jsonc
   ```

4. 部署：

   ```bash
   pnpm sync:deploy
   ```

## 本地开发 / 测试

```bash
pnpm sync:schema:local     # 本地建表
pnpm sync:dev              # 本地启动（.dev.vars 提供 token）
pnpm sync:test             # 单测（内存 Db，无需真实 D1）
```

本地先建 `sync-worker/.dev.vars`（已被 .gitignore 忽略）：

```
WRITER_TOKEN="local-writer"
VIEWER_TOKEN="local-viewer"
```

## 从旧 KV 迁移（数据不丢）

新 Worker 同时绑定了旧 KV（`SYNC_DATA`）与 D1。首次切换到 D1 后，用写者 token 调一次：

```bash
curl -X POST "https://api.fqcdan1001.dpdns.org/api/admin/import-kv?username=<旧用户名>" \
  -H "Authorization: Bearer <WRITER_TOKEN>"
```

即可把该用户名的旧整份备份导入 D1。确认无误后，可在 Cloudflare 控制台清理旧 KV。
