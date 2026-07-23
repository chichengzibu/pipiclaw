/**
 * PiPiClaw - 错误人话化工具 (P4-T4.2)
 *
 * 把技术错误(EADDRINUSE / 401 / etc)翻译成用户能懂的提示。
 * 配套 use:
 *   const { userMessage, hint, action } = humanizeError(new Error('ECONNREFUSED 127.0.0.1:11434'))
 *   showToast(userMessage)
 */

export interface HumanizedError {
  /** 给用户看的主消息 */
  userMessage: string
  /** 简短提示(下一步) */
  hint?: string
  /** 建议的操作(可执行) */
  action?: { label: string; command?: string; route?: string }
  /** 原始错误(供日志) */
  raw: string
  /** 错误分类 */
  kind: 'network' | 'auth' | 'permission' | 'rate-limit' | 'config' | 'not-found' | 'oom' | 'unknown'
}

const PATTERNS: Array<{
  test: RegExp
  kind: HumanizedError['kind']
  userMessage: string
  hint?: string
  action?: HumanizedError['action']
}> = [
  {
    test: /ECONNREFUSED|connection refused|connect ECONNREFUSED/i,
    kind: 'network',
    userMessage: '本地服务没起来,连不上',
    hint: '检查目标地址和端口,或启动对应服务',
  },
  {
    test: /ENOTFOUND|getaddrinfo|dns/i,
    kind: 'network',
    userMessage: '找不到服务器(DNS 解析失败)',
    hint: '检查网络连接,或换个 DNS',
  },
  {
    test: /ETIMEDOUT|timeout|timed out/i,
    kind: 'network',
    userMessage: '请求超时,服务没在限定时间内回应',
    hint: '网络慢,或服务在忙。可以稍后重试',
  },
  {
    test: /EADDRINUSE|address already in use/i,
    kind: 'network',
    userMessage: '端口已被占用,启不起来',
    hint: '关掉占用端口的进程,或换个端口',
  },
  {
    test: /401|unauthorized|invalid api key|authentication/i,
    kind: 'auth',
    userMessage: 'API Key 不对,或没填',
    hint: '去 Settings → LLM 配置 检查 API Key',
    action: { label: '打开 LLM 配置', route: '/settings/llm-config' },
  },
  {
    test: /403|forbidden|permission denied/i,
    kind: 'permission',
    userMessage: '权限不够,操作被拒绝',
    hint: '检查账号权限,或找管理员开权限',
  },
  {
    test: /429|rate limit|quota/i,
    kind: 'rate-limit',
    userMessage: '请求太快,被限流了',
    hint: '稍等 1-2 分钟,或升级套餐',
  },
  {
    test: /404|not found|ENOENT/i,
    kind: 'not-found',
    userMessage: '找不到资源(文件 / API / 页面)',
    hint: '检查路径是否正确,或文件还在不在',
  },
  {
    test: /OOM|out of memory|ENOMEM|cannot allocate/i,
    kind: 'oom',
    userMessage: '内存爆了,任务被系统杀掉',
    hint: '减小数据规模,或关闭其他应用释放内存',
  },
  {
    test: /no.*provider|apiKey missing|not configured/i,
    kind: 'config',
    userMessage: '还没配置 LLM provider',
    hint: '先去 Settings → LLM 配置 添加 provider',
    action: { label: '打开 LLM 配置', route: '/settings/llm-config' },
  },
]

/**
 * 把任意错误转成 HumanizedError
 */
export function humanizeError(err: unknown): HumanizedError {
  const raw = err instanceof Error ? err.message : String(err)
  for (const p of PATTERNS) {
    if (p.test.test(raw)) {
      return {
        userMessage: p.userMessage,
        hint: p.hint,
        action: p.action,
        raw,
        kind: p.kind,
      }
    }
  }
  return {
    userMessage: '出错了,详细信息看控制台',
    hint: '如果一直出现,把错误截图给开发者',
    raw,
    kind: 'unknown',
  }
}
