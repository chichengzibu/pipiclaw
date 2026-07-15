/**
 * PiPiClaw - 技能加载器
 * 
 * 职责：
 * 1. 扫描 skills/ 目录下所有子文件夹
 * 2. 解析每个 skill.md 的技能信息
 * 3. 匹配用户消息，返回对应技能的完整指令
 * 4. 管理技能的启用/禁用状态
 * 5. 支持导入新技能
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { LogManager } from '../core/LogManager';
import { ConfigStore } from '../core/ConfigStore';
import { ModelManager } from '../models/ModelManager';
import { SelfLearner } from '../learning/SelfLearner';
import { SkillManager } from './SkillManager';

/**
 * 技能定义接口
 */
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
  operationSteps: string[];
  fullInstructions: string;
}

/**
 * 技能状态接口
 */
export interface SkillState {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
  operationSteps: string[];
  fullInstructions: string;
  enabled: boolean;
  usageCount: number;
  successRate: number;
  fileSize: number;
}

export class SkillLoader {
  private static instance: SkillLoader;
  private log = LogManager.getInstance();
  private skillsDir: string;
  private skills: Map<string, SkillState> = new Map();
  private configStore: ConfigStore;
  private modelManager: ModelManager;
  private _selfLearner: SelfLearner | null = null;
  
  // 延迟加载 SelfLearner
  private get selfLearner(): SelfLearner {
    if (!this._selfLearner) {
      this._selfLearner = SelfLearner.getInstance();
    }
    return this._selfLearner;
  }

  private constructor() {
    this.configStore = ConfigStore.getInstance();
    this.modelManager = ModelManager.getInstance();
    
    // 延迟初始化 SelfLearner，避免循环依赖
    // this.selfLearner 现在只会在需要时才加载
    // this.selfLearner = SelfLearner.getInstance();
    
    // 使用 SkillManager.getSkillsDir() 作为路径单点(W7.0.4)
    this.skillsDir = SkillManager.getSkillsDir();
    
    // 如果用户数据目录下没有技能，尝试从项目根目录复制
    const projectSkillsDir = path.join(app.getAppPath(), '..', 'skills');
    if (fs.existsSync(projectSkillsDir) && !fs.existsSync(this.skillsDir)) {
      this.log.info('[SkillLoader] 发现项目技能目录，正在复制到用户数据目录', { 
        source: projectSkillsDir,
        dest: this.skillsDir
      });
      
      // 复制项目技能目录到用户数据目录
      this.copyDirectory(projectSkillsDir, this.skillsDir);
    }
    
    // 确保目录存在
    this.ensureSkillsDir();
    // 加载技能
    this.loadAllSkills();
  }

  public static getInstance(): SkillLoader {
    if (!SkillLoader.instance) {
      SkillLoader.instance = new SkillLoader();
    }
    return SkillLoader.instance;
  }

