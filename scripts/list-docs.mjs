#!/usr/bin/env node
/**
 * PiPiClaw docs/site metadata lister
 *
 * Walks docs/site/, prints a markdown table of all .md files with size and
 * first heading.  No external deps; runs in < 100 ms.
 *
 * Usage:
 *   node scripts/list-docs.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DOCS_ROOT = join(ROOT, 'docs', 'site')

const HEADING_RE = /^#\s+(.+)$/m

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
    } else if (entry.endsWith('.md')) {
      const content = readFileSync(full, 'utf-8')
      const headingMatch = content.match(HEADING_RE)
      out.push({
        path: relative(DOCS_ROOT, full).replace(/\\/g, '/'),
        size: content.length,
        heading: headingMatch ? headingMatch[1].trim() : '(no h1)',
      })
    }
  }
  return out
}

const files = walk(DOCS_ROOT).sort((a, b) => a.path.localeCompare(b.path))

console.log(`# PiPiClaw docs/site inventory (${files.length} files)`)
console.log()
console.log('| Path | Size (chars) | Title |')
console.log('| --- | ---: | --- |')
for (const f of files) {
  console.log(`| ${f.path} | ${f.size} | ${f.heading} |`)
}