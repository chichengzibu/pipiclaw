#!/usr/bin/env node
import { _electron as electron } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(__dirname, '..')
const app = await electron.launch({
  args: [path.join(PROJECT, 'dist-electron/main.js'), '--no-sandbox'],
  cwd: PROJECT,
  env: { ...process.env, PIPICLAW_E2E: '1' }
})
const win = await app.firstWindow({ timeout: 30_000 })
await win.waitForLoadState('domcontentloaded')
await win.waitForSelector('#app')
await win.setViewportSize({ width: 1440, height: 900 })
await win.waitForTimeout(3000)

await win.evaluate(() => { window.location.hash = '#/chat' })
await win.waitForTimeout(3000)

// 找 input
const textareaInfo = await win.evaluate(() => {
  const ta = document.querySelector('textarea')
  if (!ta) return { found: false }
  return { found: true, value: ta.value, placeholder: ta.placeholder, rect: ta.getBoundingClientRect() }
})
console.log('textarea:', JSON.stringify(textareaInfo))

// 试 fill
await win.fill('textarea', '测试一下')
const after = await win.evaluate(() => document.querySelector('textarea')?.value)
console.log('after fill:', after)

// 试 keydown Enter via dispatchEvent
const before = await win.evaluate(() => document.querySelectorAll('.chat-message, [class*="message"]').length)
console.log('messages before enter:', before)

await win.evaluate(() => {
  const ta = document.querySelector('textarea')
  if (ta) {
    const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
    ta.dispatchEvent(ev)
  }
})
await win.waitForTimeout(2000)
const afterKeydown = await win.evaluate(() => document.querySelectorAll('.chat-message, [class*="message"]').length)
console.log('messages after dispatch keydown:', afterKeydown)

// 看 console log 看 send 调没
const consoleLogs = []
win.on('console', msg => consoleLogs.push(msg.text()))
await win.waitForTimeout(500)
console.log('console logs:', consoleLogs.slice(-10))

await app.close()
