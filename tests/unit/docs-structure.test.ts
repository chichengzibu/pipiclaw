import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DOCS_ROOT = join(__dirname, '..', '..', 'docs', 'site')

const REQUIRED_FILES = [
  'README.md',
  'user-guide/getting-started.md',
  'user-guide/user-guide.md',
  'user-guide/faq.md',
  'user-guide/troubleshooting.md',
  'architecture/overview.md',
  'architecture/ipc.md',
  'architecture/extension.md',
  'contributing.md',
]

const CAPABILITY_DOMAINS = [
  'Chat',
  'Tasks',
  'Schedule',
  'Skills',
  'IM',
  'Permissions',
  'Models',
  'Sandbox',
]

function readDoc(relPath: string): string {
  const full = join(DOCS_ROOT, relPath)
  if (!existsSync(full)) {
    throw new Error(`Missing docs file: ${full}`)
  }
  return readFileSync(full, 'utf-8')
}

describe('docs/site structure (Phase 5 Task 3 + Task 4)', () => {
  for (const rel of REQUIRED_FILES) {
    it(`${rel} exists and has substantive content`, () => {
      const content = readDoc(rel)
      expect(content.length).toBeGreaterThan(200)
    })
  }

  it('README is the entry index with links to user-guide and architecture', () => {
    const content = readDoc('README.md')
    expect(content).toMatch(/user-guide\/getting-started/)
    expect(content).toMatch(/user-guide\/faq/)
    expect(content).toMatch(/architecture\/overview/)
  })

  it('FAQ has >= 15 questions', () => {
    const content = readDoc('user-guide/faq.md')
    const matches = content.match(/\bQ\d{1,2}[:：]/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(15)
  })

  it('User guide covers all 8 capability domains', () => {
    const content = readDoc('user-guide/user-guide.md')
    for (const domain of CAPABILITY_DOMAINS) {
      expect(content).toContain(domain)
    }
  })

  it('User guide has how-to sections (## headers per domain)', () => {
    const content = readDoc('user-guide/user-guide.md')
    const domainHeaders = content.match(/^##\s+\d+\.\s+/gm) || []
    expect(domainHeaders.length).toBeGreaterThanOrEqual(8)
  })

  it('Architecture overview names the tech stack layers', () => {
    const content = readDoc('architecture/overview.md')
    expect(content).toContain('Electron')
    expect(content).toContain('Vue')
    expect(content).toContain('TypeScript')
  })

  it('IPC doc enumerates the major namespaces', () => {
    const content = readDoc('architecture/ipc.md')
    const namespaces = [
      'Window',
      'Gateway',
      'Models',
      'Permissions',
      'Chat',
      'Tasks',
      'MCP',
      'AutoUpdater',
    ]
    for (const ns of namespaces) {
      expect(content).toContain(ns)
    }
  })

  it('Extension doc lists at least 4 extension entry points', () => {
    const content = readDoc('architecture/extension.md')
    expect(content).toContain('LLM provider')
    expect(content).toContain('IM channel')
    expect(content).toContain('Permission')
    expect(content).toContain('视图')
  })

  it('Getting started walks through 5 steps (install/launch/api-key/chat/task)', () => {
    const content = readDoc('user-guide/getting-started.md')
    expect(content).toMatch(/###\s+1\.\s+安装/)
    expect(content).toMatch(/###\s+2\.\s+启动/)
    expect(content).toMatch(/API Key/)
    expect(content).toMatch(/开始对话|对话/)
    expect(content).toMatch(/自动化任务/)
  })

  it('Troubleshooting covers the 5 error categories', () => {
    const content = readDoc('user-guide/troubleshooting.md')
    expect(content).toContain('启动失败')
    expect(content).toContain('LLM API')
    expect(content).toContain('沙箱')
    expect(content).toContain('IM 接入')
    expect(content).toContain('更新失败')
  })

  it('Contributing has the 4-piece checklist', () => {
    const content = readDoc('contributing.md')
    expect(content).toContain('lint')
    expect(content).toContain('tsc')
    expect(content).toContain('vitest')
    expect(content).toContain('smoke')
  })

  it('No file is a stub (< 200 chars)', () => {
    for (const rel of REQUIRED_FILES) {
      const content = readDoc(rel)
      expect(content.length, `${rel} too short`).toBeGreaterThan(200)
    }
  })
})