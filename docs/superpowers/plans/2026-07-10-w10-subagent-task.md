# W10 — P7 镜像构建器 + 网络白名单 + 资源限额 + selfcheck Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 3 task)
> **执行窗口**:约 30-60 分钟
> **前置 commit**:`97dde32` W9 docs(已合入 master)
> **目标 commit**:3 commit + 1 docs commit = **4 commit 全部由 subagent 自 commit**(短英文 message)
> **当前工作目录**:`D:\pipiclaw\piclaw`

> **职责分工**:
> - **subagent**:写 10 个新文件,3 个 commit。**主会话只跑兜底测试 + 验收**,subagent 自己 git add + git commit。

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W10 章节(L554-L600),做 3 件事:

| Task | 模块 | 文件 | commit |
|---|---|---|---|
| W10.1 | SandboxBuilder + 4 模板 | SandboxBuilder.ts + 4 templates .ts + templates/index.ts | 1 |
| W10.2 | network 白名单 + 资源限额 | networkPolicy.ts + resourceLimits.ts | 1 |
| W10.3 | selfcheck 脚本 + package.json 末尾追加 1 script | scripts/sandbox-selfcheck.mjs + package.json 末尾追加 1 script | 1 |
| **合计** | | **9 新文件 + 1 改** | **3** |

---

## 2. 必读现状(关键)

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W10 章节(L554-L600) | 权威定义 |
| `electron/sandbox/`(W9 完成) | 已有 8 文件:dockerDetector / SandboxL1 + l1/{seatbelt, bwrap, windowsJob} / workspace / index.ts / .gitkeep |
| `electron/sandbox/workspace.ts` W9.3 | `WorkspaceManager` 单例,W10.1 SandboxBuilder 复用 |
| `electron/sandbox/dockerDetector.ts` W9.1 | W10.3 selfcheck 复用 |
| `package.json` | 现有 11 个 scripts(W9.4 加了 `sandbox:build-base`),W10.3 末尾追加 1 个 `sandbox:selfcheck` |

**关键约束**:
1. **不引入新 npm 依赖**。
2. **模板不写成 .yaml**——plan §W10.1 说 4 templates .yaml,但需要 yaml 解析库(`js-yaml`)会引入新依赖。**改用 .ts 模板**(导出 `TemplateConfig` 对象),既避免新依赖又保持类型安全。`templates/index.ts` 用 `export { viteReactTs } from './vite-react-ts'` 形式。
3. **每个 commit 自己跑 tsc + vitest 验证**(tsc 0 错 + vitest 84/84)
4. **W10 阶段不真跑** docker build(只写逻辑 + 配置 + 脚本)
5. **不修改** ChatManager / IpcServer / preload / tokens / variables / contracts / 既有 view / 既有 sandbox 业务代码
6. **W10.3 末尾追加** `package.json` script:`"sandbox:selfcheck": "node scripts/sandbox-selfcheck.mjs"`(既有 11 个 scripts 0 改动)

---

## 3. 总体原则

- **3 个 commit 顺序执行**,每个完成后跑 `npx tsc --noEmit` + `npx vitest run` 验证
- **不引入新 npm 依赖**
- **commit message 短**(避免含特殊符号 `():`-`,`)
- **每 commit 自己跑 + 自己 add + 自己 commit**

---

## 4. Task W10.1 — SandboxBuilder + 4 模板(1 commit)

### 4.1 文件清单

```
electron/sandbox/SandboxBuilder.ts            (~250 行)
electron/sandbox/templates/vite-react-ts.ts   (~50 行)
electron/sandbox/templates/nextjs-app.ts      (~50 行)
electron/sandbox/templates/fastapi.ts         (~50 行)
electron/sandbox/templates/go-http.ts         (~50 行)
electron/sandbox/templates/index.ts           (~30 行 re-export)
```

**注**:plan §W10.1 写 4 templates .yaml,但为避免新依赖,本任务用 .ts 模板(每个文件导出 `TemplateConfig` 对象)。

### 4.2 `TemplateConfig` 类型(W10.1 各模板共用)

