/**
 * PiPiClaw - Connector / CalendarConnector (W7.4 stub)
 *
 * 日历连接器。W7 阶段:stub 实现 Connector 接口,W8+ 接真实 Calendar API。
 * 提供 4 个常见 verb:
 *  - list_today: 列出今日日程
 *  - list_upcoming: 列出 N 天内日程
 *  - add_event: 添加日程
 *  - find_free_slot: 找空闲时段
 */

import { LogManager } from '../core/LogManager'
import type {
  Connector,
  ConnectorIntent,
  ConnectorContext,
  ConnectorResult,
} from '../contracts/types'

export class CalendarConnector implements Connector {
  public readonly id: string = 'calendar'
  private log = LogManager.getInstance()

  async execute(
    intent: ConnectorIntent,
    _ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    this.log.info(`CalendarConnector: execute ${intent.verb} (stub)`)
    switch (intent.verb) {
      case 'list_today':
        return {
          ok: true,
          data: [
            { id: 'e1', title: '今日会议', start: '10:00', end: '11:00' },
            { id: 'e2', title: '午休', start: '12:00', end: '13:00' },
            { id: 'e3', title: '项目复盘', start: '15:00', end: '16:00' },
          ],
        }
      case 'list_upcoming': {
        const days = (intent.args.days as number) ?? 7
        return {
          ok: true,
          data: [
            { id: 'e1', title: '明日', start: 'tomorrow 09:00' },
            { id: 'e2', title: '本周会议', start: 'Friday 14:00' },
            { id: 'e3', title: `接下来 ${days} 天内还有 3 个日程`, start: 'W8+ stub' },
          ],
        }
      }
      case 'add_event':
        return {
          ok: true,
          data: { id: 'new-' + Date.now(), title: intent.args.title, start: intent.args.start },
        }
      case 'find_free_slot': {
        const duration = (intent.args.duration as number) ?? 60
        return { ok: true, data: { slot: '14:00-15:00', durationMinutes: duration } }
      }
      default:
        return { ok: false, error: `unknown verb: ${intent.verb}` }
    }
  }
}