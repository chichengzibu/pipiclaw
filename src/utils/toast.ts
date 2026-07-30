/**
 * PiPiClaw - Toast提示工具
 * 轻量提示功能
 */
import { ElMessage } from 'element-plus'

/**
 * 显示待开发提示
 */
export function showTodoToast(text: string = '功能开发中…') {
  ElMessage.info(text)
}

/**
 * 快捷Toast方法
 */
export const toast = {
  success: (msg: string) => ElMessage.success(msg),
  warning: (msg: string) => ElMessage.warning(msg),
  error: (msg: string) => ElMessage.error(msg),
  info: (msg: string) => ElMessage.info(msg),
  todo: showTodoToast
}

export default toast
