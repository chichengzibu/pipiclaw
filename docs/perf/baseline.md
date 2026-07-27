# PiPiClaw 性能基准报告

生成时间: 2026-07-27T06:21:51.054Z
commit: local

## 实测

| 指标 | 实测 | 单位 | 阈值 | 状态 |
| --- | ---: | --- | --- | --- |
| B1.ipcMain.handle count (main.js) | 169 | 个 | 100 ~ 5000 | ✅ pass |
| B2.ipcRenderer.invoke count (preload.js) | 172 | 个 | 100 ~ 5000 | ✅ pass |
| B3.main.js size | 455 | KB | 1 ~ 8192 | ✅ pass |
| B4.preload.js size | 18 | KB | 1 ~ 2048 | ✅ pass |
| C1.renderer js total | 1098 | KB | 1 ~ 16384 | ✅ pass |
| C2.renderer css total | 116 | KB | 1 ~ 4096 | ✅ pass |
| C3.largest chunk size | 692 | KB | 1 ~ 4096 | ✅ pass |
| C4.js chunk count | 31 | 个 | 1 ~ 200 | ✅ pass |

## 含义

- **IPC surface** 是 Phase 2 / 3 / 4 / 5 累积的 IPC handler / invoke 总数,反映 Electron 主进程复杂度
- **bundle size** 反映渲染端初始下载成本,gzip 前估算
- **build time** 是 vite cold cache 完整 build 耗时(CI 默认 skip,需要 PERF_FULL=1)
- **SSE latency** 需要 mock LLM server,留 Phase 5 stretch

## 性能门禁策略

本报告**不**作为 CI gate(波动大)。仅供人在本地手动比较 baseline 与新测量值。
当发现明显 regression(>30%)时,在 commit message 中记录差异。
