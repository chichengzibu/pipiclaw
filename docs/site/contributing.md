# PiPiClaw 贡献者指南

> 欢迎贡献 PiPiClaw!这份文档说明如何提 PR / 报 bug / 贡献 skill。

## 行为准则

- 友好、专业、就事论事
- 任何 PR 都要过 4 件套(lint / tsc / vue-tsc / vitest)
- 提交前先看 [架构文档](architecture/overview.md) 理解模块边界

## 如何提 PR

### 1. Fork + 分支

```bash
git clone https://github.com/<your-fork>/pipiclaw.git
cd pipiclaw
git checkout -b feat/your-feature
```

### 2. 改代码

- 风格:参考 `eslint.config.js` + `tsconfig.json`(strict)
- 测试:每个新功能至少 1 个单测
- 文档:改 behavior 要同步 README / docs/site

### 3. 验证 4 件套

```bash
npm run lint
npx tsc --noEmit -p tsconfig.node.json
npx vue-tsc --noEmit
npx vitest run --reporter=basic
npm run smoke
```

必须**全过**才能提 PR。

### 4. Commit 信息格式

```
<type>(<scope>): <subject>

<body - 解释 why,不解释 what>

<footer - 关联 issue>
```

type 范围:
- `feat` 新功能
- `fix` bug 修复
- `refactor` 重构
- `test` 测试
- `docs` 文档
- `chore` 杂项(dep / config)

scope 示例:`chat` / `sandbox` / `channel` / `permission` / `docs`

### 5. Push + PR

```bash
git push origin feat/your-feature
# GitHub 上 Open PR
```

PR 标题同 commit subject。

### 6. Review

- Reviewer 会在 1-3 天内响应
- 接受 review 反馈 → push 更新 → 自动 re-trigger CI
- 全部绿灯 + 1 个 approve → merge

---

## 如何报 Bug

GitHub Issues,带以下模板:

```markdown
## 复现步骤
1. ...
2. ...

## 期望行为
...

## 实际行为
...

## 环境
- PiPiClaw 版本: v2.1.0
- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- LLM provider: OpenAI GPT-4
- 已安装技能: <列表>

## 日志
（设置 → 高级 → 导出诊断包）

## 截图（如有）
```

---

## 如何贡献 Skill

### 方式 A:本地开发

1. 在 `skills/<your-skill-name>/` 创建 skill.md
2. 测试通过 UI 导入
3. 提交 PR,标题 `feat(skill) add <your-skill-name>`

### 方式 B:社区贡献

1. 在 GitHub Discussions 发"Skill Proposal"
2. 维护者 review 必要性
3. Approved 后按方式 A 流程

skill.md 模板见 [扩展开发 → 添加新技能](architecture/extension.md#6-添加新技能-skill)。

---

## 开发环境

### 系统要求

- Node.js 18+(推荐 20 LTS)
- npm 9+
- Docker(可选,跑 D2-Prime 沙箱需要)

### 跑 dev

```bash
npm install
npm run dev
```

会自动:
- vite dev server 启前端
- electron 加载本地前端,启 IPC
- hot-reload

### 跑测试

```bash
npm run test            # 一次性
npm run test:watch      # watch
npm run test:coverage   # coverage
npm run smoke           # smoke 检查
```

### 跑性能 benchmark

```bash
npm run perf            # 基线测量
PERF_FULL=1 npm run perf   # 完整 build 测量(慢)
```

---

## 项目结构速览

```
piclaw/
├── electron/        # 主进程(Node.js)
├── src/             # 渲染端(Vue 3)
├── tests/
│   ├── unit/        # vitest 单测
│   ├── integration/ # 集成测试
│   └── e2e/         # Playwright 真 E2E
├── docs/
│   ├── site/        # 用户文档(本目录)
│   ├── perf/        # 性能数据
│   └── superpowers/ # plans / retros / specs
├── scripts/         # 工具脚本
└── skills/          # 社区技能
```

---

## Release 流程

1. 改 package.json 版本号
2. CHANGELOG.md 加 entry
3. `npm run smoke:full`(build + smoke)
4. `npm run build`(生成 installer)
5. 打 git tag:`git tag v2.x.y`
6. push tag → CI 自动 publish 到 GitHub Releases
7. release notes 从 CHANGELOG 拷贝

---

## 沟通渠道

- GitHub Issues:Bug / Feature
- GitHub Discussions:设计 / skill proposal
- 邮件:`support@pipiclaw.dev`(预留)

---

## 致谢

感谢所有贡献者!见 [GitHub Contributors](https://github.com/chichengzibu/pipiclaw/graphs/contributors)。