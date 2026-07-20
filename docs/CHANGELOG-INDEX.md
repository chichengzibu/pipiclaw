# PiPiClaw Retro & Plan 索引

> 本文件统一索引 PiPiClaw 项目所有的 retro(阶段回顾)、plan(实施计划)、spec(设计文档),方便快速定位历史决策和实现路径。

## Retros(阶段回顾)

- [W1-W6 retro](superpowers/retros/2026-07-15-w1-w6-retro.md) — 早期 6 周基线汇总
- [A 5 demo real-env validation retro](superpowers/retros/2026-07-16-a5demo-real-env/retros.md) — D1/D2/D3/D5/A5 真实环境闭环
- [B IM account integration retro](superpowers/retros/2026-07-16-b-im-account-integration/retros.md) — 飞书/钉钉/企业微信 IM 账号集成
- [B ready-verification](superpowers/retros/2026-07-16-b-im-account-integration/ready-verification.md) — B 准备就绪凭证补全 7 步流程
- [C sandbox validation retro](superpowers/retros/2026-07-16-c-sandbox-validation/retros.md) — P7 sandbox 镜像 + SandboxBuilder 闭环
- [real LLM integration retro](superpowers/retros/2026-07-17-real-llm-integration/retro.md) — LlmConfig + 3 provider 真接
- [real proxy wc jupyter retro](superpowers/retros/2026-07-17-real-proxy-wc-jupyter/retro.md) — WebContainerRunner + PortForwarder + JupyterRunner
- [Phase 1 engineering hygiene retro](superpowers/retros/2026-07-17-phase1-engineering-hygiene/retro.md) — ESLint / CI hard-fail / 仓库清理 / 文档同步

## Plans(实施计划)

- [v2 plan](superpowers/plans/2026-07-10-pipiclaw-v2-plan.md) — v2 总体路线图
- [W2-W12 subagent plans](superpowers/plans/2026-07-10-w*-subagent-task.md) — 各周子任务分解
- [real-env-validation 3 plans](superpowers/plans/2026-07-16-real-env-validation-3-plans.md) — A/B/C 三计划合集
- [v2.0.0 real-env validation guide](superpowers/plans/2026-07-16-v2.0.0-real-env-validation-guide.md) — 真实环境验证操作手册
- [fix A and verify B ready](superpowers/plans/2026-07-16-fix-a-and-verify-b-ready.md) — A 修 + B 准备验证
- [real LLM integration](superpowers/plans/2026-07-17-real-llm-integration.md) — LLM provider 真接方案
- [real proxy wc jupyter](superpowers/plans/2026-07-17-real-proxy-wc-jupyter.md) — WebContainer + 端口转发 + Jupyter 真接方案
- [Phase 1 engineering hygiene](superpowers/plans/2026-07-17-phase1-engineering-hygiene.md) — 本文对应 Phase 1 工程化基线提升计划

## Specs(设计文档)

- [v2 design](superpowers/specs/2026-07-10-pipiclaw-v2-design.md) — v2 总体设计
- [A demo validation design](superpowers/specs/2026-07-16-a-5demo-real-env-validation-design.md) — A 5 demo 设计
- [B IM integration design](superpowers/specs/2026-07-16-b-real-im-account-integration-design.md) — B IM 集成设计
- [C sandbox validation design](superpowers/specs/2026-07-16-c-sandbox-validation-design.md) — C 沙盒验证设计

## 文档约定

- 文件名格式 `YYYY-MM-DD-<topic>.md`,topic 用短横线连接的英文短词
- retro / plan / spec 分目录存放(`docs/superpowers/{retros,plans,specs}/`)
- Phase 1 retro / plan / 本 INDEX 三件套是工程化基线的"三件套",新加入者先读这三个文件
- 后续 Phase 2/3/4 的 retro / plan 应保持同样命名规则

## 维护说明

- 新增 retro: 在对应目录创建文件后,在此 INDEX 的 Retros 节加一行
- 新增 plan / spec: 同上,分别在 Plans / Specs 节加一行
- Phase 完成时同时更新 `CHANGELOG.md`(版本号 + Added/Changed/Fixed/Verified 节)
- README 中的「文档索引」节与本 INDEX 同步,通常本 INDEX 是单一真实来源