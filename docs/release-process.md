# PiPiClaw Release Process

> v4.3.1+ 真实发布流程 — 从代码到 GitHub Release

## 一键 Release(用户)

```powershell
# 1. 配 GitHub PAT(只在第一次)
#    https://github.com/settings/tokens
#    选 Fine-grained token,勾选 contents: write
#    配到 git credential helper 或 .gitconfig:
#    git config --global credential.helper store
#    (或用 gh auth login)

# 2. 推送 229 个本地 commit
git push origin master

# 3. 打 tag 触发 GitHub Actions(可选)或手动上传
git tag v4.3.1
git push origin v4.3.1

# 4. 创建 GitHub Release
#    https://github.com/chichengzibu/pipiclaw/releases/new
#    - Tag: v4.3.1
#    - Title: PiPiClaw v4.3.1 — Ship-Ready 真用户测试套件
#    - Description: 见下方模板
#    - 上传文件(从 release/):
#      * PiPiClaw-4.3.1-Setup.exe
#      * latest.yml
#      * PiPiClaw-4.3.1-Setup.exe.blockmap

# 5. 验证 auto-update
#    已安装用户启动 app → 5s 后自动 checkForUpdates
#    检测到新版 → 顶部 UpdateBanner 提示
```

## Release Description 模板

```markdown
## v4.3.1 — Ship-Ready 真用户测试套件

### 🆕 修复的 ship 缺口
- 全局 Ctrl+K / Cmd+K 命令面板快捷键(AppLayout.vue)
- Esc 关闭命令面板

### 📊 测试覆盖
- 101 e2e + 23 dev-only skipped
- 869 unit tests
- 22 smoke tests
- production build verified

### 🔧 真链路验证
- Ollama 11434 + qwen3.5:9b / qwen3:14b / gpt-oss:20b
- thinking mode fallback (qwen3/qwen3.5/DeepSeek-R1/gpt-oss)
- ECONNREFUSED / timeout 友好 UX
- 黑洞 IP 不会卡死 send 按钮

### 🐛 真问题修复
1. sidebar "新建对话" Plus 按钮加 title + 文字
2. LlmClient 透传 tool_calls
3. thinking mode fallback (content ?? reasoning)
4. max_tokens 2048 → 4096
5. dev-only 路由守卫
6. Element Plus `el-button` 不传 type 元素 → 用 class
7. test selector 全部用稳定 class + :visible 伪类

### 📦 完整下载
- **Windows**: PiPiClaw-4.3.1-Setup.exe (NSIS installer)
- **macOS** (待构建): .dmg
- **Linux** (待构建): .AppImage
```

## Auto-Update 流程(已配)

```
[app 启动]
  ↓
[5s 后 main.ts 调 AutoUpdater.initialize()]
  ↓
[AutoUpdater.startCheck() → checkForUpdates()]
  ↓
[请求 https://api.github.com/repos/chichengzibu/pipiclaw/releases/latest]
  ↓
[本地 version vs remote version]
  ↓
[若新版: window.webContents.send('autoUpdater:onUpdateAvailable', { version, releaseNotes })]
  ↓
[UpdateBanner.vue 监听 → 顶部蓝色 info banner]
  ↓
[用户点"下载" → IPC autoUpdater:download → downloadUpdate()]
  ↓
[下载完成: send('autoUpdater:onUpdateDownloaded', { version })]
  ↓
[UpdateBanner 切到 success → "立即重启" / "稍后"]
  ↓
[选立即重启 → autoUpdater.quitAndInstall() → app 重启到新版]
```

## 检查点

| 检查 | 命令 |
|------|------|
| 单元测试 | `npx vitest run` |
| 类型检查 | `npx vue-tsc --noEmit` |
| Lint | `npx eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx` |
| 烟囱测试 | `npm run smoke` |
| E2E (本地) | `E2E_ELECTRON=1 npx playwright test` |
| Production build | `npm run build` |

## 配置

`electron-builder.json5`:
```json5
"publish": {
  "provider": "github",
  "repo": "pipiclaw",
  "owner": "chichengzibu",
  "releaseType": "release",
  "channel": "latest"
}
```

`AutoUpdater.ts`:
- 5s 启动 check
- `autoDownload: false`(用户主动下载)
- `autoInstallOnAppQuit: true`(退出时自动装)
- `PIPICLAW_SKIP_UPDATE_CHECK=1` 可关闭 dev 环境的检查

## 已知 ship 缺口(已记录)

- Element Plus filterable select UI 实时切换在 Playwright 下 flaky(由 unit tests 覆盖)
- v4.1 → v4.2 theme schema 遗留(顶层 theme vs app.theme,功能不受影响)
- 真 Ctrl+K 全局键监听 ✅(v4.3.1 已修,`706e7e7`)

## 阻塞任务

| ID | 任务 | 状态 |
|----|------|------|
| T0.1 | 配 GitHub PAT + push 229 commit | ✅ 配好 + 已 push 230 commit |
| T0.2 | 创建 v4.3.1 GitHub Release | ✅ published,3 assets 上传 |
| T0.3 | 验证 auto-update 端到端 | ⏳ 等用户在已装 v4.3.0 的机器上启动 |

## 常见坑:Windows 上 curl.exe 创建/修改 GitHub Release 的 UTF-8 编码问题

**症状**:Release body 里所有中文显示成 `?`(`Ship-Ready ??????` / `? ship ??` / `?? Ctrl+K`)。

**原因**:Windows PowerShell 默认代码页是 CP936/GBK(中文系统),用
`curl -d $body` 传 JSON 时,inline body 会被 PowerShell 编码成当前代码页字节
再发出去,GitHub API 收到非 UTF-8 字节 → 解码失败 → 全部替换成 `?`。

**正解**:把 body 写到 UTF-8 文件(无 BOM),用 `--data-binary @file` 上传:

```powershell
# 1. 把 release body 写到 UTF-8 文件(用 Python 而非 Out-File 避免 BOM)
python -c "
import json
with open('release-body.md', 'r', encoding='utf-8') as f:
    body = f.read()
payload = {'body': body}
with open('release-patch.json', 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
"

# 2. PATCH release(curl.exe 原生支持 UTF-8 文件)
$TOKEN = "github_pat_..."
curl.exe -s -X PATCH `
  -H "Authorization: Bearer $TOKEN" `
  -H "Accept: application/vnd.github+json" `
  -H "X-GitHub-Api-Version: 2022-11-28" `
  -H "Content-Type: application/json" `
  --data-binary "@release-patch.json" `
  "https://api.github.com/repos/{owner}/{repo}/releases/{id}"
```

**避坑要点**:
- 永远不要 `-d "中文内容"`(命令体内联,会被 CP936 污染)
- `Out-File -Encoding utf8` 会写 BOM,某些 API 不友好,优先用 Python `json.dump`
- PATCH 前用 `[System.IO.File]::ReadAllBytes` 看前 4 字节确认无 BOM (`EF BB BF`)
- 创建 release 也用同样模式(把整个 JSON payload 写到文件再 POST)
