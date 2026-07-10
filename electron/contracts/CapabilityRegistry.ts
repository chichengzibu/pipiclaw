/**
 * PiPiClaw - 域间协议注册表(W3 骨架)
 *
 * 职责:
 * 1. 各域启动时调用 register(domain) 把自己挂到 registry
 * 2. LLM Agent / 跨域调用通过 resolve(id) 找到 Capability
 * 3. execute(capabilityId, args, ctx) 执行(包含依赖检查 + 权限校验 + 链路追踪)
 *
 * 本期(W3.2):实现骨架,具体权限/追踪在 W7-W8 接入。
 */

import { LogManager } from '../core/LogManager'
import type { Domain, Capability, ExecutionContext } from './types'

export class CapabilityRegistry {
  private static instance: CapabilityRegistry
  private log = LogManager.getInstance()
  private domains: Map<string, Domain> = new Map()
  private capabilities: Map<string, Capability> = new Map()
  private initialized = false

  private constructor() {}

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry()
    }
    return CapabilityRegistry.instance
  }

  /**
   * 注册一个域(以及其下所有 capabilities)
   * 重复注册同 id 域会覆盖(并打 warn)
   */
  public register(domain: Domain): void {
    if (this.domains.has(domain.id)) {
      this.log.warn(`CapabilityRegistry: 域 ${domain.id} 重复注册,覆盖`)
    }
    this.domains.set(domain.id, domain)
    for (const cap of domain.capabilities) {
      this.capabilities.set(cap.id, cap)
    }
    this.log.info(`CapabilityRegistry: 注册域 ${domain.id} (${domain.capabilities.length} capabilities)`)
  }

  /**
   * 解析一个 capability
   */
  public resolve(capabilityId: string): Capability | undefined {
    return this.capabilities.get(capabilityId)
  }

  /**
   * 列出某域下所有 capability
   */
  public listByDomain(domainId: string): readonly Capability[] {
    return this.domains.get(domainId)?.capabilities ?? []
  }

  /**
   * 列出全部域(用于 Insights 页 / About 页)
   */
  public listDomains(): readonly Domain[] {
    return [...this.domains.values()]
  }

  /**
   * 执行一个 capability
   * W3.2 阶段:只做依赖检查 + 日志
   * W7 之后:加入权限校验 + 链路追踪
   */
  public async execute(
    capabilityId: string,
    args: Record<string, unknown>,
    ctx: ExecutionContext = {}
  ): Promise<unknown> {
    const cap = this.resolve(capabilityId)
    if (!cap) {
      throw new Error(`Capability ${capabilityId} 未注册`)
    }
    // 找 capability 所属域
    const domain = [...this.domains.values()].find(d =>
      d.capabilities.some(c => c.id === capabilityId)
    )
    if (!domain) {
      throw new Error(`Capability ${capabilityId} 所属域未找到`)
    }
    // 依赖检查(递归)
    for (const dep of domain.dependencies) {
      if (!this.domains.has(dep)) {
        this.log.warn(`Capability ${capabilityId} 的依赖域 ${dep} 未注册`)
        // 不 throw,只是 warn,允许部分依赖缺失时仍执行
      }
    }
    this.log.debug(`执行 capability ${capabilityId}`)
    return cap.execute(args, ctx)
  }

  /**
   * 检查启动顺序(返回拓扑排序)
   * 用于 main.ts 启动时按顺序 register 各域
   */
  public getStartupOrder(): readonly string[] {
    const visited = new Set<string>()
    const order: string[] = []

    const visit = (id: string): void => {
      if (visited.has(id)) return
      visited.add(id)
      const dom = this.domains.get(id)
      if (!dom) return
      for (const dep of dom.dependencies) {
        visit(dep)
      }
      order.push(id)
    }

    for (const id of this.domains.keys()) {
      visit(id)
    }
    return order
  }

  /**
   * 重置(测试用)
   */
  public reset(): void {
    this.domains.clear()
    this.capabilities.clear()
    this.initialized = false
  }

  /**
   * 标记初始化完成(main.ts 启动后调用)
   */
  public markInitialized(): void {
    this.initialized = true
    this.log.info(`CapabilityRegistry: 初始化完成,共 ${this.domains.size} 个域, ${this.capabilities.size} 个 capability`)
  }

  public isInitialized(): boolean {
    return this.initialized
  }
}