  private ensureSkillsDir(): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
      this.log.info('[SkillLoader] 创建技能目录', { path: this.skillsDir });
    }
  }

  private copyDirectory(source: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    this.log.info('[SkillLoader] 目录复制完成', { source, dest });
  }

  private loadAllSkills(): void {
    this.log.info('[SkillLoader] 开始加载技能...', { path: this.skillsDir });
    
    try {
      const skillDirs = fs.readdirSync(this.skillsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      this.log.info('[SkillLoader] 发现技能目录', { count: skillDirs.length });

      for (const skillDir of skillDirs) {
        this.loadSkill(skillDir);
      }

      this.log.info('[SkillLoader] 技能加载完成', { count: this.skills.size });
    } catch (error) {
      this.log.error('[SkillLoader] 加载技能失败', error);
    }
  }

  private loadSkill(skillDir: string): void {
    const skillPath = path.join(this.skillsDir, skillDir);
    const skillMdPath = path.join(skillPath, 'skill.md');

    if (!fs.existsSync(skillMdPath)) {
      this.log.warn('[SkillLoader] 技能文件不存在', { skillDir, path: skillMdPath });
      return;
    }

    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const fileSize = Buffer.byteLength(content, 'utf-8');
      const skill = this.parseSkillMd(skillDir, content);
      
      if (skill) {
        // 从配置中读取状态
        const skillStates = this.configStore.get('skills.states') as Record<string, any> || {};
        const savedState = skillStates[skill.id] || {};
        
        this.skills.set(skill.id, {
          ...skill,
          enabled: savedState.enabled !== false, // 默认启用
          usageCount: savedState.usageCount || 0,
          successRate: savedState.successRate || 100,
          fileSize
        });
        
        this.log.info('[SkillLoader] 加载技能成功', { id: skill.id, name: skill.name, fileSize });
      }
    } catch (error) {
      this.log.error('[SkillLoader] 解析技能失败', { skillDir, error });
    }
  }

  private parseSkillMd(skillId: string, content: string): SkillDefinition | null {
    try {
      const lines = content.split('\n');
      let name = skillId;
      let description = '';
      const triggerKeywords: string[] = [];
      const operationSteps: string[] = [];
      
      let currentSection = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('# ')) {
          name = line.substring(2).trim();
        } else if (line.startsWith('## 描述')) {
          currentSection = 'description';
        } else if (line.startsWith('## 触发关键词')) {
          currentSection = 'keywords';
        } else if (line.startsWith('## 操作步骤')) {
          currentSection = 'steps';
        } else if (line && !line.startsWith('##')) {
          if (currentSection === 'description' && line) {
            description += (description ? '\n' : '') + line;
          } else if (currentSection === 'keywords') {
            // 解析关键词列表 - 支持 - 或 * 开头的列表
            const keyword = line.replace(/^[-*]\s*/, '').trim();
            if (keyword) {
              triggerKeywords.push(keyword);
            }
          } else if (currentSection === 'steps') {
            // 解析操作步骤 - 支持数字开头或 - 开头
            const step = line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim();
            if (step) {
              operationSteps.push(step);
            }
          }
        }
      }

      if (triggerKeywords.length === 0) {
        this.log.warn('[SkillLoader] 技能缺少触发关键词', { skillId });
      }

      // 生成完整指令
      const fullInstructions = this.generateFullInstructions(name, description, operationSteps);

      return {
        id: skillId,
        name,
        description: description || skillId,
        triggerKeywords,
        operationSteps,
        fullInstructions
      };
    } catch (error) {
      this.log.error('[SkillLoader] 解析 skill.md 失败', { skillId, error });
      return null;
    }
  }

  private generateFullInstructions(name: string, description: string, steps: string[]): string {
    let instructions = `## ${name}\n\n`;
    
    if (description) {
      instructions += `${description}\n\n`;
    }
    
    instructions += '### 操作步骤:\n';
    steps.forEach((step, index) => {
      instructions += `${index + 1}. ${step}\n`;
    });
    
    return instructions;
  }

  /**
   * 查找匹配的技能
   */
  private findMatchingSkill(userMessage: string): SkillDefinition | null {
    const lowerMessage = userMessage.toLowerCase();
    
    for (const skill of this.skills.values()) {
      for (const keyword of skill.triggerKeywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          return skill;
        }
      }
    }
    
    return null;
  }

  /**
   * 获取所有技能的摘要清单
   */
  public getAllSkillSummaries(): string {
    if (this.skills.size === 0) {
      return '暂无可使用的技能';
    }

    let summary = '## 可用技能列表\n\n';
    
    let index = 1;
    for (const skill of this.skills.values()) {
      summary += `${index}. **${skill.name}**\n`;
      summary += `   - 描述: ${skill.description}\n`;
      summary += `   - 触发关键词: ${skill.triggerKeywords.join(', ')}\n\n`;
      index++;
    }

    return summary;
  }

  /**
   * 获取所有加载的技能
   */
  public getAllSkills(): SkillState[] {
    return Array.from(this.skills.values());
  }

  /**
   * 重新加载所有技能
   */
  public reloadSkills(): void {
    this.skills.clear();
    this.loadAllSkills();
  }

  /**
   * 切换技能的启用状态
   */
  public toggleSkill(skillId: string, enabled: boolean): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) {
      this.log.warn('[SkillLoader] 技能不存在', { skillId });
      return false;
    }

    skill.enabled = enabled;
    
    // 保存状态
    this.saveSkillStates();
    
    this.log.info('[SkillLoader] 技能状态已更新', { skillId, enabled });
    return true;
  }

  /**
   * 记录技能使用
   */
  public recordSkillUsage(skillId: string, success: boolean): void {
    const skill = this.skills.get(skillId);
    if (!skill) return;

    skill.usageCount += 1;
    
    // 更新成功率
    if (skill.usageCount > 0) {
      const successCount = (skill.successRate * (skill.usageCount - 1) + (success ? 100 : 0)) / skill.usageCount;
      skill.successRate = Math.round(successCount);
    }
    
    this.saveSkillStates();
  }

  /**
   * 保存技能状态
   */
  private saveSkillStates(): void {
    const skillStates: Record<string, any> = {};
    this.skills.forEach((skill, id) => {
      skillStates[id] = {
        enabled: skill.enabled,
        usageCount: skill.usageCount,
        successRate: skill.successRate
      };
    });
    this.configStore.set('skills.states', skillStates);
  }

  /**
   * 导入技能（从文件）
   */
  public async importSkillFromFile(filePath: string): Promise<{ success: boolean; error?: string; skillId?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 生成技能ID
      const fileName = path.basename(filePath, path.extname(filePath));
      const skillId = `imported_${fileName}_${Date.now()}`;
      
      // 解析技能
      const skill = this.parseSkillMd(skillId, content);
      if (!skill) {
        return { success: false, error: '技能文件解析失败' };
      }
      
      // 创建技能目录
      const skillDir = path.join(this.skillsDir, skillId);
      if (!fs.existsSync(skillDir)) {
        fs.mkdirSync(skillDir, { recursive: true });
      }
      
      // 保存技能文件
      const skillMdPath = path.join(skillDir, 'skill.md');
      fs.writeFileSync(skillMdPath, content, 'utf-8');
      
      // 加载新技能
      this.loadSkill(skillId);
      
      this.log.info('[SkillLoader] 技能导入成功', { skillId, name: skill.name });
      
      return { success: true, skillId };
    } catch (error: any) {
      this.log.error('[SkillLoader] 技能导入失败', error);
      return { success: false, error: error.message || '导入失败' };
    }
  }

  /**
   * 导入技能（从URL）
   */
  public async importSkillFromUrl(url: string): Promise<{ success: boolean; error?: string; skillId?: string }> {
    try {
      this.log.info('[SkillLoader] 从URL导入技能', { url });
      
      // 简单的下载实现
      // 实际项目中可能需要用 axios 或 node-fetch
      // 这里仅作为示例
      const content = `# 导入的技能\n\n## 描述\n从 ${url} 导入的技能\n\n## 触发关键词\n- 示例关键词\n\n## 操作步骤\n1. 示例步骤`;
      
      const skillId = `imported_${Date.now()}`;
      const skill = this.parseSkillMd(skillId, content);
      
      if (!skill) {
        return { success: false, error: '技能解析失败' };
      }
      
      const skillDir = path.join(this.skillsDir, skillId);
      fs.mkdirSync(skillDir, { recursive: true });
      
      const skillMdPath = path.join(skillDir, 'skill.md');
      fs.writeFileSync(skillMdPath, content, 'utf-8');
      
      this.loadSkill(skillId);
      
      return { success: true, skillId };
    } catch (error: any) {
      this.log.error('[SkillLoader] 从URL导入技能失败', error);
      return { success: false, error: error.message || '导入失败' };
    }
  }

  /**
   * 合并技能
   */
  public mergeSkill(proposal: any, existingSkillId: string): boolean {
    try {
      const existingSkill = this.skills.get(existingSkillId);
      if (!existingSkill) {
        this.log.warn('[SkillLoader] 技能不存在，无法合并', { existingSkillId });
        return false;
      }

      const existingSkillDir = path.join(this.skillsDir, existingSkillId);
      const existingSkillMdPath = path.join(existingSkillDir, 'skill.md');
      
      // 备份原文件
      const backupPath = `${existingSkillMdPath}.backup_${Date.now()}`;
      if (fs.existsSync(existingSkillMdPath)) {
        fs.copyFileSync(existingSkillMdPath, backupPath);
        this.log.info('[SkillLoader] 已备份原技能文件', { backupPath });
      }

      // 合并触发关键词
      const mergedKeywords = [...new Set([...existingSkill.triggerKeywords, ...(proposal.keywords || [])])];
      
      // 合并操作步骤
      const mergedSteps = [...new Set([...existingSkill.operationSteps, ...(proposal.operationSteps || [])])];

      // 生成新的完整指令
      let fullInstructions = `# ${proposal.name || existingSkill.name}\n\n`;
      fullInstructions += `## 描述\n${proposal.description || existingSkill.description}\n\n`;
      fullInstructions += `## 触发条件\n${proposal.triggerCondition || '无'}\n\n`;
      fullInstructions += `## 触发关键词\n`;
      mergedKeywords.forEach(keyword => {
        fullInstructions += `- ${keyword}\n`;
      });
      fullInstructions += `\n## 操作步骤\n`;
      mergedSteps.forEach((step, index) => {
        fullInstructions += `${index + 1}. ${step}\n`;
      });

      // 写入文件
      fs.writeFileSync(existingSkillMdPath, fullInstructions, 'utf-8');

      // 更新内存中的技能
      existingSkill.name = proposal.name || existingSkill.name;
      existingSkill.description = proposal.description || existingSkill.description;
      existingSkill.triggerKeywords = mergedKeywords;
      existingSkill.operationSteps = mergedSteps;
      existingSkill.fullInstructions = fullInstructions;
      existingSkill.fileSize = Buffer.byteLength(fullInstructions, 'utf-8');

      this.log.info('[SkillLoader] 技能合并成功', { existingSkillId, backupPath });

      return true;
    } catch (error) {
      this.log.error('[SkillLoader] 技能合并失败', error);
      return false;
    }
  }

  /**
   * 获取优化的技能上下文
   */
  public async getSkillContext(userMessage: string): Promise<string> {
    try {
      const enabledSkills = Array.from(this.skills.values()).filter(s => s.enabled);
      
      if (enabledSkills.length === 0) {
        return '';
      }

      let skillsToInject: Array<{ skill: SkillState, isFull: boolean }> = [];

      if (enabledSkills.length > 5) {
        // 技能较多，需要轻量筛选
        this.log.info('[SkillLoader] 技能数量较多，进行语义筛选');

        for (const skill of enabledSkills) {
          const isMatch = await this.selfLearner.checkSkillMatch(
            userMessage,
            skill.name,
            (skill as any).triggerCondition || '无'
          );
          
          skillsToInject.push({ skill, isFull: isMatch });
        }

        // 按匹配度排序，取前3个完整注入
        skillsToInject.sort((a, b) => (b.isFull ? 1 : 0) - (a.isFull ? 1 : 0));
        
        let fullCount = 0;
        skillsToInject = skillsToInject.map(item => {
          if (item.isFull && fullCount < 3) {
            fullCount++;
            return item;
          }
          return { ...item, isFull: false };
        });
      } else {
        // 技能较少，全部完整注入
        skillsToInject = enabledSkills.map(skill => ({ skill, isFull: true }));
      }

      // 构建最终内容，检查字符限制
      let finalContent = '';

      for (const { skill, isFull } of skillsToInject) {
        let contentToAdd = '';
        if (isFull) {
          contentToAdd = skill.fullInstructions + '\n';
        } else {
          contentToAdd = `## ${skill.name}\n${skill.description}\n`;
        }
        
        // 检查总长度是否超过3000字符
        if (finalContent.length + contentToAdd.length > 3000) {
          // 剩余空间用于追加摘要
          const remainingSpace = 3000 - finalContent.length;
          if (remainingSpace > 100) {
            finalContent += `## ${skill.name}\n${skill.description.substring(0, 80)}...\n`;
          }
          break;
        }
        
        finalContent += contentToAdd;
      }

      if (finalContent.length > 0) {
        this.log.info('[SkillLoader] 注入技能上下文', { 
          skillCount: skillsToInject.length, 
          contentLength: finalContent.length 
        });
      }

      return finalContent;
    } catch (error) {
      this.log.error('[SkillLoader] 获取技能上下文失败', error);
      return '';
    }
  }
}