模板设计:
```typescript
export interface TemplateConfig {
  /** 模板 id(供 user 选择) */
  id: 'vite-react-ts' | 'nextjs-app' | 'fastapi' | 'go-http'
  /** 模板名(显示用) */
  name: string
  /** 模板描述 */
  description: string
  /** 触发正则(供 regex 匹配) */
  triggers: string[]
  /** dev server 默认端口 */
  devPort: number
  /** docker image 引用 */
  image: string
  /** 模板内的初始文件(由 SandboxBuilder 写入 workspace) */
  files: Array<{ path: string; content: string }>
  /** 启动命令 */
  startCommand: string
  /** 端口暴露列表 */
  exposePorts: number[]
  /** 默认安装的 npm/pip 包 */
  dependencies?: {
    npm?: string[]
    pip?: string[]
    go?: string[]
  }
  /** 估算资源(CPU 核 / 内存 MB) */
  resourceHint?: { cpu: number; memoryMb: number }
}
```

### 4.3 `templates/vite-react-ts.ts`

```typescript
import type { TemplateConfig } from './types'

export const viteReactTs: TemplateConfig = {
  id: 'vite-react-ts',
  name: 'Vite + React + TypeScript',
  description: '快速的前端 SPA 项目,使用 Vite 构建 + React 18 + TypeScript 5',
  triggers: ['vite', 'react', 'spa', '前端', '博客', 'blog', 'frontend', 'react-app'],
  devPort: 5173,
  image: 'pipiclaw/sandbox-base:latest',
  files: [
    {
      path: 'package.json',
      content: `{
  "name": "vite-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc && vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
`,
    },
    {
      path: 'vite.config.ts',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
})
`,
    },
    {
      path: 'tsconfig.json',
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
    },
    {
      path: 'index.html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: 'src/main.tsx',
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: 'src/App.tsx',
      content: `export default function App() {
  return <h1>Hello from Vite + React + TypeScript (PiPiClaw sandbox)</h1>
}
`,
    },
  ],
  startCommand: 'npm install && npm run dev',
  exposePorts: [5173],
  dependencies: { npm: ['react', 'react-dom'] },
  resourceHint: { cpu: 1, memoryMb: 1024 },
}
```

### 4.4 `templates/nextjs-app.ts`

```typescript
import type { TemplateConfig } from './types'

export const nextjsApp: TemplateConfig = {
  id: 'nextjs-app',
  name: 'Next.js 14 (App Router)',
  description: 'Next.js 14 App Router + TypeScript + React Server Components',
  triggers: ['next', 'nextjs', 'next.js', 'app-router', 'react-server', '全栈', 'ssr', 'seo'],
  devPort: 3000,
  image: 'pipiclaw/sandbox-base:latest',
  files: [
    {
      path: 'package.json',
      content: `{
  "name": "nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 3000",
    "build": "next build",
    "start": "next start -H 0.0.0.0 -p 3000"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  }
}
`,
    },
    {
      path: 'tsconfig.json',
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
    },
    {
      path: 'next.config.mjs',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}
export default nextConfig
`,
    },
    {
      path: 'app/page.tsx',
      content: `export default function Home() {
  return (
    <main>
      <h1>Hello from Next.js 14 (PiPiClaw sandbox)</h1>
    </main>
  )
}
`,
    },
    {
      path: 'app/layout.tsx',
      content: `export const metadata = { title: 'Next.js App', description: 'PiPiClaw sandbox' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    },
  ],
  startCommand: 'npm install && npm run dev',
  exposePorts: [3000],
  dependencies: { npm: ['next', 'react', 'react-dom'] },
  resourceHint: { cpu: 2, memoryMb: 2048 },
}
```

### 4.5 `templates/fastapi.ts`

```typescript
import type { TemplateConfig } from './types'

export const fastapi: TemplateConfig = {
  id: 'fastapi',
  name: 'FastAPI (Python 3.12)',
  description: 'FastAPI + uvicorn + Pydantic v2,RESTful API 项目',
  triggers: ['fastapi', 'python', 'api', '后端', '后端api', 'pydantic', 'uvicorn', 'restful'],
  devPort: 8000,
  image: 'pipiclaw/sandbox-base:latest',
  files: [
    {
      path: 'requirements.txt',
      content: `fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
`,
    },
    {
      path: 'main.py',
      content: `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title='PiPiClaw FastAPI Sandbox')

class Item(BaseModel):
    name: str
    description: str | None = None

@app.get('/')
async def root():
    return {'message': 'Hello from FastAPI (PiPiClaw sandbox)'}

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.post('/items')
async def create_item(item: Item):
    return {'name': item.name, 'description': item.description}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
`,
    },
  ],
  startCommand: 'pip install -r requirements.txt && python main.py',
  exposePorts: [8000],
  dependencies: { pip: ['fastapi', 'uvicorn', 'pydantic'] },
  resourceHint: { cpu: 1, memoryMb: 1024 },
}
```

### 4.6 `templates/go-http.ts`

```typescript
import type { TemplateConfig } from './types'

