# Agent 2: 前端 Lead 视角审查

## 任务
对 PiPiClaw v4.4.0 做**前端代码健康审查**。

## 审查范围
- `src/views/` — 14 个 view (Dashboard, Chat, Skills, Models, Tasks, IM, Schedule, Permissions, Settings, Help, ClawHub, ModelCompare, PluginMarket, RemoteControl)
- `src/components/` — chat/ layout/ common/ skills/ guide/ settings/
- `src/stores/` — Pinia stores
- `src/router/` — vue-router 配置
- `src/locales/` — i18n
- `src/styles/` — tokens + global.scss
- `package.json` scripts: `dev`, `build`, `test`, `test:e2e`, `lint`

## 关键问题
1. 跑 `npx vue-tsc --noEmit` 看 type error 数量
2. 跑 `npx eslint src/` 看 error 数量
3. 跑 `npx vitest run` 看 unit test pass/fail (916 测试)
4. 跑 `npm run build` 看 dist 产物
5. 组件复用度? 重复代码? (75 skills 卡片重复?)
6. TypeScript strict 模式? 类型覆盖?
7. 状态管理 (Pinia) 是否合理?
8. 路由守卫 (meta.devOnly)?
9. 错误处理 (try-catch / error boundary)?
10. 性能 (虚拟列表 / 懒加载 / 分包)?
11. 国际化 (zh-CN / en-US 覆盖度)?
12. 依赖: Vue 3.5, Element Plus, Pinia, vue-i18n, vue-router, @vueuse

## 输出格式
写到 `docs/audit/02-frontend-report.md`:
- 代码统计 (文件数, 组件数, 行数)
- 跑测试结果 (vue-tsc / eslint / vitest / build)
- 发现的问题
- 评分: 健康度 X/10
