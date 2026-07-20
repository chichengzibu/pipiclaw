/**
 * InstructionGenerator - 大模型指令生成器
 * 用大模型直接将用户自然语言转为结构化操作步骤
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { LogManager } from '../core/LogManager';
import { ModelManager } from '../models/ModelManager';
import { SkillLoader } from '../skill/SkillLoader';

/**
 * 操作步骤类型
 */
export interface GeneratedStep {
  action: string;
  params: Record<string, any>;
  description?: string;
}

export class InstructionGenerator {
  private static instance: InstructionGenerator;
  private log = LogManager.getInstance();
  private modelManager = ModelManager.getInstance();
  private skillLoader = SkillLoader.getInstance();

  private constructor() {
    this.log.info('[InstructionGenerator] 初始化');
  }

  public static getInstance(): InstructionGenerator {
    if (!InstructionGenerator.instance) {
      InstructionGenerator.instance = new InstructionGenerator();
    }
    return InstructionGenerator.instance;
  }

  /**
   * 从用户指令生成操作步骤
   */
  public async generateTaskSteps(userInstruction: string, preferredProviderId?: string, preferredModelId?: string): Promise<GeneratedStep[] | null> {
    this.log.info(`[InstructionGenerator] 生成步骤: ${userInstruction}`);
    this.log.info(`[InstructionGenerator] 用户选择: provider=${preferredProviderId || '未指定'}, model=${preferredModelId || '未指定'}`);

    try {
      let provider: any = null;
      let model: any = null;

      if (preferredProviderId) {
        provider = this.modelManager.getProvider(preferredProviderId);
        if (provider) {
          if (preferredModelId) {
            model = provider.models.find((m: any) => m.id === preferredModelId && m.enabled) || provider.models.find((m: any) => m.enabled);
          } else {
            model = provider.models.find((m: any) => m.enabled) || provider.models[0];
          }
        }
      }

      if (!provider || !model) {
        const providers = this.modelManager.getAllProviders().filter((p: any) => p.enabled);
        if (providers.length === 0) {
          this.log.error('[InstructionGenerator] 没有可用的模型');
          return null;
        }
        provider = providers[0];
        model = provider.models.find((m: any) => m.enabled) || provider.models[0];
      }
      
      if (!model) {
        this.log.error('[InstructionGenerator] 没有可用的模型');
        return null;
      }

      this.log.info(`[InstructionGenerator] 实际使用: provider=${provider.name}(${provider.type}), model=${model.name || model.id}`);

      // 生成步骤
      let steps = await this.callModel(userInstruction, provider, model);
      
      // 【修改2：增加本地校验与补救】
      if (steps && steps.length > 0) {
        steps = await this.validateAndFixSteps(steps, userInstruction, provider, model);
      }
      
      if (steps && steps.length > 0) {
        this.log.info(`[InstructionGenerator] 生成成功: ${steps.length} 个步骤`);
        this.log.info('[InstructionGenerator] 最终步骤:', JSON.stringify(steps, null, 2));
        return steps;
      }

      return null;
    } catch (error) {
      this.log.error('[InstructionGenerator] 生成步骤失败:', error);
      return null;
    }
  }

  /**
   * 【修改2：校验并修复步骤】
   */
  private async validateAndFixSteps(
    steps: GeneratedStep[],
    userInstruction: string,
    provider: any,
    model: any
  ): Promise<GeneratedStep[]> {
    const fixedSteps = [...steps];

    for (let i = 0; i < fixedSteps.length; i++) {
      const step = fixedSteps[i];
      
      // 检查 write_file 是否有 content
      if (step.action === 'write_file') {
        const hasContent = step.params?.content && step.params.content.trim() !== '';
        
        if (!hasContent) {
          this.log.warn('[InstructionGenerator] write_file 缺少 content，尝试补充生成...');
          
          try {
            // 补充生成 content
            const content = await this.generateMissingContent(userInstruction, provider, model);
            
            if (content && content.trim() !== '') {
              step.params.content = content;
              this.log.info('[InstructionGenerator] 成功补充 content，长度:', content.length);
            } else {
              step.params.content = '（内容生成失败，请手动输入）';
            }
          } catch (error) {
            this.log.error('[InstructionGenerator] 补充 content 失败:', error);
            step.params.content = '（内容生成失败，请手动输入）';
          }
        }
      }
    }

    return fixedSteps;
  }