export const goHttp: TemplateConfig = {
  id: 'go-http',
  name: 'Go HTTP Server',
  description: 'Go 1.23 net/http + 标准库 RESTful API',
  triggers: ['go', 'golang', 'go-http', '后端go', '微服务go', 'restful-go'],
  devPort: 8080,
  image: 'pipiclaw/sandbox-base:latest',
  files: [
    {
      path: 'main.go',
      content: `package main

import (
	"encoding/json"
	"log"
	"net/http"
)

type Item struct {
	Name        string \`json:"name"\`
	Description string \`json:"description,omitempty"\`
}

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Hello from Go HTTP (PiPiClaw sandbox)",
		})
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	http.HandleFunc("/items", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var item Item
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(item)
	})

	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
`,
    },
    {
      path: 'go.mod',
      content: `module pipiclaw-go-sandbox

go 1.23
`,
    },
  ],
  startCommand: 'go run main.go',
  exposePorts: [8080],
  dependencies: { go: [] },
  resourceHint: { cpu: 1, memoryMb: 512 },
}
```

### 4.7 `templates/index.ts` re-export

```typescript
export type { TemplateConfig } from './types'
export { viteReactTs } from './vite-react-ts'
export { nextjsApp } from './nextjs-app'
export { fastapi } from './fastapi'
export { goHttp } from './go-http'
import type { TemplateConfig } from './types'
import { viteReactTs } from './vite-react-ts'
import { nextjsApp } from './nextjs-app'
import { fastapi } from './fastapi'
import { goHttp } from './go-http'

export const ALL_TEMPLATES: TemplateConfig[] = [viteReactTs, nextjsApp, fastapi, goHttp]
```

(注意:`types` 是 .ts interface 抽取,不是单独文件。**把 `TemplateConfig` interface 写到 `templates/types.ts`**,templates/index.ts 从 './types' 导入。)

### 4.8 `templates/types.ts`(额外新增 1 文件,plan 未列但需要)

```typescript
export interface TemplateConfig {
  id: 'vite-react-ts' | 'nextjs-app' | 'fastapi' | 'go-http'
  name: string
  description: string
  triggers: string[]
  devPort: number
  image: string
  files: Array<{ path: string; content: string }>
  startCommand: string
  exposePorts: number[]
  dependencies?: {
    npm?: string[]
    pip?: string[]
    go?: string[]
  }
  resourceHint?: { cpu: number; memoryMb: number }
}
```

(共 7 文件 = 4 templates + 1 types + 1 index + 1 SandboxBuilder)

### 4.9 `SandboxBuilder.ts`

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { WorkspaceManager, Workspace } from './workspace'
import { ALL_TEMPLATES, TemplateConfig } from './templates'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

export interface BuildOptions {
  /** 用户自然语言描述 */
  prompt: string
  /** 显式指定模板(默认自动 regex 匹配) */
  templateId?: TemplateConfig['id']
  /** workspace 名(可选) */
  workspaceName?: string
}

export interface BuildResult {
  ok: boolean
  workspace?: Workspace
  template?: TemplateConfig
  /** 模板选择依据(自动匹配 or 显式指定) */
  templateReason: 'auto-regex' | 'explicit' | 'default' | 'none'
  /** 写入的文件数 */
  fileCount?: number
  durationMs: number
  error?: string
}

/**
 * SandboxBuilder: 根据用户 prompt 选择模板 + 写入 workspace
 * W10 阶段:只做模板选择 + 文件写入,不真跑 docker run
 * W11+ 阶段:与 WebContainerRunner / PortForwarder 接通
 */
export class SandboxBuilder {
  private static instance: SandboxBuilder
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private workspaceManager = WorkspaceManager.getInstance()

  private constructor() {}

  public static getInstance(): SandboxBuilder {
    if (!SandboxBuilder.instance) SandboxBuilder.instance = new SandboxBuilder()
    return SandboxBuilderBuilder.instance
  }

  /** 选模板(regex 匹配) */
  selectTemplate(prompt: string, explicitId?: TemplateConfig['id']): { template: TemplateConfig | undefined; reason: BuildResult['templateReason'] } {
    if (explicitId) {
      const t = ALL_TEMPLATES.find(x => x.id === explicitId)
      if (t) return { template: t, reason: 'explicit' }
    }
    // regex 匹配
    for (const t of ALL_TEMPLATES) {
      for (const trig of t.triggers) {
        try {
          const re = new RegExp(trig, 'i')
          if (re.test(prompt)) return { template: t, reason: 'auto-regex' }
        } catch {
          continue
        }
      }
    }
    // 默认 vite-react-ts
    return { template: viteReactTs, reason: 'default' }
  }

  /** 主入口:build */
  async build(opts: BuildOptions): Promise<BuildResult> {
    const startMs = Date.now()
    try {
      // 1. 选模板
      const sel = this.selectTemplate(opts.prompt, opts.templateId)
      if (!sel.template) {
        return { ok: false, templateReason: 'none', durationMs: Date.now() - startMs, error: 'no template matched' }
      }
      const template = sel.template

      // 2. 建 workspace
      const workspace = this.workspaceManager.createWorkspace({ name: opts.workspaceName ?? `ws-${template.id}-${randomUUID().slice(0, 6)}`, type: 'project' })

      // 3. 写文件
      let fileCount = 0
      for (const file of template.files) {
        const filePath = path.join(workspace.hostPath, file.path)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, file.content, 'utf-8')
        fileCount += 1
      }

      this.log.info(`SandboxBuilder: ${template.id} → workspace ${workspace.id} (${fileCount} files, ${sel.reason})`)
      void this.bus.publish('sandbox:build:completed', { workspaceId: workspace.id, templateId: template.id, fileCount, reason: sel.reason })

      return {
        ok: true,
        workspace,
        template,
        templateReason: sel.reason,
        fileCount,
        durationMs: Date.now() - startMs,
      }
    } catch (e) {
      this.log.error('SandboxBuilder: build failed', e)
      return { ok: false, templateReason: 'none', durationMs: Date.now() - startMs, error: String(e) }
    }
  }

  /** 列出所有可用模板 */
  listTemplates(): TemplateConfig[] {
    return [...ALL_TEMPLATES]
  }
}
```

