# PiPiClaw 故障排查

> 按错误类别定位。先看 [FAQ](faq.md) 看是否是高频问题。

---

## 启动失败

### F1. 白屏 / 黑屏

**症状**: 启动后窗口纯白 / 纯黑,无 UI 元素。

**排查**:
1. 等待 10s(首次启动有 vite-plugin-electron 编译延迟)
2. 查看 `%APPDATA%\PiPiClaw\logs\main.log`(Windows) / `~/Library/Logs/PiPiClaw/main.log`(macOS) / `~/.config/PiPiClaw/logs/main.log`(Linux)
3. 搜关键词:`Error` / `failed` / `Renderer`

**常见根因**:
- **GPU 驱动崩溃**: 启动加 `--disable-gpu`
- **端口占用**: 主进程 7788 端口被占 → 改 `pipiclaw.gateway.port`
- **userData 损坏**: 删除 userData 重启(会丢配置)

**修复**:
```bash
# Windows: 清除 userData
rmdir /s /q "%APPDATA%\PiPiClaw"

# macOS:
rm -rf "~/Library/Application Support/PiPiClaw"

# Linux:
rm -rf ~/.config/PiPiClaw
```

### F2. 启动后立即退出

**症状**: 双击图标后闪一下就消失。

**排查**:
1. 命令行启动看错误:
   ```bash
   # Windows
   "C:\Program Files\PiPiClaw\PiPiClaw.exe" --enable-logging
   
   # macOS
   /Applications/PiPiClaw.app/Contents/MacOS/PiPiClaw --enable-logging
   
   # Linux
   ./PiPiClaw-2.1.0-x64.AppImage --enable-logging
   ```
2. 常见错误: `Node version mismatch` / `Electron sandbox failed`

### F3. 端口被占用

**症状**: 启动报 `EADDRINUSE :::7788` (gateway 端口)。

**修复**:
- **方法 A**: 关闭占用 7788 端口的进程
  ```bash
  # Windows
  netstat -ano | findstr :7788
  taskkill /PID <pid> /F
  
  # macOS / Linux
  lsof -i :7788
  kill -9 <pid>
  ```
- **方法 B**: 改 PiPiClaw 配置 → `userData/config.json`:
  ```json
  { "gateway": { "port": 7799 } }
  ```

---

## LLM API 错误

### F4. 401 Unauthorized

**症状**: 测试连接报 401。

**根因**:
- API Key 错误 / 过期
- Base URL 错(常见: OpenAI key 用在 Anthropic base URL)

**修复**:
1. 重新粘贴 API Key(注意首尾空格)
2. 检查 Base URL 与 provider 对应
3. 验证 Key 有效:
   ```bash
   # OpenAI
   curl https://api.openai.com/v1/models -H "Authorization: Bearer $KEY"
   
   # Anthropic
   curl https://api.anthropic.com/v1/messages -H "x-api-key: $KEY" ...
   ```

### F5. 403 Forbidden

**症状**: 测试连接报 403。

**根因**:
- Key 无权限(常见: free tier 不能用 GPT-4)
- Region 不支持(如某些 Anthropic 模型仅 US)
- 自定义 endpoint 配错(URL 拼错)

### F6. 429 Too Many Requests

**症状**: 频繁报 429,对话断流。

**根因**: Rate limit 触发。

**修复**:
- 切换到更便宜的模型(GLM-4-Flash / Haiku)
- 减少并发任务
- 等待 1-60s 重试(指数退避自动)

### F7. 5xx Server Error

**症状**: 502 / 503 / 504。

