/**
 * PiPiClaw - OpenClaw 执行器
 * 
 * 职责：
 * 1. 接收执行计划，拆解为单步操作
 * 2. 逐行调用OpenClawGateway执行操作
 * 3. 实时返回执行状态
 * 4. 失败自动重试
 * 5. 返回完整执行报告
 */

import { LogManager } from '../core/LogManager';
import { OpenClawGateway } from './OpenClawGateway';
import type {
  OpenClawOperationRequest,
  OpenClawOperationResult,
  OpenClawBatchRequest,
  OpenClawBatchResult
} from '../types/openclaw';

export class OpenClawExecutor {
  private static instance: OpenClawExecutor;
  private log = LogManager.getInstance();
  private gateway = OpenClawGateway.getInstance();
  private maxRetries = 3;

  private constructor() {
    this.log.info('[OpenClawExecutor] 初始化中...');
    this.log.info('[OpenClawExecutor] 初始化完成');
  }

  public static getInstance(): OpenClawExecutor {
    if (!OpenClawExecutor.instance) {
      OpenClawExecutor.instance = new OpenClawExecutor();
    }
    return OpenClawExecutor.instance;
  }

  /**
   * 设置最大重试次数
   */
  public setMaxRetries(retries: number): void {
    this.maxRetries = Math.max(0, Math.min(10, retries));
    this.log.info(`[OpenClawExecutor] 最大重试次数设置为: ${this.maxRetries}`);
  }

  /**
   * 执行单个操作（带重试）
   */
  public async executeWithRetry(
    request: OpenClawOperationRequest,
    retries = this.maxRetries
  ): Promise<OpenClawOperationResult> {
    const operationId = request.operationId || `op_${Date.now()}`;
    let lastError: Error | null = null;

    this.log.info(`[OpenClawExecutor] 开始执行操作: ${request.operationType}, ID: ${operationId}, 重试次数: ${retries}`);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.log.debug(`[OpenClawExecutor] 尝试执行第 ${attempt + 1}/${retries + 1} 次`);
        
        const result = await this.gateway.executeOperation({
          ...request,
          operationId
        });

        if (result.success) {
          this.log.info(`[OpenClawExecutor] 操作执行成功: ${request.operationType}`);
          return result;
        } else {
          lastError = new Error(result.error || '操作失败');
          this.log.warn(`[OpenClawExecutor] 操作执行失败 (尝试 ${attempt + 1}/${retries + 1}): ${result.error}`);
        }
      } catch (error: any) {
        lastError = error;
        this.log.warn(`[OpenClawExecutor] 操作异常 (尝试 ${attempt + 1}/${retries + 1}):`, error);
      }

      // 如果不是最后一次尝试，等待后重试
      if (attempt < retries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        this.log.debug(`[OpenClawExecutor] 等待 ${waitTime}ms 后重试...`);
        await this.sleep(waitTime);
      }
    }

    // 所有重试都失败了
    const finalResult: OpenClawOperationResult = {
      success: false,
      operationType: request.operationType,
      operationId,
      status: 'failed',
      error: lastError?.message || '操作执行失败，已耗尽重试次数',
      errorCode: 'MAX_RETRIES_EXCEEDED'
    };

    this.log.error(`[OpenClawExecutor] 操作最终失败: ${request.operationType}`, lastError);
    return finalResult;
  }

  /**
   * 批量执行操作
   */
  public async executeBatch(request: OpenClawBatchRequest): Promise<OpenClawBatchResult> {
    const { operations, failFast = false, parallel = false } = request;
    const startTime = Date.now();
    const results: OpenClawOperationResult[] = [];

    this.log.info(`[OpenClawExecutor] 开始批量执行: ${operations.length} 个操作, failFast: ${failFast}, parallel: ${parallel}`);

    try {
      if (parallel) {
        // 并行执行
        this.log.debug('[OpenClawExecutor] 使用并行执行模式');
        const promises = operations.map((op, index) => 
          this.executeWithRetry({ ...op, operationId: op.operationId || `batch_op_${index}` })
        );
        results.push(...(await Promise.all(promises)));
      } else {
        // 串行执行
        this.log.debug('[OpenClawExecutor] 使用串行执行模式');
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          const result = await this.executeWithRetry({
            ...op,
            operationId: op.operationId || `batch_op_${i}`
          });
          
          results.push(result);

          // 如果启用了快速失败，且当前操作失败，则停止后续操作
          if (failFast && !result.success) {
            this.log.warn(`[OpenClawExecutor] 快速失败: 第 ${i + 1} 个操作失败，停止后续执行`);
            break;
          }
        }
      }

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      const allSuccess = failedCount === 0;

      const summary = allSuccess 
        ? `所有 ${operations.length} 个操作执行成功`
        : `${successCount} 个操作成功, ${failedCount} 个操作失败`;

      const batchResult: OpenClawBatchResult = {
        success: allSuccess,
        total: operations.length,
        completed: successCount,
        failed: failedCount,
        results,
        summary,
        duration: Date.now() - startTime
      };

      this.log.info(`[OpenClawExecutor] 批量执行完成: ${summary}, 耗时: ${batchResult.duration}ms`);
      return batchResult;

    } catch (error: any) {
      this.log.error('[OpenClawExecutor] 批量执行异常:', error);
      
      return {
        success: false,
        total: operations.length,
        completed: results.filter(r => r.success).length,
        failed: operations.length - results.filter(r => r.success).length,
        results,
        summary: `批量执行异常: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 获取审计日志
   */
  public getAuditLogs(limit = 100) {
    return this.gateway.getAuditLogs(limit);
  }

  /**
   * 工具方法：延时
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
