#!/usr/bin/env node
/**
 * PiPiClaw 性能基准 (Phase 5 Task 2)
 *
 * 4 个维度(全部基于已 build 产物,不打 spawn):
 * A. Build 性能 — vite build 耗时(可跳过,如不需要)
 * B. IPC surface — ipcMain.handle 数 + ipcRenderer.invoke 数 + main.js 字节
 * C. Bundle size — dist/assets/ top 5 文件 + 总量
 * D. Mock SSE 延迟 — 启动 vite + express mock,测量首字延迟 + total time
 *
 * 阈值基于实测,后续 CI 介入才有 regression catch。
 *
 * Usage:
 *   node scripts/perf-benchmark.mjs        # 仅 B + C(默认,1s 内完成)
 *   PERF_FULL=1 node scripts/perf-benchmark.mjs  # 含 A(vite build)
 *   PERF_SSE=1 node scripts/perf-benchmark.mjs   # 含 D(mock SSE)
 *
 * 输出: docs/perf/baseline.md + docs/perf/baseline.json
 */

import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const PERF_DIR = join(ROOT, 'docs/perf')

if (!existsSync(PERF_DIR)) mkdirSync(PERF_DIR, { recursive: true })

const results = []

function record(name, value, unit, threshold) {
  let status
  if (threshold === null || threshold === undefined) {
    status = 'ℹ️  info'
  } else if (typeof threshold === 'object') {
    status = value >= threshold.min && value <= threshold.max ? '✅ pass' : '❌ fail'
  } else {
    status = value <= threshold ? '✅ pass' : '❌ fail'
  }
  results.push({ name, value, unit, threshold: threshold ?? null, status })
}

function fmtThreshold(t) {
  if (t === null || t === undefined) return '-'
  if (typeof t === 'object') return `${t.min} ~ ${t.max}`
  return `${t}`
}

console.log('📊 PiPiClaw Performance Benchmark')
console.log('==================================\n')

// 维度 A — build 性能(可选,默认跳过)
if (process.env.PERF_FULL === '1') {
  console.log('A. Build performance...')
  const t0 = Date.now()
  try {
    const { execSync } = await import('node:child_process')
    execSync('npx vite build', { cwd: ROOT, stdio: 'pipe' })
    const elapsed = Date.now() - t0
    record('A1.vite build time', elapsed, 'ms', 180000)
    console.log(`   vite build: ${elapsed}ms`)
  } catch (e) {
    console.error(`   ❌ vite build failed: ${(e?.message || '').slice(0, 100)}`)
  }
  console.log('')
} else {
  console.log('A. Build performance... (skipped, set PERF_FULL=1 to enable)')
  console.log('')
}

// 维度 B — IPC surface
console.log('B. IPC surface...')
{
  const mainJs = join(ROOT, 'dist-electron/main.js')
  const preloadJs = join(ROOT, 'dist-electron/preload.js')
  if (!existsSync(mainJs) || !existsSync(preloadJs)) {
    console.log('   ⚠️  dist-electron/{main,preload}.js missing, run `npm run build` first, skipping')
  } else {
    const mainContent = readFileSync(mainJs, 'utf-8')
    const preloadContent = readFileSync(preloadJs, 'utf-8')
    const handlers = (mainContent.match(/ipcMain\.handle/g) || []).length
    const invokes = (preloadContent.match(/ipcRenderer\.invoke/g) || []).length
    const mainSizeKB = Math.round(statSync(mainJs).size / 1024)
    const preloadSizeKB = Math.round(statSync(preloadJs).size / 1024)

    record('B1.ipcMain.handle count (main.js)', handlers, '个', { min: 100, max: 5000 })
    record('B2.ipcRenderer.invoke count (preload.js)', invokes, '个', { min: 100, max: 5000 })
    record('B3.main.js size', mainSizeKB, 'KB', { min: 1, max: 8192 })
    record('B4.preload.js size', preloadSizeKB, 'KB', { min: 1, max: 2048 })

    console.log(`   ipcMain.handle: ${handlers}`)
    console.log(`   ipcRenderer.invoke: ${invokes}`)
    console.log(`   main.js: ${mainSizeKB}KB, preload.js: ${preloadSizeKB}KB`)
  }
  console.log('')
}

