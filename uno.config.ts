import type { Preset } from 'unocss'
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

// https://www.npmjs.com/package/@uni-helper/unocss-preset-uni
import { presetUni } from '@uni-helper/unocss-preset-uni'
// @see https://unocss.dev/presets/legacy-compat
import { presetLegacyCompat } from '@unocss/preset-legacy-compat'
import {
  defineConfig,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUni({
      attributify: false,
    }),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        // 注册本地 SVG 图标集合, 从本地文件系统加载图标
        // 在 './src/static/my-icons' 目录下的所有 svg 文件将被注册为图标，
        // my-icons 是图标集合名称，使用 `i-my-icons-图标名` 调用
        'my-icons': FileSystemIconLoader(
          './src/static/my-icons',
          // 可选的，你可以提供一个 transform 回调来更改每个图标
          (svg) => {
            let svgStr = svg

            // 如果 SVG 文件未定义 `fill` 属性，则默认填充 `currentColor`, 这样图标颜色会继承文本颜色，方便在不同场景下适配
            svgStr = svgStr.includes('fill="')
              ? svgStr
              : svgStr.replace(/^<svg /, '<svg fill="currentColor" ')

            // 如果 svg 有 width, 和 height 属性，将这些属性改为 1em，否则无法显示图标
            svgStr = svgStr
              .replace(/(<svg.*?width=)"(.*?)"/, '$1"1em"')
              .replace(/(<svg.*?height=)"(.*?)"/, '$1"1em"')

            return svgStr
          },
        ),
      },
    }),
    // TODO: check 是否会有别的影响
    // 处理低端安卓机的样式问题
    // 将颜色函数 (rgb()和hsl()) 从空格分隔转换为逗号分隔，更好的兼容性app端，example：
    // `rgb(255 0 0)` -> `rgb(255, 0, 0)`
    // `rgba(255 0 0 / 0.5)` -> `rgba(255, 0, 0, 0.5)`
    presetLegacyCompat({
      commaStyleColorFunction: true,
      legacyColorSpace: true, // by QQ4群-量子蔷薇
      // @菲鸽 unocss 配置中，建议在 presetLegacyCompat 中添加 legacyColorSpace: true，以去除生成的颜色样式中的 in oklch 关键字，现在发现有些渐变色生成不符合预期
    }) as Preset,
  ],
  transformers: [
    // 启用指令功能：主要用于支持 @apply、@screen 和 theme() 等 CSS 指令
    transformerDirectives(),
    // 启用 () 分组功能
    // 支持css class组合，eg: `<div class="hover:(bg-gray-400 font-medium) font-(light mono)">测试 unocss</div>`
    transformerVariantGroup(),
  ],
  shortcuts: [
    {
      center: 'flex justify-center items-center',
      // ---------- 全站设计令牌（样式事实源，功能无关） ----------
      /** 标准卡片：白底 + 细边框 + 柔和阴影 */
      card: 'box-border rounded-2xl bg-white border border-gray-100 shadow-card',
      /** 页面大标题 */
      'txt-title': 'text-lg text-gray-900 font-bold',
      /** 卡片主标题 */
      'txt-heading': 'text-base text-gray-900 font-semibold',
      /** 正文 */
      'txt-body': 'text-sm text-gray-700',
      /** 次要信息（时间、说明） */
      'txt-sub': 'text-xs text-gray-500',
      /** 辅助信息（计数、提示） */
      'txt-aux': 'text-2xs text-gray-400',
      /** 费用强调 */
      'txt-fee': 'text-orange-500 font-semibold',
      /** 分组小标题（设置页等） */
      'section-label': 'mb-1.5 px-1 text-2xs text-gray-400 font-medium tracking-wide',
      /** 状态小圆点 */
      'status-dot': 'h-1.5 w-1.5 rounded-full',
    },
  ],
  // 动态图标需要在这里配置，或者写在vue页面中注释掉
  safelist: [
    'i-carbon-code',
    'i-carbon-calendar',
    'i-carbon-list',
    'i-carbon-chart-bar',
    'i-carbon-settings',
    'i-carbon-home',
    'i-carbon-user',
    'i-carbon-ibm-watson-language-translator',
    'i-carbon-menu',
    'i-carbon-zoom-in',
    'i-carbon-zoom-out',
    'i-carbon-calendar-heat-map',
    'i-carbon-rotate',
    'i-carbon-arrow-left',
    // 设置页图标
    'i-carbon-export',
    'i-carbon-download',
    'i-carbon-trash-can',
    'i-carbon-repeat',
    'i-carbon-delete',
    // CourseCard 图标
    'i-carbon-video',
    'i-carbon-notebook',
    // ConflictDialog 图标
    'i-carbon-warning-alt',
    // detail 页图标
    'i-carbon-edit',
    'i-carbon-copy',
    'i-carbon-bookmark',
    // 看板课程块学生配色（运行时按姓名 hash 动态选择）
    'border-indigo-500',
    'bg-indigo-50',
    'border-sky-500',
    'bg-sky-50',
    'border-emerald-500',
    'bg-emerald-50',
    'border-amber-500',
    'bg-amber-50',
    'border-rose-500',
    'bg-rose-50',
    'border-violet-500',
    'bg-violet-50',
    // CourseCard 动态头像渐变（运行时拼接，需固定声明避免被剪裁）
    'from-indigo-500',
    'to-blue-500',
    'from-violet-500',
    'to-purple-500',
    'from-sky-500',
    'to-cyan-500',
    'from-rose-500',
    'to-pink-500',
    'from-amber-500',
    'to-orange-500',
    'from-emerald-500',
    'to-teal-500',
    'bg-gradient-to-br',
  ],
  rules: [
    [
      'p-safe',
      {
        padding:
          'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      },
    ],
    ['pt-safe', { 'padding-top': 'env(safe-area-inset-top)' }],
    ['pb-safe', { 'padding-bottom': 'env(safe-area-inset-bottom)' }],
    // tabbar 页面滚动区底部留白：tabbar 高度(50px) + 安全区（H5 fallback，APP 端用内联 style）
    ['pb-tabbar', { 'padding-bottom': 'calc(50px + env(safe-area-inset-bottom))' }],
    // 非 tabbar 页面底部固定操作栏留白：操作栏高度(52px) + 安全区
    ['pb-actionbar', { 'padding-bottom': 'calc(52px + env(safe-area-inset-bottom))' }],
    // 卡片柔和阴影（比 shadow-sm 更细腻的双层阴影）
    ['shadow-card', { 'box-shadow': '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px -2px rgba(16, 24, 40, 0.06)' }],
    // 悬浮元素阴影（FAB 等，带主色光晕）
    ['shadow-float', { 'box-shadow': '0 6px 16px -4px rgba(99, 102, 241, 0.4), 0 2px 6px rgba(16, 24, 40, 0.08)' }],
  ],
  theme: {
    colors: {
      /** 主题色，用法如: text-primary（与全局 scss 中 --wot-primary-6 的 indigo 覆盖保持一致） */
      primary: 'var(--wot-primary-6, #6366f1)',
    },
    fontSize: {
      /** 提供更小号的字体，用法如：text-2xs */
      '2xs': ['20rpx', '28rpx'],
      '3xs': ['18rpx', '26rpx'],
    },
  },
  // windows 系统会报错：[plugin:unocss:transformers:pre] Cannot overwrite a zero-length range - use append Left or prependRight instead.
  // 去掉下面的就正常了
  // content: {
  //   /**
  //    * 解决小程序报错 `./app.wxss(78:2814): unexpected unexpected at pos 5198`
  //    * 为什么同时使用include和exclude？虽然看起来多余，但同时配置两者是一种常见的 `防御性编程` 做法。
  //      1. 结构变化保障 : 如果未来项目结构发生变化，某些排除目录可能被移动到包含路径下，exclude配置可以确保它们仍被排除
  //      2. 明确性 : 明确列出要排除的目录使配置意图更加清晰
  //      3. 性能优化 : 避免处理不必要的文件，提高构建性能
  //      4. 防止冲突 : 排除第三方库和构建输出目录，避免潜在的CSS冲突
  //    */
  //   pipeline: {
  //     exclude: [
  //       'node_modules/**/*',
  //       'public/**/*',
  //       'dist/**/*',
  //     ],
  //     include: [
  //       './src/**/*',
  //     ],
  //   },
  // },
})
