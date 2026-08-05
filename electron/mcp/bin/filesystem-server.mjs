#!/usr/bin/env node
/**
 * PiPiClaw - MCP filesystem server (stdio child process)
 *
 * 协议: MCP 2025-06-18 (JSON-RPC 2.0 over stdio, newline-delimited)
 * 实现: 5 个工具
 *   - list_directory(path)
 *   - read_file(path, encoding?)
 *   - write_file(path, content)
 *   - search_files(pattern, base?)
 *   - get_file_info(path)
 *
 * 安全: 路径白名单 (从 argv[2] 接收, JSON 数组; 不在白名单的拒绝)
 *
 * 启动方式 (主进程):
 *   node filesystem-server.mjs <allowedPathsJson>
 *   例子: node filesystem-server.mjs '["D:\\pipiclaw\\piclaw"]'
 *
 * 通信格式 (每行一条 JSON, 严格 newline-delimited):
 *   stdout: 响应 + 通知 (本实现只发响应)
 *   stderr: 日志 (主进程会捕获, 不会污染 JSON 流)
 *
 * 退出:
 *   stdin EOF → 退出
 *   主进程 SIGTERM → 退出
 */

'use strict';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ========== 启动参数 ==========

const [, , allowedPathsJsonArg] = process.argv;

if (!allowedPathsJsonArg) {
  process.stderr.write('[filesystem-server] FATAL: missing allowedPathsJson argv\n');
  process.exit(2);
}

let allowedPaths;
try {
  allowedPaths = JSON.parse(allowedPathsJsonArg);
  if (!Array.isArray(allowedPaths)) {
    throw new Error('allowedPaths must be array');
  }
} catch (e) {
  process.stderr.write(`[filesystem-server] FATAL: invalid allowedPaths JSON: ${e.message}\n`);
  process.exit(2);
}

const allowedRoots = allowedPaths.map((p) => path.resolve(p));

// ========== 工具定义 (MCP 格式) ==========

const TOOLS = [
  {
    name: 'list_directory',
    description: 'List entries of a directory. Returns name, type, size for each entry.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute directory path to list',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 (or specified encoding) text file. Refuses binary by default.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute file path to read',
        },
        encoding: {
          type: 'string',
          enum: ['utf-8', 'utf8', 'ascii', 'latin1', 'base64'],
          description: 'Text encoding (default utf-8)',
          default: 'utf-8',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write a text file. Creates parent directories if needed. Refuses to overwrite symlinks.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute file path to write',
        },
        content: {
          type: 'string',
          description: 'File content (text)',
        },
        encoding: {
          type: 'string',
          enum: ['utf-8', 'utf8', 'ascii', 'latin1'],
          default: 'utf-8',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'search_files',
    description: 'Glob search for files matching a pattern under a base directory. Returns matching file paths.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern, e.g. "**/*.ts" or "src/views/*.vue"',
        },
        base: {
          type: 'string',
          description: 'Base directory (default: first allowed root)',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Get file/dir metadata: size, mtime, exists, isFile, isDirectory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to inspect',
        },
      },
      required: ['path'],
    },
  },
];

// ========== JSON-RPC helper ==========

function send(obj) {
  // newline-delimited, 强制 flush
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message, data) {
  send({
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  });
}

// ========== 路径沙箱 ==========

/**
 * 校验 path 是否落在 allowedRoots 内, 返回 resolved path 或抛错
 * 防御: 解析 symlink, 拒绝 ..
 */
function resolveInSandbox(inputPath) {
  if (typeof inputPath !== 'string' || !inputPath) {
    throw new Error('path must be non-empty string');
  }
  if (inputPath.includes('\0')) {
    throw new Error('path contains null byte');
  }
  // 不强制 absolute, 但 relative 会被解析到 cwd
  const absolute = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);

  // 用 realpath 解析 symlink; 不存在则用 normalized 路径
  let resolved;
  try {
    resolved = fs.realpathSync(absolute);
  } catch {
    // 路径不存在, 用 normalized 路径继续校验
    resolved = path.normalize(absolute);
  }

  // 检查是否在任一白名单根目录内
  const lower = resolved.toLowerCase();
  const inSandbox = allowedRoots.some((root) => {
    const rootLower = root.toLowerCase();
    // 必须以 root 开头, 且要么相等要么下一个字符是分隔符
    return (
      lower === rootLower ||
      lower.startsWith(rootLower + path.sep)
    );
  });

  if (!inSandbox) {
    throw new Error(
      `path outside sandbox: ${resolved} not under any of [${allowedRoots.join(', ')}]`
    );
  }
  return resolved;
}

// ========== Tool 实现 ==========

async function toolListDirectory(args) {
  const resolved = resolveInSandbox(args.path);
  const entries = await fsp.readdir(resolved, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    let size = 0;
    if (e.isFile()) {
      try {
        const st = await fsp.stat(path.join(resolved, e.name));
        size = st.size;
      } catch {
        size = 0;
      }
    } else if (e.isDirectory()) {
      try {
        const st = await fsp.stat(path.join(resolved, e.name));
        size = st.size;
      } catch {
        size = 0;
      }
    }
    out.push({
      name: e.name,
      type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other',
      size,
    });
  }
  // 排序: 目录优先, 名字字典序
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { entries: out };
}

async function toolReadFile(args) {
  const resolved = resolveInSandbox(args.path);
  const encoding = (args.encoding || 'utf-8').toLowerCase();
  // base64 走 raw buffer
  if (encoding === 'base64') {
    const buf = await fsp.readFile(resolved);
    return { content: buf.toString('base64'), encoding: 'base64', size: buf.length };
  }
  const content = await fsp.readFile(resolved, encoding);
  return { content, encoding, size: Buffer.byteLength(content, encoding) };
}

