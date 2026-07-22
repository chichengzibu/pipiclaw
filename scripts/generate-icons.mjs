#!/usr/bin/env node
/**
 * PiPiClaw 图标生成脚本
 *
 * 从 SVG 源生成 3 平台图标:
 * - resources/icon.png (Linux, 512x512)
 * - resources/icon.ico (Windows, multi-size)
 * - resources/icon.icns (macOS, multi-size)
 *
 * 依赖: png2icons (PNG → ICO/ICNS)
 *      sharp (SVG → PNG,可选,fallback to hand-coded PNG)
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RESOURCES = join(ROOT, 'resources')
const require = createRequire(import.meta.url)

if (!existsSync(RESOURCES)) mkdirSync(RESOURCES, { recursive: true })

// 1) SVG 源 — PiPiClaw logo (claw 抽象图)
const SVG_512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="50%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#c026d3"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <!-- 三个 claw 点 -->
  <g fill="white" stroke="white" stroke-width="8" stroke-linejoin="round">
    <path d="M 168 168 L 220 220 L 196 244 L 144 192 Z" opacity="0.95"/>
    <path d="M 256 144 L 308 196 L 284 220 L 232 168 Z" opacity="0.85"/>
    <path d="M 312 232 L 364 284 L 340 308 L 288 256 Z" opacity="0.75"/>
    <!-- 中心核 -->
    <circle cx="256" cy="256" r="40" fill="white" opacity="1"/>
  </g>
  <!-- 文字 -->
  <text x="256" y="400" font-family="Arial,sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="-2">PiPiClaw</text>
</svg>`

writeFileSync(join(RESOURCES, 'icon-source.svg'), SVG_512)

// 2) 手写一个简单的 256x256 PNG(纯色 + 简单图形) — 不依赖 sharp
// 用 Node.js 内置 zlib + 自定义 PNG 编码
import zlib from 'node:zlib'

function crc32(buf) {
  const crc = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    crc[n] = c
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crc[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function makeSolidPng(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  // IDAT
  const rowBytes = size * 3 + 1
  const raw = Buffer.alloc(rowBytes * size)
  for (let y = 0; y < size; y++) {
    const offset = y * rowBytes
    raw[offset] = 0 // filter type none
    for (let x = 0; x < size; x++) {
      const p = offset + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// 生成 4 个尺寸的纯色占位 PNG
// 用 PiPiClaw 主题色 #6366f1 (indigo-500)
const sizes = [16, 32, 48, 64, 128, 256, 512]
for (const sz of sizes) {
  const png = makeSolidPng(sz, 0x63, 0x66, 0xf1)
  writeFileSync(join(RESOURCES, `icon-${sz}.png`), png)
}

// icon.png 512x512 主图
writeFileSync(join(RESOURCES, 'icon.png'), makeSolidPng(512, 0x63, 0x66, 0xf1))

// 3) 尝试用 png2icons 生成 .ico / .icns
try {
  const png2icons = require('png2icons')
  const pngBuf = require('node:fs').readFileSync(join(RESOURCES, 'icon.png'))

  const ico = png2icons.createICO(pngBuf, png2icons.BICUBIC, 0, true)
  if (ico) writeFileSync(join(RESOURCES, 'icon.ico'), ico)

  const icns = png2icons.createICNS(pngBuf, png2icons.BICUBIC, 0, true)
  if (icns) writeFileSync(join(RESOURCES, 'icon.icns'), icns)

  console.log('✅ Icons generated via png2icons:')
  console.log(`   - icon.png     (${pngBuf.length} bytes, 512x512)`)
  console.log(`   - icon.ico     (${ico?.length ?? 0} bytes)`)
  console.log(`   - icon.icns    (${icns?.length ?? 0} bytes)`)
} catch (e) {
  console.warn('⚠️ png2icons not available, falling back to .ico generation')
  console.warn(`   Reason: ${e.message}`)

  // Fallback: 自己写一个简单的 .ico(只含一个 16x16 PNG image 块)
  const png16 = require('node:fs').readFileSync(join(RESOURCES, 'icon-16.png'))
  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0) // reserved
  icoHeader.writeUInt16LE(1, 2) // type ICO
  icoHeader.writeUInt16LE(1, 4) // 1 image

  const icoEntry = Buffer.alloc(16)
  icoEntry[0] = 16 // width
  icoEntry[1] = 16 // height
  icoEntry[2] = 0 // palette
  icoEntry[3] = 0 // reserved
  icoEntry.writeUInt16LE(1, 4) // color planes
  icoEntry.writeUInt16LE(32, 6) // bpp
  icoEntry.writeUInt32LE(png16.length, 8) // size
  icoEntry.writeUInt32LE(22, 12) // offset
  const ico = Buffer.concat([icoHeader, icoEntry, png16])
  writeFileSync(join(RESOURCES, 'icon.ico'), ico)

  // .icns 不易手写,先放一个空 placeholder
  writeFileSync(join(RESOURCES, 'icon.icns'), '')
  console.log('✅ Fallback icons written (icns empty placeholder)')
}

console.log('\n📦 资源位置:', RESOURCES)
console.log('⚠️  这是占位图标(纯色),Phase 4 Task 2 完成后用正式 logo 替换')