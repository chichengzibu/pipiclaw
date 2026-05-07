/**
 * PiPiClaw - 内容安全校验模块
 *
 * 职责：在写入文件前检查内容安全性
 */

import { LogManager } from '../core/LogManager';

/**
 * 校验结果接口
 */
export interface ValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * 内容安全校验器
 */
export class ContentValidator {
  private static log = LogManager.getInstance();

  /**
   * 危险命令模式
   */
  private static readonly DANGEROUS_PATTERNS = {
    pathTraversal: [/\.\.\//g, /\.\.\\/g],
    linuxShell: [
      /\brm\s+-rf\b/i,
      /\bdd\s+if=/i,
      /\bmkfs\b/i,
      /:\(\)\s*\{[^}]*:\|:\s*&\s*;\s*:\s*\}/,
    ],
    windowsBatch: [
      /\bformat\s+[a-z]:/i,
      /\breg\s+(add|delete|edit|import|export)/i,
      /\bdel\s+[a-z]:\\.*\/s/i,
      /\brundll32\s+/i,
    ],
    maxLength: 50000
  };

  /**
   * 从路径提取文件类型
   */
  private static extractFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return ext;
  }

  /**
   * 校验内容安全性
   */
  static sanitize(content: string, filePath: string): ValidationResult {
    this.log.info('[ContentValidator] 开始安全校验', {
      filePath,
      contentLength: content.length
    });

    const fileType = this.extractFileType(filePath);
    this.log.debug('[ContentValidator] 文件类型', { fileType });

    // 1. 检查超大内容
    if (content.length > this.DANGEROUS_PATTERNS.maxLength) {
      const reason = `内容超过限制（当前: ${content.length}字符，最大: ${this.DANGEROUS_PATTERNS.maxLength}字符）`;
      this.log.warn('[ContentValidator] 超大内容被拦截', {
        current: content.length,
        max: this.DANGEROUS_PATTERNS.maxLength
      });
      return { safe: false, reason };
    }

    // 2. 检查路径遍历
    for (const pattern of this.DANGEROUS_PATTERNS.pathTraversal) {
      if (pattern.test(content)) {
        this.log.warn('[ContentValidator] 路径遍历攻击被拦截', { pattern: pattern.toString() });
        return { safe: false, reason: '检测到路径遍历符号(../)，为安全起见，已拦截' };
      }
    }

    // 3. 根据文件类型检查危险命令
    if (fileType === 'sh' || fileType === 'bash') {
      for (const pattern of this.DANGEROUS_PATTERNS.linuxShell) {
        if (pattern.test(content)) {
          this.log.warn('[ContentValidator] Shell危险命令被拦截', { pattern: pattern.toString() });
          return { safe: false, reason: '检测到Shell危险命令，为安全起见，已拦截' };
        }
      }
    }

    if (fileType === 'bat' || fileType === 'cmd' || fileType === 'ps1') {
      for (const pattern of this.DANGEROUS_PATTERNS.windowsBatch) {
        if (pattern.test(content)) {
          this.log.warn('[ContentValidator] Batch/PowerShell危险命令被拦截', { pattern: pattern.toString() });
          return { safe: false, reason: '检测到批处理/PowerShell危险命令，为安全起见，已拦截' };
        }
      }
    }

    this.log.info('[ContentValidator] 安全校验通过');
    return { safe: true };
  }
}