async function toolWriteFile(args) {
  const resolved = resolveInSandbox(args.path);
  const dir = path.dirname(resolved);
  await fsp.mkdir(dir, { recursive: true });
  const encoding = (args.encoding || 'utf-8').toLowerCase();
  await fsp.writeFile(resolved, args.content, encoding);
  return { success: true, path: resolved, bytes: Buffer.byteLength(args.content, encoding) };
}

async function toolSearchFiles(args) {
  const pattern = args.pattern;
  if (typeof pattern !== 'string' || !pattern) {
    throw new Error('pattern must be non-empty string');
  }
  const base = args.base
    ? resolveInSandbox(args.base)
    : allowedRoots[0];

  // 用 minimatch 风格的手写 glob 转换 (避免引 minimatch)
  // 简化: 仅支持 *, **, ?, 不支持 {} / ![]
  const regex = globToRegex(pattern);
  const matches = [];
  const MAX_MATCHES = 1000; // 防止 OOM
  const MAX_DEPTH = 10;

  async function walk(dir, depth) {
    if (matches.length >= MAX_MATCHES) return;
    if (depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (matches.length >= MAX_MATCHES) return;
      const full = path.join(dir, e.name);
      // 检查 path 相对 base 是否匹配
      const rel = path.relative(base, full).replace(/\\/g, '/');
      if (regex.test(rel) || regex.test(e.name)) {
        matches.push(full);
      }
      if (e.isDirectory()) {
        await walk(full, depth + 1);
      }
    }
  }
  await walk(base, 0);
  return { matches, base, pattern, count: matches.length };
}

function globToRegex(glob) {
  // 转义正则元字符 (保留 * ? / \)
  let s = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        s += '.*';
        i++;
      } else {
        s += '[^/\\\\]*';
      }
    } else if (ch === '?') {
      s += '[^/\\\\]';
    } else if ('\\^$.|+()[]{}'.includes(ch)) {
      s += '\\' + ch;
    } else {
      s += ch;
    }
  }
  return new RegExp('^' + s + '$', 'i');
}

async function toolGetFileInfo(args) {
  const resolved = resolveInSandbox(args.path);
  try {
    const st = await fsp.stat(resolved);
    return {
      path: resolved,
      exists: true,
      isFile: st.isFile(),
      isDirectory: st.isDirectory(),
      size: st.size,
      mtime: st.mtimeMs,
      ctime: st.ctimeMs,
      mode: st.mode,
    };
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { path: resolved, exists: false };
    }
    throw e;
  }
}

// ========== JSON-RPC 处理 ==========

const TOOL_IMPL = {
  list_directory: toolListDirectory,
  read_file: toolReadFile,
  write_file: toolWriteFile,
  search_files: toolSearchFiles,
  get_file_info: toolGetFileInfo,
};

async function handleRequest(msg) {
  // validation
  if (msg.jsonrpc !== '2.0') {
    return replyError(null, -32600, 'Invalid Request: jsonrpc must be "2.0"');
  }
  if (typeof msg.method !== 'string') {
    return replyError(msg.id ?? null, -32600, 'Invalid Request: method must be string');
  }

  // 通知 (无 id) — 不响应
  if (msg.id === undefined || msg.id === null) {
    process.stderr.write(`[filesystem-server] notification received: ${msg.method} (ignored)\n`);
    return;
  }

  const { id, method, params = {} } = msg;

  try {
    switch (method) {
      case 'initialize': {
        return reply(id, {
          protocolVersion: '2025-06-18',
          serverInfo: { name: 'pipiclaw-filesystem', version: '1.0.0' },
          capabilities: { tools: {} },
        });
      }
      case 'ping': {
        return reply(id, {});
      }
      case 'tools/list': {
        return reply(id, { tools: TOOLS });
      }
      case 'tools/call': {
        const { name, arguments: toolArgs = {} } = params;
        const impl = TOOL_IMPL[name];
        if (!impl) {
          return reply(id, {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          });
        }
        // 基础参数校验 (refine 在 transport 层, 这里只检查 required)
        const def = TOOLS.find((t) => t.name === name);
        if (def.inputSchema.required) {
          for (const k of def.inputSchema.required) {
            if (!(k in toolArgs)) {
              return reply(id, {
                content: [{ type: 'text', text: `Missing required argument: ${k}` }],
                isError: true,
              });
            }
          }
        }
        try {
          const result = await impl(toolArgs);
          return reply(id, {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          });
        } catch (e) {
          return reply(id, {
            content: [{ type: 'text', text: `Tool error: ${e.message}` }],
            isError: true,
          });
        }
      }
      default:
        return replyError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return replyError(id, -32603, `Internal error: ${e.message}`);
  }
}

// ========== stdin 解析 (newline-delimited) ==========

let buf = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      process.stderr.write(`[filesystem-server] bad JSON: ${line.slice(0, 200)}\n`);
      continue;
    }
    handleRequest(msg).catch((e) => {
      process.stderr.write(`[filesystem-server] handleRequest error: ${e.message}\n`);
    });
  }
});

process.stdin.on('end', () => {
  process.stderr.write('[filesystem-server] stdin EOF, exiting\n');
  process.exit(0);
});

// 关闭信号
process.on('SIGTERM', () => {
  process.stderr.write('[filesystem-server] SIGTERM, exiting\n');
  process.exit(0);
});
process.on('SIGINT', () => {
  process.stderr.write('[filesystem-server] SIGINT, exiting\n');
  process.exit(0);
});

// 启动日志
process.stderr.write(
  `[filesystem-server] started, allowedRoots=${JSON.stringify(allowedRoots)}, pid=${process.pid}\n`
);
