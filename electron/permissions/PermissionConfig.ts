/**
 * PiPiClaw - 权限配置管理器
 *
 * 职责：
 * 1. 权限配置的持久化存储
 * 2. 权限模板管理
 *
 * M1 P0-1 安全重构 (2026-08-05):
 * - 启动时**不调用** forceResetToPermissive() (避免覆盖用户选择)
 * - 首次安装默认 safe 模式 (least privilege),不是 permissive
 * - permissive 模板重命名为 "unrestricted" / "无限制模式 ⚠️",description 标红字警告
 * - 模式切换进 EventBus 'permission:mode-changed' + Insight 审计
 * - forceResetToPermissive 保留,仅 IPC `force:true` 或 PIPICLAW_RESET_PERMISSIONS=1 触发
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { LogManager } from '../core/LogManager';
import { EventBus } from '../runtime/bridge/EventBus';
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
  private bus = EventBus.getInstance();
  private configPath: string;
  private permissionSets: Map<string, PermissionSet> = new Map();
  private activeSetId: string | null = null;

  /**
   * 内部审计 helper: 模式切换进 EventBus + Insight。
   * 触发点: setActivePermissionSet / forceResetToPermissive。
   * UI 可订阅 'permission:mode-changed' 实时更新 banner;Insight 落库做合规审计。
   */
  /**
   * 拿 app version (dev 模式 fallback 到 root package.json)
   * - prod (Setup.exe): app.getVersion() 返 4.5.0-alpha ✅
   * - dev (vite-plugin-electron): app.getVersion() 返 30.5.1 (electron version), 需 fallback
   */
  private getAppVersion(): string {
    try {
      const v = app.getVersion();
      // dev mode 标识: 30.5.1 是 electron version, 不是 app version
      if (v && v !== '30.5.1') return v;
      // fallback: 读 root package.json
      try {
        return require('../../package.json').version;
      } catch { return v || 'unknown'; }
    } catch { return 'unknown'; }
  }

  private emitModeChange(opts: {
    from: string | null;
    to: string;
    reason: 'user-setActive' | 'init-default' | 'reset' | 'ipc-reset' | 'env-reset';
    via?: string;
  }): void {
    const payload = {
      from: opts.from,
      to: opts.to,
      reason: opts.reason,
      via: opts.via,
      ts: Date.now(),
      version: app.getVersion(),
    };
    void this.bus.publish('permission:mode-changed', payload);
    this.log.info('[PermissionConfig] permission:mode-changed', payload);
  }

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

        // M1 P0-1 补充: 老 config migration
        // 老版本 (v < 4.5.0-alpha) 默认 activeSetId 是 'preset_permissive' (P0-1 修复前 forceReset 强制)
        // 升级时, 如果用户没主动切过 (activeSetId 仍是 preset_permissive) → 切到 safe (尊重 P0-1 立场)
        // 如果用户在老版本里主动切到 standard/safe/permissive → 保留用户选择
        // dev 模式下 app.getVersion() 返 electron version (30.5.1) 不是 app version — 用 fallback
        let currentVersion: string;
        try { currentVersion = app.getVersion(); } catch { currentVersion = 'unknown'; }
        if (!currentVersion || currentVersion === '30.5.1' || /^\d+\.\d+\.\d+$/.test(currentVersion) && !currentVersion.includes('-')) {
          // dev mode: 读 root package.json
          try {
            const pkg = require('../../package.json');
            currentVersion = pkg.version;
          } catch { /* keep currentVersion */ }
        }
        const configVersion = parsed.version || '0.0.0';
        this.log.info(`[PermissionConfig] 升级检查: current=${currentVersion} config=${configVersion} activeSetId=${this.activeSetId}`);
        if (configVersion !== currentVersion && this.activeSetId === 'preset_permissive') {
          // 确保 safe set 存在
          if (!Array.from(this.permissionSets.values()).some(s => s.id.startsWith('preset_safe'))) {
            this.initDefaultPermissionSets();
          } else {
            const safeSet = Array.from(this.permissionSets.values()).find(s => s.id.startsWith('preset_safe'));
            if (safeSet) {
              const prev = this.activeSetId;
              this.activeSetId = safeSet.id;
              this.log.info(
                `[PermissionConfig] 升级 ${configVersion} -> ${currentVersion}: 老 permissive 默认被替换为 safe (least privilege)`,
                { from: prev, to: safeSet.id }
              );
              this.emitModeChange({ from: prev, to: safeSet.id, reason: 'upgrade-default', via: 'loadConfig' });
              this.saveConfig();
            }
          }
        }
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
        // dev 模式下 app.getVersion() 返 electron version (30.5.1) — 用 fallback 写正确 app version
        version: this.getAppVersion(),
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
    const prevActiveId = this.activeSetId;
    this.permissionSets.clear();

    const safeSet = this.createPermissionSetFromTemplate('safe');
    const standardSet = this.createPermissionSetFromTemplate('standard');
    const permissiveSet = this.createPermissionSetFromTemplate('permissive');

    this.permissionSets.set(safeSet.id, safeSet);
    this.permissionSets.set(standardSet.id, standardSet);
    this.permissionSets.set(permissiveSet.id, permissiveSet);

    // M1 P0-1: 默认 safe 模式 (least privilege) — 旧行为是 permissive。
    // 用户可主动从 UI 切到 standard/unrestricted。
    this.activeSetId = safeSet.id;
    this.log.info('[PermissionConfig] 初始化默认权限，激活安全模式 (least privilege)');
    if (prevActiveId !== safeSet.id) {
      this.emitModeChange({ from: prevActiveId, to: safeSet.id, reason: 'init-default', via: 'initDefaultPermissionSets' });
    }
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
      // M1 P0-1: "开放模式" → "无限制模式 ⚠️" — UI 配套要红字警告 + 二次确认弹窗
      // id 仍是 'preset_permissive' (兼容老 config),只改展示名 + 描述
      permissive: '无限制模式 ⚠️ (不推荐)',
      custom: '自定义'
    };

    // M1 P0-1: unrestricted 模板的描述明确标红字警告 + 解释风险
    const descriptionOverride: Partial<Record<PermissionTemplate, string>> = {
      permissive: '⚠️ 警告: 此模式允许所有操作,无任何安全防护。仅在你完全信任当前环境(单机独享 / 临时测试)时使用。生产 / 公共网络 / 共用电脑请勿启用。',
    };

    return {
      id: `preset_${template}`,
      name: templateNames[template],
      template,
      description: descriptionOverride[template] ?? templateConfig.description,
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
    const prev = this.activeSetId;
    this.activeSetId = id;
    this.saveConfig();
    this.log.info(`激活权限集: ${id}`);
    if (prev !== id) {
      this.emitModeChange({ from: prev, to: id, reason: 'user-setActive', via: 'setActivePermissionSet' });
    }
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
   * 强制重置权限为 unrestricted (无限制 ⚠️) 模式。
   *
   * 历史: v4.4.0 之前每次启动都无条件调用本方法,导致用户在 UI 选的
   * "安全模式"/"标准模式" 都被覆盖,RBAC 形同虚设。
   *
   * M1 P0-1 安全重构 (2026-08-05):
   * - 启动时**不再调用**本方法 (main.ts 已删除调用)。
   * - 仅以下场景会真正重置:
   *   1. `options.force === true` — IPC `permissions:reset` 用户主动操作
   *   2. 环境变量 PIPICLAW_DEV=1 — 开发/调试模式
   *   3. 环境变量 PIPICLAW_RESET_PERMISSIONS=1 — 显式一次性重置
   *   4. activeSetId 为空 — 旧 config 格式不匹配 (migration 工具,带 version check)
   *
   * 行为: 把 active 切到 `preset_permissive` (id 仍兼容老 config;展示名 "无限制模式 ⚠️"),
   *       并发 EventBus 'permission:mode-changed' 审计事件。
   *
   * 重要: 旧 `activeSetId` 已有值 + 未触发以上 4 条件 → **尊重用户选择,不做任何事**。
   *
   * @param options.force 强制重置 (用于 IPC `permissions:reset` 用户主动操作)
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

    const reason: 'ipc-reset' | 'env-reset' = force ? 'ipc-reset' : 'env-reset';
    this.log.info('[PermissionConfig] ========== 强制重置权限为无限制模式 ⚠️ ==========', {
      reason: force ? '用户主动操作 (IPC forceReset)' : isDevMode ? 'PIPICLAW_DEV=1' : isExplicitReset ? 'PIPICLAW_RESET_PERMISSIONS=1' : '首次启动 / migration',
      via: reason
    });

    // 1. 重新初始化默认权限集 (确保 preset_permissive 存在)
    this.initDefaultPermissionSets();

    // 2. 确保激活 permissive 模板 (id 仍为 'preset_permissive',显示名 "无限制模式 ⚠️")
    const permissiveSet = this.permissionSets.get('preset_permissive');
    if (!permissiveSet) {
      this.log.error('[PermissionConfig] ❌ 重置权限失败：找不到 permissive 权限集');
      return false;
    }

    const prev = this.activeSetId;
    this.activeSetId = permissiveSet.id;
    this.saveConfig();
    this.log.info('[PermissionConfig] ✅ 已重置权限为无限制模式 ⚠️', { activeSetId: this.activeSetId });
    if (prev !== permissiveSet.id) {
      this.emitModeChange({ from: prev, to: permissiveSet.id, reason, via: 'forceResetToPermissive' });
    }
    return true;
  }

  public destroy(): void {
    PermissionConfig.instance = null as any;
  }
}
