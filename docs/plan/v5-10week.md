# PiPiClaw v4.4.0 → v5.0.0 — 10 周硬骨头路线图

> **总目标**：Agent runtime 跟 ClaudeCode 对齐 + MCP 集成 + 知识库真向量 = 能力超越 ClaudeCode 起点
> **现状**：v4.4.0 ship 完成（5 P0 安全 + 14 v4.4 视觉），总评 6.5/10
> **差距**：MCP 0% / 知识库假向量 / Agent 死代码 / 沙箱 stub / LLM 精神分裂

## M1 — v4.5.0-alpha（4 周）

| 任务 | 主导 | 周 | 关键交付 |
|---|---|---|---|
| LlmAgentBrain v0.1 | ai | 1-2 | tool call 透传 + 5 工具（Read/Edit/Bash/Glob/Grep）+ multi-turn |
| 9 P0 阻塞前 4 项 | backend | 1 | forceReset 重做 + Ed25519+TOFU + LlmClient 修复 + d5:run bug |
| LLM 抽象统一 | ai | 1 | LlmClient + ModelManager 合并，删 ModelManager 死代码 |
| MCP 调研 + PoC | mcp (新) | 1-2 | stdio transport + filesystem server PoC |

**ship**：v4.5.0-alpha → GitHub 公开（early adopter），**总评 7.5/10**

## M2 — v4.5.0-beta（4 周）

| 任务 | 主导 | 周 | 关键交付 |
|---|---|---|---|
| LlmAgentBrain v0.2 | ai | 5-6 | max_iterations + cost tracking + 流式 tool call |
| 9 P0 阻塞后 5 项 | backend | 5 | safeStorage Linux + file path 沙箱 + 未知 op deny + SkillLoader verify + ToolRegistry |
| MCP 实施 3 server | mcp | 5-8 | filesystem / github / postgres + UI 配置页 |

**ship**：v4.5.0-beta → GitHub 公开（general），**总评 8.5/10**

## M3 — v5.0.0（2 周）

| 任务 | 主导 | 周 | 关键交付 |
|---|---|---|---|
| 知识库真向量 | ai | 9-10 | sqlite-vss + bge-m3 + rerank（替换 SHA-256 假向量） |
| 沙箱起步 | backend | 9-10 | ProcessSandbox 接口 + Windows 平台分支（cgroup/Job Object） |

**ship**：v5.0.0 → production + 半商业化，**总评 9.0/10**

## 节点 + ship 对象

| 节点 | 总评 | ship 给 |
|---|---|---|
| 现在 v4.4.0 | 6.5/10 | 内部 dogfooding |
| M1 v4.5.0-alpha | 7.5/10 | GitHub 公开（early adopter） |
| M2 v4.5.0-beta | 8.5/10 | GitHub 公开（general） |
| M3 v5.0.0 | 9.0/10 | production + 半商业化 |

## M1 第一波（今天启动）

| Agent | 任务 | 状态 |
|---|---|---|
| pipiclaw-ai | LlmAgentBrain v0.1 + LLM 抽象统一 | spawn now |
| pipiclaw-backend | 9 P0 阻塞前 4 项 | spawn now |
| **pipiclaw-mcp（新）** | MCP 调研 + filesystem PoC | spawn now |

verifier 每周末汇总 + 决定 ship 模式
