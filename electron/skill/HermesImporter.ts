import { LogManager } from '../core/LogManager'
import { HermesMemory } from '../hermes/HermesMemory'

/**
 * HermesImporter: 在新建 skill 时,从 Hermes 读出相关历史记忆,作为 skill 的额外上下文。
 * W6 阶段:简单调 HermesMemory.retrieveRelevantMemories,返回 top-5 记忆拼接成 markdown
 */
export class HermesImporter {
  private static instance: HermesImporter
  private log = LogManager.getInstance()
  private hermes = HermesMemory.getInstance()

  private constructor() {}

  public static getInstance(): HermesImporter {
    if (!HermesImporter.instance) HermesImporter.instance = new HermesImporter()
    return HermesImporter.instance
  }

  importContext(query: string, limit = 5): string {
    const memories = this.hermes.retrieveRelevantMemories(query, limit)
    if (memories.length === 0) return ''
    let md = '\n## Hermes 关联记忆\n\n'
    for (let i = 0; i < memories.length; i++) {
      const m = memories[i]
      const snippet = m.content.length > 80 ? m.content.slice(0, 80) + '...' : m.content
      md += `- [memory-${i + 1}] importance=${m.importance ?? 30} - ${snippet}\n`
    }
    return md
  }
}