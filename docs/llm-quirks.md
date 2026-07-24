# PiPiClaw × LLM 模型适配笔记

跑过 4 个本地 Ollama 模型的真实经验,这里记下"踩过的坑"。

## 模型速查表

| 模型 | size | 速度 | thinking | 工具调用 | 推荐场景 |
|---|---|---|---|---|---|
| qwen3.5:9b | 6.3GB | ⚡⚡ 23s | 强(3.7x) | ✓ | 日常对话,需要透明 thinking |
| gpt-oss:20b | 13GB | ⚡⚡ 25s | 强(3.9x) | ✓ | 复杂任务,质量高 |
| qwen3:14b | 8.8GB | ⚠ 42s | 中(1.7x) | ✓ | 不推荐(慢) |
| qwen3:14b-large | 8.8GB | ⚠ 41s | 中(1.8x) | ✓ | 不推荐(同 14b 慢) |
| qwen3-vl:32b | 20GB | ✗ 157s+ | - | - | 视觉任务专用,文本别用 |

## 已知坑

### 1. thinking 模式吞 token
- **症状**: `max_tokens=200`,模型返回 200 token 全部是 reasoning,content 空
- **触发**: qwen3 / qwen3.5 / DeepSeek-R1 等 reasoning 模型,问题稍微复杂就触发
- **修复**:
  - PiPiClaw OpenAI adapter 已 fallback `content ?? reasoning`(commit 34eb72f)
  - **生产 max_tokens 建议 ≥ 2048**,给 thinking + 答案都留够空间

### 2. `think: false` 协议层不生效
- **症状**: OpenAI 兼容协议下,Ollama 不把 `think: false` 透传给 gpt-oss / qwen3
- **测试**:
  ```
  gpt-oss:20b: reasoning 1562 字(短了但还在)
  qwen3.5:9b: 仍走 native thinking
  ```
- **解决**: 必须用 Ollama native API `/api/chat`(不走 `/v1/chat/completions`)
- **PiPiClaw**: 目前走 OpenAI compat,所以**关闭 thinking 不可用**。建议用 `max_tokens ≥ 4096` 间接解决

### 3. qwen3:14b 慢于 qwen3.5:9b
- **症状**: 14B 比 9B 慢 2 倍(42s vs 23s)
- **原因**: qwen3.5:9b 用了 9B params + 较短 thinking;14B 慢在 KV cache
- **建议**: 日常对话用 qwen3.5:9b 即可,9B 速度体验明显好

### 4. gpt-oss-20b 代码生成 S2 失败
- **症状**: 短 max_tokens(800)下,生成的是"问题分析"而非代码
- **解决**: max_tokens ≥ 2000,reasoning 完了再生成代码

### 5. qwen3.5:9b 多轮 S4 失败
- **症状**: 3 轮对话后没记住名字
- **原因**: 小模型(9.7B)对长 context 注意力不够
- **建议**: 多轮用 gpt-oss-20b 或 Claude

## 推荐配置(本地 Ollama)

**用户日常用**:
```json
{
  "provider": "openai",
  "apiKey": "no-key",
  "apiBaseUrl": "http://localhost:11434/v1",
  "defaultModel": "qwen3.5:9b",
  "maxTokens": 2048
}
```

**复杂任务 / Agent**:
```json
{
  "provider": "openai",
  "apiKey": "no-key",
  "apiBaseUrl": "http://localhost:11434/v1",
  "defaultModel": "gpt-oss:20b",
  "maxTokens": 2048
}
```

**如果用户给 Claude / OpenAI API key**:
- claude-3-5-sonnet-20241022:质量最高(需付费)
- gpt-4o-mini:便宜 + 质量好
- gpt-4o:质量顶(贵)

## PiPiClaw 已做的修复

| commit | 修复内容 |
|---|---|
| 34eb72f | content fallback to reasoning |
| 34eb72f | max_tokens 默认 2048 → 4096 |
| 603e7ed | tool_calls 完整透传 + 解析 |
| 7f7e629 | ThinkingBlock UI 组件(可替换 Chat.vue 现有 inline) |

## 未来改进

- [ ] 流式响应 (当前是非流式,等 200 OK 才显示,延迟感强)
- [ ] thinking 实时流(用户能看到模型边想边说)
- [ ] Anthropic adapter 也支持 thinking(目前 OpenAI compat 才有)
- [ ] Chat.vue 把 inline thinking 替换成 ThinkingBlock
- [ ] LlmClient 自动选择 max_tokens(根据模型族 + 复杂度)
- [ ] Ollama native adapter 单独写(直接 /api/chat,支持 think:false)
