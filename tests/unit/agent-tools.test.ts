/**
 * PiPiClaw - Agent 5 工具单测 (M1 v0.1)
 *
 * 覆盖: Read / Edit / Bash / Glob / Grep
 * 策略: 用 os.tmpdir() 下建真目录, 然后在 beforeAll 用 vi.spyOn(app, 'getPath') 把 userData 指到那.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { app } from 'electron'

// 真实测试根目录, 避免污染项目目录
const TEST_ROOT = fsSync.mkdtempSync(path.join(os.tmpdir(), 'agent-tools-test-'))
const SANDBOX_DIR = path.join(TEST_ROOT, 'sandbox')
const WORKSPACE_DIR = path.join(TEST_ROOT, 'workspace')
fsSync.mkdirSync(SANDBOX_DIR, { recursive: true })
fsSync.mkdirSync(WORKSPACE_DIR, { recursive: true })

beforeAll(() => {
  // 强制 app.getPath('userData') 返 TEST_ROOT (覆盖 electron-setup.ts 的默认 mock)
  vi.spyOn(app, 'getPath').mockImplementation((k: string) => {
    if (k === 'userData') return TEST_ROOT
    return TEST_ROOT
  })
})

import { ReadTool, ReadToolMetadata } from '../../electron/agent/tools/ReadTool'
import { EditTool, EditToolMetadata } from '../../electron/agent/tools/EditTool'
import { BashTool, BashToolMetadata } from '../../electron/agent/tools/BashTool'
import { GlobTool, GlobToolMetadata } from '../../electron/agent/tools/GlobTool'
import { GrepTool, GrepToolMetadata } from '../../electron/agent/tools/GrepTool'

describe('Agent 5 工具 metadata', () => {
  it('Read 工具 schema 正确', () => {
    expect(ReadToolMetadata.name).toBe('Read')
    expect(ReadToolMetadata.requiresPermission).toBe(false)
    expect(ReadToolMetadata.parametersJson.required).toContain('file_path')
  })
  it('Edit 工具 schema 正确', () => {
    expect(EditToolMetadata.name).toBe('Edit')
    expect(EditToolMetadata.requiresPermission).toBe(true)
    expect(EditToolMetadata.parametersJson.required).toEqual(['file_path', 'old_string', 'new_string'])
  })
  it('Bash 工具 schema 正确', () => {
    expect(BashToolMetadata.name).toBe('Bash')
    expect(BashToolMetadata.requiresPermission).toBe(true)
    expect(BashToolMetadata.parametersJson.required).toEqual(['command'])
  })
  it('Glob 工具 schema 正确', () => {
    expect(GlobToolMetadata.name).toBe('Glob')
    expect(GlobToolMetadata.requiresPermission).toBe(false)
  })
  it('Grep 工具 schema 正确', () => {
    expect(GrepToolMetadata.name).toBe('Grep')
    expect(GrepToolMetadata.requiresPermission).toBe(false)
  })
})

describe('ReadTool', () => {
  const tool = new ReadTool()
  beforeEach(async () => {
    await fs.writeFile(path.join(SANDBOX_DIR, 'sample.txt'), 'Hello PiPiClaw\n第二行\n', 'utf-8')
  })
  afterEach(async () => {
    await fs.rm(path.join(SANDBOX_DIR, 'sample.txt'), { force: true })
  })

  it('读 sandbox 内文件', async () => {
    const r = await tool.execute({ file_path: 'sample.txt' })
    expect(r.ok).toBe(true)
    expect(r.result).toContain('PiPiClaw')
  })
  it('缺 file_path 报错', async () => {
    const r = await tool.execute({})
    expect(r.ok).toBe(false)
    expect(r.error).toContain('file_path')
  })
  it('文件不存在报错', async () => {
    const r = await tool.execute({ file_path: 'nope.txt' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/不存在|ENOENT/)
  })
  it('路径在 sandbox 外被拒绝 (C:\\Windows)', async () => {
    const r = await tool.execute({ file_path: 'C:\\Windows\\System32\\drivers\\etc\\hosts' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/sandbox|workspace/)
  })
})

describe('EditTool', () => {
  const tool = new EditTool()
  beforeEach(async () => {
    await fs.writeFile(path.join(SANDBOX_DIR, 'edit.txt'), 'name=old\nname=other\n', 'utf-8')
  })
  afterEach(async () => {
    await fs.rm(path.join(SANDBOX_DIR, 'edit.txt'), { force: true })
    await fs.rm(path.join(SANDBOX_DIR, 'edit.txt.bak'), { force: true })
  })

  it('唯一 old_string → 替换成功', async () => {
    const r = await tool.execute({ file_path: 'edit.txt', old_string: 'name=other', new_string: 'name=new' })
    expect(r.ok).toBe(true)
    const content = await fs.readFile(path.join(SANDBOX_DIR, 'edit.txt'), 'utf-8')
    expect(content).toBe('name=old\nname=new\n')
  })
  it('不唯一 → 报错要求 replace_all', async () => {
    await fs.writeFile(path.join(SANDBOX_DIR, 'edit.txt'), 'a\nb\na\n', 'utf-8')
    const r = await tool.execute({ file_path: 'edit.txt', old_string: 'a', new_string: 'X' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/不唯一/)
  })
  it('replace_all=true 全替换', async () => {
    await fs.writeFile(path.join(SANDBOX_DIR, 'edit.txt'), 'a\nb\na\n', 'utf-8')
    const r = await tool.execute({ file_path: 'edit.txt', old_string: 'a', new_string: 'X', replace_all: true })
    expect(r.ok).toBe(true)
    const content = await fs.readFile(path.join(SANDBOX_DIR, 'edit.txt'), 'utf-8')
    expect(content).toBe('X\nb\nX\n')
  })
  it('old_string 不存在 → 报错', async () => {
    const r = await tool.execute({ file_path: 'edit.txt', old_string: 'NOT_THERE', new_string: 'X' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/未找到/)
  })
})

describe('BashTool', () => {
  const tool = new BashTool()

  it('白名单内命令正常跑', async () => {
    const r = await tool.execute({ command: 'node', args: ['-e', 'console.log(42)'] })
    expect(r.ok).toBe(true)
    expect(r.result).toContain('exit=0')
    expect(r.result).toContain('42')
  })
  it('白名单外命令拒绝', async () => {
    const r = await tool.execute({ command: 'rm', args: ['-rf', '/'] })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/不在白名单/)
  })
  it('shell metacharacter 拒绝', async () => {
    const r = await tool.execute({ command: 'node; echo PWN', args: [] })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/非法字符/)
  })
  it('args 含 null byte 拒绝', async () => {
    const r = await tool.execute({ command: 'echo', args: ['safe\0evil'] })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/null byte/)
  })
  it('cwd 在 sandbox 外拒绝', async () => {
    const r = await tool.execute({ command: 'node', args: ['-e', '1'], cwd: 'C:\\Windows' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/sandbox|workspace/)
  })
})

describe('GlobTool', () => {
  const tool = new GlobTool()
  beforeEach(async () => {
    await fs.writeFile(path.join(SANDBOX_DIR, 'a.ts'), 'x', 'utf-8')
    await fs.writeFile(path.join(SANDBOX_DIR, 'b.ts'), 'x', 'utf-8')
    await fs.mkdir(path.join(SANDBOX_DIR, 'sub'), { recursive: true })
    await fs.writeFile(path.join(SANDBOX_DIR, 'sub', 'c.vue'), 'x', 'utf-8')
    await fs.writeFile(path.join(SANDBOX_DIR, 'README.md'), 'x', 'utf-8')
  })
  afterEach(async () => {
    await fs.rm(path.join(SANDBOX_DIR, 'a.ts'), { force: true })
    await fs.rm(path.join(SANDBOX_DIR, 'b.ts'), { force: true })
    await fs.rm(path.join(SANDBOX_DIR, 'sub'), { recursive: true, force: true })
    await fs.rm(path.join(SANDBOX_DIR, 'README.md'), { force: true })
  })

  it('**/*.ts 匹配 .ts 文件', async () => {
    const r = await tool.execute({ pattern: '**/*.ts' })
    expect(r.ok).toBe(true)
    expect(r.result).toContain('a.ts')
    expect(r.result).toContain('b.ts')
    expect(r.result).not.toContain('c.vue')
  })
  it('*.vue 匹配根级 .vue', async () => {
    const r = await tool.execute({ pattern: '*.vue' })
    expect(r.ok).toBe(true)
    expect(r.result).toBe('(no matches)')
  })
  it('**/*.vue 跨子目录匹配', async () => {
    const r = await tool.execute({ pattern: '**/*.vue' })
    expect(r.ok).toBe(true)
    expect(r.result).toContain('sub/c.vue')
  })
  it('无匹配返 (no matches)', async () => {
    const r = await tool.execute({ pattern: '**/*.nonexistent' })
    expect(r.ok).toBe(true)
    expect(r.result).toBe('(no matches)')
  })
  it('缺 pattern 报错', async () => {
    const r = await tool.execute({})
    expect(r.ok).toBe(false)
  })
})

