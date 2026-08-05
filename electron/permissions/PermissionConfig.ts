/**
 * PiPiClaw - 权限配置管理器
 * 
 * 职责：
 * 1. 权限配置的持久化存储
 * 2. 权限模板管理
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { LogManager } from '../core/LogManager';
import { 
  PermissionSet, 
  PermissionRule, 
  PermissionTemplate, 
  TEMPLATE_DEFAULTS,
  PERMISSION_CATEGORIES
} from './PermissionTypes';

export class PermissionConfig {
  private static instance: PermissionConfig;
  private log = LogManager.getInstance();
  private configPath: string;
  private permissionSets: Map<string, PermissionSet> = new Map();
  private activeSetId: string | null = null;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'permissions.json');
    this.loadConfig();
  }

  public static getInstance(): PermissionConfig {
    if (!PermissionConfig.instance) {
      PermissionConfig.instance = new PermissionConfig();
    }
    return PermissionConfig.instance;
  }

  private loadConfig(): void {
    try {
      const dir = app.getPath('userData');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.permissionSets.clear();
        for (const set of parsed.permissionSets || []) {
          this.permissionSets.set(set.id, set);
        }
        this.activeSetId = parsed.activeSetId || null;
        this.log.info('权限配置加载成功', { count: this.permissionSets.size });
      } else {
        this.initDefaultPermissionSets();
        this.saveConfig();
        this.log.info('初始化默认权限配置');
      }
    } catch (error) {
      this.log.error('权限配置加载失败', error);
      this.initDefaultPermissionSets();
    }
  }

  private saveConfig(): void {
    try {
      const data = JSON.stringify({
        version: app.getVersion(),
        permissionSets: Array.from(this.permissionSets.values()),
        activeSetId: this.activeSetId
      }, null, 2);
      writeFileSync(this.configPath, data, 'utf-8');
      this.log.debug('权限配置已保存');
    } catch (error) {
      this.log.error('权限配置保存失败', error);
    }
  }

  private initDefaultPermissionSets(): void {
    this.permissionSets.clear();

    const safeSet = this.createPermissionSetFromTemplate('safe');
    const standardSet = this.createPermissionSetFromTemplate('standard');
    const permissiveSet = this.createPermissionSetFromTemplate('permissive');

    this.permissionSets.set(safeSet.id, safeSet);
    this.permissionSets.set(standardSet.id, standardSet);
    this.permissionSets.set(permissiveSet.id, permissiveSet);

    // 默认使用开放模式（permissive），最大化功能可用性
    this.activeSetId = permissiveSet.id;
    this.log.info('[PermissionConfig] 初始化默认权限，激活开放模式');
  }

  private createPermissionSetFromTemplate(template: PermissionTemplate): PermissionSet {
    const templateConfig = TEMPLATE_DEFAULTS[template];
    const rules: PermissionRule[] = templateConfig.rules.map((partialRule, index) => ({
      id: `rule_${template}_${index}`,
      category: partialRule.category!,
      name: partialRule.name!,
      description: PERMISSION_CATEGORIES[partialRule.category!]?.description || '',
      level: partialRule.level || 'none',
      allowedPaths: partialRule.allowedPaths,
      deniedPaths: partialRule.deniedPaths,
      allowedDomains: partialRule.allowedDomains,
      deniedDomains: partialRule.deniedDomains
    }));

    const templateNames: Record<PermissionTemplate, string> = {
      safe: '安全模式',
      standard: '标准模式',
      permissive: '开放模式',
      custom: '自定义'
    };

    return {
      id: `preset_${template}`,
      name: templateNames[template],
      template,
      description: templateConfig.description,
      rules,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  public getAllPermissionSets(): PermissionSet[] {
    return Array.from(this.permissionSets.values());
  }

  public getPermissionSet(id: string): PermissionSet | undefined {
    return this.permissionSets.get(id);
  }

  public getActivePermissionSet(): PermissionSet | undefined {
    if (!this.activeSetId) return undefined;
    return this.permissionSets.get(this.activeSetId);
  }

  public getActiveSetId(): string | null {
    return this.activeSetId;
  }

  public setActivePermissionSet(id: string): boolean {
    if (!this.permissionSets.has(id)) {
      return false;
    }
    this.activeSetId = id;
    this.saveConfig();
    this.log.info(`激活权限集: ${id}`);
    return true;
  }

  public createPermissionSet(data: {
    name: string;
    template: PermissionTemplate;
    description: string;
    rules?: PermissionRule[];
  }): PermissionSet {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let rules = data.rules;

    if (!rules || rules.length === 0) {
      const templateConfig = TEMPLATE_DEFAULTS[data.template];
      rules = templateConfig.rules.map((partialRule, index) => ({
        id: `rule_${id}_${index}`,
        category: partialRule.category!,
        name: partialRule.name!,
        description: PERMISSION_CATEGORIES[partialRule.category!]?.description || '',
        level: partialRule.level || 'none',
        allowedPaths: partialRule.allowedPaths,
        deniedPaths: partialRule.deniedPaths,
        allowedDomains: partialRule.allowedDomains,
        deniedDomains: partialRule.deniedDomains
      }));
    }

    const permissionSet: PermissionSet = {
      id,
      name: data.name,
      template: data.template,
      description: data.description,
      rules,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.permissionSets.set(id, permissionSet);
    this.saveConfig();
    this.log.info(`创建权限集: ${data.name}`);
    return permissionSet;
  }

  public updatePermissionSet(id: string, updates: Partial<Omit<PermissionSet, 'id' | 'createdAt'>>): PermissionSet | null {
    const existing = this.permissionSets.get(id);
    if (!existing) {
      return null;
    }

    const updated: PermissionSet = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    };

    this.permissionSets.set(id, updated);
    this.saveConfig();
    this.log.info(`更新权限集: ${updated.name}`);
    return updated;
  }

  public updatePermissionRule(setId: string, ruleId: string, updates: Partial<PermissionRule>): PermissionRule | null {
    const permissionSet = this.permissionSets.get(setId);
    if (!permissionSet) {
      return null;
    }

    const ruleIndex = permissionSet.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) {
      return null;
    }

    permissionSet.rules[ruleIndex] = {
      ...permissionSet.rules[ruleIndex],
      ...updates,
      id: ruleId,
      category: permissionSet.rules[ruleIndex].category,
      name: permissionSet.rules[ruleIndex].name,
      description: permissionSet.rules[ruleIndex].description
    };

    permissionSet.updatedAt = Date.now();
    this.saveConfig();
    return permissionSet.rules[ruleIndex];
  }

  public deletePermissionSet(id: string): boolean {
    if (id.startsWith('preset_')) {
      this.log.warn(`无法删除预设权限集: ${id}`);
      return false;
    }

    const deleted = this.permissionSets.delete(id);
    if (deleted) {
      if (this.activeSetId === id) {
        const remaining = this.getAllPermissionSets();
        this.activeSetId = remaining.length > 0 ? remaining[0].id : null;
      }
      this.saveConfig();
      this.log.info(`删除权限集: ${id}`);
    }
    return deleted;
  }

  public duplicatePermissionSet(id: string, newName: string): PermissionSet | null {
    const existing = this.permissionSets.get(id);
    if (!existing) {
      return null;
    }

    const newId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duplicated: PermissionSet = {
      id: newId,
      name: newName,
      template: 'custom',
      description: `${existing.name} (副本)`,
      rules: existing.rules.map(r => ({
        ...r,
        id: `rule_${newId}_${r.category}`
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.permissionSets.set(newId, duplicated);
    this.saveConfig();
    this.log.info(`复制权限集: ${existing.name} -> ${newName}`);
    return duplicated;
  }

  /**
   * 强制重置权限为开放模式。
   *
   * 安全考虑: 之前每次启动都无条件调用本方法,导致用户在 UI 选的
   * "安全模式"/"标准模式" 都被覆盖,RBAC 形同虚设。
   *
   * 现在必须满足以下任一条件才会真正重置:
   * 1. `options.force === true` (用户主动从 UI 点 "重置" 按钮)
   * 2. 环境变量 PIPICLAW_DEV=true (开发/调试模式)
   * 3. 环境变量 PIPICLAW_RESET_PERMISSIONS=true (显式一次性重置)
   * 4. 配置文件中 activeSetId 为空 (首次启动,从未选过)
   *
   * 生产环境 + 已设置过权限 + 非 force → **尊重用户选择**,不重置。
   *
   * @param options.force 强制重置(用于 IPC `permissions:reset` 用户主动操作)
   * @returns true = 真的重置了; false = 跳过 (尊重用户选择)
   */
  public forceResetToPermissive(options?: { force?: boolean }): boolean {
    const force = options?.force === true;
    const isDevMode = process.env.PIPICLAW_DEV === '1' || process.env.PIPICLAW_DEV === 'true';
    const isExplicitReset = process.env.PIPICLAW_RESET_PERMISSIONS === '1' || process.env.PIPICLAW_RESET_PERMISSIONS === 'true';
    const isFirstBoot = !this.activeSetId;

    if (!force && !isDevMode && !isExplicitReset && !isFirstBoot) {
      this.log.info('[PermissionConfig] ⏭️ 跳过强制重置 (生产模式 + 已设过权限,尊重用户选择)', {
        activeSetId: this.activeSetId,
        hint: '要强制重置请设 PIPICLAW_DEV=1 或 PIPICLAW_RESET_PERMISSIONS=1,或在 UI 点"重置"按钮'
      });
      return false;
    }

    this.log.info('[PermissionConfig] ========== 强制重置权限为开放模式 ==========', {
      reason: force ? '用户主动操作 (IPC forceReset)' : isDevMode ? 'PIPICLAW_DEV=1' : isExplicitReset ? 'PIPICLAW_RESET_PERMISSIONS=1' : '首次启动'
    });

    // 1. 重新初始化默认权限集（确保 permissive 存在）
    this.initDefaultPermissionSets();

    // 2. 确保激活 permissive 模板
    const permissiveSet = this.permissionSets.get('preset_permissive');
    if (permissiveSet) {
      this.activeSetId = permissiveSet.id;
      this.saveConfig();
      this.log.info('[PermissionConfig] ✅ 已重置权限为开放模式', { activeSetId: this.activeSetId });
      return true;
    }

    this.log.error('[PermissionConfig] ❌ 重置权限失败：找不到 permissive 权限集');
    return false;
  }

  public destroy(): void {
    PermissionConfig.instance = null as any;
  }
}
