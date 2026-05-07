#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const REPORT_FILE = path.join(__dirname, '../unused-buttons-report.json');

console.log('🚀 开始扫描无效按钮...');
console.log(`📁 扫描目录: ${SRC_DIR}`);

const results = {
  scanTime: new Date().toISOString(),
  totalFiles: 0,
  vueFiles: 0,
  issues: []
};

// 递归遍历目录
function walkDir(dir) {
  const files = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      files.push(...walkDir(filePath));
    } else {
      files.push(filePath);
    }
  });
  return files;
}

// 扫描 Vue 文件
const allFiles = walkDir(SRC_DIR);
const vueFiles = allFiles.filter(f => f.endsWith('.vue'));

results.totalFiles = allFiles.length;
results.vueFiles = vueFiles.length;

console.log(`📄 共找到 ${vueFiles.length} 个 Vue 文件`);

vueFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(SRC_DIR, file);

  const issues = [];

  // 1. 检测 @click 和 v-on:click 事件绑定
  const clickMatches = content.matchAll(/(?:@|v-on:)click\s*=\s*(?:['"]([^'"]+)['"]|{([^}]+)})/g);
  for (const match of clickMatches) {
    const fullMatch = match[0];
    const handlerName = match[1] || match[2];

    if (!handlerName) continue;

    // 简单分析：handler 是否只是占位符
    const handlerClean = handlerName.replace(/\(.*\)$/, '');

    // 检查常见的无效模式
    if (/^(todo|placeholder|待开发|notImplemented|notImplementedYet)$/i.test(handlerClean)) {
      issues.push({
        type: 'placeholder-handler',
        location: 'template',
        handler: handlerName,
        snippet: fullMatch.substring(0, 100)
      });
    }

    // 检查 script 部分是否有这个方法
    if (handlerClean) {
      const methodRegex = new RegExp(`${handlerClean}\\s*\\([^)]*\\)\\s*[:{]`);
      if (!methodRegex.test(content)) {
        issues.push({
          type: 'missing-handler',
          location: 'script',
          handler: handlerName,
          snippet: fullMatch.substring(0, 100)
        });
      }
    }
  }

  // 2. 检测注释标注的待开发功能
  const todoMatches = content.matchAll(/(?:<!--\s*)?(?:TODO|FIXME|待开发|未完成|未实现)(.*?)(?:-->|$)/g);
  for (const match of todoMatches) {
    issues.push({
      type: 'todo-comment',
      comment: match[1]?.trim(),
      snippet: match[0].substring(0, 100)
    });
  }

  if (issues.length > 0) {
    results.issues.push({
      file: relativePath,
      issues
    });
  }
});

// 保存报告
fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));

console.log('\n📊 扫描完成！');
console.log(`✅ 总文件数: ${results.totalFiles}`);
console.log(`✅ Vue 文件: ${results.vueFiles}`);
console.log(`❌ 发现问题: ${results.issues.length} 个文件有问题`);
console.log(`📝 报告已保存至: ${REPORT_FILE}`);

if (results.issues.length > 0) {
  console.log('\n🔍 问题汇总:');
  results.issues.forEach(fileIssue => {
    console.log(`\n📄 ${fileIssue.file}:`);
    fileIssue.issues.forEach(issue => {
      console.log(`   - [${issue.type}] ${issue.handler || issue.comment || issue.snippet}`);
    });
  });
}

console.log('\n💡 建议: 对于标记为待开发的按钮，您可以添加 v-if="false" 隐藏');
