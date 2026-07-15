/**
 * PiPiClaw - Docker 探测器(W9.1)
 *
 * 职责:
 * 1. 探测本机 docker 状态(6 种状态)
 * 2. 返回安装 URL(只探测,不安装)
 * 3. 提供健康检查(给 UI 用)
 *
 * W9 阶段:只探测,不安装。
 * 走 3 步:docker --version → docker info → docker compose version
 */

import { LogManager } from '../core/LogManager'
import { execSync } from 'node:child_process'
import * as os from 'node:os'

export type DockerStatus =
  | 'available'                    // docker 装了 + daemon 跑了 + compose 可用
  | 'available-no-compose'         // docker 装了 + daemon 跑了 + compose 不可用
  | 'not-installed'                // docker 命令找不到
  | 'daemon-down'                  // docker 装了但 daemon 没跑
  | 'permission-denied'            // /var/run/docker.sock 无权限
  | 'unsupported'                  // 当前平台不支持

export interface DockerDetectResult {
  status: DockerStatus
  /** docker version 字符串(如 "Docker version 24.0.7, build ...") */
  version?: string
  /** 错误详情(若 status != 'available') */
  error?: string
  /** 当前平台 */
  platform: NodeJS.Platform
  /** 安装 URL(若 not-installed) */
  installUrl?: string
}

export class DockerDetector {
  private static instance: DockerDetector
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): DockerDetector {
    if (!DockerDetector.instance) DockerDetector.instance = new DockerDetector()
    return DockerDetector.instance
  }

  /**
   * 探测 docker 状态。W9 阶段:只探测,不安装。
   * 走 3 步:docker --version → docker info → docker compose version
   */
  async detect(): Promise<DockerDetectResult> {
    const platform = os.platform() as NodeJS.Platform
    const result: DockerDetectResult = { status: 'unsupported', platform }

    if (platform === 'win32') {
      result.status = 'unsupported'
      result.error = 'Windows 平台 W9 暂不实装,W10+ 评估'
      return result
    }

    let version: string
    try {
      version = execSync('docker --version', { encoding: 'utf-8', timeout: 5000 }).trim()
    } catch (e) {
      this.log.info('DockerDetector: docker --version fail', String((e as Error).message ?? e))
      result.status = 'not-installed'
      result.error = String((e as Error).message ?? e)
      result.installUrl = this.installUrlFor(platform)
      return result
    }
    result.version = version

    try {
      const info = execSync('docker info 2>&1', { encoding: 'utf-8', timeout: 5000 })
      if (info.toLowerCase().includes('permission denied') || info.toLowerCase().includes('cannot connect')) {
        result.status = 'permission-denied'
        result.error = info.slice(0, 200)
        return result
      }
    } catch (e) {
      const msg = (e as { stderr?: { toString(): string } }).stderr?.toString() ?? String((e as Error).message ?? e)
      this.log.info('DockerDetector: docker info fail', msg)
      if (msg.toLowerCase().includes('permission denied')) {
        result.status = 'permission-denied'
        result.error = msg.slice(0, 200)
        return result
      }
      result.status = 'daemon-down'
      result.error = msg.slice(0, 200)
      return result
    }

    try {
      execSync('docker compose version', { encoding: 'utf-8', timeout: 5000 })
      result.status = 'available'
    } catch (e) {
      this.log.info('DockerDetector: docker compose version fail', String((e as Error).message ?? e))
      result.status = 'available-no-compose'
    }

    return result
  }

  /**
   * 返回官方 docker 安装 URL
   * 不实际触发安装,只返回链接供 UI 显示
   */
  installUrlFor(platform: NodeJS.Platform): string {
    switch (platform) {
      case 'darwin':
        return 'https://docs.docker.com/desktop/install/mac-install/'
      case 'linux':
        return 'https://docs.docker.com/engine/install/'
      case 'win32':
        return 'https://docs.docker.com/desktop/install/windows-install/'
      default:
        return 'https://www.docker.com/get-docker/'
    }
  }

  /**
   * 健康检查(给 UI 用)
   * 返回 { status, summary }
   */
  async healthCheck(): Promise<{ status: DockerStatus; summary: string }> {
    const r = await this.detect()
    const summaryMap: Record<DockerStatus, string> = {
      'available': 'Docker 可用',
      'available-no-compose': 'Docker 可用但 docker compose 不可用',
      'not-installed': `Docker 未安装,前往 ${this.installUrlFor(r.platform)}`,
      'daemon-down': 'Docker daemon 未运行',
      'permission-denied': 'Docker socket 无权限',
      'unsupported': `当前平台 ${r.platform} W9 暂不支持`,
    }
    return { status: r.status, summary: summaryMap[r.status] }
  }
}