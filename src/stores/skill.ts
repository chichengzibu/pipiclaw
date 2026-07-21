/**
 * PiPiClaw - 技能状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Skill, SkillParameter } from '../../types/skill';

export type { Skill, SkillParameter };

// 内置预设技能模板
const PRESET_SKILLS: Omit<Skill, 'createdAt' | 'updatedAt' | 'usageCount' | 'successRate'>[] = [
  {
    id: 'preset-rename-files',
    name: '批量文件重命名',
    description: '批量重命名指定目录下的文件，支持按序号、日期、规则重命名',
    category: '办公自动化',
    tags: ['文件', '重命名', '批量'],
    parameters: [
      {
        id: 'path',
        name: '目录路径',
        description: '需要重命名文件的目录',
        type: 'string',
        required: true
      },
      {
        id: 'pattern',
        name: '重命名规则',
        description: '新文件名的规则（如：file_001.txt）',
        type: 'string',
        required: true
      }
    ],
    executionSteps: [],
    requiredPermissions: ['filesystem'],
    enabled: true
  },
  {
    id: 'preset-organize-desktop',
    name: '桌面文件分类整理',
    description: '按文件类型自动分类到图片、文档、视频、压缩包等文件夹',
    category: '办公自动化',
    tags: ['桌面', '整理', '分类'],
    parameters: [],
    executionSteps: [],
    requiredPermissions: ['filesystem'],
    enabled: true
  },
  {
    id: 'preset-clean-excel',
    name: 'Excel数据清洗',
    description: '清洗Excel中的空行、重复数据、格式转换',
    category: '办公自动化',
    tags: ['Excel', '数据清洗', '整理'],
    parameters: [
      {
        id: 'file',
        name: 'Excel文件',
        description: '需要清洗的Excel文件',
        type: 'file',
        required: true
      }
    ],
    executionSteps: [],
    requiredPermissions: ['filesystem'],
    enabled: true
  }
];

export const useSkillStore = defineStore('skill', () => {
  const skills = ref<Skill[]>([]);
  const showExecuteModal = ref(false);
  const selectedSkill = ref<Skill | null>(null);

  const mySkills = computed(() => skills.value.filter(s => !s.id.startsWith('preset-')));
  const presetSkills = computed(() => PRESET_SKILLS);

  function setSkills(newSkills: Skill[]): void {
    skills.value = newSkills;
  }

  function addSkill(skill: Skill): void {
    skills.value.push(skill);
  }

  function removeSkill(id: string): void {
    const index = skills.value.findIndex(s => s.id === id);
    if (index !== -1) {
      skills.value.splice(index, 1);
    }
  }

  function openExecuteModal(skill: Skill): void {
    selectedSkill.value = skill;
    showExecuteModal.value = true;
  }

  function closeExecuteModal(): void {
    showExecuteModal.value = false;
    selectedSkill.value = null;
  }

  return {
    skills,
    mySkills,
    presetSkills,
    showExecuteModal,
    selectedSkill,
    setSkills,
    addSkill,
    removeSkill,
    openExecuteModal,
    closeExecuteModal
  };
});