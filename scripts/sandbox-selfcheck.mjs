#!/usr/bin/env node
/**
 * PiPiClaw sandbox selfcheck 脚本(W10.3)
 * 用法: pnpm sandbox:selfcheck  或  node scripts/sandbox-selfcheck.mjs
 *
 * 5 项检查:
 * 1. docker installed (docker --version)
 * 2. docker daemon up (docker info)
 * 3. base image exists (docker image inspect pipiclaw/sandbox-base:latest)
 * 4. can run hello (docker run hello-world, timeout 30s)
 * 5. self-test L1 (本地 SandboxL1 stub 不可用, 标记 skip)
 */

import { execSync, spawnSync } from 'node:child_process'

const results = []

function check(name, fn) {
  const startMs = Date.now()
  try {
    const ok = fn()
    results.push({ name, ok: !!ok, durationMs: Date.now() - startMs, error: ok ? undefined : 'returned false' })
  } catch (e) {
    results.push({ name, ok: false, durationMs: Date.now() - startMs, error: String(e.message ?? e) })
  }
}

check('docker-installed', () => {
  const out = execSync('docker --version', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim()
  console.log(`  → ${out}`)
  return true
})

check('docker-daemon-up', () => {
  const out = execSync('docker info 2>&1', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
  if (out.toLowerCase().includes('cannot connect') || out.toLowerCase().includes('permission denied')) {
    throw new Error('daemon down or permission denied')
  }
  console.log('  → daemon OK')
  return true
})

check('base-image-exists', () => {
  try {
    execSync('docker image inspect pipiclaw/sandbox-base:latest', { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 })
    console.log('  → image exists')
    return true
  } catch {
    console.log('  → image NOT found (W9 阶段可能未 build, 可用 sandbox:build-base 构建)')
    return false
  }
})

check('can-run-hello', () => {
  const r = spawnSync('docker', ['run', '--rm', 'hello-world'], { encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' })
  if (r.status !== 0) throw new Error(`docker run hello-world exit ${r.status}: ${r.stderr?.slice(0, 200)}`)
  console.log('  → hello-world ok')
  return true
})

check('l1-self-test', () => {
  const platform = process.platform
  console.log(`  → platform=${platform} (L1 self-test W10 阶段 skip, W11+ 评估)`)
  return false
})

const okCount = results.filter(r => r.ok).length
const totalCount = results.length
const passRate = (okCount / totalCount * 100).toFixed(0)

console.log()
console.log('========== sandbox selfcheck ==========')
for (const r of results) {
  const mark = r.ok ? '✅' : '❌'
  const note = r.error ? ` (${r.error.slice(0, 80)})` : ''
  console.log(`  ${mark} ${r.name.padEnd(25)} ${r.durationMs}ms${note}`)
}
console.log('----------------------------------------')
console.log(`  ${okCount}/${totalCount} passed (${passRate}%)`)
console.log('========================================')

process.exit(okCount === totalCount ? 0 : 1)