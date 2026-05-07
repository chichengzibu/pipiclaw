
/**
 * PiPiClaw - Hermes 自我学习引擎（重构版）
 * 
 * 职责：
 * 1. 观察用户的操作并收集到观察列表
 * 2. 达到阈值时调用大模型分析行为模式
 * 3. 生成泛化的技能提案（语义理解→抽象模式→创建技能）
 * 4. 实现语义匹配的技能触发机制
 */

import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { app, BrowserWindow } from 'electron';
import { LogManager } from '../core/LogManager';
import { ConfigStore } from '../core/ConfigStore';
import { SkillLoader } from '../skill/SkillLoader';
import { ModelManager } from '../models/ModelManager';

/**
 * 观察记录
 */
interface Observation {
  id: string;
  instruction: string;
  steps: any[];
  timestamp: number;
}

/**
 * 技能提案（包含语义触发条件）
 */
export interface SkillProposal {
  id: string;
  name: string;
  description: string;
  triggerCondition: string; // 语义描述的触发条件
  keywords: string[];
  operationSteps: string[];
  fullInstructions: string;
  createdAt: number;
}

/**
 * 模型返回的技能分析结果
 */
interface SkillAnalysisResult {
  name: string;
  description: string;
  triggerCondition: string;
  keywords: string[];
}

export class SelfLearner {
  private static instance: SelfLearner;
  private log = LogManager.getInstance();
  private configStore = ConfigStore.getInstance();
  private skillLoader = SkillLoader.getInstance();
  private modelManager = ModelManager.getInstance();
  private learningDir: string;
  private observations: Observation[] = [];
  private pendingProposal: SkillProposal | null = null;
  private analysisInProgress = false;

  private constructor() {
    // 初始化学习数据目录
    this.learningDir = path.join(app.getPath('userData'), 'hermes-learning');
    this.ensureLearningDir();
    this.loadObservations();
  }

  public static getInstance(): SelfLearner {
    if (!SelfLearner.instance) {
      SelfLearner.instance = new SelfLearner();
    }
    return SelfLearner.instance;
  }

  private ensureLearningDir(): void {
    if (!fs.existsSync(this.learningDir)) {
      fs.mkdirSync(this.learningDir, { recursive: true });
      this.log.info('[SelfLearner] 创建学习数据目录', { path: this.learningDir });
    }
  }

  private loadObservations(): void {
    try {
      const observationsPath = path.join(this.learningDir, 'observations.json');
      if (fs.existsSync(observationsPath)) {
        const data = JSON.parse(fs.readFileSync(observationsPath, 'utf-8'));
        this.observations = data;
        this.log.info('[SelfLearner] 加载观察记录成功', { count: this.observations.length });
      }
    } catch (error) {
      this.log.error('[SelfLearner] 加载观察记录失败', error);
    }
  }

  private saveObservations(): void {
    try {
      const observationsPath = path.join(this.learningDir, 'observations.json');
      fs.writeFileSync(observationsPath, JSON.stringify(this.observations, null, 2), 'utf-8');
    } catch (error) {
      this.log.error('[SelfLearner] 保存观察记录失败', error);
    }
  }

  /**
   * 观察执行过程（简化版 - 只存入观察列表）
   */
  public observeExecution(instruction: string, steps: any[], result: any): void {
    try {
      // 检查是否是重复指令（忽略大小写和标点符号）
      const normalizedInstruction = this.normalizeInstruction(instruction);
      const isDuplicate = this.observations.some(obs => 
        this.normalizeInstruction(obs.instruction) === normalizedInstruction
      );

      // 如果是重复指令，不添加到观察列表
      if (isDuplicate) {
        this.log.info('[SelfLearner] 检测到重复指令，跳过观察', { instruction });
        return;
      }

      const observation: Observation = {
        id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        instruction,
        steps,
        timestamp: Date.now()
      };

      // 只保留最近10条观察记录
      this.observations.push(observation);
      if (this.observations.length > 10) {
        this.observations.shift();
      }

      this.saveObservations();

      this.log.info('[SelfLearner] 观察到执行', { 
        instruction,
        observationCount: this.observations.length 
      });

      // 检查是否达到分析阈值
      if (this.observations.length >= 3 && !this.analysisInProgress) {
        this.analyzeAndGenerateSkill();
      }

    } catch (error) {
      this.log.error('[SelfLearner] 观察执行失败', error);
    }
  }

