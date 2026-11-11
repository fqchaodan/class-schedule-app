/**
 * Cloudflare Pages Function：国内可直连的反向代理
 *
 * 背景：`*.dpdns.org` 整段域名在国内被按 SNI 重置（TCP 能连、TLS 握手被 RST），
 * 换子域 / 换 IP / 改 DNS 都无效；而 `*.pages.dev` 目前国内可直连。
 *
 * 做法：客户端改连本 Pages 项目，由它在 Cloudflare 内网转发到原 Worker。
 * 现有 Worker、D1、鉴权、接口协议全部不动，只是多一层国内可达的入口。
 *
 * 部署：见同目录 README.md
 */
const UPSTREAM = 'https://api.fqcdan1001.dpdns.org'

interface PageContext {
  request: Request
}

export async function onRequest({ request }: PageContext): Promise<Response> {
  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, UPSTREAM)

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  const upstream = await fetch(target.toString(), {
    method: request.method,
    headers: request.headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  })

  // 原样回传状态码与响应头（含 Hono 的 CORS 头），流式转发不缓冲
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })
}
