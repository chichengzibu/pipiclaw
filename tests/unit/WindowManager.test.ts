import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WM = join(__dirname, '../../electron/core/WindowManager.ts')
const source = readFileSync(WM, 'utf-8')

describe('WindowManager focus/blur handlers removal', () => {
  it('source does not register focus handler with log.debug', () => {
    expect(source).not.toMatch(/this\.mainWindow\.on\(['"]focus['"][\s\S]{0,200}log\.debug/)
  })

  it('source does not register blur handler with log.debug', () => {
    expect(source).not.toMatch(/this\.mainWindow\.on\(['"]blur['"][\s\S]{0,200}log\.debug/)
  })

  it('source has a comment explaining the removal', () => {
    expect(source).toContain('focus/blur handlers 已被移除')
    expect(source).toContain('Vite HMR')
  })

  it('WindowManager still listens for maximize and closed events', () => {
    expect(source).toMatch(/this\.mainWindow\.on\(['"]maximize['"]/)
    expect(source).toMatch(/this\.mainWindow\.on\(['"]closed['"]/)
  })

  it('WindowManager retains sendMaximizeChange IPC bridge', () => {
    expect(source).toContain("send('window:onMaximizeChange'")
  })
})