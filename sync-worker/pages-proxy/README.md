# Pages 反代（绕开 dpdns.org 被墙）

`*.dpdns.org` 整段域名在国内被按 SNI 重置（TCP 能连、TLS 握手直接被 RST），换子域 / 换优选 IP / DoH 都无效；
而 `*.pages.dev` 国内可直连。本项目把现有 Worker 包一层 Cloudflare Pages Function，客户端只改接口地址，后端与 D1 完全不动。

## 当前部署

- 地址：**https://fanqie-schedule-api.pages.dev**
- 项目名：`fanqie-schedule-api`（Pages 项目，production 分支 `main`）
- 上游：`https://api.fqcdan1001.dpdns.org`（见 `functions/[[path]].ts` 里的 `UPSTREAM`）

实测（不走代理直连）：`/health` → `{"ok":true}` 200；`/api/me` 无 token → 401；带 writer token → `{"role":"writer"}` 200。

## 重新部署

国内网络访问 Cloudflare API 会超时，先开代理再执行：

```bash
pnpm sync:pages:deploy
```

等价于在 `sync-worker/pages-proxy` 下执行：

```bash
wrangler pages deploy public --project-name fanqie-schedule-api --branch main
```

> 注意：Pages Functions 的目录是「当前工作目录下的 `functions/`」，所以必须在本目录里执行，
> 不能在仓库根目录直接 deploy（否则找不到 functions）。

## 客户端切换

接口地址在 `env/.env.production`（以及 `.env.development`）：

```
VITE_SYNC_SERVER_URL = 'https://fanqie-schedule-api.pages.dev'
```

`src/api/sync.ts` 读这个变量，读不到才回落到同址默认值。改完重新打包安装即可。

## 说明

- 代理只做转发：方法、Header（含 `Authorization`）、Body、状态码、响应头原样透传，不缓存。
- 免费用量：Pages Functions 10 万请求/天，两人使用远不会触顶。
- 以后若买了自己的域名，直接在 Pages 项目里绑自定义域名，改一次 env 即可，无需再动后端。
- 若某天 `*.pages.dev` 也被墙，同一套代码可以改绑自有域名，或迁到任何支持 fetch 的运行时。