// 维度 C — bundle size
console.log('C. Bundle size...')
{
  const assetsDir = join(ROOT, 'dist/assets')
  if (!existsSync(assetsDir)) {
    console.log('   ⚠️  dist/assets/ missing, skipping')
  } else {
    const allFiles = readdirSync(assetsDir)
    const jsFiles = allFiles
      .filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))
      .map((f) => ({ f, size: statSync(join(assetsDir, f)).size }))
      .sort((a, b) => b.size - a.size)
    const cssFiles = allFiles
      .filter((f) => f.endsWith('.css'))
      .map((f) => ({ f, size: statSync(join(assetsDir, f)).size }))
    const totalJsKB = Math.round(jsFiles.reduce((s, x) => s + x.size, 0) / 1024)
    const totalCssKB = Math.round(cssFiles.reduce((s, x) => s + x.size, 0) / 1024)

    console.log(`   Top 5 largest .js:`)
    for (const { f, size } of jsFiles.slice(0, 5)) {
      console.log(`     ${f}: ${Math.round(size / 1024)}KB`)
    }
    console.log(`   Total renderer JS: ${totalJsKB}KB, CSS: ${totalCssKB}KB`)

    record('C1.renderer js total', totalJsKB, 'KB', { min: 1, max: 16384 })
    record('C2.renderer css total', totalCssKB, 'KB', { min: 1, max: 4096 })
    record('C3.largest chunk size', Math.round((jsFiles[0]?.size ?? 0) / 1024), 'KB', { min: 1, max: 4096 })
    record('C4.js chunk count', jsFiles.length, '个', { min: 1, max: 200 })
  }
  console.log('')
}

// 维度 D — mock SSE 延迟(可选,默认跳过,留 Phase 5 stretch)
if (process.env.PERF_SSE === '1') {
  console.log('D. SSE latency...')
  console.log('   ℹ️  not implemented in current scope, see Phase 5 plan')
  console.log('')
} else {
  console.log('D. SSE latency... (skipped, set PERF_SSE=1 to enable, Phase 5 stretch)')
  console.log('')
}

console.log('🎯 Results')
console.log('----------')
const tableRows = results.map((r) => ({
  指标: r.name,
  实测: `${r.value} ${r.unit}`,
  阈值: fmtThreshold(r.threshold),
  状态: r.status,
}))
console.table(tableRows)

// 写报告
const md = [
  '# PiPiClaw 性能基准报告',
  '',
  `生成时间: ${new Date().toISOString()}`,
  `commit: ${process.env.GIT_COMMIT || 'local'}`,
  '',
  '## 实测',
  '',
  '| 指标 | 实测 | 单位 | 阈值 | 状态 |',
  '| --- | ---: | --- | --- | --- |',
  ...results.map(
    (r) => `| ${r.name} | ${r.value} | ${r.unit} | ${fmtThreshold(r.threshold)} | ${r.status} |`,
  ),
  '',
  '## 含义',
  '',
  '- **IPC surface** 是 Phase 2 / 3 / 4 / 5 累积的 IPC handler / invoke 总数,反映 Electron 主进程复杂度',
  '- **bundle size** 反映渲染端初始下载成本,gzip 前估算',
  '- **build time** 是 vite cold cache 完整 build 耗时(CI 默认 skip,需要 PERF_FULL=1)',
  '- **SSE latency** 需要 mock LLM server,留 Phase 5 stretch',
  '',
  '## 性能门禁策略',
  '',
  '本报告**不**作为 CI gate(波动大)。仅供人在本地手动比较 baseline 与新测量值。',
  '当发现明显 regression(>30%)时,在 commit message 中记录差异。',
  '',
].join('\n')

writeFileSync(join(PERF_DIR, 'baseline.md'), md)
writeFileSync(
  join(PERF_DIR, 'baseline.json'),
  JSON.stringify(
    { timestamp: new Date().toISOString(), commit: process.env.GIT_COMMIT || 'local', results },
    null,
    2,
  ),
)

console.log(`\n📄 Written: docs/perf/baseline.md + baseline.json`)
console.log('🎉 Done')