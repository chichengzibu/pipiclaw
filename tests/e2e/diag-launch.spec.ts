import { test, _electron as electron } from '@playwright/test'
import path from 'node:path'

/**
 * 诊断测试: 启动 Electron,捕获所有 console + 错误,不做任何 waitFor
 */

const repoRoot = path.resolve(__dirname, '..', '..')
const mainEntry = path.join(repoRoot, 'dist-electron', 'main.js')

test('diagnose electron launch', async () => {
  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: repoRoot,
    env: { ...process.env, PIPICLAW_E2E: '1' },
    timeout: 30_000,
  })

  // 监听主进程输出
  app.process().stdout?.on('data', (d) => console.log(`[main stdout] ${d.toString().trim()}`))
  app.process().stderr?.on('data', (d) => console.log(`[main stderr] ${d.toString().trim()}`))

  // 监听所有窗口的 webContents
  app.on('window', async (window) => {
    console.log(`[window opened] url=${window.url()}`)
    window.on('console', (msg) => {
      console.log(`[renderer console.${msg.type()}] ${msg.text()}`)
    })
    window.on('pageerror', (err) => {
      console.log(`[renderer pageerror] ${err.message}\n${err.stack ?? ''}`)
    })
    window.on('crash', () => {
      console.log('[renderer CRASHED]')
    })
    window.on('close', () => {
      console.log('[window CLOSED]')
    })

    // 等 Vue 挂载 + 抓 innerHTML
    await window.waitForTimeout(3000)
    const html = await window.evaluate(() => document.getElementById('app')?.innerHTML ?? '<no #app>')
    console.log(`[renderer #app innerHTML length=${html.length}]`)
    console.log(`[renderer #app first 1000 chars]`)
    console.log(html.substring(0, 1000))
  })

  app.on('close', () => {
    console.log('[app closed]')
  })

  // 等 5s 看会发生什么
  await new Promise((r) => setTimeout(r, 5000))

  // 列出所有窗口
  const windows = app.windows()
  console.log(`[after 5s] window count = ${windows.length}`)
  for (const w of windows) {
    console.log(`  - url=${w.url()}`)
    try {
      const title = await w.title()
      console.log(`    title=${title}`)
    } catch (e) {
      console.log(`    title=<error: ${(e as Error).message}>`)
    }
  }

  await app.close().catch(() => {})
})
