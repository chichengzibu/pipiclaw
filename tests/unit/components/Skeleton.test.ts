import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Skeleton from '../../../src/components/common/Skeleton.vue'

describe('P5-UX: Skeleton 加载占位组件', () => {
  it('默认 type=text,渲染 lines 行骨架', () => {
    const w = mount(Skeleton, { props: { lines: 3 } })
    const lines = w.findAll('.skeleton-line')
    expect(lines.length).toBe(3)
  })

  it('最后一行宽度 60%(视觉更自然)', () => {
    const w = mount(Skeleton, { props: { lines: 3 } })
    const lines = w.findAll('.skeleton-line')
    expect(lines[2].attributes('style')).toContain('60%')
  })

  it('倒数第二行宽度 85%', () => {
    const w = mount(Skeleton, { props: { lines: 3 } })
    const lines = w.findAll('.skeleton-line')
    expect(lines[1].attributes('style')).toContain('85%')
  })

  it('第一行宽度 100%', () => {
    const w = mount(Skeleton, { props: { lines: 3 } })
    const lines = w.findAll('.skeleton-line')
    expect(lines[0].attributes('style')).toContain('100%')
  })

  it('type=card → 渲染卡片骨架', () => {
    const w = mount(Skeleton, { props: { type: 'card' } })
    expect(w.find('.skeleton-card').exists()).toBe(true)
    expect(w.find('.skeleton-card-header').exists()).toBe(true)
    expect(w.find('.skeleton-card-body').exists()).toBe(true)
  })

  it('type=avatar → 渲染圆形骨架,size=lg', () => {
    const w = mount(Skeleton, { props: { type: 'avatar', size: 'lg' } })
    const circle = w.find('.skeleton-circle')
    expect(circle.exists()).toBe(true)
    expect(circle.classes()).toContain('skeleton-circle--lg')
  })

  it('type=avatar → 默认 size=md', () => {
    const w = mount(Skeleton, { props: { type: 'avatar' } })
    expect(w.find('.skeleton-circle--md').exists()).toBe(true)
  })

  it('type=table → 渲染 rows 行表格骨架', () => {
    const w = mount(Skeleton, { props: { type: 'table', rows: 4 } })
    const tableRows = w.findAll('.skeleton-table-row')
    expect(tableRows.length).toBe(4)
  })

  it('type=rect → 渲染矩形骨架', () => {
    const w = mount(Skeleton, { props: { type: 'rect', width: '200px', height: '100px' } })
    const rect = w.find('.skeleton-rect')
    expect(rect.exists()).toBe(true)
    expect(rect.attributes('style')).toContain('width: 200px')
    expect(rect.attributes('style')).toContain('height: 100px')
  })

  it('aria-busy=true 标记加载中', () => {
    const w = mount(Skeleton)
    expect(w.attributes('aria-busy')).toBe('true')
  })

  it('aria-label=加载中', () => {
    const w = mount(Skeleton)
    expect(w.attributes('aria-label')).toBe('加载中')
  })
})
