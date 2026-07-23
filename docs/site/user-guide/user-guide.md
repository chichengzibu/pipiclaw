# PiPiClaw 用户手册

> 8 个能力域的 How-to。每节末尾有 **常见陷阱**。

---

## 1. AI 对话 (Chat)

### 1.1 选择模型

顶部下拉显示当前所有 **已启用 + 测试通过** 的模型。显示顺序 = 最近使用优先。

- 切换模型不需要新建会话
- 如果模型被禁用 / 不可用 → 下拉显示 **(离线)** 标记

### 1.2 流式响应

逐 token 增量推送(`chat:onStreamChunk` 事件),从首字节到末字节连续可见。

- 中途想中断 → 按 **Esc** 或点击 **停止生成** 按钮
- 停止后已生成部分保留,可点 **继续生成**(`chat:message:continue`)

### 1.3 多会话管理

左侧 **会话列表** 列出所有对话:

- 鼠标悬停显示操作:置顶 / 归档 / 删除 / 重命名
- 顶部搜索框支持按标题 + 内容全文搜索
- 批量操作:多选 → 批量删除 / 批量归档

### 1.4 批量操作(删除 / 归档)

1. 进入 Chat 视图
2. 左侧会话列表勾选多个
3. 顶部出现批量操作栏:删除 / 归档 / 导出
4. 确认 → 执行

> **陷阱**: 删除会话是软删除,30 天内可在 **设置 → 数据管理 → 回收站** 找回。

---

## 2. 自动化任务 (Tasks)

### 2.1 创建任务

1. 导航到 **自动化任务**
2. 右上 **+ 新建任务**
3. 填写名称 + 自然语言指令
4. 系统调用 LLM 解析为步骤计划(`TaskPlan` 含 steps 数组)
5. 弹出预览:每个步骤显示类型(读文件 / 写文件 / shell / URL 打开)
6. 点击 **确认执行** → 进入执行队列

### 2.2 立即执行 vs 定时

- **立即执行**:点 **确认执行** → 进入队列立即跑
- **定时执行**:在 **定时任务** 创建 schedule,关联此任务的 taskId

### 2.3 取消任务

任务运行中 → 列表显示 **取消** 按钮 → 点击 → AbortController 触发 → 在跑的步骤优雅终止。

> **陷阱**: 文件写入 / shell 命令在中途无法回滚,取消后磁盘可能残留部分文件。

### 2.4 查看执行历史

1. 进入 **任务历史** tab
2. 每个任务有完整执行轨迹:
   - 开始 / 结束时间
   - 每步状态(pending / running / success / failed / cancelled)
   - 每步输入 / 输出 / 错误
   - 总耗时 / Token 用量
3. 支持按状态 / 时间 / 名称筛选
4. 一键重试失败任务
5. 导出为 JSON / TXT

---

## 3. 定时任务 (Schedule)

### 3.1 Cron 表达式

支持标准 5 字段:`分 时 日 月 周`,例如:

| 表达式 | 含义 |
| --- | --- |
| `0 9 * * *` | 每天 9:00 |
| `*/15 * * * *` | 每 15 分钟 |
| `0 9 * * 1-5` | 工作日 9:00 |
| `0 0 1 * *` | 每月 1 号 0:00 |

UI 内置 **Cron 可视化选择器**(从 src/components/schedule/CronPicker.vue),不需要手写。

### 3.2 4 种周期预设

UI 提供 4 个一键预设(自动生成 cron 表达式):

- **单次**:指定未来时间点,只跑一次
- **每天**:固定 HH:MM 跑
- **每周**:选星期几 + HH:MM
- **每月**:选日期 + HH:MM

### 3.3 重试策略

每个 schedule 任务可配置:

- `maxRetries`:失败后最大重试次数(默认 3)
- `retryDelay`:重试间隔(默认 30s,指数退避 × 2)
- `retryOn`:触发重试的错误类型(network / timeout / all)

> **陷阱**: 启用 schedule 后默认应用启动时自动跑;若希望仅在前台运行时跑,在 **设置 → 计划任务** 关闭 "应用启动时执行"。

---

## 4. 技能市场 (Skills)

### 4.1 浏览社区技能

1. 导航到 **技能市场**
2. 浏览 / 搜索 技能卡片
3. 卡片显示:名称 / 描述 / 作者 / 评分 / 触发条件
4. 点击卡片查看详情页(JSON 描述 + 输入输出 schema + 截图)

### 4.2 安装技能

1. 详情页点 **安装**
2. 系统下载 skill.md → 验证签名 → 存到 `userData/skills/<name>/`
3. 安装后可一键执行

### 4.3 一键执行

1. 已安装技能 → 列表显示 **执行** 按钮
2. 点击 → 系统弹出输入表单(根据 skill.md 的 input schema)
3. 填表 → 提交 → 执行

### 4.4 创建自定义技能

1. 进入 **技能市场 → 我的技能 → 新建**
2. 填写 skill.md(frontmatter + 描述 + prompt + 工具列表)
3. 上传图标
4. 发布到本地 / 导出为文件

> **陷阱**: skill 实际执行需要权限,缺权限时系统弹权限申请对话框;不是所有 skill 都能在沙箱里跑(部分需要 network / file-system write)。

---

## 5. 即时通讯 (IM Accounts)

### 5.1 飞书 / 钉钉 / 企业微信接入

