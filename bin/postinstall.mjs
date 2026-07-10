#!/usr/bin/env node
/**
 * PiPiClaw 引导脚本（postinstall）
 *
 * 目的：用户第一次执行 `npm install` 时，自动检测开发 / 运行环境，
 *       把结果写入 ~/.pipiclaw/.bootstrap-state.json，
 *       让后续 GUI / CLI 能读取"用户在什么环境"，做出更合适的提示。
 *
 * 设计原则（来自设计稿段 2.3 "不静默执行" 反模式）：
 *   - 不自动安装任何东西
 *   - 不抛出任何异常（探测失败用 warn 即可）
 *   - 每项探测都明确告诉用户 [ok] / [skip] / [warn]
 *   - 失败的探测不会阻塞 npm install 流程
 *
 * 仅依赖 Node 内置模块：node:os / node:path / node:fs/promises
 *                      / node:child_process / node:url
 */

import { homedir, platform, arch } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFilep = promisify(execFile)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * 探测：执行外部命令，成功返回 stdout（trim 后），失败返回 null。
 * 永不抛错——所有失败都被吞掉并由调用方按 warn 处理。
 *
 * @param {string} cmd   命令名
 * @param {string[]} args 参数列表
 * @returns {Promise<string|null>}
 */
async function probe(cmd, args = []) {
  try {
    const { stdout } = await execFilep(cmd, args, {
      timeout: 5000,
      windowsHide: true
    })
    return String(stdout).trim()
  } catch {
    return null
  }
}

/**
 * 检查 Node 主版本是否 >= 20.11（设计稿要求）。
 * @returns {Promise<['ok' | 'warn', string]>}
 */
function checkNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  const required = 20.11
  const current = major + minor / 100
  if (current >= required) {
    return ['ok', `Node ${process.versions.node} ≥ ${required}`]
  }
  return ['warn', `Node ${process.versions.node} < ${required}（建议升级到 20.11+）`]
}

/**
 * 检查 git CLI 是否可用。
 * @returns {Promise<['ok' | 'warn', string]>}
 */
async function checkGit() {
  const out = await probe('git', ['--version'])
  if (out) return ['ok', out]
  return ['warn', 'git 不可用（部分场景如 MCP / 插件源安装会受影响）']
}

/**
 * 检查操作系统是否为官方支持的 darwin / win32 / linux 之一。
 * @returns {Promise<['ok' | 'warn', string]>}
 */
function checkPlatform() {
  const supported = ['darwin', 'win32', 'linux']
  if (supported.includes(platform())) {
    return ['ok', `平台 ${platform()}`]
  }
  return ['warn', `平台 ${platform()} 不在官方支持列表（darwin/win32/linux）`]
}

/**
 * 检查 CPU 架构：x64 / arm64 是主流；其他为 warn。
 * @returns {Promise<['ok' | 'warn', string]>}
 */
function checkArch() {
  if (arch() === 'x64' || arch() === 'arm64') {
    return ['ok', `架构 ${arch()}`]
  }
  return ['warn', `架构 ${arch()} 未经验证（可能影响 native 模块编译）`]
}

/**
 * 检查 Docker CLI 是否存在。**只探测，不安装**——沙盒功能依赖它，
 * 但缺失时不应卡住安装流程，让用户后续在 GUI 里点"启用沙盒"再走强引导。
 * @returns {Promise<['ok' | 'skip', string]>}
 */
async function checkDocker() {
  const out = await probe('docker', ['--version'])
  if (out) return ['ok', out]
  return ['skip', 'Docker CLI 未找到（沙盒功能需要，但本步骤不强装）']
}

/**
 * 把探测结果序列化为人类可读的一行，例如 `[ok  ] Node 20.11.0 ≥ 20.11`。
 * @param {[string, string]} entry
 * @returns {string}
 */
function fmt(entry) {
  const [tag, label] = entry
  return `[${tag.padEnd(4)}] ${label}`
}

/**
 * 主流程：探测 → 输出 → 写文件。
 * 整个函数被包在 try/catch 里，最终保证 process.exit(0)。
 */
async function main() {
  console.log('🦞 PiPiClaw bootstrap starting...')

  const checks = [
    ['nodeVersion', checkNodeVersion],
    ['git', checkGit],
    ['platform', checkPlatform],
    ['arch', checkArch],
    ['docker', checkDocker]
  ]

  const results = {}
  for (const [name, fn] of checks) {
    // eslint-disable-next-line no-await-in-loop
    const result = await fn()
    results[name] = { tag: result[0], label: result[1] }
    console.log(fmt(result))
  }

  // 写入 ~/.pipiclaw/.bootstrap-state.json
  const stateDir = join(homedir(), '.pipiclaw')
  const stateFile = join(stateDir, '.bootstrap-state.json')
  await mkdir(stateDir, { recursive: true })

  const state = {
    bootstrapAt: new Date().toISOString(),
    node: process.versions.node,
    platform: platform(),
    arch: arch(),
    checks: results
  }

  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8')

  console.log('✓ Bootstrap state written to ~/.pipiclaw/.bootstrap-state.json')
}

main().catch(err => {
  // 绝对不 throw：失败也只在控制台提示，绝不让 npm install 整体挂掉
  console.warn('[warn] bootstrap 检测异常（已忽略）：', err?.message ?? err)
  process.exit(0)
})
