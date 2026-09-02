/**
 * 学生头像渐变配色（全站统一）
 * 按姓名/标题 hash 取色，同一学生在课表卡片、详情页、模板页等各处颜色一致
 * 注意：渐变类名已在 uno.config.ts safelist 中固定声明，此处不可写成动态拼接的新组合
 */
export const AVATAR_GRADIENTS = [
  'from-indigo-500 to-blue-500',
  'from-violet-500 to-purple-500',
  'from-sky-500 to-cyan-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
] as const

export function avatarGradient(title: string): string {
  const s = title || '课'
  let h = 0
  for (let i = 0; i < s.length; i++)
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}
