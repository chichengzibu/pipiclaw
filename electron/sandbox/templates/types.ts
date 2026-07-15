/**
 * PiPiClaw - 模板配置类型(W10.1)
 *
 * 4 个内置模板(vite-react-ts / nextjs-app / fastapi / go-http)共用此类型
 */

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
