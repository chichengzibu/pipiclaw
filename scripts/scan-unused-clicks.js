#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const REPORT_FILE = path.join(__dirname, 'unused-clicks-report.json');

console.log('🔍 开始扫描Vue文件中的未使用点击事件...\n');

const results = [];

// 递归扫描目录
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
  let match;
  const handlers = [];
  
  while ((match = clickRegex.exec(content)) !== null) {
    const handler = match[1] || match[2] || match[3];
    const lineNum = content.substring(0, match.index).split('\n').length;
    if (handler) {
      handlers.push({
        handler,
        line: lineNum,
        snippet: lines[lineNum - 1]?.trim()
      });
    }
  }
  
  if (handlers.length === 0) return;
  
  // 检查 script setup 中是否定义了这些函数
  const scriptSetupMatch = content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  
  const scriptContent = (scriptSetupMatch?.[1] || scriptMatch?.[1] || '');
  const importMatch = scriptContent.match(/import\s+(?:type\s+)?\{([^}]+)\}.*from/);
  const exportedFuncs = [];
  if (importMatch) {
    const imports = importMatch[1].split(',');
    imports.forEach(imp => exportedFuncs.push(imp.trim()));
  }
  
  handlers.forEach(({handler, line, snippet}) => {
    const cleanHandler = handler.replace(/\(.*\)$/, '').replace(/['"]/g, '');
    const isFuncDefined = 
      scriptContent.includes(`const ${cleanHandler} =`) || 
      scriptContent.includes(`function ${cleanHandler}(`) || 
      scriptContent.includes(`let ${cleanHandler} =`) ||
      scriptContent.includes(`var ${cleanHandler} =`) || 
      scriptContent.includes(`export const ${cleanHandler} =`) || 
      scriptContent.includes(`export function ${cleanHandler}`);
    const isImported = exportedFuncs.includes(cleanHandler);
    
    // 排除一些内置常见值
    if (['true', 'false', '() => true', '() => false'].includes(cleanHandler)) {
      return;
    }
    
    if (!isFuncDefined && !isImported) {
      results.push({
        file: filePath.replace(path.join(__dirname, '..') + '\\', ''),
        line,
        handler: cleanHandler,
        fullHandler: handler,
        snippet,
        status: 'unused'
      });
    }
  });
}

// 执行扫描
scanDir(SRC_DIR);

fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), 'utf-8');

console.log(`📊 扫描完成！共发现 ${results.length} 个可能未使用的点击事件`);
console.log(`📁 报告已保存到: ${REPORT_FILE}`);

if (results.length > 0) {
  console.log('\n🔎 未使用的点击事件:');
  results.forEach(item => {
    console.log(`- ${item.file}:${item.line} => ${item.handler}`);
    if (item.snippet) {
      console.log(`  ${item.snippet}`);
    }
  });
}
