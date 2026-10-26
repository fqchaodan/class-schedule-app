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

/**
 * 看板课程块配色（与头像渐变同 index 对应，同一学生头像与看板色块色相一致）
 * 类名需在 uno.config.ts safelist 中固定声明，此处不可写成动态拼接的新组合
 */
export const STUDENT_BLOCK_COLORS = [
  { bar: 'border-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  { bar: 'border-violet-400', bg: 'bg-violet-50', text: 'text-violet-700' },
  { bar: 'border-sky-400', bg: 'bg-sky-50', text: 'text-sky-700' },
  { bar: 'border-rose-400', bg: 'bg-rose-50', text: 'text-rose-700' },
  { bar: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  { bar: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
] as const

export function studentBlockColor(title: string): (typeof STUDENT_BLOCK_COLORS)[number] {
  const s = title || '课'
  let h = 0
  for (let i = 0; i < s.length; i++)
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  return STUDENT_BLOCK_COLORS[h % STUDENT_BLOCK_COLORS.length]
}