**注意**:`new SandboxBuilderBuilder.instance` 是 typo(写成了 `SandboxBuilderBuilder`),应改为 `SandboxBuilder.instance`(我指令里写错了,subagent 改对即可)。

### 4.10 自查清单

- [ ] 7 个新文件齐全(SandboxBuilder + 4 templates + types + index)
- [ ] 4 模板各自的 devPort:5173 / 3000 / 8000 / 8080
- [ ] SandboxBuilder.selectTemplate 支持 regex 匹配 + 显式指定 + 默认 vite-react-ts
- [ ] build() 走"选模板 → 建 workspace → 写文件"3 步
- [ ] tsc 0 错 + vitest 84/84

### 4.11 commit

```bash
git add electron/sandbox/SandboxBuilder.ts electron/sandbox/templates/
git commit -m "feat(sandbox) SandboxBuilder plus 4 templates vite next fastapi go"
```

---

## 5. Task W10.2 — network 白名单 + 资源限额(1 commit)

### 5.1 文件清单

```
electron/sandbox/networkPolicy.ts       (~120 行)
electron/sandbox/resourceLimits.ts      (~130 行)
```

### 5.2 `networkPolicy.ts`

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export type NetworkDomainCategory = 'package-manager' | 'ai-api' | 'web-content' | 'custom'

export interface NetworkWhitelistEntry {
  /** 域名(host 部分) */
  domain: string
  /** 分类 */
  category: NetworkDomainCategory
  /** 备注 */
  note?: string
  /** 是否启用 */
  enabled: boolean
}

export interface NetworkPolicyConfig {
  /** 默认白名单(包管理器国内镜像) */
  entries: NetworkWhitelistEntry[]
  /** 是否阻断所有外网(总开关) */
  blockAll: boolean
  /** AI API 通过 settings 配置(独立白名单) */
  aiApiDomains: string[]
}

