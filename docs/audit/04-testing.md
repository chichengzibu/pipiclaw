# Agent 4: QA Lead 视角审查

## 任务
对 PiPiClaw v4.4.0 做**测试覆盖 + 实际跑测试**。

## 审查 + 实际跑

### Step 1: 测试套件盘点
- `tests/unit/` — vitest 单元测试 (916 测试)
- `tests/integration/` — 集成测试
- `tests/e2e/` — playwright e2e (25 files, 102 tests)
- `scripts/smoke-test.mjs` — 22 烟雾测试
- `scripts/e2e-real-llm.mjs` — 真实 LLM 端到端
- `scripts/user-journey-ollama.mjs` — 用户全套功能 (新建)

### Step 2: 实际跑 (在 D:\pipiclaw\piclaw 目录)
```bash
# 单元测试
npx vitest run 2>&1 | tail -50

# 类型检查
npx vue-tsc --noEmit 2>&1 | tail -30

# ESLint
npx eslint src/ 2>&1 | tail -30

# 编译
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm run build 2>&1 | tail -30
```

### Step 3: 测试覆盖分析
- 哪些模块有测试, 哪些没?
- e2e 是否覆盖关键路径 (Chat / Models / Skills / Settings)?
- 实际跑通过率多少?

## 关键问题
1. 单元测试覆盖关键模块 (stores, LlmClient, ChatManager)?
2. e2e 是否跑通 Ollama 真链路?
3. 是否有 performance / load / stress 测试?
4. CI 配置? GitHub Actions?
5. test flakiness (memory 提到 17 failed pre-existing)?
6. smoke-test.mjs 22 个 smoke 是否全过?
7. 自动化覆盖: 用户操作 (新建对话, 切主题, 切语言, 改默认模型)?

## 输出格式
写到 `docs/audit/04-testing-report.md`:
- 测试套件统计
- 实际跑结果 (vue-tsc / eslint / vitest / build 全部带数字)
- 通过率 / 失败原因分析
- 评分: 健康度 X/10
