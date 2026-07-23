# PiPiClaw Release Checklist

> **强制**: v3.0.0 GA 时漏掉了 `npm run build` 这一步,导致主导航 broken 还能 release。
> 从 v3.0.1 起,**未走完本 checklist 全部步骤,不允许打 tag**。

## 适用版本

任何 `npm version [major|minor|patch]` 之前必须走完本 checklist。

## Checklist(7 步全部必过)

### 1. Lint 干净

```bash
npm run lint
```

**通过标准**: 0 errors, 0 warnings  
**失败处理**: ESLint 自带 `--fix`,部分规则可自动修。剩余手改。

### 2. TypeScript 类型干净

```bash
npx vue-tsc --noEmit
npx tsc --noEmit -p tsconfig.node.json
```

**通过标准**: 两个都 exit 0,0 errors  
**失败处理**: 不能用 `// @ts-ignore` 绕过,要真修。

### 3. 单元测试全过

```bash
npm test
```

**通过标准**: 所有 test files passed,无 skipped(active 测试)  
**当前基线**: 40 files / 486 tests

### 4. 冒烟测试全过

```bash
npm run smoke
```

**通过标准**: 22/22 passed(构建产物 + IPC surface + 配置完整性)

### 5. E2E 真 Electron 测试全过(关键)

```bash
npm run build   # 必须先 build
E2E_ELECTRON=1 npx playwright test \
  tests/e2e/chat-agent.spec.ts \
  tests/e2e/settings-p7.spec.ts \
  tests/e2e/a5-computer-use.spec.ts \
  tests/e2e/ui-smoke.spec.ts \
  --reporter=line
```

**通过标准**: 全部 passed,0 failed(本机有 Electron 桌面环境)  
**跳过**: `d2prime-*.spec.ts` / `d3-feishu.spec.ts` / `insight-trace.spec.ts` 是 placeholder,在 CI 上由 spec 自带的 `test.skip` 处理  
**CI 行为**: GitHub Actions 上 ubuntu-latest runner 跑(已加 hard-fail,见 `.github/workflows/ci.yml`)

### 6. **全量 Build + 产物自检**(堵 v3.0.0 的坑)

```bash
npm run build
```

**通过标准**:
- build 退出码 0
- 产物存在:
  - `dist/index.html` 包含 `unsafe-eval` CSP ← P0-T0.3 守卫
  - `dist/assets/index-*.js` 包含 `ChatDotRound` 等关键图标组件名
  - `release/PiPiClaw-{version}-Setup.exe` 存在且 ≤ 100MB
- 在干净 Win10 VM 上装机,跑 5 分钟,无:
  - 启动崩溃
  - 主导航不可见(看 SideNav 14 项 + 图标)
  - Chat / Settings / Models / Skills 4 个核心页面能正常打开
  - 状态栏显示版本号 + 运行端口

**失败处理**:
- SideNav 不可见 → 检查 `src/main.ts` 是否注册了 `@element-plus/icons-vue`
- 启动崩溃 → 跑 `release/win-unpacked/PiPiClaw.exe` 看 stderr
- 页面空白 → 检查 `index.html` CSP

### 7. CHANGELOG 同步

- `CHANGELOG.md` 顶部加新版本条目
- `docs/superpowers/retros/` 写 retro(每个 phase 完成时)
- 如果有破坏性变更,`docs/site/user-guide/breaking-changes.md` 加说明

## Tag & Push

```bash
# 1. 确认所有改动已 commit
git status  # 应该干净

# 2. 打 tag
git tag v{version}

# 3. 推送 tag + commit
git push origin master
git push origin v{version}

# 4. 触发 release workflow(自动 build + 上传 GitHub Releases)
# 见 .github/workflows/release.yml(Phase 5 P5-T5.2 待建)
```

## Rollback 流程

如果 release 后发现严重 bug:

```bash
# 1. 从 GitHub Releases 撤回该 release
#    (Settings -> [release] -> Delete this release)

# 2. 删除 tag
git tag -d v{version}
git push origin :refs/tags/v{version}

# 3. 改版本号 patch +1,重新走 checklist
npm version patch
```

## 自动化(目标)

Phase 5 计划:
- `.github/workflows/release.yml` 在 `git push --tags` 时自动跑本 checklist 全部 7 步
- 任一失败,自动在 PR 留评论说明
- 全过后自动发 GitHub Release

## 历史问题登记

| 版本 | 漏检项 | 后果 |
|---|---|---|
| v3.0.0 | `npm run build` 没跑 | 主导航 broken 还叫 GA |
| v2.0.1 | 单元测试覆盖率 0% | 大量 bug 漏到 release |
| v1.x | lint 规则过松 | 技术债堆积到 v2 重构 |

## 维护

每次 release 后:
- 任何新发现的"应该被 checklist 抓住"问题 → 补进对应步骤
- 任何步骤被证明没用 → 删掉
- 保持本文件 ≤ 100 行
