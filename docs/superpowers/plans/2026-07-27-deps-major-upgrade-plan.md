# 依赖 Major 升级路径 (2026-07-27)

## 当前状态

| 包 | 已装 | 漏洞范围 | 严重度 | 状态 |
|---|---|---|---|---|
| vitest | 1.6.1 | <3.2.6 | critical | 🔴 VULN |
| electron | 30.5.1 | <35.7.5 | high | 🔴 VULN |
| vite | 5.4.21 | <=6.4.1 | high | 🔴 VULN |
| esbuild | 0.21.5 | <=0.24.2 | moderate | 🟡 VULN (vite 间接) |
| postcss | ~~8.5.10~~ → 8.5.23 | <=8.5.17 | high | ✅ 2026-07-27 fixed via override |
| 其他 transitive | — | — | — | — |

**npm audit 总数**: 31 → 30 (postcss fix)

## 推荐升级路径(分阶段)

### Phase A — 安全补丁 (✅ 2026-07-27 完成)
- `postcss` override `^8.5.23` (含 transitive)
- 影响: -1 vuln (high)

### Phase B — Vitest 1.6 → 3.2.6+ (建议下次 session)
**风险**: HIGH
- 869 个 test 用 `vi.fn()` / `vi.mock()` / `vi.hoisted()`,vitest 2 改了 hoisted 行为
- `pool: 'forks'` config 是 v1 写法,v3 已改名 `pool: 'vmThreads'`
- `@vitest/coverage-v8` 必须同步升
- 步骤:
  1. `npm i -D vitest@^3.2.6 @vitest/coverage-v8@^3.2.6`
  2. 改 `vitest.config.ts`: `pool: 'forks'` → `pool: 'vmThreads'`
  3. 跑 `npx vitest run`,记下失败 case
  4. 修 mock pattern(`vi.hoisted` 改名 / `vi.mocked` 行为差异)

### Phase C — Vite 5.4 → 6.x (中期)
**风险**: MEDIUM
- vite 6 改 `define` API,加 `import.meta.hot` 行为变更
- vite-plugin-electron 0.28 是否兼容 vite 6? 待验证 (npm view vite-plugin-electron versions)
- 步骤:
  1. `npm i -D vite@^6 vite-plugin-electron@latest`
  2. 检查 `vite.config.ts` 是否需要改
  3. 跑 build + smoke test

### Phase D — Electron 30 → 35 LTS (中期)
**风险**: MEDIUM
- Electron 30 → 35 跨 5 个 minor,IPC API 稳定,但 `app.commandLine` 在 32 有 breaking
- electron-updater 6.x 是否兼容 electron 35? 待验证
- 步骤:
  1. `npm i -D electron@^35`
  2. 跑 electron-builder (Win)
  3. macOS / Linux CI 验证

### Phase E (可选) — Vite 8 + Vitest 4 + Electron 43
**风险**: VERY HIGH (留 v5.0)
- vite 8 是 3 个 major 跨度,plugin 生态可能未跟上
- electron 43 是 13 个 minor,改 IPC contract 风险
- **建议**: 等 v5.0 GA 准备时再评估,届时生态成熟

## 验收标准 (Phase B 完成后)
- [ ] `npm audit` critical/high 归零 (除 vite 8 / electron 43 留 v5)
- [ ] `npx vitest run` 869/869 ✅
- [ ] `npx vue-tsc --noEmit` 0 错
- [ ] `npm run build` Windows .exe 成功
- [ ] smoke 22/22 ✅

## 相关 commit

- `npm audit fix` — postcss 8.5.10 → 8.5.23 (lockfile)
- `package.json#overrides.postcss = ^8.5.23` — 强制 transitive