**修复**:
- 切换 provider(OpenAI 挂了就切 Anthropic)
- 等待几分钟后重试
- 检查 [OpenAI status](https://status.openai.com) / [Anthropic status](https://status.anthropic.com)

### F8. SSE 中断

**症状**: 流式响应卡在中间,不结束。

**根因**:
- 代理服务器切断长连接
- 网络不稳定

**修复**: 设置 → 模型管理 → 高级 → `sse.timeout` 调到 60s+。

---

## 沙箱错误

### F9. D2-Prime Docker 启动失败

**症状**: 任务跑 D2-Prime 模板报 Docker 错误。

**排查清单**:
1. `docker ps` 能正常输出
2. Docker Desktop 正在运行(非 Linux)
3. `pipiclaw/sandbox-base` 镜像存在:
   ```bash
   docker images | grep pipiclaw
   ```
4. 镜像太旧: `npm run sandbox:build-base` 重建
5. 看 `userData/sandbox/*.log`

### F10. WebContainer 启动失败

**症状**: D2Prime demo 报 "WebContainer not available"。

**根因**:
- 浏览器 SharedArrayBuffer 未启用(需要 cross-origin isolation)
- WebContainer service 暂时不可达

**修复**:
- Chrome 95+ / Firefox 95+ 默认支持
- 检查是否有 reverse proxy 设置 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`
- 重启应用重试

### F11. Jupyter 启动失败

**症状**: Jupyter view 报错 "Python not found"。

**修复**:
1. 装 Python 3.8+: https://www.python.org/downloads/
2. 装 Jupyter: `pip install jupyter notebook ipykernel`
3. 重启 PiPiClaw

### F12. 沙箱 OOM

**症状**: D2-Prime 容器被 kill,日志 `OOMKilled`。

**根因**: 内存限制(默认 2 GB)不够。

**修复**: 设置 → 沙箱 → 提高 `memoryLimit`(如 4 GB)。

---

## IM 接入错误

### F13. OAuth 失败

**症状**: 飞书 / Lark 授权后回调报错。

**排查**:
1. **回调 URL**: 第三方平台 OAuth 配置里填 `pipiclaw://oauth/callback`
2. **App ID / Secret**: 复制粘贴确认无空格
3. **权限 scope**: 申请了必要的权限(`im:message`, `im:message:send` 等)

### F14. WebSocket 断

**症状**: IM channel 状态从 `connected` → `disconnected` 后无法恢复。

**排查**:
- token 过期(飞书 2h, 钉钉不定)
- 网络 NAT 切换(wifi → 4G)

**修复**: PiPiClaw 自动重连(指数退避),若仍断:
1. 关掉 channel
2. 重新启用
3. 重新 OAuth

### F15. 消息路由不到

**症状**: 群里发消息但 PiPiClaw 不响应。

**排查**:
1. 检查路由规则: 设置 → IM 账号 → 路由
2. 检查发送人是否在白名单
3. 关键字匹配: 默认精确匹配,不含模糊

---

## 更新失败

### F16. latest.yml 404

**症状**: 检查更新报 `404 Not Found` on `latest.yml`。

**根因**: GitHub Release 未上传 `latest.yml`(electron-builder 自动生成,需 CI 走 publish 流程)。

**修复**:
- **本地开发**: 跳过更新检查: `PIPICLAW_SKIP_UPDATE_CHECK=1`
- **生产**: 重新发布 Release,确认 CI 配置 `GH_TOKEN` + `npm run build` 跑完整 publish

### F17. update download 403

**症状**: 下载更新包报 403。

**根因**: GitHub asset 权限(Release 是 draft 或 private)。

**修复**: 在 GitHub Release 页面把 Release 状态改为 **Public**。

### F18. quitAndInstall 不生效

**症状**: 点 "立即重启" 后未安装。

**排查**: 看 `userData/logs/auto-update.log`。

---

## 日志位置

- **主进程日志**: `<userData>/logs/main.log`
- **渲染端日志**: DevTools Console (Ctrl+Shift+I / Cmd+Opt+I)
- **Gateway 日志**: `<userData>/logs/gateway.log`
- **Sandbox 日志**: `<userData>/sandbox/*.log`
- **任务执行日志**: `<userData>/task-logs/*.jsonl`

---

## 仍然没解决?

1. 导出全部日志: 设置 → 高级 → 导出诊断包
2. GitHub Issue: 带日志 + 复现步骤 + 环境信息
3. 看 Phase 4 retro 的 [smoke 测试结果](../superpowers/retros/2026-07-22-phase4-cross-platform/retro.md) 确认是不是已知问题