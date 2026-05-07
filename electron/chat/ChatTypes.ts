/**
 * PiPiClaw - 聊天类型定义
 */

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'streaming' | 'sent' | 'error';
export type ConversationStatus = 'active' | 'archived';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  timestamp: number;
  status: MessageStatus;
  modelId?: string;
  providerId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId?: string;
  providerId?: string;
  permissionSetId?: string;
  createdAt: number;
  updatedAt: number;
  status: ConversationStatus;
  pinned: boolean;
}

export interface ChatRequest {
  providerId: string;
  modelId: string;
  messages: Array<{ role: MessageRole; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: MessageRole;
      content: string;
    };
    finishReason: string;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: MessageRole;
    };
    finishReason?: string;
  }>;
}

export interface ChatSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0
};

export interface ChatSession {
  id: string;
  providerId: string;
  modelId: string;
  settings: ChatSettings;
  createdAt: number;
}