const DEFAULT_CONFIG: NetworkPolicyConfig = {
  blockAll: false,
  aiApiDomains: ['api.openai.com', 'api.anthropic.com', 'open.bigmodel.cn', 'dashscope.aliyuncs.com'],
  entries: [
    // npm 镜像
    { domain: 'registry.npmmirror.com', category: 'package-manager', note: 'npm cn mirror', enabled: true },
    { domain: 'registry.npmjs.org', category: 'package-manager', note: 'npm official', enabled: true },
    // pypi 镜像
    { domain: 'pypi.tuna.tsinghua.edu.cn', category: 'package-manager', note: 'pypi tuna mirror', enabled: true },
    { domain: 'pypi.org', category: 'package-manager', note: 'pypi official', enabled: true },
    // maven 镜像
    { domain: 'maven.aliyun.com', category: 'package-manager', note: 'maven aliyun', enabled: true },
    { domain: 'repo.maven.apache.org', category: 'package-manager', note: 'maven official', enabled: true },
    // go proxy
    { domain: 'goproxy.cn', category: 'package-manager', note: 'goproxy cn', enabled: true },
    { domain: 'goproxy.io', category: 'package-manager', note: 'goproxy io', enabled: true },
    { domain: 'proxy.golang.org', category: 'package-manager', note: 'go official', enabled: true },
  ],
}

export class NetworkPolicy {
  private static instance: NetworkPolicy
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private storePath: string
  private config: NetworkPolicyConfig

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'network-policy.json')
    this.config = this.loadFromDisk()
  }

  public static getInstance(): NetworkPolicy {
    if (!NetworkPolicy.instance) NetworkPolicy.instance = new NetworkPolicy()
    return NetworkPolicy.instance
  }

  /** 判断某 host 是否被允许 */
  isAllowed(host: string): boolean {
    if (this.config.blockAll) return false
    // AI API
    if (this.config.aiApiDomains.includes(host)) return true
    // 白名单
    return this.config.entries.some(e => e.enabled && e.domain === host)
  }

  /** 添加白名单 */
  addEntry(entry: NetworkWhitelistEntry): void {
    this.config.entries.push(entry)
    this.persistToDisk()
    this.log.info(`NetworkPolicy: add ${entry.domain}`)
  }

  /** 移除白名单 */
  removeEntry(domain: string): boolean {
    const idx = this.config.entries.findIndex(e => e.domain === domain)
    if (idx < 0) return false
    this.config.entries.splice(idx, 1)
    this.persistToDisk()
    return true
  }

  /** 列出所有 */
  list(): NetworkWhitelistEntry[] {
    return [...this.config.entries]
  }

  /** 阻断开关 */
  setBlockAll(blockAll: boolean): void {
    this.config.blockAll = blockAll
    this.persistToDisk()
    this.log.warn(`NetworkPolicy: blockAll = ${blockAll}`)
  }

  isBlockAll(): boolean {
    return this.config.blockAll
  }

  private loadFromDisk(): NetworkPolicyConfig {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      }
    } catch (e) {
      this.log.warn('NetworkPolicy: load failed', e)
    }
    return { ...DEFAULT_CONFIG }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.config, null, 2))
    } catch (e) {
      this.log.warn('NetworkPolicy: persist failed', e)
    }
  }
}
```

### 5.3 `resourceLimits.ts`

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface ResourceLimits {
  /** CPU 核数(0.5 / 1 / 2) */
  cpuCores: number
  /** 内存限制(MB) */
  memoryMb: number
  /** 磁盘限制(MB) */
  diskMb: number
  /** 超时(分钟) */
  timeoutMinutes: number
  /** 最大并发 sandbox 数 */
  maxConcurrent: number
}

const DEFAULT_LIMITS: ResourceLimits = {
  cpuCores: 2,
  memoryMb: 4096,
  diskMb: 10_240,
  timeoutMinutes: 30,
  maxConcurrent: 3,
}

export class ResourceLimitsManager {
  private static instance: ResourceLimitsManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private storePath: string
  private limits: ResourceLimits
  private activeSandboxes: Set<string> = new Set()

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'resource-limits.json')
    this.limits = this.loadFromDisk()
  }

  public static getInstance(): ResourceLimitsManager {
    if (!ResourceLimitsManager.instance) ResourceLimitsManager.instance = new ResourceLimitsManager()
    return ResourceLimitsManager.instance
  }

  get(): ResourceLimits {
    return { ...this.limits }
  }

  set(patch: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...patch }
    this.persistToDisk()
    this.log.info('ResourceLimitsManager: updated')
  }

  reset(): void {
    this.limits = { ...DEFAULT_LIMITS }
    this.persistToDisk()
  }

  /** 申请资源(返回 ok / reason) */
  acquire(sandboxId: string): { ok: boolean; reason?: string } {
    if (this.activeSandboxes.size >= this.limits.maxConcurrent) {
      void this.bus.publish('resource:denied', { reason: 'max-concurrent', active: this.activeSandboxes.size })
      return { ok: false, reason: `max concurrent ${this.limits.maxConcurrent} reached` }
    }
    this.activeSandboxes.add(sandboxId)
    void this.bus.publish('resource:acquired', { sandboxId, active: this.activeSandboxes.size })
    return { ok: true }
  }

  /** 释放资源 */
  release(sandboxId: string): void {
    this.activeSandboxes.delete(sandboxId)
    void this.bus.publish('resource:released', { sandboxId, active: this.activeSandboxes.size })
  }

  /** 当前活动 sandbox 数 */
  activeCount(): number {
    return this.activeSandboxes.size
  }

  /** 超时换算 */
  timeoutMs(): number {
    return this.limits.timeoutMinutes * 60 * 1000
  }

  private loadFromDisk(): ResourceLimits {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      }
    } catch (e) {
      this.log.warn('ResourceLimitsManager: load failed', e)
    }
    return { ...DEFAULT_LIMITS }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.limits, null, 2))
    } catch (e) {
      this.log.warn('ResourceLimitsManager: persist failed', e)
    }
  }
}
```

