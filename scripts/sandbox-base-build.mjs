#!/usr/bin/env node
/**
 * PiPiClaw sandbox base image build 脚本
 * 用法: pnpm sandbox:build-base  或  node scripts/sandbox-base-build.mjs
 *
 * W9 阶段:脚本只打印 docker build 命令,不真跑(避免 W9 阶段没有 docker 的环境阻塞)
 * 后续可加 --run 开关真触发 build
 */
import { execSync } from 'node:child_process'

const IMAGE_NAME = 'pipiclaw/sandbox-base'
const IMAGE_TAG = 'latest'
const DOCKERFILE = 'sandbox/base/Dockerfile'

console.log(`[sandbox-base-build]`)
console.log(`  IMAGE  : ${IMAGE_NAME}:${IMAGE_TAG}`)
console.log(`  CONTEXT: sandbox/base/`)
console.log(`  FILE   : ${DOCKERFILE}`)
console.log()

const args = ['build', '-t', `${IMAGE_NAME}:${IMAGE_TAG}`, '-f', DOCKERFILE, 'sandbox/base/']
console.log(`[cmd] docker ${args.join(' ')}`)
console.log()

const runNow = process.argv.includes('--run')
if (runNow) {
  console.log('[run-now] 真执行 docker build...')
  try {
    execSync(`docker ${args.join(' ')}`, { stdio: 'inherit' })
    console.log('[ok] 镜像构建成功')
  } catch (e) {
    console.error(`[fail] ${e.message}`)
    process.exit(1)
  }
} else {
  console.log('[info] 当前为 dry-run 模式(只打印命令,未真执行)')
  console.log('[info] 如要真跑 docker build,加 --run 标志:')
  console.log('       pnpm sandbox:build-base -- --run')
}