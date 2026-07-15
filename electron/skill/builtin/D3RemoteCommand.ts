/**
 * PiPiClaw - Skill / D3RemoteCommand (W7.4)
 *
 * 飞书"帮我查今天日程" → 调 CalendarConnector → 回复飞书。
 * W7 阶段:demo 用 AgentBrain stub。W8+ 接真实 AgentBrain think + LLM。
 */

import { LogManager } from '../../core/LogManager'
import { ChannelRouter } from '../../channel/ChannelRouter'
import { CalendarConnector } from '../../connector/CalendarConnector'
import { AgentBrainImpl } from '../../agent/AgentBrain'
import { EventBus } from '../../runtime/bridge/EventBus'

export const D3_SKILL_NAME = 'd3:remote-command'

export interface D3Input {
  /** 飞书发来的用户消息 */
  userMessage: string
  /** 飞书 userId */
  userId: string
  /** 飞书 channelId */
  channelId: string
}

/**
 * D3RemoteCommand: 飞书一句话远程指令(W7 stub)。
 */
export async function runD3(input: D3Input): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const log = LogManager.getInstance()
  const channelRouter = ChannelRouter.getInstance()
  const calendar = new CalendarConnector()
  const brain = AgentBrainImpl.getInstance()

  try {
    // 1. AgentBrain think(判断意图)
    const decision = await brain.think({
      conversationId: input.channelId,
      content: input.userMessage,
    } as unknown as Parameters<typeof brain.think>[0])

    // 2. 根据 user message 调 Calendar(简化:固定调 list_today)
    let replyText = ''
    if (/日程|schedule|today|今天/i.test(input.userMessage)) {
      const result = await calendar.execute({ verb: 'list_today', args: {} }, { userId: input.userId })
      if (result.ok) {
        const events = result.data as Array<{ title: string; start: string; end: string }>
        replyText = `今日日程:\n${events.map(e => `- ${e.start}-${e.end} ${e.title}`).join('\n')}`
      } else {
        replyText = `查询失败: ${result.error}`
      }
    } else {
      replyText = `(stub) AgentBrain 决策: ${JSON.stringify(decision)}`
    }

    // 3. 发送回飞书
    const sendResult = await channelRouter.send(input.channelId, { to: input.userId, text: replyText })
    if (!sendResult.ok) {
      log.warn('D3RemoteCommand: 飞书发送失败', sendResult.error)
    }

    void EventBus.getInstance().publish(
      'd3:remote:completed',
      { userId: input.userId, reply: replyText },
      'D3RemoteCommand',
    )
    return { ok: true, reply: replyText }
  } catch (e) {
    log.error('D3RemoteCommand: 失败', e)
    return { ok: false, error: String(e) }
  }
}

export const d3SkillHandler = {
  name: D3_SKILL_NAME,
  description: '飞书一句话远程指令(W7 stub)',
  requiresPermission: false,
  async execute(args: D3Input) {
    return runD3(args)
  },
}