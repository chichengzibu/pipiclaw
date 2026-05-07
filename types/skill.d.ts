/**
 * PiPiClaw - 技能类型定义
 */

export interface SkillParameter {
  id: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  required: boolean;
  defaultValue?: any;
}

export interface SkillExecutionStep {
  id: string;
  order: number;
  type: string;
  description: string;
  instruction: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  parameters: SkillParameter[];
  executionSteps: SkillExecutionStep[];
  requiredPermissions: string[];
  enabled: boolean;
  usageCount: number;
  successRate: number;
  createdAt: number;
  updatedAt: number;
}

export interface SkillExecutionResult {
  success: boolean;
  skillId: string;
  duration: number;
  error?: string;
  output?: any;
}