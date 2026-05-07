/**
 * PiPiClaw - 新手引导状态管理
 * 
 * 职责：
 * 1. 管理示例指令
 * 2. 管理收藏状态
 * 3. 管理快速开始模板
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface ExamplePrompt {
  id: string;
  category: string;
  icon: string;
  title: string;
  description: string;
  content: string;
}

export interface QuickTemplate {
  id: string;
  category: string;
  icon: string;
  title: string;
  content: string;
}

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: '1',
    category: '办公自动化',
    icon: '📁',
    title: '整理桌面文件',
    description: '按文件类型自动分类到不同文件夹',
    content: '请帮我整理桌面文件，按类型（图片、文档、视频、压缩包）分类到对应的文件夹中'
  },
  {
    id: '2',
    category: '办公自动化',
    icon: '📊',
    title: 'Excel数据清洗',
    description: '清洗Excel中的空行、重复数据',
    content: '我有一个Excel文件需要清洗，请帮我删除空行和重复数据，然后保存为新文件'
  },
  {
    id: '3',
    category: '办公自动化',
    icon: '📝',
    title: '批量重命名',
    description: '批量重命名文件，按序号排列',
    content: '请将当前目录下的所有图片文件批量重命名为 photo_001.jpg, photo_002.jpg 格式'
  },
  {
    id: '4',
    category: '代码开发',
    icon: '🐍',
    title: '生成Python爬虫',
    description: '生成一个简单的网页爬虫',
    content: '请帮我写一个Python爬虫，爬取 https://example.com 的标题和正文内容'
  },
  {
    id: '5',
    category: '代码开发',
    icon: '☕',
    title: 'Java CRUD代码',
    description: '生成Java实体类和CRUD接口',
    content: '请帮我生成一个User实体类的Java代码，包含基本的CRUD操作'
  },
  {
    id: '6',
    category: '代码开发',
    icon: '🔍',
    title: '代码审查',
    description: '审查代码并提出优化建议',
    content: '请帮我审查以下代码，检查潜在问题并提出优化建议：'
  },
  {
    id: '7',
    category: '日常助手',
    icon: '📅',
    title: '生成周报',
    description: '根据工作记录生成周报',
    content: '请根据以下工作记录帮我生成一份简洁的周报：'
  },
  {
    id: '8',
    category: '日常助手',
    icon: '✉️',
    title: '写邮件',
    description: '写一封专业的商务邮件',
    content: '请帮我写一封商务邮件，主题是项目进度汇报，收件人是客户'
  }
];

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 't1',
    category: '办公自动化',
    icon: '📁',
    title: '整理桌面',
    content: '请帮我整理桌面文件，按类型分类到不同文件夹'
  },
  {
    id: 't2',
    category: '代码开发',
    icon: '🐍',
    title: 'Python爬虫',
    content: '请帮我写一个Python爬虫，爬取指定网页的内容'
  },
  {
    id: 't3',
    category: '数据分析',
    icon: '📊',
    title: 'Excel分析',
    content: '请帮我分析这个Excel文件，生成数据统计报告'
  }
];

export const useGuideStore = defineStore('guide', () => {
  // 状态
  const examplePrompts = ref<ExamplePrompt[]>(EXAMPLE_PROMPTS);
  const quickTemplates = ref<QuickTemplate[]>(QUICK_TEMPLATES);
  const favoriteIds = ref<string[]>([]);

  // 计算属性
  const favoritePrompts = computed(() => {
    return examplePrompts.value.filter(p => favoriteIds.value.includes(p.id));
  });

  const promptsByCategory = computed(() => {
    const groups: Record<string, ExamplePrompt[]> = {};
    examplePrompts.value.forEach(prompt => {
      if (!groups[prompt.category]) {
        groups[prompt.category] = [];
      }
      groups[prompt.category].push(prompt);
    });
    return groups;
  });

  // 动作方法
  function toggleFavorite(id: string): void {
    const index = favoriteIds.value.indexOf(id);
    if (index > -1) {
      favoriteIds.value.splice(index, 1);
    } else {
      favoriteIds.value.push(id);
    }
  }

  function isFavorite(id: string): boolean {
    return favoriteIds.value.includes(id);
  }

  return {
    examplePrompts,
    quickTemplates,
    favoriteIds,
    favoritePrompts,
    promptsByCategory,
    toggleFavorite,
    isFavorite
  };
});