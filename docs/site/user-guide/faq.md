# PiPiClaw 常见问题 FAQ

> 15+ 高频问题,按主题分组。找不到答案?先看 [故障排查](troubleshooting.md)。

---

## 安装与启动

**Q1: 安装包在哪下载?**
A: 从 [Releases](https://github.com/chichengzibu/pipiclaw/releases) 页面下载对应平台安装包。当前最新稳定版 v2.1.0。

**Q2: 安装后启动白屏?**
A: 99% 是 Electron renderer 进程加载失败:
1. 删除 `userData` 目录(路径见 Q7)
2. 重启应用
3. 若仍白屏 → 看 [故障排查 → 启动失败](troubleshooting.md#启动失败)

**Q3: macOS 提示"无法打开,因为它来自身份不明的开发者"?**
A: 当前未签名,需手动打开 Gatekeeper。两种方式:
- **临时**:右键 → 打开方式 → 打开
- **永久**: 系统设置 → 隐私与安全性 → 仍要打开

正式签名版见 future release;Apple Developer 账号申请中。

**Q4: Linux AppImage 无法运行?**
A: 99% 是权限问题:
```bash
chmod +x PiPiClaw-2.1.0-x64.AppImage
./PiPiClaw-2.1.0-x64.AppImage
```
若提示 FUSE 缺失:
```bash
sudo apt install libfuse2   # Ubuntu 22.04+
```

---

## 数据与隐私

**Q5: API Key 存在哪里?是否安全?**
A: `safeStorage` 加密存储在 `userData/llm-config.json.enc` 文件中,使用 OS keychain:
- Windows: DPAPI (Data Protection API)
- macOS: Keychain
- Linux: libsecret (GNOME Keyring / KWallet)

明文永不落盘。详见 [LlmConfigStore 实现](../../electron/llm/LlmConfigStore.ts)。

**Q6: 数据存在哪里?**
A:
- Windows: `%APPDATA%\PiPiClaw\`(即 `C:\Users\<you>\AppData\Roaming\PiPiClaw\`)
- macOS: `~/Library/Application Support/PiPiClaw/`
- Linux: `~/.config/PiPiClaw/`

包含:配置 / 对话历史 / 任务日志 / 技能 / 缓存。

**Q7: 卸载会删数据吗?**
A: 默认**保留**。Windows 安装器可取消勾选"保留用户数据";macOS 拖到废纸篓不会自动删 userData,需手动 `~/Library/Application Support/PiPiClaw`。

**Q8: 如何备份配置?**
A: 复制整个 `userData` 目录即可。还原 = 把备份覆盖到原路径即可。所有 LLM Key / IM 凭证都会随加密文件一起保留(只要 OS keychain 凭证没换)。

---

## 模型与对话

**Q9: 支持哪些 LLM?**
A:
- **Anthropic** Claude 3.5 / 3.7 / Sonnet / Haiku / Opus 全系列
- **OpenAI** GPT-4 / GPT-4o / GPT-4-turbo / GPT-3.5
- **智谱 GLM** GLM-4 / GLM-4-Flash(国产友好)
- **Ollama** 本地模型(llama3 / qwen / mistral 等)
- **自定义** 任何 OpenAI-compatible endpoint(DeepSeek / Moonshot / 硅基流动 / 任意 vLLM / Ollama remote)

**Q10: 流式响应卡顿?**
A: 4 个常见原因:
1. **网络抖动**: 切到本地 Ollama 或更近的 endpoint
2. **模型太大**: 切换到更小的模型(如 Haiku / GLM-4-Flash)
3. **Provider SSE 超时**: 设置 → 模型管理 → 高级 → `sse.timeout` 调大
4. **本机内存不足**: 关闭其他应用,Chrome/Firefox 标签页都吃内存

**Q11: 怎么切换界面语言?**
A: 当前 v2.1.0 仍是中文为主,英文版留 Phase 6 GA。临时切换可改浏览器 zoom 或 OS locale。开发者改源码见 [i18n 接入计划](../superpowers/plans/2026-07-21-phase3-product-quality.md#task-1-vue-i18n-全量接入m6)。

**Q12: 对话历史能搜吗?**
A: 可以:
- Chat 顶部搜索框:全文搜索所有对话(标题 + 内容)
- 支持中文分词,基于本地索引(不联网)

---

## 任务与定时

**Q13: 自动化任务不执行?**
A: 排查清单:
1. **权限**: 设置 → 权限 → 是否在标准 / 开放模式
2. **Cron 表达式**: 定时任务查看 cron 是否合法
3. **执行模式**: 安全 / 计划 / 全量模式选错
4. **执行历史**: 任务历史 tab 看具体错误
5. **Gateway 状态**: 设置 → Gateway 状态是否 running

**Q14: 取消任务后磁盘有残留?**
A: 对,部分操作(写文件 / shell)中途中断无法回滚。这是设计取舍(避免 atomic 写带来的性能损失)。需要清理残留,可写一个 cleanup 任务在 schedule 里定期跑。

**Q15: 定时任务重复执行了?**
A: 99% 是启用了多个 PiPiClaw 实例。检查:
- 系统托盘是否多开
- 是否在两个工作目录分别启动
- 解决:只保留一个实例,其他 quit

---

## 沙箱与扩展

**Q16: 沙箱启动失败?**
A: 分 3 种:
- **D2-Prime (Docker)**: 检查 Docker Desktop 运行 → `docker ps` 能列容器 → 在设置 → 沙箱切换到 WebContainer 兜底
- **WebContainer**: 浏览器需要 SharedArrayBuffer(Chrome 95+ 默认支持),如失败可能是 cross-origin isolation 被破坏
- **Jupyter**: 检查 Python 3.8+ 在 PATH,或 `jupyter` 命令可执行

**Q17: WebContainer 跑 Python 报错?**
A: WebContainer 不支持 Python(只 Node.js)。需要 Python 切 D2-Prime + FastAPI 模板。

**Q18: 怎么贡献 skill?**
A: 两种方式:
1. **本地**: 创建 skill.md → 测试 → `tar czf my-skill.tar.gz skill.md` → 通过 PR 加到 `skills/` 目录
2. **社区**: 在 GitHub Discussions 发帖 → 维护者 review → 收录到官方 skill 仓库

详见 [贡献者指南](../contributing.md)。

---

## 性能与更新

**Q19: 怎么升级?**
A:
- 自动: 设置 → 关于 → 检查更新(GitHub Releases 通道,需 GH_TOKEN)
- 手动: 下载新版本安装包覆盖安装,userData 不动

**Q20: 启动慢 / 占内存大?**
A:
- 启动慢: 关闭不必要的 plan / retro 文档标签(本地调试时);生产 build 已经 minify
- 占内存大: Element Plus 全量引入 → bundle 偏大;Phase 6 会按需引入
- 详细数据见 [性能基准](../perf/baseline.md)

**Q21: IPC handler 107 个,能不能减少?**
A: 107 主要是 namespace 拆分(看 [架构 → IPC](../architecture/ipc.md) 表)。每个 handler 实际逻辑 < 30 行,拆分后维护性 > 合并。这是设计取舍不是冗余。

---

## 测试与开发

**Q22: 单元测试怎么跑?**
A:
```bash
npm run test              # vitest run,一次性
npm run test:watch        # watch 模式
npm run test:coverage     # 带 coverage 报告
```

文档结构测试:
```bash
npx vitest run tests/unit/docs-structure.test.ts
```

**Q23: 端到端冒烟测试?**
A:
```bash
npm run smoke             # 22 项检查,< 10ms,CI hard-fail
npm run smoke:full        # 包含 build + smoke
```

详细见 [E2E 测试说明](../e2e-testing.md)。

---

## 反馈与社区

**Q24: 怎么报 bug?**
A: GitHub Issues 模板:
- 复现步骤
- 期望行为
- 实际行为
- 环境(OS / PiPiClaw 版本 / LLM provider)
- 日志(设置 → 日志 → 导出)

**Q25: 商业支持 / 定制开发?**
A: 邮件 `support@pipiclaw.dev`(预留,正式地址待 GA 时公布)。