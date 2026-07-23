import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-filetransfer-test') },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P0-06: 文件上传 FileTransferManager
 *
 * 验证 uploadToIM:
 * - 平台支持检查
 * - 文件存在性 + 大小校验
 * - 配置读取
 * - 进度回调
 */

import { FileTransferManager } from '../../electron/channel/FileTransferManager'
import { IMConfigStore } from '../../electron/channel/IMConfigStore'

const TEST_USER_DATA = '/tmp/pipiclaw-filetransfer-test'
let tmpDir: string

describe('P0-06: FileTransferManager.uploadToIM', () => {
  beforeEach(() => {
    ;(FileTransferManager as unknown as { instance: FileTransferManager | null }).instance = null
    ;(IMConfigStore as unknown as { instance: IMConfigStore | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipiclaw-filetransfer-'))
  })

  it('singleton returns same instance', () => {
    const a = FileTransferManager.getInstance()
    const b = FileTransferManager.getInstance()
    expect(a).toBe(b)
  })

  it('不支持的平台 → ok=false + error', async () => {
    const mgr = FileTransferManager.getInstance()
    const fp = path.join(tmpDir, 'a.txt')
    fs.writeFileSync(fp, 'hello')
    const r = await mgr.uploadToIM({
      platform: 'im-feishu-NOT-A-REAL-PLATFORM' as any,
      filePath: fp,
      channelId: 'ch-1',
      targetUserId: 'u-1',
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('unsupported platform')
  })

  it('文件不存在 → ok=false + error', async () => {
    const mgr = FileTransferManager.getInstance()
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: path.join(tmpDir, 'nope.txt'),
      channelId: 'ch-1',
      targetUserId: 'u-1',
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('file not found')
  })

  it('目录而非文件 → ok=false + not a file', async () => {
    const mgr = FileTransferManager.getInstance()
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: tmpDir,
      channelId: 'ch-1',
      targetUserId: 'u-1',
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('not a file')
  })

  it('小文件 + 有 accessToken → ok=true + 模拟 messageId/fileId', async () => {
    const mgr = FileTransferManager.getInstance()
    const fp = path.join(tmpDir, 'tiny.txt')
    fs.writeFileSync(fp, 'hello')
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: fp,
      channelId: 'ch-1',
      targetUserId: 'u-1',
      accessToken: 'test-token',
    })
    expect(r.ok).toBe(true)
    expect(r.messageId).toMatch(/^mock-msg-/)
    expect(r.fileId).toMatch(/^mock-file-/)
    expect(r.fileSize).toBe(5)
  })

  it('无 accessToken 但 IMConfigStore 有 botToken → ok=true', async () => {
    const store = IMConfigStore.getInstance()
    store.set('im-telegram', { botToken: 'bot-from-store', enabled: true })
    const mgr = FileTransferManager.getInstance()
    const fp = path.join(tmpDir, 'b.txt')
    fs.writeFileSync(fp, 'data')
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: fp,
      channelId: 'ch-1',
      targetUserId: 'u-1',
    })
    expect(r.ok).toBe(true)
  })

  it('accessToken 和 IMConfigStore 都没有 → ok=false + no access token', async () => {
    const mgr = FileTransferManager.getInstance()
    const fp = path.join(tmpDir, 'c.txt')
    fs.writeFileSync(fp, 'data')
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: fp,
      channelId: 'ch-1',
      targetUserId: 'u-1',
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('no access token')
  })

  it('超过 50MB 限制 → ok=false + too large(用 60MB 文件测 Telegram)', async () => {
    const mgr = FileTransferManager.getInstance()
    const fp = path.join(tmpDir, 'big.bin')
    // 60MB = 60 * 1024 * 1024 bytes
    const big = Buffer.alloc(60 * 1024 * 1024, 0)
    fs.writeFileSync(fp, big)
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: fp,
      channelId: 'ch-1',
      targetUserId: 'u-1',
      accessToken: 't',
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('too large')
  })

  it('onProgress 回调被调用', async () => {
    const mgr = FileTransferManager.getInstance()
    const fp = path.join(tmpDir, 'p.txt')
    fs.writeFileSync(fp, 'progress')
    const progress: number[] = []
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: fp,
      channelId: 'ch',
      targetUserId: 'u',
      accessToken: 't',
      onProgress: (p) => progress.push(p),
    })
    expect(r.ok).toBe(true)
    expect(progress.length).toBeGreaterThan(0)
    expect(progress[progress.length - 1]).toBe(100)
  })

  it('durationMs 反映耗时', async () => {
    const mgr = FileTransferManager.getInstance()
    const fp = path.join(tmpDir, 'd.txt')
    fs.writeFileSync(fp, 'data')
    const r = await mgr.uploadToIM({
      platform: 'im-telegram',
      filePath: fp,
      channelId: 'ch',
      targetUserId: 'u',
      accessToken: 't',
    })
    expect(r.durationMs).toBeGreaterThanOrEqual(0)
  })
})

describe('P0-06: FileTransferManager 平台限制', () => {
  it('getMaxFileSize: 6 个平台各不相同', () => {
    const mgr = FileTransferManager.getInstance()
    expect(mgr.getMaxFileSize('im-feishu')).toBe(30 * 1024 * 1024)
    expect(mgr.getMaxFileSize('im-dingtalk')).toBe(20 * 1024 * 1024)
    expect(mgr.getMaxFileSize('im-wechat-work')).toBe(20 * 1024 * 1024)
    expect(mgr.getMaxFileSize('im-telegram')).toBe(50 * 1024 * 1024)
    expect(mgr.getMaxFileSize('im-slack')).toBe(1024 * 1024 * 1024)
    expect(mgr.getMaxFileSize('im-discord')).toBe(25 * 1024 * 1024)
  })

  it('listSupportedPlatforms: 6 个', () => {
    const mgr = FileTransferManager.getInstance()
    const list = mgr.listSupportedPlatforms()
    expect(list.length).toBe(6)
    expect(list).toContain('im-feishu')
    expect(list).toContain('im-discord')
  })
})
