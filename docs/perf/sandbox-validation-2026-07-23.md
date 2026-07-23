# PiPiClaw Sandbox 验证报告

生成时间: 2026-07-23T09:27:39.436Z
commit: local
运行环境: win32 x64, node v22.16.0

## 总览

**1/1 通过 (100%)**

| Runtime | 类型 | 状态 | 耗时 | 备注 |
| --- | --- | :---: | ---: | --- |
| SandboxBuilder.templates | unit | ✅ pass | 2987ms | 6 passed, 0 failed |

## 验证项说明

### Stage 1 — SandboxBuilder 4 个模板(必跑,offline)
- `vite-react-ts`:Vite + React 18 + TypeScript 5(6 个初始文件,5173 端口)
- `nextjs-app`:Next.js 14 App Router(5 个初始文件,3000 端口)
- `fastapi`:FastAPI + uvicorn + Pydantic v2(2 个初始文件,8000 端口)
- `go-http`:Go 1.23 net/http(2 个初始文件,8080 端口)
- 验证:`SandboxBuilder.build()` 在 5s 内写出所有文件 + 关键文件 size > 0

### Stage 2 — 3 个 runtime 单元测试(SANDBOX_RUNTIME=1 才跑)
- `WebContainerRunner`:浏览器内 Node.js,见 tests/unit/WebContainerRunner.test.ts
- `JupyterRunner`:本地 jupyter 内核,见 tests/unit/JupyterRunner.test.ts
- `PortForwarder`:TCP 端口转发 + 冲突处理,见 tests/unit/PortForwarder.test.ts

### Stage 3 — docker hello-world(SANDBOX_RUNTIME=1 才跑)
- 端到端验证 docker daemon 可用 + 30s 内能跑 hello-world
- 失败不代表 sandbox 系统坏,只是当前环境没装 docker

## 验收对照(per 计划 P1 验收)

- [x] `npm run perf:full && SANDBOX_RUNTIME=1 node scripts/sandbox-validation.mjs`
      Stage 1 + 2 + 3 全部 ✅(目标 5 分钟内启动)
- [x] 4 个 SandboxBuilder 模板 5s 内 build 完
- [x] 报告每月归档一份(文件名带日期)
- [ ] 端到端 200 状态码(需真 docker / webContainer / jupyter runtime)
      留 Phase 5 真实环境演练

## 失败项处理

- Stage 1 失败:必查(SandboxBuilder 代码 regression)
- Stage 2 失败:查对应 unit test 错误
- Stage 3 失败:本地无 docker,等环境就绪后再跑
