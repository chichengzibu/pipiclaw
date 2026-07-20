/**
 * PiPiClaw - 对话导出工具
 * 
 * 职责：
 * 1. 将会话内容导出为Markdown/PDF/Word格式
 * 2. 前置对接PermissionManager做权限校验
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { LogManager } from '../core/LogManager';
import { PermissionManager } from '../permissions/PermissionManager';
import type { Conversation, ChatMessage } from '../chat/ChatTypes';

export interface ExportOptions {
  format: 'markdown' | 'pdf' | 'word';
  outputPath: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  guidance?: string;
}

export class ConversationExporter {
  private static instance: ConversationExporter;
  private log = LogManager.getInstance();
  private permissionManager: PermissionManager;

  private constructor() {
    this.permissionManager = PermissionManager.getInstance();
  }

  public static getInstance(): ConversationExporter {
    if (!ConversationExporter.instance) {
      ConversationExporter.instance = new ConversationExporter();
    }
    return ConversationExporter.instance;
  }

  /**
   * 导出对话
   */
  public async exportConversation(
    conversation: Conversation,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      let outputPath = options.outputPath;
      
      if (!outputPath) {
        const downloadsPath = app.getPath('downloads');
        const timestamp = new Date().getTime();
        const safeTitle = conversation.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 20);
        
        switch (options.format) {
          case 'markdown':
            outputPath = path.join(downloadsPath, `${safeTitle}_${timestamp}.md`);
            break;
          case 'pdf':
            outputPath = path.join(downloadsPath, `${safeTitle}_${timestamp}.pdf`);
            break;
          case 'word':
            outputPath = path.join(downloadsPath, `${safeTitle}_${timestamp}.docx`);
            break;
        }
      }

      const dir = path.dirname(outputPath);
      const permCheck = this.permissionManager.checkPermission({
        category: 'filesystem',
        action: 'write',
        resource: dir
      });

      if (!permCheck.allowed) {
        return {
          success: false,
          error: `无写入权限: ${permCheck.reason}`,
          guidance: '请在权限管理中启用「文件系统」的「写入」权限'
        };
      }

      let content: string;
      
      switch (options.format) {
        case 'markdown':
          content = this.generateMarkdown(conversation);
          fs.writeFileSync(outputPath, content, 'utf-8');
          break;
        case 'pdf':
          content = this.generateMarkdown(conversation);
          await this.generatePdf(content, outputPath);
          break;
        case 'word':
          content = this.generateMarkdown(conversation);
          await this.generateWord(content, outputPath);
          break;
      }

      this.log.info('[ConversationExporter] 导出成功:', outputPath);
      return { success: true, filePath: outputPath };

    } catch (error: any) {
      this.log.error('[ConversationExporter] 导出失败:', error);
      return {
        success: false,
        error: error.message || '导出失败'
      };
    }
  }

  /**
   * 生成Markdown内容
   */
  private generateMarkdown(conversation: Conversation): string {
    const lines: string[] = [];
    
    lines.push(`# ${conversation.title}`);
    lines.push('');
    lines.push(`**创建时间:** ${new Date(conversation.createdAt).toLocaleString('zh-CN')}`);
    lines.push(`**模型:** ${conversation.modelId || '未指定'}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const message of conversation.messages) {
      const roleIcon = message.role === 'user' ? '👤' : '🤖';
      const roleName = message.role === 'user' ? '用户' : 'AI';
      const time = new Date(message.timestamp).toLocaleString('zh-CN');
      
      lines.push(`### ${roleIcon} ${roleName} - ${time}`);
      lines.push('');

      if (message.thinking) {
        lines.push('**思考过程:**');
        lines.push('```');
        lines.push(message.thinking);
        lines.push('```');
        lines.push('');
      }

      const content = message.content || '(无内容)';
      lines.push(content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('');
    lines.push(`*导出时间: ${new Date().toLocaleString('zh-CN')}*`);
    
    return lines.join('\n');
  }

  /**
   * 生成PDF（简化版，实际项目可能需要用puppeteer或jspdf）
   */
  private async generatePdf(markdownContent: string, outputPath: string): Promise<void> {
    const html = this.markdownToHtml(markdownContent);
    fs.writeFileSync(outputPath.replace('.pdf', '.html'), html, 'utf-8');
    this.log.warn('[ConversationExporter] PDF导出需要额外的PDF库，当前保存为HTML');
  }

  /**
   * 生成Word（简化版，实际项目可能需要用docx库）
   */
  private async generateWord(markdownContent: string, outputPath: string): Promise<void> {
    const html = this.markdownToHtml(markdownContent);
    const docContent = this.htmlToWord(html, outputPath.replace('.docx', '.html'));
    fs.writeFileSync(outputPath.replace('.docx', '.html'), docContent, 'utf-8');
    this.log.warn('[ConversationExporter] Word导出需要额外的库，当前保存为HTML');
  }

  /**
   * Markdown转HTML
   */
  private markdownToHtml(markdown: string): string {
    const html = markdown
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/---/g, '<hr>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>对话导出</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1, h2, h3 { color: #333; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'Consolas', monospace; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    .meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
  }

  /**
   * HTML转Word格式
   */
  private htmlToWord(html: string, title: string): string {
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
    </w:WordDocument>
  </xml>
  <![endif]-->
</head>
<body>
  ${html}
</body>
</html>`;
  }
}