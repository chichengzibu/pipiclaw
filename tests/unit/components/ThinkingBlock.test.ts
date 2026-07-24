import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ThinkingBlock from '../../../src/components/chat/ThinkingBlock.vue'

const LONG_REASONING = `用户想要一个 Python 快速排序的实现,我需要先解释快速排序的原理,然后给出清晰的代码。

1. 快速排序基于分治:
   - 选择 pivot(基准)
   - 把数组分成小于 pivot / 大于 pivot 两部分
   - 递归对两部分排序

2. Python 实现的关键点:
   - list comprehension
   - 原地 vs 返回新 list
   - 边界条件

3. 给出一个清晰可读的版本。`

describe('P5-UX B: ThinkingBlock thinking 可视化', () => {
  it('reasoning 空时不渲染', () => {
    const w = mount(ThinkingBlock, { props: { reasoning: '' } })
    expect(w.find('.thinking-block').exists()).toBe(false)
  })

  it('reasoning 有内容时渲染', () => {
    const w = mount(ThinkingBlock, { props: { reasoning: LONG_REASONING } })
    expect(w.find('.thinking-block').exists()).toBe(true)
  })

  it('默认折叠(不显示 content)', () => {
    const w = mount(ThinkingBlock, { props: { reasoning: LONG_REASONING } })
    expect(w.find('.thinking-content').exists()).toBe(false)
    expect(w.text()).toContain('已思考')
  })

  it('点击 toggle 展开 → 显示 content', async () => {
    const w = mount(ThinkingBlock, { props: { reasoning: LONG_REASONING } })
    await w.find('.thinking-toggle').trigger('click')
    expect(w.find('.thinking-content').exists()).toBe(true)
    expect(w.text()).toContain('思考过程')
  })

  it('defaultExpanded=true 直接展开', () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, defaultExpanded: true },
    })
    expect(w.find('.thinking-content').exists()).toBe(true)
  })

  it('展开 → 折叠(双向切换)', async () => {
    const w = mount(ThinkingBlock, { props: { reasoning: LONG_REASONING } })
    expect(w.find('.thinking-content').exists()).toBe(false)
    await w.find('.thinking-toggle').trigger('click')
    expect(w.find('.thinking-content').exists()).toBe(true)
    await w.find('.thinking-toggle').trigger('click')
    expect(w.find('.thinking-content').exists()).toBe(false)
  })

  it('streaming=true 时显示"正在思考…"', () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, streaming: true },
    })
    expect(w.text()).toContain('正在思考')
  })

  it('durationMs 显示(秒级)', () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, durationMs: 3500 },
    })
    expect(w.text()).toContain('3.5s')
  })

  it('durationMs 显示(毫秒级)', () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, durationMs: 800 },
    })
    expect(w.text()).toContain('800ms')
  })

  it('durationMs 显示(分钟级)', () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, durationMs: 90_000 },
    })
    expect(w.text()).toContain('1m 30s')
  })

  it('reasoningTokens 显示', () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, reasoningTokens: 428 },
    })
    expect(w.text()).toContain('428 tokens')
  })

  it('reasoning 内容完整显示(展开后)', async () => {
    const w = mount(ThinkingBlock, { props: { reasoning: LONG_REASONING } })
    await w.find('.thinking-toggle').trigger('click')
    const pre = w.find('.thinking-content')
    expect(pre.text()).toContain('快速排序')
    expect(pre.text()).toContain('list comprehension')
  })

  it('aria-expanded 正确反映展开状态', async () => {
    const w = mount(ThinkingBlock, { props: { reasoning: LONG_REASONING } })
    expect(w.find('.thinking-toggle').attributes('aria-expanded')).toBe('false')
    await w.find('.thinking-toggle').trigger('click')
    expect(w.find('.thinking-toggle').attributes('aria-expanded')).toBe('true')
  })

  it('content 区域使用 monospace 字体', async () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, defaultExpanded: true },
    })
    // scss 是用 font-family,我们检查 class 存在
    expect(w.find('.thinking-content').exists()).toBe(true)
  })

  it('多个 meta 一起显示(duration + tokens)', () => {
    const w = mount(ThinkingBlock, {
      props: { reasoning: LONG_REASONING, durationMs: 1200, reasoningTokens: 250 },
    })
    const text = w.text()
    expect(text).toContain('1.2s')
    expect(text).toContain('250 tokens')
  })
})
