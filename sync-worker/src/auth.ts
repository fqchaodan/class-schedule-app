/**
 * 极简 bearer 鉴权：两个固定 token 区分「写者」与「只读观看者」。
 * 只有两个人使用，无注册/密码体系；token 由部署方通过 wrangler secret 配置。
 */

export type Role = 'writer' | 'viewer'

export interface TokenConfig {
  writerToken: string
  viewerToken: string
}

/** 从 Authorization 头取出 bearer token */
export function extractBearer(header: string | null | undefined): string | null {
  if (!header)
    return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match ? match[1]! : null
}

/** token → 角色；未匹配返回 null */
export function roleForToken(token: string | null, config: TokenConfig): Role | null {
  if (!token)
    return null
  if (config.writerToken && token === config.writerToken)
    return 'writer'
  if (config.viewerToken && token === config.viewerToken)
    return 'viewer'
  return null
}
