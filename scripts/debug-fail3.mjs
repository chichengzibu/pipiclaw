#!/usr/bin/env node
/** debug 3 failed tests */
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://localhost:5173/')
await page.waitForSelector('#app', { timeout: 15000 })
await page.waitForTimeout(2000)

// Models
await page.evaluate(() => { window.location.hash = '#/models' })
await page.waitForTimeout(2000)
const modelsHTML = await page.evaluate(() => {
  return {
    cards: document.querySelectorAll('.provider-card').length,
    anyCard: document.querySelectorAll('[class*="provider"]').length,
    body: document.body.innerHTML.slice(0, 500)
  }
})
console.log('Models:', JSON.stringify(modelsHTML, null, 2))

// Chat
await page.evaluate(() => { window.location.hash = '#/chat' })
await page.waitForTimeout(1500)
const chatHTML = await page.evaluate(() => {
  return {
    textarea: document.querySelectorAll('textarea').length,
    newChat: Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('新建')).length,
    emptyState: !!document.querySelector('.empty-state, .empty-chat, [class*="empty"]'),
    body: document.body.innerHTML.slice(0, 500)
  }
})
console.log('Chat:', JSON.stringify(chatHTML, null, 2))

// Skills
await page.evaluate(() => { window.location.hash = '#/skills' })
await page.waitForTimeout(2000)
const skillsHTML = await page.evaluate(() => {
  return {
    cards: document.querySelectorAll('.skill-card').length,
    listItems: document.querySelectorAll('[class*="skill"]').length,
    anyElement: document.querySelectorAll('*').length,
    body: document.body.innerHTML.slice(0, 500)
  }
})
console.log('Skills:', JSON.stringify(skillsHTML, null, 2))

await browser.close()
