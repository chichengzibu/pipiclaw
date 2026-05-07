/**
 * PiPiClaw - 文件解析工具
 * 
 * 职责：
 * 1. 读取本地文件内容
 * 2. 解析不同格式文件（图片、Excel、Word、PDF等）
 * 3. 前置对接PermissionManager做权限校验
 */

import * as fs from 'fs';
import * as path from 'path';
import { app, clipboard } from 'electron';
import { LogManager } from '../core/LogManager';
import { PermissionManager } from '../permissions/PermissionManager';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: string;
  content?: string;
  base64?: string;
  mimeType: string;
}

export interface ParseResult {
  success: boolean;
  file?: FileInfo;
  error?: string;
  guidance?: string;
}

const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h',
  '.html', '.css', '.scss', '.vue', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.log', '.csv', '.sql',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico',
  '.pdf',
  '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt'
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.py': 'text/python',
  '.html': 'text/html',
  '.css': 'text/css',
  '.vue': 'text/vue',
  '.xml': 'text/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword'
};

export class FileParser {
  private static instance: FileParser;
  private log = LogManager.getInstance();
  private permissionManager: PermissionManager;

  private constructor() {
    this.permissionManager = PermissionManager.getInstance();
  }

  public static getInstance(): FileParser {
    if (!FileParser.instance) {
      FileParser.instance = new FileParser();
    }
    return FileParser.instance;
  }

  /**
   * 解析文件
   */
  public async parseFile(filePath: string): Promise<ParseResult> {
    try {
      const normalizedPath = this.normalizePath(filePath);
      
      if (!fs.existsSync(normalizedPath)) {
        return {
          success: false,
          error: '文件不存在',
          guidance: '请检查文件路径是否正确'
        };
      }

      const stats = fs.statSync(normalizedPath);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: '不支持读取目录'
        };
      }

      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件大小超过限制（${MAX_FILE_SIZE / 1024 / 1024}MB）`
        };
      }

      const permCheck = this.checkPermission(normalizedPath);
      if (!permCheck.allowed) {
        return {
          success: false,
          error: `无对应文件的读取权限: ${permCheck.reason}`,
          guidance: permCheck.guidance
        };
      }

      const ext = path.extname(normalizedPath).toLowerCase();
      const name = path.basename(normalizedPath);

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return {
          success: false,
          error: `不支持的文件格式: ${ext}`
        };
      }

      const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext);
      const isText = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css', '.vue', '.xml', '.yaml', '.yml', '.csv', '.log'].includes(ext);

      let content: string | undefined;
      let base64: string | undefined;

      if (isImage) {
        const buffer = fs.readFileSync(normalizedPath);
        base64 = buffer.toString('base64');
      } else if (isText) {
        content = fs.readFileSync(normalizedPath, 'utf-8');
      }

      const file: FileInfo = {
        name,
        path: normalizedPath,
        size: stats.size,
        type: ext.replace('.', ''),
        mimeType: MIME_TYPES[ext] || 'application/octet-stream',
        content,
        base64
      };

      this.log.info('[FileParser] 文件解析成功:', normalizedPath);
      return { success: true, file };

    } catch (error: any) {
      this.log.error('[FileParser] 文件解析失败:', error);
      return {
        success: false,
        error: error.message || '文件解析失败'
      };
    }
  }

  /**
   * 批量解析文件
   */
  public async parseFiles(filePaths: string[]): Promise<ParseResult[]> {
    const results: ParseResult[] = [];
    for (const filePath of filePaths) {
      const result = await this.parseFile(filePath);
      results.push(result);
    }
    return results;
  }

  /**
   * 从剪贴板读取图片
   */
  public readImageFromClipboard(): { success: boolean; base64?: string; error?: string } {
    try {
      const image = clipboard.readImage();
      if (image.isEmpty()) {
        return { success: false, error: '剪贴板中没有图片' };
      }

      const buffer = image.toPNG();
      const base64 = buffer.toString('base64');
      
      this.log.info('[FileParser] 从剪贴板读取图片成功');
      return { success: true, base64 };

    } catch (error: any) {
      this.log.error('[FileParser] 从剪贴板读取图片失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取文件信息
   */
  public getFileInfo(filePath: string): { success: boolean; info?: FileInfo; error?: string } {
    try {
      const normalizedPath = this.normalizePath(filePath);
      
      if (!fs.existsSync(normalizedPath)) {
        return { success: false, error: '文件不存在' };
      }

      const stats = fs.statSync(normalizedPath);
      const ext = path.extname(normalizedPath).toLowerCase();
      const name = path.basename(normalizedPath);

      return {
        success: true,
        info: {
          name,
          path: normalizedPath,
          size: stats.size,
          type: ext.replace('.', ''),
          mimeType: MIME_TYPES[ext] || 'application/octet-stream'
        }
      };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查文件权限
   */
  private checkPermission(filePath: string): { allowed: boolean; reason?: string; guidance?: string } {
    const result = this.permissionManager.checkPermission({
      category: 'filesystem',
      action: 'read',
      resource: filePath
    });

    if (!result.allowed) {
      return {
        allowed: false,
        reason: result.reason || '权限不足',
        guidance: '请在权限管理中启用「文件系统」的「读取」权限'
      };
    }

    return { allowed: true };
  }

  /**
   * 规范化路径
   */
  private normalizePath(p: string): string {
    if (!p) return p;
    
    if (p.startsWith('~')) {
      p = p.replace('~', process.env.HOME || process.env.USERPROFILE || '');
    }
    
    p = p.replace(/\\/g, '/');
    
    if (!path.isAbsolute(p)) {
      p = path.resolve(process.cwd(), p);
    }
    
    return p;
  }

  /**
   * 获取支持的文件扩展名
   */
  public getAllowedExtensions(): string[] {
    return Array.from(ALLOWED_EXTENSIONS);
  }

  /**
   * 获取最大文件大小
   */
  public getMaxFileSize(): number {
    return MAX_FILE_SIZE;
  }
}
