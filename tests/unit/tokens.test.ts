import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * W2.1 — Apple HIG design tokens 守卫测试
 *
 * 目的：tokens.css 是 W2.2-W2.12 视觉翻新的基石。
 * 任何误删/重命名/格式错乱都会导致后续 12 view 翻新连锁翻车。
 * 用守卫测试把"变量必须在"变成可执行约定。
 *
 * 检查点：
 *   1. tokens.css 文件存在
 *   2. global.scss 已 @use 引用（保证 build 时被加载）
 *   3. 关键 CSS 变量定义都在（间距/字号/动效/圆角/阴影/z-index/布局/组件尺寸）
 *   4. 暗色模式：prefers-color-scheme + data-theme 双重覆盖都存在
 *   5. 间距/字号按 4 / Apple HIG 标准档位（防漂移）
 */

const ROOT = resolve(__dirname, '..', '..')
const TOKENS_PATH = resolve(ROOT, 'src', 'styles', 'tokens.css')
const GLOBAL_SCSS_PATH = resolve(ROOT, 'src', 'styles', 'global.scss')

let tokensContent = ''
let globalScssContent = ''

beforeAll(async () => {
  tokensContent = await readFile(TOKENS_PATH, 'utf-8')
  globalScssContent = await readFile(GLOBAL_SCSS_PATH, 'utf-8')
})

const REQUIRED_VAR_GROUPS: ReadonlyArray<{ group: string; vars: string[] }> = [
  {
    group: 'Spacing（4 的倍数）',
    vars: ['--space-xs', '--space-sm', '--space-md', '--space-lg', '--space-xl', '--space-2xl', '--space-3xl'],
  },
  {
    group: 'Typography 字号',
    vars: [
      '--font-family-system',
      '--font-family-mono',
      '--font-size-display',
      '--font-size-title-1',
      '--font-size-title-2',
      '--font-size-body',
      '--font-size-callout',
      '--font-size-caption-1',
      '--font-size-caption-2',
      '--font-weight-regular',
      '--font-weight-medium',
      '--font-weight-semibold',
      '--font-weight-bold',
      '--line-height-tight',
      '--line-height-normal',
      '--line-height-relaxed',
    ],
  },
  {
    group: 'Motion 动效',
    vars: ['--ease-spring', '--ease-standard', '--ease-decelerate', '--ease-accelerate', '--duration-fast', '--duration-base', '--duration-slow'],
  },
  {
    group: 'Radius 圆角',
    vars: ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill'],
  },
  {
    group: 'Layout 布局',
    vars: ['--title-bar-height', '--side-nav-width', '--side-nav-width-collapsed', '--inspector-width', '--content-max-width', '--content-padding'],
  },
  {
    group: 'Shadow 阴影',
    vars: ['--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'],
  },
  {
    group: 'Z-index',
    vars: ['--z-base', '--z-elevated', '--z-dropdown', '--z-modal', '--z-toast', '--z-tooltip'],
  },
  {
    group: 'Component Sizes',
    vars: [
      '--button-height-sm',
      '--button-height-md',
      '--button-height-lg',
      '--input-height-md',
      '--icon-size-sm',
      '--icon-size-md',
      '--icon-size-lg',
      '--icon-size-xl',
    ],
  },
]

describe('W2.1 — Apple HIG design tokens', () => {
  it('tokens.css 文件存在', () => {
    expect(tokensContent.length).toBeGreaterThan(0)
  })

  it('global.scss 已 @use ./tokens.css（保证 build 时加载）', () => {
    expect(globalScssContent).toMatch(/@use\s+["']\.\/tokens\.css["']/)
  })

  describe('关键 CSS 变量必须存在', () => {
    for (const { group, vars } of REQUIRED_VAR_GROUPS) {
      describe(group, () => {
        for (const v of vars) {
          it(`${v}`, () => {
            // 形如 `--space-md: 16px;` 或 `--space-md:var(--xxx);` 都可以
            const re = new RegExp(`${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`)
            expect(tokensContent, `缺少 token: ${v}`).toMatch(re)
          })
        }
      })
    }
  })

  it('暗色模式：@media (prefers-color-scheme: dark) 覆盖存在', () => {
    expect(tokensContent).toMatch(/@media\s+\(prefers-color-scheme:\s*dark\)/)
  })

  it('暗色模式：:root[data-theme="dark"] 显式覆盖存在', () => {
    expect(tokensContent).toMatch(/:root\[data-theme=['"]dark['"]\]/)
  })

  it('亮色模式：:root[data-theme="light"] 显式覆盖存在', () => {
    expect(tokensContent).toMatch(/:root\[data-theme=['"]light['"]\]/)
  })

  it('Spacing 4 的倍数（防漂移）', () => {
    const expectMap: Array<[string, number]> = [
      ['--space-xs', 4],
      ['--space-sm', 8],
      ['--space-md', 16],
      ['--space-lg', 24],
      ['--space-xl', 32],
      ['--space-2xl', 48],
      ['--space-3xl', 64],
    ]
    for (const [name, expectedPx] of expectMap) {
      const re = new RegExp(`${name}\\s*:\\s*${expectedPx}px`)
      expect(tokensContent, `${name} 必须是 ${expectedPx}px`).toMatch(re)
    }
  })

  it('字号使用 px 单位（HIG 规定不用 rem）', () => {
    // 抽取所有 --font-size-* 的值，检查都是 px
    const re = /--font-size-[a-z0-9-]+\s*:\s*([0-9.]+)px/g
    const matches = [...tokensContent.matchAll(re)]
    expect(matches.length).toBeGreaterThanOrEqual(7)
    for (const m of matches) {
      const v = parseFloat(m[1])
      expect(v, `${m[0]} 应是 px 单位`).toBeGreaterThan(0)
    }
  })
})
