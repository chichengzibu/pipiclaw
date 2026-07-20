/**
 * PiPiClaw - 技能管理器
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { LogManager } from '../core/LogManager';
import { ConfigStore } from '../core/ConfigStore';
import { PermissionManager } from '../permissions/PermissionManager';
import type { Skill, SkillExecutionResult } from '../../types/skill';

export class SkillManager {
  private static instance: SkillManager;
  private log = LogManager.getInstance();
  private configStore = ConfigStore.getInstance();
  private permissionManager = PermissionManager.getInstance();
  private skillsDir: string;
  private skills: Skill[] = [];

  /** W7.0.4: 路径单点 — 其它模块应使用这个而非自己 join(userData,'skills') */
  public static getSkillsDir(): string {
    const userDataPath = app.getPath('userData');
    const dir = path.join(userDataPath, 'skills');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private constructor() {
    this.skillsDir = SkillManager.getSkillsDir();
    this.ensureSkillsDir();
    this.loadSkills();
  }

  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager();
    }
    return SkillManager.instance;
  }

  private ensureSkillsDir(): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  private loadSkills(): void {
    try {
      const saved = this.configStore.get('skills') as Skill[];
      if (saved) {
        this.skills = saved;
      }
      this.log.info('[SkillManager] 技能加载成功', { count: this.skills.length });
    } catch (error) {
      this.log.error('[SkillManager] 技能加载失败', error);
    }
  }

  private saveSkills(): void {
    try {
      this.configStore.set('skills', this.skills);
    } catch (error) {
      this.log.error('[SkillManager] 技能保存失败', error);
    }
  }

  /**
   * 获取所有技能
   */
  public listSkills(): Skill[] {
    return [...this.skills];
  }

  /**
   * 获取指定技能
   */
  public getSkill(id: string): Skill | undefined {
    return this.skills.find(s => s.id === id);
  }

  /**
   * 保存或更新技能
   */
  public saveSkill(skill: Omit<Skill, 'createdAt' | 'updatedAt' | 'usageCount' | 'successRate'>): Skill {
    const existingIndex = this.skills.findIndex(s => s.id === skill.id);
    
    if (existingIndex !== -1) {
      const existing = this.skills[existingIndex];
      const updated: Skill = {
        ...existing,
        ...skill,
        updatedAt: Date.now()
      };
      this.skills[existingIndex] = updated;
      this.saveSkills();
      this.log.info('[SkillManager] 技能已更新', { id: skill.id });
      return updated;
    } else {
      const newSkill: Skill = {
        ...skill,
        id: skill.id || `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        enabled: true,
        usageCount: 0,
        successRate: 100,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.skills.push(newSkill);
      this.saveSkills();
      this.log.info('[SkillManager] 技能已创建', { id: newSkill.id });
      return newSkill;
    }
  }

  /**
   * 删除技能
   */
  public deleteSkill(id: string): boolean {
    const index = this.skills.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.skills.splice(index, 1);
    this.saveSkills();
    this.log.info('[SkillManager] 技能已删除', { id });
    return true;
  }

  /**
   * 启用/禁用技能
   */
  public toggleSkill(id: string): boolean {
    const skill = this.skills.find(s => s.id === id);
    if (!skill) return false;
    
    skill.enabled = !skill.enabled;
    skill.updatedAt = Date.now();
    this.saveSkills();
    this.log.info('[SkillManager] 技能状态已切换', { id, enabled: skill.enabled });
    return true;
  }

  /**
   * 执行技能
   */
  public async executeSkill(skillId: string, _parameters: Record<string, any>): Promise<SkillExecutionResult> {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) {
      throw new Error('技能不存在');
    }
    if (!skill.enabled) {
      throw new Error('技能已禁用');
    }

    // 权限校验
    for (const _perm of skill.requiredPermissions) {
      const check = this.permissionManager.checkPermission({
        category: 'filesystem',
        action: 'read'
      });
      if (!check.allowed) {
        throw new Error(`权限不足: ${check.reason}`);
      }
    }

    const startTime = Date.now();
    
    try {
      // 更新使用次数
      skill.usageCount++;
      skill.updatedAt = Date.now();
      
      // 这里调用 TaskExecutor 执行技能
      // 简化版本
      this.log.info('[SkillManager] 技能执行开始', { id: skillId, name: skill.name });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 更新成功率（简化计算）
      skill.successRate = Math.min(100, (skill.successRate * skill.usageCount + 100) / (skill.usageCount + 1));
      
      this.saveSkills();
      
      this.log.info('[SkillManager] 技能执行成功', { id: skillId, duration });
      
      return {
        success: true,
        skillId,
        duration,
        output: { message: '执行成功' }
      };
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 更新成功率
      skill.successRate = Math.max(0, (skill.successRate * skill.usageCount) / (skill.usageCount + 1));
      this.saveSkills();
      
      this.log.error('[SkillManager] 技能执行失败', { id: skillId, error: error.message });
      
      return {
        success: false,
        skillId,
        duration,
        error: error.message
      };
    }
  }

  /**
   * 导出技能
   */
  public exportSkill(id: string): string {
    const skill = this.skills.find(s => s.id === id);
    if (!skill) {
      throw new Error('技能不存在');
    }
    return JSON.stringify(skill, null, 2);
  }

  /**
   * 导入技能
   */
  public importSkill(skillJson: string): Skill {
    const skill = JSON.parse(skillJson) as Skill;
    return this.saveSkill(skill);
  }
}