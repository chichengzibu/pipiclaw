# PiPiClaw 新手入门

> 5 分钟把 PiPiClaw 跑起来 — 适合第一次接触 PiPiClaw 的用户。

## 系统要求

| 平台 | 最低版本 | 备注 |
| --- | --- | --- |
| Windows | Windows 10 1909+ | x64 |
| macOS | 10.15 (Catalina)+ | x64 + arm64 (Apple Silicon) |
| Linux | glibc 2.31+ (Ubuntu 20.04) | x64,AppImage 便携 |

## 5 分钟快速上手

### 1. 安装

1. 从 [Releases](https://github.com/chichengzibu/pipiclaw/releases) 页面下载对应平台安装包:
   - Windows: `PiPiClaw-2.1.0-Setup.exe`
   - macOS (Intel): `PiPiClaw-2.1.0-x64.dmg`
   - macOS (Apple Silicon): `PiPiClaw-2.1.0-arm64.dmg`
   - Linux: `PiPiClaw-2.1.0-x64.AppImage`
2. 双击安装,选择安装路径(Windows 默认 `C:\Program Files\PiPiClaw`)。
3. 首次启动会展开窗口 + 系统托盘图标。

### 2. 启动

启动后看到主界面 = 左侧 `SideNav` + 主区 `Chat` 视图。

- 顶部 TitleBar 显示当前模型状态
- 左侧导航包括 AI 对话 / 自动化任务 / 定时任务 / 技能市场 / 设置 等
- 主区默认 Chat 视图,顶部有模型下拉

### 3. 配置 LLM API Key

1. 进入 **系统设置 → 模型管理**(导航图标:魔方)
2. 选择你的 LLM 提供商:
   - **OpenAI** — 需 OpenAI API Key
   - **Anthropic** — 需 Anthropic API Key
   - **智谱 GLM** — 需智谱 API Key(国产友好)
   - **Ollama** — 本地模型,需先启动 Ollama 服务
   - **自定义** — 任何 OpenAI-compatible endpoint (如 DeepSeek / 月之暗面 / 硅基流动)
3. 输入 API Key
4. 点击 **测试连接** — 等待 1-3 秒,绿色表示 OK
5. 保存

> API Key 通过 `safeStorage` 加密存储(OS Keychain),不会以明文形式写到磁盘。
> 加密文件路径:Windows `%APPDATA%/PiPiClaw/llm-config.json.enc` / macOS `~/Library/Application Support/PiPiClaw/llm-config.json.enc` / Linux `~/.config/PiPiClaw/llm-config.json.enc`

### 4. 开始对话

1. 回到 **AI 对话** 视图
2. 顶部下拉选择模型(已配置的模型会列出)
3. 底部输入框输入消息
4. 按 **Enter** 发送(Shift+Enter 换行)
5. 流式响应会逐 token 出现(看到字符一个一个出现,不是整段跳出来)

### 5. 创建自动化任务(可选)

1. 进入 **自动化任务** 视图
2. 点击右上 **新建任务**
3. 填写:
   - 任务名称
   - 自然语言指令(如 "把桌面上的截图按日期归档到 ~/Pictures/Archive/")
   - 执行模式:安全模式 / 计划模式 / 全量模式
4. 系统解析指令为步骤计划,弹出确认对话框
5. 确认 → 执行
6. 执行历史可在 **任务历史** tab 查看

### 6. 设置定时任务(可选)

1. 进入 **定时任务** 视图
2. 新建任务,设置:
   - Cron 表达式(如 `0 9 * * *` = 每天 9:00)
   - 4 种周期预设:单次 / 每天 / 每周 / 每月
3. 关联已有的任务或写新指令
4. 启用 → 系统后台运行

## 下一步

- 想用全部能力?读 [用户手册](user-guide.md) — 8 个域的 How-to
- 遇到问题?读 [FAQ](faq.md) + [故障排查](troubleshooting.md)
- 想理解原理?读 [架构总览](../architecture/overview.md)
- 想贡献代码?读 [贡献者指南](../contributing.md)

## 卸载

- **Windows**: 设置 → 应用 → PiPiClaw → 卸载(可选保留用户数据)
- **macOS**: 把 Applications/PiPiClaw.app 拖到废纸篓;清理 `~/Library/Application Support/PiPiClaw`
- **Linux**: `rm PiPiClaw-*.AppImage`;清理 `~/.config/PiPiClaw`