### 5.4 自查清单

- [ ] 2 个文件齐全
- [ ] NetworkPolicy:isAllowed / addEntry / removeEntry / list / setBlockAll
- [ ] NetworkPolicy 默认 9 个包管理镜像 + 4 个 AI API
- [ ] ResourceLimitsManager:get / set / reset / acquire / release / activeCount
- [ ] 默认 limits:2cpu / 4GB / 10GB / 30min / 3 并发
- [ ] tsc 0 错

### 5.5 commit

```bash
git add electron/sandbox/networkPolicy.ts electron/sandbox/resourceLimits.ts
git commit -m "feat(sandbox) network whitelist plus resource limits 2cpu 4gb 10gb 30min"
```

---

## 6. Task W10.3 — selfcheck 脚本(1 commit)

### 6.1 文件清单

```
scripts/sandbox-selfcheck.mjs    (~100 行)
package.json    (末尾追加 1 script)
```

### 6.2 `scripts/sandbox-selfcheck.mjs`

```javascript
#!/usr/bin/env node
/**
 * PiPiClaw sandbox selfcheck 脚本
 * 用法: pnpm sandbox:selfcheck  或  node scripts/sandbox-selfcheck.mjs
 * 
 * 5 项检查:
 * 1. docker installed (docker --version)
 * 2. docker daemon up (docker info)
 * 3. base image exists (docker image inspect pipiclaw/sandbox-base:latest)
 * 4. can run hello (docker run hello-world,timeout 30s)
 * 5. self-test L1 (本地 SandboxL1 stub 不可用,标记 skip)
 */

import { execSync, spawnSync } from 'node:child_process'

const results = []

function check(name, fn) {
  const startMs = Date.now()
  try {
    const ok = fn()
    results.push({ name, ok: !!ok, durationMs: Date.now() - startMs, error: ok ? undefined : 'returned false' })
  } catch (e) {
    results.push({ name, ok: false, durationMs: Date.now() - startMs, error: String(e.message ?? e) })
  }
}

// 1. docker installed
check('docker-installed', () => {
  const out = execSync('docker --version', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim()
  console.log(`  → ${out}`)
  return true
})

// 2. docker daemon up
check('docker-daemon-up', () => {
  const out = execSync('docker info 2>&1', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
  if (out.toLowerCase().includes('cannot connect') || out.toLowerCase().includes('permission denied')) {
    throw new Error('daemon down or permission denied')
  }
  console.log(`  → daemon OK`)
  return true
})

// 3. base image exists
check('base-image-exists', () => {
  try {
    execSync('docker image inspect pipiclaw/sandbox-base:latest', { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 })
    console.log('  → image exists')
    return true
  } catch {
    console.log('  → image NOT found (W9 阶段可能未 build,可用 sandbox:build-base 构建)')
    return false  // 算 not-ok
  }
})

// 4. can run hello
check('can-run-hello', () => {
  const r = spawnSync('docker', ['run', '--rm', 'hello-world'], { encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' })
  if (r.status !== 0) throw new Error(`docker run hello-world exit ${r.status}: ${r.stderr?.slice(0, 200)}`)
  console.log('  → hello-world ok')
  return true
})

// 5. L1 self-test (本任务标记 skip,真测在 L1 platform 上做)
check('l1-self-test', () => {
  const platform = process.platform
  console.log(`  → platform=${platform} (L1 self-test W10 阶段 skip,W11+ 评估)`)
  return false  // 算 not-ok(W10 stub)
})

// 汇总
const okCount = results.filter(r => r.ok).length
const totalCount = results.length
const passRate = (okCount / totalCount * 100).toFixed(0)

console.log()
console.log('========== sandbox selfcheck ==========')
for (const r of results) {
  const mark = r.ok ? '✅' : '❌'
  const note = r.error ? ` (${r.error.slice(0, 80)})` : ''
  console.log(`  ${mark} ${r.name.padEnd(25)} ${r.durationMs}ms${note}`)
}
console.log('----------------------------------------')
console.log(`  ${okCount}/${totalCount} passed (${passRate}%)`)
console.log('========================================')

// 退出码:全过 → 0;否则 1
process.exit(okCount === totalCount ? 0 : 1)
```

