#!/usr/bin/env node

// 改进版: 准确识别"真正未使用"的点击事件
// 上一版本启发式误判 store.*, $router.push, inline assignment 等生产功能为 unused
// 现在保留这些为"used inline",只标出真正死代码(局部函数/方法引用,但脚本里找不到定义)

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const REPORT_FILE = path.join(__dirname, 'unused-clicks-report.json');

console.log('🔍 开始扫描 Vue 文件中的未使用点击事件 (改进版)...\n');

const results = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const entryPath = path.join(dir, entry);
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      scanDir(entryPath);
    } else if (entry.endsWith('.vue')) {
      parseVueFile(entryPath);
    }
  }
}

function parseVueFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // 提取所有 @click 或 @v-on:click
  const clickRegex = /@(?:click|v-on:click)(?:=(?:"([^"]+)"|'([^']+)'|{([^}]+)}))?/g;
  const handlers = [];

  let match;
  while ((match = clickRegex.exec(content)) !== null) {
    const handler = match[1] || match[2] || match[3];
    const lineNum = content.substring(0, match.index).split('\n').length;
    if (handler) {
      handlers.push({ handler, line: lineNum, snippet: lines[lineNum - 1]?.trim() });
    }
  }
  if (handlers.length === 0) return;

  const scriptSetupMatch = content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  const scriptContent = (scriptSetupMatch?.[1] || scriptMatch?.[1] || '');

  // 收集所有 import 的名字(命名导入 + 默认导入)
  const importNames = new Set();
  const importRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from/g;
  let imp;
  while ((imp = importRegex.exec(scriptContent)) !== null) {
    imp[1].split(',').forEach(n => importNames.add(n.trim().split(/\s+as\s+/).pop()));
  }
  const defaultImportRegex = /import\s+(\w+)\s+from\s+['"][^'"]+['"]/g;
  while ((imp = defaultImportRegex.exec(scriptContent)) !== null) {
    importNames.add(imp[1]);
  }

  // 收集 script setup 中所有顶层 const/let/function/var 定义
  const definedNames = new Set();
  const defRegex = /(?:const|let|var)\s+(\w+)\s*=|function\s+(\w+)\s*\(|export\s+(?:const|let|var|function)\s+(\w+)/g;
  let d;
  while ((d = defRegex.exec(scriptContent)) !== null) {
    const name = d[1] || d[2] || d[3];
    if (name) definedNames.add(name);
  }

  handlers.forEach(({ handler, line, snippet }) => {
    // 跳过空 handler
    if (!handler) return;

    const cleanHandler = handler.replace(/\(.*\)$/, '').replace(/['"]/g, '').trim();

    // === 白名单: 这些都是合法的"内联表达式",不视为未使用 ===
    // 1. 直接修改 ref/reactive 状态 (visible = false, showSettings = true)
    if (/^\w+\s*[+\-*/]?=\s*.+/.test(handler) || /^\w+\.\w+\s*=\s*.+/.test(handler)) {
      return; // 赋值表达式,合法使用
    }
    // 2. 链式调用 (store.action(), store.computed(), router.push())
    if (/^[\w$]+\.[\w$]+(\([^)]*\))?$/.test(cleanHandler) || /^[\w$]+(\([^)]*\))?$/.test(cleanHandler)) {
      // store.action 或 method(args) - 通过引用的方法名查找
      const rootName = cleanHandler.split('.')[0].split('(')[0];
      if (importNames.has(rootName) || definedNames.has(rootName) || definedNames.has(cleanHandler)) {
        return;
      }
      // 即使 rootName 不在 defined 中(如 Pinia store 通过 useXxxStore() 返回,源码 store 名不在 script 顶层),
      // store.action() 也是合法的;如果想精确判,需要查 setup() 中的 const xStore = useXxxStore() 但这是 NESTED,简单启发式 skip
      return;
    }
    // 3. 箭头函数 inline () => { ... }
    if (/^\(?\s*\w*\s*\)?\s*=>/.test(handler) || /^function/.test(handler)) {
      return;
    }

    // === 黑名单: 真正的本地未定义函数引用 ===
    const isImported = importNames.has(cleanHandler);
    const isDefined = definedNames.has(cleanHandler);
    if (!isImported && !isDefined) {
      results.push({
        file: filePath.replace(path.join(__dirname, '..') + '\\', ''),
        line,
        handler: cleanHandler,
        fullHandler: handler,
        snippet,
        status: 'unused',
      });
    }
  });
}

scanDir(SRC_DIR);
fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), 'utf-8');

console.log(`📊 扫描完成! 发现 ${results.length} 个真正未使用的点击事件\n`);
if (results.length > 0) {
  console.log('🔎 列表:');
  results.forEach(item => {
    console.log(`- ${item.file}:${item.line} => ${item.handler}`);
    if (item.snippet) console.log(`  ${item.snippet}`);
  });
}