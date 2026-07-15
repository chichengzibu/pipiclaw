/**
 * PiPiClaw - 模板注册表(W10.1)
 *
 * 4 个内置模板:vite-react-ts / nextjs-app / fastapi / go-http
 * 全部以 .ts 形式导出(避免引入 yaml 解析新依赖)
 */

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
