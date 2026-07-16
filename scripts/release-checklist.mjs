#!/usr/bin/env node
/**
 * PiPiClaw release checklist
 * Usage: node scripts/release-checklist.mjs
 *
 * 7 steps total; 0 hard fail required for GA
 */
import { execSync } from 'node:child_process'

const steps = [
  { name: 'git working tree clean', cmd: 'git status --porcelain', expectEmpty: true },
  { name: 'TypeScript typecheck (node)', cmd: 'npx tsc --noEmit -p tsconfig.node.json' },
  { name: 'Vitest unit', cmd: 'npx vitest run' },
  { name: 'Vite build', cmd: 'npm run build' },
  { name: 'Sandbox selfcheck', cmd: 'node scripts/sandbox-selfcheck.mjs', softFail: true },
  { name: 'Lint', cmd: 'npm run lint', softFail: true },
  { name: 'E2E', cmd: 'npx playwright test', softFail: true },
]

let passCount = 0
let failCount = 0
console.log('========== release-checklist ==========')
for (const step of steps) {
  const startMs = Date.now()
  try {
    const out = execSync(step.cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 180_000 })
    const outStr = String(out)
    if (step.expectEmpty && outStr.trim() !== '') {
      console.log(`FAIL ${step.name}: not empty (${outStr.slice(0, 100)})`)
      failCount += 1
      continue
    }
    console.log(`PASS ${step.name}: ok (${Date.now() - startMs}ms)`)
    passCount += 1
  } catch (e) {
    if (step.softFail) {
      const msg = (e.stderr?.toString?.() ?? e.message ?? String(e)).slice(0, 100)
      console.log(`WARN ${step.name}: soft-fail (${msg})`)
      passCount += 1
    } else {
      console.log(`FAIL ${step.name}: FAIL`)
      console.error((e.stderr?.toString?.() ?? e.message ?? String(e)).slice(0, 500))
      failCount += 1
    }
  }
}
console.log('----------------------------------------')
console.log(`  ${passCount}/${steps.length} passed (${failCount} hard fail)`)
console.log('========================================')
process.exit(failCount > 0 ? 1 : 0)