### 6.3 末尾追加 package.json script

读 `package.json`,在 scripts 块末尾(W9.4 既有 `sandbox:build-base` 之后)追加 1 个:

```json
  "sandbox:selfcheck": "node scripts/sandbox-selfcheck.mjs",
```

(注意:加在最末尾,逗号接上一个 script,**`};` 之前**)

### 6.4 自查清单

- [ ] 1 个新脚本 + 1 改(package.json 末尾追加 1 script)
- [ ] 5 检查:docker installed / daemon up / base image exists / can run hello / L1 self-test
- [ ] 默认 L1 self-test 返回 false(W10 stub)
- [ ] 退出码 0/1 区分 pass/fail
- [ ] 既有 11 个 scripts 0 改动
- [ ] tsc 0 错(vitest 84/84 不变)

### 6.5 commit

```bash
git add scripts/sandbox-selfcheck.mjs package.json
git commit -m "chore(sandbox) selfcheck script 5 checks"
```

---

## 7. subagent 工作流

```
1. Read 任务指令(本文件)
2. cd D:\pipiclaw\piclaw
3. 跑 git status 确认干净
4. Read 关键文件校准:
   - electron/sandbox/ 目录(确认 W9 已就位 8 文件)
   - package.json scripts 块(W9.4 加了 sandbox:build-base,本任务末尾追加 1 个)
5. W10.1: 写 SandboxBuilder + 4 templates .ts + types + index → tsc + vitest → 1 commit
6. W10.2: 写 networkPolicy + resourceLimits → tsc + vitest → 1 commit
7. W10.3: 写 selfcheck.mjs + 末尾追加 1 package script → tsc + vitest → 1 commit
8. 最终 git log + 报告
```

---

## 8. 完成报告(返回内容)

1. **3 commit hash**(从 git log 读)
2. tsc 错误数(应保持 0)
3. vitest 通过数(应保持 84)
4. electron/sandbox/ 目录文件总数(应从 9 → 16:8 既有 W9 + 7 W10.1 + 2 W10.2 = 17 个 .ts 业务文件 + 模板目录)
5. scripts 目录新文件: `sandbox-selfcheck.mjs`
6. 关键决策 / 难题 / 遗留未改项

---

## 9. 禁止事项

- **不引入** 任何新 npm 依赖
- **不修改** ChatManager / IpcServer / preload / tokens / variables / contracts
- **不修改** 既有 view / component / store / SideNav
- **不修改** 既有 sandbox 业务代码(W9 8 文件 0 改动)
- **不修改** package.json 既有 11 个 scripts(只末尾追加 1)
- **不真跑** docker build / docker run(脚本只检查状态)
- **不删除** / 不重命名任何文件
- **不跑 npm install**

---

## 10. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git log --oneline -4` 看 3 commit + 1 docs
2. `npx vitest run` 确认 84/84
3. `npx tsc --noEmit` 确认 0 错
4. 报告 W10 整体结果