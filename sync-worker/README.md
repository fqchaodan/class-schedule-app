# 番茄课表云同步 Worker

这是一个极简 Cloudflare Worker，只提供健康检查和按用户名读写整份 JSON 备份；不使用 D1，不实现课程/课表 CRUD，不负责用户注册或密码认证。

## API

- `GET /health`：健康检查。
- `GET /api/sync?username=<用户名>`：读取 `{ backup, updatedAt }`；没有备份时返回 `404`。
- `PUT /api/sync?username=<用户名>`：覆盖保存该用户名的整份备份，并返回服务端 `updatedAt`。

用户名仅允许 1–32 位 Unicode 字母/数字、下划线、点和连字符；大小写视为相同。KV key 只含规范化用户名，不记录课程 CRUD 数据。

> 这是无认证的自用功能。知道用户名的人可以读取或覆盖对应数据；用户名不要使用敏感信息。客户端为手动模式：「推送」把本机数据整份覆盖云端，「拉取」用云端备份整份覆盖本机；并发操作没有冲突仲裁，以最后一次操作为准。KV 为最终一致性存储。

## 首次配置

1. 在 Cloudflare 控制台确认 `fqcdan1001.dpdns.org` Zone 可用，并且已有 API 子域名 `api.fqcdan1001.dpdns.org`。
2. 在项目根目录创建 KV namespace：

   ```bash
   pnpm sync:kv:create
   ```

3. 将 Wrangler 输出的 namespace ID 写入 `sync-worker/wrangler.jsonc` 的 `kv_namespaces[0].id`，然后登录 Cloudflare：

   ```bash
   pnpm exec wrangler login
   ```

4. 本地启动（本地 KV 模拟，不会改线上数据）：

   ```bash
   pnpm sync:dev
   ```

   测试：`http://localhost:8787/health`。

5. 部署：

   当前配置沿用既有 Worker 名称 `fanqie-schedule-api` 和 API 自定义域名，用同步专用代码更新旧接口；部署后 Worker 不再绑定 D1。D1 数据库本身不会因为解绑自动删除，确认旧数据不再需要后再从 Cloudflare 控制台删除，避免误删。

   ```bash
   pnpm sync:deploy
   ```

   `wrangler.jsonc` 配置会将 Worker 绑定到 `api.fqcdan1001.dpdns.org`。部署前确认域名 Zone 在同一 Cloudflare 账号并处于 Active。

6. 前端生产构建默认使用 `https://api.fqcdan1001.dpdns.org`。如有变化，在 `env/.env.production` 设置 `VITE_SYNC_SERVER_URL`；H5、APP、微信小程序生产构建都需要 HTTPS API 地址。

## 开发与测试

```bash
pnpm sync:test
pnpm sync:dev
```

线上部署由使用者执行 `pnpm sync:deploy`；本地实现不会自动部署或改动 Cloudflare 资源。