  /**
   * 补充生成缺失的内容
   */
  private async generateMissingContent(
    userInstruction: string,
    provider: any,
    model: any
  ): Promise<string | null> {
    const systemPrompt = '你是内容生成助手。根据用户的原始指令，请只返回文件应该包含的完整内容，不要任何解释，不要JSON格式，只返回纯文本内容。';
    const userPrompt = `用户原始指令："${userInstruction}"\n\n请你只返回这份文件应该包含的完整文本内容。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl;
      if (!baseUrl) {
        reject(new Error('缺少 baseUrl'));
        return;
      }
      baseUrl = baseUrl.replace(/\/$/, '');

      let url: URL;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (provider.type === 'openai' || provider.type === 'deepseek' || provider.type === 'custom' || provider.type === 'ollama') {
        let endpoint = '/chat/completions';
        if (provider.type === 'ollama') {
          endpoint = '/api/chat';
        }
        url = new URL(baseUrl + endpoint);
        headers['Authorization'] = `Bearer ${provider.apiKey || ''}`;
      } else if (provider.type === 'azure') {
        const deploymentName = provider.deploymentName || model.id;
        url = new URL(`${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || '2024-02-01'}`);
        headers['api-key'] = provider.apiKey || '';
      } else {
        reject(new Error(`不支持的提供商类型: ${provider.type}`));
        return;
      }

      const body: any = {
        model: model.id,
        messages,
        stream: false,
        temperature: 0.3,
        max_tokens: 3000
      };

      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 11434),
          path: url.pathname + url.search,
          method: 'POST',
          headers
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = JSON.parse(data);
                let content = '';
                
                if (provider.type === 'ollama' && parsed.message) {
                  content = parsed.message.content;
                } else if (parsed.choices?.[0]?.message?.content) {
                  content = parsed.choices[0].message.content;
                }

                if (content && content.trim()) {
                  resolve(content.trim());
                } else {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            } catch (error) {
              resolve(null);
            }
          });
        }
      );

      req.on('error', () => resolve(null));
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * 调用大模型生成步骤
   */
  private async callModel(
    userInstruction: string,
    provider: any,
    model: any
  ): Promise<GeneratedStep[] | null> {
    // 获取技能摘要和匹配的技能
    const skillSummaries = this.skillLoader.getAllSkillSummaries();
    const matchedSkillContext = this.skillLoader.getSkillContext(userInstruction);
    
    // 构建包含技能系统的系统提示词
    let systemPrompt = `你是专业的桌面自动化助手。根据用户指令生成结构化操作步骤。

可用工具：
- write_file: 写入文件，参数: filePath, content
- read_file: 读取文件，参数: filePath
- delete_file: 删除文件，参数: filePath
- list_directory: 列出目录内容，参数: directoryPath
- run_command: 运行命令，参数: command, cwd (可选)
- open_url: 打开URL，参数: url
- create_file: 创建文件，参数: filePath, content
- rename_file: 重命名文件，参数: filePath, newPath
- create_directory: 创建目录，参数: directoryPath
- delete_directory: 删除目录，参数: directoryPath
- file_exists: 检查文件是否存在，参数: filePath
- clipboard_read: 读取剪贴板，参数: 无
- clipboard_write: 写入剪贴板，参数: text
- browser_open: 打开浏览器，参数: url (可选)
- browser_navigate: 导航到URL，参数: url, sessionId (可选)
- browser_click: 点击元素，参数: selector, sessionId (可选)
- browser_type: 输入文本，参数: selector, text, sessionId (可选)
- browser_get_text: 获取文本，参数: selector, sessionId (可选)
- browser_wait_for: 等待元素，参数: selector, timeout (可选), sessionId (可选)
- browser_screenshot: 截图，参数: path (可选), sessionId (可选)

【技能系统 - 优先使用】
${skillSummaries}

要求：
1. 首先检查用户消息是否匹配上述任何技能的触发关键词
2. 如果匹配到技能，严格按照该技能的操作步骤来生成结构化指令
3. 当操作需要文件内容时（如 write_file），必须在 params 中包含 content 字段并填入完整的文本内容
4. 对于任何要求写入内容的指令（如九九乘法表、文章、代码等），必须一次性在 content 中生成完整结果，不得留空或只写标题
5. 必须只返回纯 JSON 数组，不要任何解释、说明、markdown 等
6. 路径要使用用户实际描述的位置
7. 如果无法理解用户指令，返回空数组 []

重要：文件操作安全规则（必须严格遵守！）
规则1：执行任何文件操作时，如果用户没有明确指定文件扩展名，必须优先使用 list_directory 查看目标目录，匹配已有的文件名和扩展名，严禁在找不到文件时擅自创建新文件名。
规则2：遇到修改、编辑、更新、追加、改写、替换文件内容的需求，流程必须是：list_directory 确认文件 -> read_file 读取内容 -> write_file 写入修改。
规则3：写文件时，content 字段必须严格根据用户指令生成或修改的完整内容，绝对禁止在没有明确指令时清空文件内容。

文件修改流程规则 - 遇到修改，先读后写！
- 当用户要求修改、编辑、更新、追加、改写、替换文件内容时，必须按照以下两步流程：
  步骤1：先生成 read_file 指令读取该文件的当前内容
  步骤2：再生成 write_file 指令，根据用户要求修改后写入完整内容
- 这个规则对文件修改操作是强制的，必须遵守，不得直接生成 write_file 而跳过 read_file

示例：
用户指令："在桌面创建 test.txt，内容是九九乘法表"
返回：[{"action":"write_file","params":{"filePath":"桌面/test.txt","content":"【这里必须填入用户要求的完整文本内容，不得省略】"}}]`;

    // 如果匹配到特定技能，将技能的完整步骤注入到提示词中
    if (matchedSkillContext) {
      systemPrompt += `\n\n【检测到匹配的技能】\n${matchedSkillContext}\n\n请严格按照上述技能的操作步骤生成结构化指令。`;
      this.log.info('[InstructionGenerator] 注入匹配技能到提示词');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInstruction }
    ];

    // 尝试第一次调用
    let result = await this.makeRequest(messages, provider, model);
    
    // 如果失败，重试一次
    if (!result) {
      this.log.warn('[InstructionGenerator] 第一次调用失败，重试...');
      result = await this.makeRequest(messages, provider, model);
    }

    return result;
  }

  /**
   * 发送请求到模型
   */
  private async makeRequest(
    messages: Array<{ role: string; content: string }>,
    provider: any,
    model: any
  ): Promise<GeneratedStep[] | null> {
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl;
      if (!baseUrl) {
        reject(new Error('缺少 baseUrl'));
        return;
      }
      baseUrl = baseUrl.replace(/\/$/, '');

      let url: URL;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: any;

      if (provider.type === 'anthropic') {
        // 检查 API Key
        if (!provider.apiKey) {
          reject(new Error('Anthropic API Key未配置，请在设置中配置API Key'));
          return;
        }

        url = new URL(baseUrl + '/v1/messages');
        headers['x-api-key'] = provider.apiKey || '';
        headers['anthropic-version'] = '2023-06-01';

        // 分离 system 消息和其他消息
        let systemMessage = '';
        const filteredMessages = messages.filter(m => {
          if (m.role === 'system') {
            systemMessage = m.content;
            return false;
          }
          return true;
        }).map(m => ({ role: m.role, content: m.content }));

        body = {
          model: model.id,
          messages: filteredMessages,
          stream: false,
          max_tokens: 2000
        };
        if (systemMessage) {
          body.system = systemMessage;
        }
      } else if (provider.type === 'openai' || provider.type === 'deepseek' || provider.type === 'custom' || provider.type === 'ollama') {
        let endpoint = '/chat/completions';
        if (provider.type === 'ollama') {
          endpoint = '/api/chat';
        }
        url = new URL(baseUrl + endpoint);
        headers['Authorization'] = `Bearer ${provider.apiKey || ''}`;
        
        body = {
          model: model.id,
          messages,
          stream: false,
          temperature: 0.1,
          max_tokens: 2000
        };
      } else if (provider.type === 'azure') {
        const deploymentName = provider.deploymentName || model.id;
        url = new URL(`${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || '2024-02-01'}`);
        headers['api-key'] = provider.apiKey || '';
        
        body = {
          model: model.id,
          messages,
          stream: false,
          temperature: 0.1,
          max_tokens: 2000
        };
      } else {
        reject(new Error(`不支持的提供商类型: ${provider.type}`));
        return;
      }

      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 11434),
          path: url.pathname + url.search,
          method: 'POST',
          headers
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = JSON.parse(data);
                let content = '';
                
                if (provider.type === 'anthropic') {
                  content = parsed.content?.[0]?.text || '';
                } else if (provider.type === 'ollama' && parsed.message) {
                  content = parsed.message.content;
                } else if (parsed.choices?.[0]?.message?.content) {
                  content = parsed.choices[0].message.content;
                }

                if (!content) {
                  this.log.error('[InstructionGenerator] 模型返回内容为空');
                  resolve(null);
                  return;
                }

                // 尝试解析 JSON
                this.log.info('[InstructionGenerator] 模型返回:', content);
                
                // 清理返回内容（去除可能的 markdown 包裹）
                const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                
                try {
                  const steps = JSON.parse(cleanContent);
                  if (Array.isArray(steps)) {
                    resolve(steps);
                  } else {
                    this.log.error('[InstructionGenerator] 返回不是数组');
                    resolve(null);
                  }
                } catch (parseError) {
                  this.log.error('[InstructionGenerator] JSON 解析失败:', parseError);
                  resolve(null);
                }
              } else {
                let errorMsg = `请求失败: HTTP ${res.statusCode}`;
                try {
                  const errorJson = JSON.parse(data);
                  errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
                } catch { /* ignore parse error */ }
                
                if (res.statusCode === 401) {
                  if (provider.type === 'anthropic') {
                    errorMsg = 'Anthropic API Key无效，请检查您的API Key';
                  } else {
                    errorMsg = 'API Key无效，请检查您的API Key';
                  }
                } else if (res.statusCode === 429) {
                  errorMsg = '请求过于频繁，请稍后再试';
                }
                
                this.log.error('[InstructionGenerator] 请求失败:', res.statusCode, data);
                resolve(null);
              }
            } catch (error) {
              this.log.error('[InstructionGenerator] 解析响应失败:', error);
              resolve(null);
            }
          });
        }
      );

      req.on('error', (error) => {
        this.log.error('[InstructionGenerator] 请求错误:', error);
        resolve(null);
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }
}