describe('GrepTool', () => {
  const tool = new GrepTool()
  beforeEach(async () => {
    await fs.writeFile(path.join(SANDBOX_DIR, 'app.ts'), 'const version = "1.0"\nexport default version\n', 'utf-8')
    await fs.writeFile(path.join(SANDBOX_DIR, 'note.md'), '# PiPiClaw notes\nversion 1.0 draft\n', 'utf-8')
  })
  afterEach(async () => {
    await fs.rm(path.join(SANDBOX_DIR, 'app.ts'), { force: true })
    await fs.rm(path.join(SANDBOX_DIR, 'note.md'), { force: true })
  })

  it('搜 "version" 在 .ts 里', async () => {
    const r = await tool.execute({ pattern: 'version', include: '*.ts' })
    expect(r.ok).toBe(true)
    expect(r.result).toContain('app.ts:')
  })
  it('ignoreCase 默认 true', async () => {
    const r = await tool.execute({ pattern: 'PIPICLAW', include: '*.md' })
    expect(r.ok).toBe(true)
    expect(r.result).toContain('note.md:')
  })
  it('无匹配返 (no matches)', async () => {
    const r = await tool.execute({ pattern: 'DEFINITELY_NOT_THERE_XXX' })
    expect(r.ok).toBe(true)
    expect(r.result).toBe('(no matches)')
  })
  it('缺 pattern 报错', async () => {
    const r = await tool.execute({})
    expect(r.ok).toBe(false)
  })
})