1. 导航到 **设置 → IM 账号**
2. 选择 channel(飞书 / 钉钉 / 企业微信)
3. 填写凭证:
   - **飞书**:App ID + App Secret + Verification Token
   - **钉钉**:App Key + App Secret + Robot Code
   - **企业微信**:Corp ID + Agent ID + Secret
4. 点击 **启用**
5. Channel 启动 WebSocket / 长连接

### 5.2 OAuth 流程

部分 channel(Lark / Slack / Discord 等)需要 OAuth 2.0:

1. 点 **连接** → 跳转到第三方登录页
2. 授权后回调到 `pipiclaw://oauth/callback?code=xxx`
3. PiPiClaw 拿 code 换 access_token
4. 存到 IMConfigStore(safeStorage 加密)

### 5.3 消息路由

通过 `IMMessageRouter`(electron/channel/IMMessageRouter.ts):

- 规则匹配:发送人 / 群组 / 关键字 → 路由到指定 skill / agent
- 默认安全:未授权发送人 → 仅 echo / 不执行任务
- 可在 **IM 设置** 编辑路由规则

> **陷阱**: 飞书 / 钉钉 sandbox token 有效期 2 小时;生产 token 取决于企业配置。token 过期 channel 会自动重连。

---

## 6. 权限管理 (Permissions)

### 6.1 权限集

权限集 = 一组规则集合,定义"哪些操作允许 / 拒绝 / 询问"。

- **安全模式** (built-in):默认拒绝所有非读操作
- **标准模式** (built-in):默认询问,白名单允许
- **开放模式** (built-in):默认允许,黑名单拒绝
- **自定义**:从模板开始,逐条编辑

### 6.2 path / api / network 规则

3 类规则:

- **path 规则**:文件路径 glob(如 `~/Downloads/**` = 允许下载目录)
- **api 规则**:IPC handler 白名单(如 `chat:message:send` = 允许发消息)
- **network 规则**:网络白名单(如 `api.openai.com:443` = 允许 OpenAI)

每条规则 action: `allow` / `deny` / `ask`

### 6.3 默认安全策略

- 默认 deny by default
- 高风险操作(写文件 / shell / 网络外发 / 剪贴板写入)**始终弹确认**
- 飞书 / 钉钉 webhook 发送需二次验证

> **陷阱**: 切换到 **开放模式** 后,所有任务自动执行,误操作风险高。生产建议保留 **标准模式**。

---

## 7. 模型管理 (Models)

### 7.1 添加自定义模型

1. **设置 → 模型管理 → 添加模型**
2. 选 provider(OpenAI / Anthropic / 智谱 / Ollama / 自定义)
3. 填 base URL + API Key + model name
4. 高级:可设置 max tokens / temperature / top_p

### 7.2 测试连接

- 模型卡片右侧 **测试连接** 按钮
- 发送一个 minimal prompt(如 "hi"),1-3 秒内返回即通过
- 测试结果显示:延迟 / HTTP code / 错误信息

### 7.3 模型配置

每个模型可独立配置:

- `displayName`:UI 显示名
- `maxContextTokens`:上下文窗口
- `costPer1kTokens`:成本估算(用于 Insights)
- `enabled`:是否在 Chat 下拉可见

> **陷阱**: Ollama 模型需要本地先 `ollama pull <model>`,否则测试连接会失败。

---

## 8. 沙箱 (Sandbox)

### 8.1 D2-Prime 容器编排

D2-Prime 是基于 Docker 的容器化沙箱:

1. 启动任务时,PiPiClaw 拉取 `pipiclaw/sandbox-base` 镜像
2. 通过 `SandboxBuilder` 从 4 个模板之一创建容器:
   - Vite-React-TS(前端开发)
   - Next.js-app(SSR)
   - FastAPI(Python 后端)
   - Go HTTP(Go 服务)
3. 通过 `PortForwarder` 把容器端口映射到 host
4. 任务结束 → 容器销毁

### 8.2 WebContainer 浏览器端

WebContainer 是 StackBlitz 提供的浏览器内 Node.js:

- 不需要本地 Docker
- 适合纯前端 / Vite / Next.js dev 任务
- 通过 `WebContainerRunner` 调度
- 端口通过 `WebContainerRunner.boot()` 暴露

### 8.3 Jupyter 数据科学

JupyterRunner 提供 Python REPL + notebook:

1. 启动 Jupyter server(后台子进程)
2. 通过 WebSocket 与主进程通信
3. 前端 `JupyterView` 显示 cell 输入 / 输出
4. 支持 matplotlib / pandas / numpy 内联展示

### 8.4 文件系统隔离

3 层隔离:

- **L1 (process-level)**:Windows Job Object / macOS sandbox-exec / Linux bubblewrap
- **L2 (容器级)**:Docker 容器
- **L3 (网络级)**:NetworkPolicy 限制出站域名 + 端口

> **陷阱**: WebContainer 限制更多(无 Python / 无原生二进制),D2-Prime 才有 Python / Go / Node 全栈。Jupyter 仅作 REPL / 分析用,不承担服务托管。

---

## 9. 跨域小贴士

- 想全量控制 → 用 **自定义权限集** + **自定义模型**
- 想开箱即用 → 用 **标准模式** + 内置 provider
- 想本地全离线 → 选 **Ollama** 模型 + **WebContainer** 沙箱
- 想团队协作 → 启用 **IM 路由** + 把 skill 推送到团队

---

## 下一步

- 碰到 bug 或问题?看 [故障排查](troubleshooting.md)
- 想了解技术细节?看 [架构总览](../architecture/overview.md)
- 想参与开发?看 [贡献者指南](../contributing.md)