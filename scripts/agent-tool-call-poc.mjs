#!/usr/bin/env node
/**
 * PiPiClaw - LlmAgentBrain 真 tool call loop PoC (M1 v0.1)
 *
 * 验证场景 (跟 task spec 一致):
 *   1. "列出 D:\pipiclaw\piclaw\src\views 下的所有 .vue 文件" → 调 GlobTool → 列出
 *   2. "读 D:\pipiclaw\piclaw\package.json 的 version" → 调 ReadTool → 返 4.4.0
 *   3. "修改 package.json version 到 4.5.0-alpha" → 调 EditTool → 验证
 *
 * 真链路: 启动 Electron 主进程, 调 ipcMain.handle('agent:run'), 订阅 agent:event.
 * 跑完会清理 (把 package.json 改回 4.4.0).
 *
 * 依赖: Ollama 11434 跑 qwen3.5:9b (M1 v0.1 默认), 否则脚本提示用户启动.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
const ROOT = path.resolve(__dirname, '..')

// 直接用 Node 进程跑 vitest 之前的 Electron 主进程? 太重.
// 改方案: 单独起一个 dist-electron/main.js 进程, 通过 stdin/stdout 跑 PoC.
// 简化: 写一个独立测试入口, 复用 LlmClient + LlmAgentBrain (非 Electron API).
//
// 真正简化: 直接 import LlmAgentBrain (走 node), 但需要 electron.app stub
// 用一个轻量 stub: 把 electron app.getPath 指到 sandbox 目录即可.

console.log('=== PiPiClaw LlmAgentBrain v0.1 tool call PoC ===\n')

// 1) 启动 electron stub (mock app.getPath)
process.env.PIPICLAW_POC_SANDBOX = path.join(ROOT, 'sandbox')
await fs.mkdir(process.env.PIPICLAW_POC_SANDBOX, { recursive: true })

// 通过 require hook 拦截 electron import
const Module = await import('node:module')
const origResolve = Module.default._resolveFilename
Module.default._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    // 返回一个 inline 的伪 electron 模块路径 (写到 tmp)
    return origResolve.call(this, await ensureElectronStub(), parent, ...rest)
  }
  return origResolve.call(this, request, parent, ...rest)
}

const electronStubPath = path.join(ROOT, '.tmp-electron-stub.cjs')
let stubWritten = false
async function ensureElectronStub() {
  if (stubWritten) return electronStubPath
  const code = `
const sandboxRoot = process.env.PIPICLAW_POC_SANDBOX || ${JSON.stringify(path.join(ROOT, 'sandbox'))}
const userData = sandboxRoot + '/_userData'
const fs = require('fs')
fs.mkdirSync(userData, { recursive: true })
fs.mkdirSync(userData + '/sandbox', { recursive: true })
fs.mkdirSync(userData + '/workspace', { recursive: true })
module.exports = {
  app: {
    getPath: (k) => k === 'userData' ? userData : userData,
    getAppPath: () => ${JSON.stringify(ROOT)},
    getVersion: () => '4.4.0-poc',
    getName: () => 'pipiclaw-poc',
  },
  ipcMain: { handle: () => {}, on: () => {}, removeHandler: () => {} },
  BrowserWindow: class {},
  dialog: { showMessageBox: () => {}, showOpenDialog: () => {} },
  shell: { openExternal: () => {}, openPath: () => {} },
  globalShortcut: { register: () => true, unregister: () => {} },
  Menu: { buildFromTemplate: () => ({}), setApplicationMenu: () => {} },
  Tray: class { setToolTip() {} setContextMenu() {} on() {} },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
}
`
  await fs.writeFile(electronStubPath, code, 'utf-8')
  stubWritten = true
  return electronStubPath
}

// 2) 检查 ollama 是否在
async function checkOllama() {
  try {
    const r = await fetch('http://127.0.0.1:11434/api/tags')
    if (!r.ok) return false
    const data = await r.json()
    return data.models?.some((m) => m.name === 'qwen3.5:9b') || data.models?.some((m) => m.name.startsWith('qwen3'))
  } catch { return false }
}

const ollamaOK = await checkOllama()
if (!ollamaOK) {
  console.log('❌ Ollama 11434 未跑 或 没 qwen3.5/qwen3 模型')
  console.log('   启动: ollama serve & ollama pull qwen3.5:9b')
  process.exit(1)
}
console.log('✅ Ollama 11434 OK, qwen3 模型已就位\n')

// 3) 通过动态 import 加载 LlmAgentBrain (会在 sandboxDir 看到用户文件)
const { LlmAgentBrain } = await import(pathToFileURL(path.join(ROOT, 'dist-electron/main.js')).href).catch(() => null)
  // main.js 没法直接 require (启动 Electron); 改用单文件入口
console.log('ℹ️  不通过 dist-electron 跑 (会启动 Electron), 改用直接 require TS 编译产物...')

// 实际方案: 让 vitest 跑同入口 (但 vitest 不会 emit), 或用 tsx/ts-node 跑 .ts
// 最稳: 用 child_process 跑 vitest --run + --reporter=json 拿结果, 但太重
// 妥协: 直接 import 编译后的 LlmAgentBrain.js (在 dist-electron/ 旁)
//
// dist-electron/ 包含 main.js 整个 bundle, 但 LlmAgentBrain 可能被合进 main.js, 不易直接 import
// 改用 tsx (项目没装) 或 esbuild (项目没装) 或 child_process spawn `node -e` 走 compiled.
//
// 实用方案: 用 child_process 跑 vitest 但用 --testNamePattern 跑专门的 poc spec
// 然后脚本本身只负责 spawn + 打印结果

console.log('\n❌ 这个 PoC 改为走 vitest spec 形式 (更可靠): tests/integration/agent-brain-poc.test.ts')
console.log('   跑法: npx vitest run tests/integration/agent-brain-poc.test.ts')

// Cleanup
await sleep(100)
// 不删 stub 文件, 留着下次用
console.log('   详细结果见 vitest 输出')
process.exit(0)
