import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-templates-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P1-T1.2: 7 个 sandbox runtime 验证
 *
 * 4 个 SandboxBuilder 模板 + WebContainerRunner + JupyterRunner + PortForwarder
 * 本 spec 验证 4 个 SandboxBuilder 模板的"file 落盘 + 关键文件存在",
 * 其余 3 个 runtime 由各自的 unit test 覆盖(WebContainerRunner.test.ts / 
 * JupyterRunner.test.ts / PortForwarder.test.ts),在 acceptance 中引用。
 *
 * 目标:5 分钟内启动 + 200 状态码(本 spec 只验证"5 分钟内 build 成功",
 * 200 状态码由 runtime unit test 验证 — 真跑 docker 需 sandbox:selfcheck)
 *
 * 报告产出:docs/perf/sandbox-validation-2026-07.md(由 sandbox-validation.mjs 生成)
 */

import { SandboxBuilder } from '../../electron/sandbox/SandboxBuilder'
import { WorkspaceManager } from '../../electron/sandbox/workspace'
import { ALL_TEMPLATES, type TemplateConfig } from '../../electron/sandbox/templates'

describe('P1-T1.2: SandboxBuilder 4 templates build successfully', () => {
  let builder: SandboxBuilder

  beforeEach(() => {
    vi.clearAllMocks()
    // 用临时目录作为 workspace host 路径,避免污染真实目录
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipiclaw-validate-'))
    vi.spyOn(WorkspaceManager.prototype, 'createWorkspace').mockImplementation(
      (opts: { name: string; type: 'project' | 'experiment' }) => {
        const wsPath = path.join(tmpDir, opts.name)
        fs.mkdirSync(wsPath, { recursive: true })
        return {
          id: `ws-${opts.name}`,
          name: opts.name,
          type: opts.type,
          hostPath: wsPath,
          createdAt: new Date().toISOString(),
        }
      },
    )
    builder = SandboxBuilder.getInstance()
  })

  // 4 个模板各跑一次,验证 fileCount > 0 + 关键文件存在
  // 实际文件结构(electron/sandbox/templates/*.ts):
  //   vite-react-ts: 6 files  (package.json + vite.config + tsconfig + index.html + src/main.tsx + src/App.tsx)
  //   nextjs-app:    5 files  (package.json + tsconfig + next.config.mjs + app/page.tsx + app/layout.tsx)
  //   fastapi:       2 files  (requirements.txt + main.py)
  //   go-http:       2 files  (main.go + go.mod)
  const templates = [
    {
      id: 'vite-react-ts' as const,
      minFiles: 6,
      keyFiles: ['package.json', 'index.html', 'src/main.tsx'],
    },
    {
      id: 'nextjs-app' as const,
      minFiles: 5,
      keyFiles: ['package.json', 'next.config.mjs', 'app/page.tsx'],
    },
    {
      id: 'fastapi' as const,
      minFiles: 2,
      keyFiles: ['requirements.txt', 'main.py'],
    },
    {
      id: 'go-http' as const,
      minFiles: 2,
      keyFiles: ['go.mod', 'main.go'],
    },
  ]

  for (const t of templates) {
    it(`template ${t.id}: build produces >= ${t.minFiles} files within 5s`, async () => {
      const t0 = Date.now()
      const result = await builder.build({
        prompt: `validate ${t.id}`,
        templateId: t.id,
      })
      const elapsedMs = Date.now() - t0

      expect(result.ok).toBe(true)
      expect(result.template?.id).toBe(t.id)
      expect(result.fileCount).toBeGreaterThanOrEqual(t.minFiles)
      expect(elapsedMs).toBeLessThan(5000)

      // 关键文件存在
      if (result.workspace) {
        for (const keyFile of t.keyFiles) {
          const fp = path.join(result.workspace.hostPath, keyFile)
          expect(fs.existsSync(fp), `${keyFile} should exist`).toBe(true)
          const stat = fs.statSync(fp)
          expect(stat.size, `${keyFile} should have content`).toBeGreaterThan(0)
        }
      }
    }, 10_000)
  }

  it('ALL_TEMPLATES registry exposes 4 templates', () => {
    expect(ALL_TEMPLATES).toHaveLength(4)
    const ids = ALL_TEMPLATES.map((t: TemplateConfig) => t.id)
    expect(ids).toEqual(
      expect.arrayContaining(['vite-react-ts', 'nextjs-app', 'fastapi', 'go-http']),
    )
  })

  it('each template has devPort + startCommand + at least 2 files', () => {
    for (const t of ALL_TEMPLATES) {
      expect(t.devPort, `${t.id} missing devPort`).toBeGreaterThan(0)
      expect(t.startCommand, `${t.id} missing startCommand`).toBeTruthy()
      expect(t.files.length, `${t.id} should have >= 2 files`).toBeGreaterThanOrEqual(2)
    }
  })
})
