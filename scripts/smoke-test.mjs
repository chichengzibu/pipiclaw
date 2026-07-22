#!/usr/bin/env node
/**
 * PiPiClaw end-to-end smoke test (Phase 4 Task 5)
 *
 * Strategy A (lightweight): verify build artifacts + key code surface.
 * Does NOT spawn a real Electron process (no GUI, sub-second).
 *
 * Validates:
 *   1. Build artifacts exist (dist-electron/main.js, dist-electron/preload.js, dist/index.html)
 *   2. electron-builder output (release/latest.yml or platform-equivalent)
 *   3. Configuration integrity (package.json, electron-builder.json5)
 *   4. Source code integrity (electron/main.ts, electron/preload.ts, src/main.ts, src/App.vue)
 *   5. IPC surface: built main.js exposes a healthy number of ipcMain.handle calls
 *
 * Usage:
 *   node scripts/smoke-test.mjs     # verify existing build artifacts
 *   SMOKE_FULL=1 node ...           # also run `npm run build` first
 *
 * Exit 0 = all passed, Exit 1 = any failure.
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let passed = 0
let failed = 0
const failures = []

function check(label, fn) {
  const startMs = Date.now()
  try {
    const result = fn()
    if (result === false) throw new Error('check returned false')
    passed++
    console.log(`  ✅ ${label} (${Date.now() - startMs}ms)`)
  } catch (e) {
    failed++
    const errMsg = e instanceof Error ? e.message : String(e)
    console.log(`  ❌ ${label}: ${errMsg}`)
    failures.push({ label, error: errMsg })
  }
}

function fileSize(p) {
  if (!existsSync(p)) return 0
  return statSync(p).size
}

console.log('🔥 PiPiClaw smoke test')
console.log(`   root: ${ROOT}\n`)

if (process.env.SMOKE_FULL === '1') {
  console.log('0. Build (SMOKE_FULL=1):')
  check('npm run build exits 0', () => {
    const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true })
    if (r.status !== 0) {
      throw new Error(`build failed (exit ${r.status}): ${r.stderr?.toString().slice(-500) ?? ''}`)
    }
    return true
  })
  console.log('')
}

console.log('1. Build artifacts:')
check('dist-electron/main.js exists & non-trivial', () => {
  const p = join(ROOT, 'dist-electron/main.js')
  if (!existsSync(p)) throw new Error('missing (run `npm run build` first)')
  const size = fileSize(p)
  if (size < 10000) throw new Error(`too small: ${size} bytes (build incomplete?)`)
  return true
})
check('dist-electron/preload.js exists & non-trivial', () => {
  const p = join(ROOT, 'dist-electron/preload.js')
  if (!existsSync(p)) throw new Error('missing (run `npm run build` first)')
  const size = fileSize(p)
  if (size < 1000) throw new Error(`too small: ${size} bytes`)
  return true
})
check('dist/index.html exists (vite renderer)', () => {
  const p = join(ROOT, 'dist/index.html')
  if (!existsSync(p)) throw new Error('missing (run `npm run build` first)')
  const size = fileSize(p)
  if (size < 200) throw new Error(`too small: ${size} bytes`)
  return true
})
check('dist-electron/tsconfig.node.tsbuildinfo exists (tsc emit proof)', () => {
  const p = join(ROOT, 'dist-electron/tsconfig.node.tsbuildinfo')
  if (!existsSync(p)) throw new Error('missing (tsc incremental build info)')
  return true
})

console.log('\n2. electron-builder output:')
check('release/latest.yml exists (electron-updater manifest)', () => {
  const p = join(ROOT, 'release/latest.yml')
  if (!existsSync(p)) throw new Error('missing (run `npm run build` first)')
  return true
})

console.log('\n3. Configuration:')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
check('package.json has semver version', () => /^\d+\.\d+\.\d+/.test(pkg.version))
check('package.json#main points to dist-electron/main.js', () => pkg.main === 'dist-electron/main.js')
check('package.json has electron-builder devDep', () => !!pkg.devDependencies['electron-builder'])
check('package.json has electron devDep', () => !!pkg.devDependencies.electron)
check('package.json has vitest devDep', () => !!pkg.devDependencies.vitest)
check('package.json has electron-updater dep', () => !!pkg.dependencies['electron-updater'])
check('package.json has @playwright/test devDep', () => !!pkg.devDependencies['@playwright/test'])
check('electron-builder.json5 declares github publish provider', () => {
  const cfg = readFileSync(join(ROOT, 'electron-builder.json5'), 'utf-8')
  if (!/provider['":\s]+['"]?github/.test(cfg)) throw new Error('publish provider not github')
  return true
})
check('electron-builder.json5 declares files globs', () => {
  const cfg = readFileSync(join(ROOT, 'electron-builder.json5'), 'utf-8')
  if (!cfg.includes('dist/**/*') || !cfg.includes('dist-electron/**/*')) {
    throw new Error('files globs missing')
  }
  return true
})

console.log('\n4. Source code integrity:')
check('electron/main.ts exists', () => existsSync(join(ROOT, 'electron/main.ts')))
check('electron/preload.ts exists', () => existsSync(join(ROOT, 'electron/preload.ts')))
check('src/main.ts exists', () => existsSync(join(ROOT, 'src/main.ts')))
check('src/App.vue exists', () => existsSync(join(ROOT, 'src/App.vue')))

console.log('\n5. IPC surface (post-build grep):')
let ipcCount = 0
check('main.js contains healthy ipcMain.handle count (>= 20)', () => {
  const main = readFileSync(join(ROOT, 'dist-electron/main.js'), 'utf-8')
  ipcCount = (main.match(/ipcMain\.handle/g) || []).length
  console.log(`     -> ${ipcCount} ipcMain.handle calls`)
  if (ipcCount < 20) throw new Error(`only ${ipcCount} handlers (expected >= 20)`)
  return true
})
check('preload.js exposes contextBridge', () => {
  const preload = readFileSync(join(ROOT, 'dist-electron/preload.js'), 'utf-8')
  if (!preload.includes('contextBridge')) throw new Error('no contextBridge usage')
  return true
})
check('preload.js wires at least 3 ipcRenderer.invoke channels', () => {
  const preload = readFileSync(join(ROOT, 'dist-electron/preload.js'), 'utf-8')
  const count = (preload.match(/ipcRenderer\.invoke/g) || []).length
  console.log(`     -> ${count} ipcRenderer.invoke calls`)
  if (count < 3) throw new Error(`only ${count} invoke channels`)
  return true
})

console.log('\n6. Renderer build:')
check('dist/ contains hashed js assets (recursive scan)', () => {
  const distDir = join(ROOT, 'dist')
  if (!existsSync(distDir)) throw new Error('dist/ missing')
  const jsAssets = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(js|mjs)$/.test(entry.name)) jsAssets.push(full)
    }
  }
  walk(distDir)
  if (jsAssets.length === 0) throw new Error('no js assets under dist/')
  console.log(`     -> ${jsAssets.length} renderer assets`)
  return true
})

console.log(`\n📊 Results: ${passed} passed, ${failed} failed${ipcCount > 0 ? `, ${ipcCount} ipc handlers total` : ''}`)

if (failed > 0) {
  console.error('\n❌ Smoke test FAILED')
  console.error(failures.map((f) => `   - ${f.label}: ${f.error}`).join('\n'))
  process.exit(1)
}

console.log('\n✅ Smoke test PASSED')
process.exit(0)
