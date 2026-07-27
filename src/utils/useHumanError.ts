/**
 * PiPiClaw - useHumanError (P2-T4.2 UI 集成)
 *
 * 把 humanizeError() 集成进 ElMessage, 用户看到的错误更友好 + 带跳转提示
 *
 * 用法:
 *   import { useHumanError } from '@/utils/useHumanError'
 *   const { showError } = useHumanError()
 *   try { ... } catch (e) { showError(e) }
 *
 *   // 或带跳转按钮 (路由)
 *   showErrorWithRoute(e, '/models', '去配置模型')
 */
import { ElMessage, ElMessageBox } from 'element-plus'
import { humanizeError, type HumanizedError } from './humanizeError'

export interface ShowErrorOpts {
  /** 自定义标题 (默认 '出错了') */
  title?: string
  /** 静默模式: 只 log 不弹窗 */
  silent?: boolean
  /** 二次确认: 用 ElMessageBox (大对话框) 而非 ElMessage (轻提示) */
  modal?: boolean
}

export function useHumanError() {
  /**
   * 把任意错误转 HumanizedError
   */
  function toHuman(err: unknown): HumanizedError {
    if (err && typeof err === 'object' && 'kind' in err && 'userMessage' in err) {
      return err as HumanizedError
    }
    return humanizeError(err)
  }

  /**
   * 轻提示 (ElMessage.error)
   */
  function showError(err: unknown, opts: ShowErrorOpts = {}): HumanizedError {
    const h = toHuman(err)
    if (opts.silent) {
      console.error('[humanError]', h)
      return h
    }
    if (h.action?.route) {
      // 带路由跳转: 用 modal + confirm
      if (opts.modal) {
        ElMessageBox.confirm(`${h.userMessage}\n\n${h.hint ?? ''}`, opts.title ?? '出错了', {
          confirmButtonText: h.action.label,
          cancelButtonText: '取消',
          type: 'warning',
        })
          .then(() => {
            window.location.hash = `#${h.action!.route}`
          })
          .catch(() => {})
      } else {
        ElMessage({
          type: 'error',
          message: h.hint ? `${h.userMessage}\n${h.hint}` : h.userMessage,
          duration: 5000,
          grouping: true,
        })
      }
    } else {
      ElMessage({
        type: 'error',
        message: h.hint ? `${h.userMessage}\n${h.hint}` : h.userMessage,
        duration: 4000,
        grouping: true,
      })
    }
    return h
  }

  /**
   * 带路由跳转的错误提示 (用户点击按钮跳转)
   */
  function showErrorWithRoute(
    err: unknown,
    route: string,
    actionLabel: string,
    title?: string,
  ): HumanizedError {
    const h = toHuman(err)
    ElMessageBox.confirm(`${h.userMessage}\n\n${h.hint ?? ''}`, title ?? '出错了', {
      confirmButtonText: actionLabel,
      cancelButtonText: '取消',
      type: 'warning',
    })
      .then(() => {
        window.location.hash = `#${route}`
      })
      .catch(() => {})
    return h
  }

  return {
    showError,
    showErrorWithRoute,
    humanize: toHuman,
  }
}