  /**
   * 标准化指令（忽略大小写和标点符号，保留语义差异）
   */
  private normalizeInstruction(instruction: string): string {
    // 去除标点符号，但保留一些语义相关的
    return instruction.toLowerCase()
      // 去除句号、感叹号、问号、逗号等
      .replace(/[.!,?;:'"()]/g, '')
      // 统一空白字符
      .replace(/\s+/g, ' ')
      // 去除首尾空格
      .trim();
  }

  /**
   * 分析观察数据并生成技能（大模型驱动）
   */
  private async analyzeAndGenerateSkill(): Promise<void> {
    if (this.analysisInProgress) {
      return;
    }

    this.analysisInProgress = true;

    try {
      this.log.info('[SelfLearner] 开始分析用户行为模式');

      // 获取最近的3条观察记录
      const recentObservations = this.observations.slice(-3);

      // 构造提示词
      const prompt = this.buildAnalysisPrompt(recentObservations);

      // 调用大模型分析
      const analysisResult = await this.callModelForAnalysis(prompt);

      if (analysisResult) {
        // 生成技能提案
        const proposal = this.generateSkillProposalFromAnalysis(
          analysisResult, 
          recentObservations[recentObservations.length - 1]
        );

        if (proposal) {
          // 步骤1：检查是否与现有技能重复
          const isDuplicate = await this.checkDuplicateSkill(proposal);
          if (isDuplicate) {
            this.log.info('[SelfLearner] 检测到重复技能，放弃提案', { name: proposal.name });
            return;
          }

          this.pendingProposal = proposal;
          this.log.info('[SelfLearner] 技能提案生成成功', { 
            name: proposal.name,
            triggerCondition: proposal.triggerCondition
          });

          // 通过IPC事件推送到前端
          this.notifyFrontend(proposal);
        }
      }

    } catch (error) {
      this.log.error('[SelfLearner] 分析失败', error);
    } finally {
      this.analysisInProgress = false;
    }
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(observations: Observation[]): string {
    let prompt = '你是专业的AI行为分析师。以下用户连续执行了3个操作：\n\n';

    observations.forEach((obs, index) => {
      prompt += `${index + 1}. ${obs.instruction}\n`;
    });

    prompt += '\n请分析：这些操作的共同模式是什么？背后的用户意图是什么？\n';
    prompt += '提炼出一个通用的技能，以JSON格式返回，字段：\n';
    prompt += '- name: 技能名称（简洁描述）\n';
    prompt += '- description: 详细描述\n';
    prompt += '- triggerCondition: 语义描述的触发条件（什么情况下用户会想使用这个技能）\n';
    prompt += '- keywords: 关键词数组（3-5个）\n';
    prompt += '\n只返回JSON，不要包含markdown代码块标记。';

    return prompt;
  }

  /**
   * 调用大模型进行分析
   */
  private async callModelForAnalysis(prompt: string): Promise<SkillAnalysisResult | null> {
    try {
      // 获取当前激活的模型提供商
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        this.log.warn('[SelfLearner] 没有启用的模型提供商');
        return null;
      }

      // 使用第一个启用的提供商
      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || provider.models[0]?.id;

      if (!modelId) {
        this.log.warn('[SelfLearner] 没有可用的模型');
        return null;
      }

      this.log.info('[SelfLearner] 调用大模型分析行为模式', {
        provider: provider.name,
        model: modelId
      });

      // 调用大模型
      const response = await this.makeChatCompletionRequest(provider, modelId, prompt);

      if (response) {
        // 解析返回的JSON
        const analysisResult = this.parseModelResponse(response);
        return analysisResult;
      }

    } catch (error) {
      this.log.error('[SelfLearner] 调用大模型失败', error);
    }

    return null;
  }

  /**
   * 发起聊天补全请求
   */
  private async makeChatCompletionRequest(
    provider: any,
    modelId: string,
    prompt: string
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, provider.timeout || 60000);

      let req: http.ClientRequest;

      try {
        switch (provider.type) {
          case 'openai':
          case 'deepseek':
          case 'custom': {
            // OpenAI兼容格式
            const url = new URL('/v1/chat/completions', provider.baseUrl);
            const protocol = url.protocol === 'https:' ? https : http;
            
            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            };
            if (provider.apiKey) {
              headers['Authorization'] = `Bearer ${provider.apiKey}`;
            }

            const body = JSON.stringify({
              model: modelId,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
              max_tokens: 500
            });

            req = protocol.request(url, { method: 'POST', headers }, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.message?.content) {
                    resolve(parsed.choices[0].message.content);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }

          case 'anthropic': {
            const url = new URL('/v1/messages', provider.baseUrl);
            const protocol = url.protocol === 'https:' ? https : http;
            
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'x-api-key': provider.apiKey || '',
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            };

            const body = JSON.stringify({
              model: modelId,
              max_tokens: 500,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3
            });

            req = protocol.request(url, { method: 'POST', headers }, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content?.[0]?.text) {
                    resolve(parsed.content[0].text);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }

          case 'azure': {
            const deploymentName = provider.deploymentName || modelId;
            const url = new URL(
              `/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || '2024-02-01'}`,
              provider.baseUrl
            );
            const protocol = url.protocol === 'https:' ? https : http;
            
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'api-key': provider.apiKey || ''
            };

            const body = JSON.stringify({
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
              max_tokens: 500
            });

            req = protocol.request(url, { method: 'POST', headers }, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.message?.content) {
                    resolve(parsed.choices[0].message.content);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }

          case 'ollama': {
            const url = new URL('/api/chat', provider.baseUrl);
            const protocol = url.protocol === 'https:' ? https : http;
            
            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            };

            const body = JSON.stringify({
              model: modelId,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
              options: { temperature: 0.3, num_predict: 500 }
            });

            req = protocol.request(url, { method: 'POST', headers }, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.message?.content) {
                    resolve(parsed.message.content);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }

          default:
            clearTimeout(timeout);
            resolve(null);
            return;
        }

        req.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        req.end();

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * 解析模型返回的响应
   */
  private parseModelResponse(response: string): SkillAnalysisResult | null {
    try {
      // 尝试直接解析JSON
      let jsonStr = response.trim();
      
      // 如果有```包裹，提取里面的内容
      if (jsonStr.startsWith('```json') || jsonStr.startsWith('```')) {
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        }
      }

      const parsed = JSON.parse(jsonStr);
      
      return {
        name: parsed.name || '自动学习技能',
        description: parsed.description || '',
        triggerCondition: parsed.triggerCondition || '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
      };

    } catch (error) {
      this.log.error('[SelfLearner] 解析模型响应失败', error);
      return null;
    }
  }

  /**
   * 从分析结果生成技能提案
   */
  private generateSkillProposalFromAnalysis(
    analysisResult: SkillAnalysisResult,
    lastObservation: Observation
  ): SkillProposal | null {
    try {
      const skillId = `auto_${Date.now()}`;
      
      // 从最后一次观察中提取操作步骤
      const operationSteps = this.extractOperationSteps(lastObservation.steps);
      
      // 生成完整的技能文档
      const fullInstructions = this.generateFullSkillInstructions(
        analysisResult,
        lastObservation.instruction,
        operationSteps
      );

      const proposal: SkillProposal = {
        id: skillId,
        name: analysisResult.name,
        description: analysisResult.description,
        triggerCondition: analysisResult.triggerCondition,
        keywords: analysisResult.keywords,
        operationSteps,
        fullInstructions,
        createdAt: Date.now()
      };

      return proposal;

    } catch (error) {
      this.log.error('[SelfLearner] 生成技能提案失败', error);
      return null;
    }
  }

  /**
   * 从执行步骤中提取描述
   */
  private extractOperationSteps(steps: any[]): string[] {
    return steps.map(step => step.description || `执行 ${step.type}`);
  }

  /**
   * 生成完整的技能文档
   */
  private generateFullSkillInstructions(
    analysisResult: SkillAnalysisResult,
    example: string,
    steps: string[]
  ): string {
    let instructions = `# ${analysisResult.name}\n\n`;
    instructions += `## 描述\n${analysisResult.description}\n\n`;
    instructions += `## 触发条件\n${analysisResult.triggerCondition}\n\n`;
    instructions += `## 关键词\n`;
    analysisResult.keywords.forEach(keyword => {
      instructions += `- ${keyword}\n`;
    });
    instructions += '\n## 操作步骤\n';
    steps.forEach((step, index) => {
      instructions += `${index + 1}. ${step}\n`;
    });
    instructions += `\n## 示例\n${example}\n`;
    
    return instructions;
  }

  /**
   * 通知前端有新的技能提案
   */
  private notifyFrontend(proposal: SkillProposal): void {
    try {
      // 获取所有窗口并发送事件
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('skills:new-proposal', proposal);
        }
      });
      this.log.info('[SelfLearner] 已通知前端技能提案');
    } catch (error) {
      this.log.error('[SelfLearner] 通知前端失败', error);
    }
  }

  /**
   * 语义匹配检查（判断新指令是否触发已保存技能）
   */
  public async checkSkillMatch(
    userInstruction: string,
    skillName: string,
    triggerCondition: string
  ): Promise<boolean> {
    try {
      // 获取激活的模型
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        return false;
      }

      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || provider.models[0]?.id;

      if (!modelId) {
        return false;
      }

      // 构建判断提示词
      const prompt = `当前用户指令：${userInstruction}\n\n已保存技能"${skillName}"的触发条件：${triggerCondition}\n\n请问：当前用户指令是否符合该技能的触发条件？只回答"是"或"否"。`;

      // 调用大模型判断
      const response = await this.makeChatCompletionRequest(provider, modelId, prompt);

      if (response) {
        const normalized = response.toLowerCase().trim();
        return normalized.includes('是') || normalized.includes('yes');
      }

    } catch (error) {
      this.log.error('[SelfLearner] 语义匹配失败', error);
    }

    return false;
  }

  /**
   * 检查新提案是否与现有技能重复
   */
  private async checkDuplicateSkill(proposal: SkillProposal): Promise<boolean> {
    try {
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        this.log.warn('[SelfLearner] 没有启用的模型，无法进行去重检查');
        return false;
      }

      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || provider.models[0]?.id;
      if (!modelId) {
        return false;
      }

      const skills = this.skillLoader.getAllSkills();
      
      for (const existingSkill of skills) {
        const prompt = `当前提案的技能触发条件：${proposal.triggerCondition}\n\n已安装技能"${existingSkill.name}"的触发条件：${(existingSkill as any).triggerCondition || '无'}。\n\n请判断：这两个触发条件描述的是否是同一种用户意图？只回答"是"或"否"。`;
        
        const response = await this.makeChatCompletionRequest(provider, modelId, prompt);
        
        if (response) {
          const normalized = response.toLowerCase().trim();
          if (normalized.includes('是') || normalized.includes('yes')) {
            this.log.info('[SelfLearner] 发现重复技能', { 
              existingSkillName: existingSkill.name,
              proposalName: proposal.name
            });
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      this.log.error('[SelfLearner] 去重检查失败', error);
      return false;
    }
  }

  /**
   * 从提案保存技能
   * @returns { success: boolean; needsRestart: boolean }
   */
  public saveSkillFromProposal(proposal: SkillProposal): { success: boolean; needsRestart: boolean } {
    let needsRestart = false;
    
    try {
      const skillsDir = path.join(app.getAppPath(), '..', 'skills');
      let skillDir = path.join(skillsDir, proposal.id);
      
      // 检查目录是否已存在，如果存在则添加时间戳后缀
      let dirCounter = 0;
      while (fs.existsSync(skillDir)) {
        dirCounter++;
        const suffix = dirCounter === 1 ? Date.now().toString() : `${Date.now()}_${dirCounter}`;
        skillDir = path.join(skillsDir, `${proposal.id}_${suffix}`);
        this.log.info('[SelfLearner] 技能目录已存在，使用新目录', { skillDir });
      }

      // 确保目录存在（递归创建）
      fs.mkdirSync(skillDir, { recursive: true });
      
      // 写入 skill.md
      const skillMdPath = path.join(skillDir, 'skill.md');
      fs.writeFileSync(skillMdPath, proposal.fullInstructions, 'utf-8');
      
      // 调用 SkillLoader 重新加载技能（热加载）
      try {
        const skillLoader = SkillLoader.getInstance();
        skillLoader.reloadSkills();
        this.log.info('[SelfLearner] 技能热加载成功');
      } catch (error) {
        this.log.warn('[SelfLearner] 技能热加载失败，需要重启', error);
        needsRestart = true;
      }
      
      this.log.info('[SelfLearner] 技能保存成功', { skillId: proposal.id, skillDir, name: proposal.name, needsRestart });
      
      // 清除待处理提案
      this.pendingProposal = null;
      
      return { success: true, needsRestart };
      
    } catch (error) {
      this.log.error('[SelfLearner] 保存技能失败', error);
      return { success: false, needsRestart: false };
    }
  }

  /**
   * 获取待处理的提案
   */
  public getPendingProposal(): SkillProposal | null {
    return this.pendingProposal;
  }

  /**
   * 清除待处理提案
   */
  public clearPendingProposal(): void {
    this.pendingProposal = null;
  }

  /**
   * 比较两个技能的相似度（公共方法）
   */
  public async checkSkillSimilarity(
    name1: string,
    description1: string,
    name2: string,
    description2: string
  ): Promise<number> {
    try {
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        this.log.warn('[SelfLearner] 没有启用的模型，无法进行相似度检查');
        return 0;
      }

      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || provider.models[0]?.id;
      if (!modelId) {
        return 0;
      }

      const prompt = `请判断以下两个技能是否描述了相同或非常相似的用户意图？
请只回答0-100之间的数字表示相似度，100表示完全相同，0表示完全不同。

技能1名称：${name1}
技能1描述：${description1}

技能2名称：${name2}
技能2描述：${description2}
`;

      const response = await this.makeChatCompletionRequest(provider, modelId, prompt);

      if (response) {
        const match = response.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      }

      return 0;
    } catch (error) {
      this.log.error('[SelfLearner] 相似度检查失败', error);
      return 0;
    }
  }

  /**
   * 获取学习统计
   */
  public getStats(): Record<string, number> {
    return {
      observationCount: this.observations.length,
      analysisInProgress: this.analysisInProgress ? 1 : 0
    };
  }

  /**
   * 重置学习统计
   */
  public resetStats(): void {
    this.observations = [];
    this.pendingProposal = null;
    this.saveObservations();
    this.log.info('[SelfLearner] 学习统计已重置');
  }

  /**
   * [兼容] 保持原来的checkPatternThreshold接口（始终返回false）
   */
  public checkPatternThreshold(fingerprint: string): boolean {
    return false;
  }

  /**
   * [兼容] 保持原来的generateSkillProposal接口
   */
  public generateSkillProposal(fingerprint: string): SkillProposal | null {
    return this.pendingProposal;
  }
}

