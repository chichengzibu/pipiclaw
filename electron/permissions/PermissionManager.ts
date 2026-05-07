/**
 * PiPiClaw - 权限管理器
 * 
 * 职责：
 * 1. 权限集管理（CRUD）
 * 2. 权限检查
 * 3. 权限模板应用
 */

import { LogManager } from '../core/LogManager';
import { PermissionConfig } from './PermissionConfig';
import { 
  PermissionSet, 
  PermissionRule, 
  PermissionCategory, 
  PermissionLevel,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionTemplate
} from './PermissionTypes';

export class PermissionManager {
  private static instance: PermissionManager;
  private log = LogManager.getInstance();
  private config: PermissionConfig;

  private constructor() {
    this.config = PermissionConfig.getInstance();
  }

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  public getAllPermissionSets(): PermissionSet[] {
    return this.config.getAllPermissionSets();
  }

  public getPermissionSet(id: string): PermissionSet | undefined {
    return this.config.getPermissionSet(id);
  }

  public getActivePermissionSet(): PermissionSet | undefined {
    return this.config.getActivePermissionSet();
  }

  public getActiveSetId(): string | null {
    return this.config.getActiveSetId();
  }

  public setActivePermissionSet(id: string): boolean {
    return this.config.setActivePermissionSet(id);
  }

  public createPermissionSet(data: {
    name: string;
    template: PermissionTemplate;
    description: string;
    rules?: PermissionRule[];
  }): PermissionSet {
    return this.config.createPermissionSet(data);
  }

  public updatePermissionSet(id: string, updates: Partial<Omit<PermissionSet, 'id' | 'createdAt'>>): PermissionSet | null {
    return this.config.updatePermissionSet(id, updates);
  }

  public updatePermissionRule(setId: string, ruleId: string, updates: Partial<PermissionRule>): PermissionRule | null {
    return this.config.updatePermissionRule(setId, ruleId, updates);
  }

  public deletePermissionSet(id: string): boolean {
    return this.config.deletePermissionSet(id);
  }

  public duplicatePermissionSet(id: string, newName: string): PermissionSet | null {
    return this.config.duplicatePermissionSet(id, newName);
  }

  public checkPermission(request: PermissionCheckRequest, permissionSetId?: string): PermissionCheckResult {
    let activeSet: PermissionSet | undefined;
    
    if (permissionSetId) {
      activeSet = this.config.getPermissionSet(permissionSetId);
    } else {
      activeSet = this.config.getActivePermissionSet();
    }

    if (!activeSet) {
      return {
        allowed: false,
        reason: permissionSetId ? '未找到指定的权限集' : '未找到激活的权限集',
        requiresConfirmation: false
      };
    }

    const rule = activeSet.rules.find(r => r.category === request.category);
    if (!rule) {
      return {
        allowed: false,
        reason: `未找到 ${request.category} 权限规则`,
        requiresConfirmation: false
      };
    }

    if (rule.level === 'none') {
      return {
        allowed: false,
        reason: `${request.category} 操作已被禁用`,
        requiresConfirmation: false
      };
    }

    if (rule.level === 'all') {
      return {
        allowed: true,
        reason: '完全允许'
      };
    }

    const actionLevel = this.getActionLevel(request.action);
    if (actionLevel > this.getLevelValue(rule.level)) {
      return {
        allowed: false,
        reason: `需要 ${request.action} 权限，当前级别: ${rule.level}`,
        requiresConfirmation: true
      };
    }

    if (request.resource) {
      const resourceCheck = this.checkResourcePermission(rule, request.action, request.resource);
      if (!resourceCheck.allowed) {
        return resourceCheck;
      }
    }

    return {
      allowed: true,
      reason: '权限检查通过'
    };
  }

  private getActionLevel(action: string): number {
    const actionLevels: Record<string, number> = {
      read: 1,
      write: 2,
      execute: 3,
      delete: 2,
      create: 2,
      list: 1,
      search: 1
    };
    return actionLevels[action.toLowerCase()] || 1;
  }

  private getLevelValue(level: PermissionLevel): number {
    const values: Record<PermissionLevel, number> = {
      none: 0,
      read: 1,
      write: 2,
      execute: 3,
      all: 4
    };
    return values[level];
  }

  private checkResourcePermission(
    rule: PermissionRule, 
    action: string, 
    resource: string
  ): PermissionCheckResult {
    if (rule.deniedPaths && rule.deniedPaths.length > 0) {
      for (const pattern of rule.deniedPaths) {
        if (this.matchPathPattern(resource, pattern)) {
          return {
            allowed: false,
            reason: `路径 ${resource} 在黑名单中`,
            requiresConfirmation: true
          };
        }
      }
    }

    if (rule.allowedPaths && rule.allowedPaths.length > 0) {
      let allowed = false;
      for (const pattern of rule.allowedPaths) {
        if (this.matchPathPattern(resource, pattern)) {
          allowed = true;
          break;
        }
      }
      
      if (!allowed) {
        return {
          allowed: false,
          reason: `路径 ${resource} 不在白名单中`,
          requiresConfirmation: true
        };
      }
    }

    if (rule.deniedDomains && rule.deniedDomains.length > 0) {
      try {
        const domain = new URL(resource).hostname;
        for (const pattern of rule.deniedDomains) {
          if (this.matchDomainPattern(domain, pattern)) {
            return {
              allowed: false,
              reason: `域名 ${domain} 在黑名单中`,
              requiresConfirmation: true
            };
          }
        }
      } catch {}
    }

    if (rule.allowedDomains && rule.allowedDomains.length > 0) {
      let allowed = false;
      try {
        const domain = new URL(resource).hostname;
        for (const pattern of rule.allowedDomains) {
          if (this.matchDomainPattern(domain, pattern)) {
            allowed = true;
            break;
          }
        }
      } catch {}

      if (!allowed) {
        return {
          allowed: false,
          reason: `域名不在白名单中`,
          requiresConfirmation: true
        };
      }
    }

    return { allowed: true };
  }

  private matchPathPattern(path: string, pattern: string): boolean {
    if (pattern === '**' || pattern === '*') {
      return true;
    }

    if (pattern.startsWith('$HOME')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      pattern = pattern.replace('$HOME', home);
    }

    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/\\\\]*');

    try {
      return new RegExp(`^${regexPattern}`).test(path);
    } catch {
      return false;
    }
  }

  private matchDomainPattern(domain: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return domain.endsWith(suffix) || domain === suffix.slice(1);
    }
    return domain === pattern;
  }

  public getPermissionSummary(): {
    totalSets: number;
    activeSet: string | null;
    categories: string[];
  } {
    const activeSet = this.getActivePermissionSet();
    return {
      totalSets: this.getAllPermissionSets().length,
      activeSet: activeSet?.name || null,
      categories: activeSet?.rules.map(r => r.category) || []
    };
  }

  public destroy(): void {
    PermissionManager.instance = null as any;
  }
}
