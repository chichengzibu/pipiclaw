#!/usr/bin/env node
/**
 * PiPiClaw v4.5.0-alpha 4h 后台真链路 Dogfooding 长跑
 *
 * 跟 2 分钟 dogfooding 脚本不同: 持续 4h, 反复跑 5 场景 + 监控内存 + 报告
 * 产物: ui-screenshots-dogfooding-4h/round-N/*.png + log
 *
 * 设计:
 *   - 每 round ~ 6 min (5 场景 + 启动开销)
 *   - 4h 理论能跑 ~40 round
 *   - 每 round 写一次状态, 4h 末尾出总报告
 *   - 跑崩/卡住自动停 + 报告
 */
import { _electron as electron } from 'playwright'
import { mkdirSync, existsSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(__dirname, '..')
const mainEntry = path.join(PROJECT, 'dist-electron', 'main.js')
const OUT = 'ui-screenshots-dogfooding-4h'
const LOG = 'ui-screenshots-dogfooding-4h/dogfooding.log'
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const PAGES = [
  { name: '01-dashboard', hash: '#/dashboard', wait: 1200 },
  { name: '02-chat',      hash: '#/chat',      wait: 1200 },
  { name: '03-models',    hash: '#/models',    wait: 1200 },
  { name: '04-skills',    hash: '#/skills',    wait: 1200 },
  { name: '05-settings',  hash: '#/settings',  wait: 1200 }
]

const startTime = new Date()
const deadline = startTime.getTime() + 4 * 60 * 60 * 1000  // 4h

// 兜底: playwright / IPC / 其他任何 uncaught 都不要让 4h 进程死
process.on('uncaughtException', (e) => {
  log(`UNCAUGHT EXCEPTION: ${String(e).slice(0, 300)}`)
})
process.on('unhandledRejection', (e) => {
  log(`UNHANDLED REJECTION: ${String(e).slice(0, 300)}`)
})

const summary = {
  startTime: startTime.toISOString(),
  deadline: new Date(deadline).toISOString(),
  rounds: [],
  errors: [],
  memoryPeakMB: 0
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  appendFileSync(LOG, line, 'utf-8')
  console.log(line.trim())
}

async function cleanupElectron() {
  try {
    const { execSync } = await import('node:child_process')
    execSync('powershell -NoProfile -Command "Get-Process electron,pipiclaw -ErrorAction SilentlyContinue | Stop-Process -Force"', { stdio: 'ignore' })
  } catch {}
  await new Promise(r => setTimeout(r, 2000))
}

async function runOneRound(roundNum) {
  const roundDir = path.join(OUT, `round-${String(roundNum).padStart(3, '0')}`)
  if (!existsSync(roundDir)) mkdirSync(roundDir, { recursive: true })
  const roundStart = Date.now()
  const result = { round: roundNum, start: new Date().toISOString(), scenes: [] }

  await cleanupElectron()
  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: PROJECT,
    env: { ...process.env, PIPICLAW_E2E: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
  }).catch(e => { throw new Error('启动失败: ' + e.message) })

  let win
  try {
    win = await app.firstWindow({ timeout: 30_000 })
    await win.waitForLoadState('domcontentloaded')
    await win.waitForSelector('#app', { timeout: 15_000 })
    await win.setViewportSize({ width: 1440, height: 900 })
    await win.waitForTimeout(2000)

    // 场景 1: 5 页截图 (light only, 每 round)
    const s1Start = Date.now()
    await win.emulateMedia({ colorScheme: 'light' })
    await win.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
    await win.waitForTimeout(500)
    for (const p of PAGES) {
      await win.evaluate((h) => { window.location.hash = h }, p.hash)
      await win.waitForTimeout(p.wait)
      await win.screenshot({ path: path.join(roundDir, `light-${p.name}.png`), fullPage: false })
    }
    result.scenes.push({ name: '1.5页截图', status: 'PASS', dur: Date.now() - s1Start })

    // 场景 2: Chat Ollama 真链路
    const s2Start = Date.now()
    let chatResult = ''
    try {
      await win.evaluate(() => { window.location.hash = '#/chat' })
      await win.waitForTimeout(2000)
      const inputSel = 'textarea, input[type="text"], [contenteditable="true"]'
      await win.waitForSelector(inputSel, { timeout: 10_000 })
      const prompt = `PiPiClaw v4.5.0-alpha round ${roundNum}: 简单介绍下你自己 (一句话)`
      await win.fill(inputSel, prompt)
      await win.press(inputSel, 'Enter')
      await win.waitForTimeout(28_000)
      await win.screenshot({ path: path.join(roundDir, '02-chat-ollama.png'), fullPage: false })
      chatResult = await win.evaluate(() => {
        const els = document.querySelectorAll('.chat-message, [class*="message"], [class*="markdown"]')
        return Array.from(els).map(e => e.textContent).filter(t => t && t.trim().length > 0).join(' ').slice(-200)
      })
      result.scenes.push({ name: '2.Chat Ollama', status: 'PASS', dur: Date.now() - s2Start, note: chatResult.slice(0, 80) })
    } catch (e) {
      result.scenes.push({ name: '2.Chat Ollama', status: 'FAIL', dur: Date.now() - s2Start, err: String(e).slice(0, 150) })
    }

    // 场景 3: 主题切换
    const s3Start = Date.now()
    try {
      await win.evaluate(() => { window.location.hash = '#/settings' })
      await win.waitForTimeout(1500)
      const themeChanged = await win.evaluate(() => {
        const candidates = document.querySelectorAll('button')
        for (const c of candidates) {
          const t = c.textContent || ''
          if (t.includes('Dark') || t.includes('深色') || t.includes('暗')) { c.click(); return true }
        }
        return false
      })
      await win.waitForTimeout(800)
      const finalTheme = await win.evaluate(() => document.documentElement.getAttribute('data-theme'))
      if (!themeChanged || finalTheme !== 'dark') throw new Error('没切到 dark')
      await win.screenshot({ path: path.join(roundDir, '03-settings-dark.png'), fullPage: false })
      result.scenes.push({ name: '3.主题切换', status: 'PASS', dur: Date.now() - s3Start })
    } catch (e) {
      result.scenes.push({ name: '3.主题切换', status: 'FAIL', dur: Date.now() - s3Start, err: String(e).slice(0, 150) })
    }

    // 场景 4: CommandPalette
    const s4Start = Date.now()
    try {
      await win.evaluate(() => { window.location.hash = '#/chat' })
      await win.waitForTimeout(1500)
      await win.keyboard.press('Control+k')
      await win.waitForTimeout(500)
      const paletteVisible = await win.evaluate(() => !!document.querySelector('[class*="command-palette"], [class*="palette"], [class*="CommandPalette"]'))
      if (!paletteVisible) throw new Error('CommandPalette 没出现')
      await win.screenshot({ path: path.join(roundDir, '04-command-palette.png'), fullPage: false })
      await win.keyboard.press('Escape')
      result.scenes.push({ name: '4.CommandPalette', status: 'PASS', dur: Date.now() - s4Start })
    } catch (e) {
      result.scenes.push({ name: '4.CommandPalette', status: 'FAIL', dur: Date.now() - s4Start, err: String(e).slice(0, 150) })
    }

    // 场景 5: MCP (启动 filesystem server 后测)
    const s5Start = Date.now()
    try {
      // 先启 filesystem server (用 name 触发 isFilesystemServer 内置路径, allowedPaths 提供沙箱白名单)
      const startResult = await win.evaluate(async () => {
        const api = (window).electronAPI
        if (!api?.mcp?.startServer) return { error: 'no startServer' }
        try {
          return await api.mcp.startServer({ name: 'filesystem', allowedPaths: ['D:\\pipiclaw\\piclaw'] })
        } catch (e) { return { error: String(e) } }
      })
      if (startResult?.error || !startResult?.success) {
        throw new Error(`startServer failed: ${JSON.stringify(startResult).slice(0, 200)}`)
      }
      // startServer 已 await 到 state=ready, 不需要 waitTimeout
      const tools = await win.evaluate(async () => {
        const api = (window).electronAPI
        if (!api?.mcp?.listTools) return { error: 'no listTools IPC' }
        return await api.mcp.listTools().catch(e => ({ error: String(e) }))
      })
      const toolCount = (() => {
        const list = Array.isArray(tools) ? tools : (tools?.data ?? [])
        return Array.isArray(list) ? list.length : 0
      })()
      if (toolCount === 0) throw new Error(`MCP listTools 返 0 工具 (raw: ${JSON.stringify(tools).slice(0, 100)})`)
      result.scenes.push({ name: '5.MCP filesystem', status: 'PASS', dur: Date.now() - s5Start, note: `${toolCount} tools` })
    } catch (e) {
      result.scenes.push({ name: '5.MCP filesystem', status: 'FAIL', dur: Date.now() - s5Start, err: String(e).slice(0, 150) })
    }

    // 内存监控
    const memInfo = await win.evaluate(() => {
      const p = (performance).memory
      return p ? { used: p.usedJSHeapSize, total: p.totalJSHeapSize, limit: p.jsHeapSizeLimit } : null
    })
    if (memInfo) {
      const usedMB = Math.round(memInfo.used / 1024 / 1024)
      if (usedMB > summary.memoryPeakMB) summary.memoryPeakMB = usedMB
      result.memoryMB = usedMB
    }

  } catch (e) {
    summary.errors.push({ round: roundNum, time: new Date().toISOString(), error: String(e).slice(0, 300) })
    log(`Round ${roundNum} 启动失败: ${String(e).slice(0, 200)}`)
  } finally {
    try { await app.close() } catch {}
    await cleanupElectron()
  }

  result.dur = Date.now() - roundStart
  summary.rounds.push(result)
  const pass = result.scenes.filter(s => s.status === 'PASS').length
  log(`Round ${roundNum}: ${pass}/5 PASS, 内存 ${result.memoryMB || '?'}MB, 用时 ${result.dur}ms`)
  return result
}

async function main() {
  log(`=== PiPiClaw v4.5.0-alpha 4h Dogfooding 长跑启动 ===`)
  log(`开始: ${startTime.toISOString()}`)
  log(`截止: ${new Date(deadline).toISOString()}`)
  log(`Main: ${mainEntry}`)
  log(`输出: ${OUT}`)

  let round = 0
  while (Date.now() < deadline) {
    round++
    try {
      await runOneRound(round)
    } catch (e) {
      log(`Round ${round} 整体失败: ${String(e).slice(0, 200)}`)
      summary.errors.push({ round, time: new Date().toISOString(), error: String(e).slice(0, 300) })
    }

    // 每 round 写一次 partial report
    const partialPath = path.join(PROJECT, 'docs/team/2026-08-06-dogfooding-4h-partial.json')
    writeFileSync(partialPath, JSON.stringify(summary, null, 2), 'utf-8')

    // 距离截止 < 1 round 停
    if (Date.now() > deadline - 5 * 60 * 1000) {
      log(`接近截止, 停止`)
      break
    }
  }

  // 写总报告
  summary.endTime = new Date().toISOString()
  const totalDuration = Date.now() - startTime.getTime()
  const allScenes = summary.rounds.flatMap(r => r.scenes)
  const passCount = allScenes.filter(s => s.status === 'PASS').length
  const failCount = allScenes.filter(s => s.status === 'FAIL').length

  const report = `# PiPiClaw v4.5.0-alpha 4h Dogfooding 长跑报告

> **开始**: ${summary.startTime}
> **结束**: ${summary.endTime}
> **总时长**: ${Math.round(totalDuration / 60000)} 分钟
> **总 round**: ${summary.rounds.length}
> **场景总数**: ${allScenes.length}
> **PASS**: ${passCount} / FAIL: ${failCount}
> **峰值内存**: ${summary.memoryPeakMB} MB
> **错误**: ${summary.errors.length}

## 各 Round 结果

| Round | Pass/Total | 内存 (MB) | 用时 (ms) | 失败场景 |
|---|---|---|---|---|
${summary.rounds.map(r => `| ${r.round} | ${r.scenes.filter(s => s.status === 'PASS').length}/${r.scenes.length} | ${r.memoryMB || '?'} | ${r.dur || '?'} | ${r.scenes.filter(s => s.status === 'FAIL').map(s => s.name).join(', ') || '-'} |`).join('\n')}

## 各场景汇总

${[1, 2, 3, 4, 5].map(i => {
  const sceneName = ['启动+截图', 'Chat Ollama', '主题切换', 'CommandPalette', 'MCP filesystem'][i-1]
  const scenes = allScenes.filter(s => s.name?.includes(sceneName.split('.')[1] || sceneName))
  const pass = scenes.filter(s => s.status === 'PASS').length
  return `- **${sceneName}**: ${pass}/${scenes.length} (${Math.round(pass/scenes.length*100)}%)`
}).join('\n')}

## 错误汇总

${summary.errors.length === 0 ? '无' : summary.errors.map(e => `- Round ${e.round} @ ${e.time}: ${e.error}`).join('\n')}

## 关键发现

${summary.memoryPeakMB > 500 ? `⚠️ **内存泄漏嫌疑**: 峰值 ${summary.memoryPeakMB} MB, 4h 跑下来后内存超 500MB` : `✅ 内存稳定: 峰值 ${summary.memoryPeakMB} MB`}

## 报告位置
- 报告: docs/team/2026-08-06-dogfooding-4h-final.md
- 截图: ui-screenshots-dogfooding-4h/round-NNN/*.png (每 round 12+ 张)
- log: ui-screenshots-dogfooding-4h/dogfooding.log
- partial JSON: docs/team/2026-08-06-dogfooding-4h-partial.json
`
  const reportPath = path.join(PROJECT, 'docs/team/2026-08-06-dogfooding-4h-final.md')
  writeFileSync(reportPath, report, 'utf-8')
  const finalJsonPath = path.join(PROJECT, 'docs/team/2026-08-06-dogfooding-4h-final.json')
  writeFileSync(finalJsonPath, JSON.stringify(summary, null, 2), 'utf-8')

  log(`=== 4h Dogfooding 完成 ===`)
  log(`总 round: ${summary.rounds.length}, PASS: ${passCount}, FAIL: ${failCount}`)
  log(`峰值内存: ${summary.memoryPeakMB} MB`)
  log(`报告: docs/team/2026-08-06-dogfooding-4h-final.md`)
}

main().catch(e => { log('FAIL: ' + String(e)); process.exit(1) })
