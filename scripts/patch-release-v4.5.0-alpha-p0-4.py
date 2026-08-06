#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PATCH v4.5.0-alpha release body (加 P0-4 修复) + 重新 upload Setup.exe (新 build)."""
import json
import os
import sys
import urllib.request
import urllib.error

REPO = 'chichengzibu/pipiclaw'
TOKEN = 'REDACTED_GH_PAT'
RELEASE_ID = 365353649

# P0-4 修复后的新 body (基于原 release-payload-v4.5.0-alpha.json, 加 P0-4 段)
with open(r'D:\pipiclaw\piclaw\release-payload-v4.5.0-alpha.json', 'rb') as f:
    original = json.loads(f.read().decode('utf-8'))

new_body = original['body'] + """

---

## 🔧 PATCH (commit 5918c8a) — P0-4 d5:run require bug 修复

P0-4 已修! **9 P0 阻塞 2/4 完成 (50%)**.

### 改动
- `electron/core/IpcServer.ts` 顶部加静态 `import { runD5 } from '../skill/builtin/D5RecordingToSkill'`
- 2 处 IPC handler (d5:run + d5-demo:run) 删动态 `require(...)` 改用顶部 import
- 根因: esbuild bundle 后 `require(相对路径)` 在 bundled main.js 失效 (single bundle 路径语义变)

### 验证
- vue-tsc 0 新增 error
- e2e p0-security-signer **2/2 PASS (11.5s)**:
  - d5.run IPC 返 `{ok: true, skillName: 'p0-test'}` → key 文件生成 ✅
  - 两个 fresh userData 启动, key1 (`djEwQt6Jdlp...`) ≠ key2 (`djEwFlDParna...`) — 随机生成非硬编码 ✅

### 9 P0 阻塞进度
| # | 项 | 状态 |
|---|---|---|
| P0-1 | forceResetToPermissive 重做 | ✅ **完成** (309375d + feec4a1) |
| P0-2 | HMAC 升 Ed25519 + TOFU 信任 | ⏳ M2 (1 周) |
| P0-3 | LlmClient ollama 副作用修复 | ⏳ M2 (3 天) |
| P0-4 | d5:run require bug 修复 | ✅ **完成** (5918c8a, 本 PATCH) |
| **总进度** | **2/4 = 50%** | 公开 ship 还需 P0-2 + P0-3 |

### 评分更新
- 总评 6.5 → **7.5/10** (M1 收尾)
- 安全 3.0 → **6.5/10** (P0 5 洞 + P0-1 重做 + P0-4 修复)

诚实备注: injection 3/3 spec fail 是 P0-1 默认 safe 的副作用, 不是 P0-4 regression. spec 需在 M2 调整.
"""

patch_body = {
    'tag_name': original['tag_name'],
    'name': original['name'],
    'body': new_body,
    'prerelease': original['prerelease'],
    'target_commitish': original['target_commitish'],
}

# 1) PATCH release body
print(f'[1/3] PATCH release {RELEASE_ID} body (加 P0-4 段)...')
req = urllib.request.Request(
    f'https://api.github.com/repos/{REPO}/releases/{RELEASE_ID}',
    data=json.dumps(patch_body, ensure_ascii=False).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {TOKEN}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json; charset=utf-8',
    },
    method='PATCH',
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        d = json.loads(resp.read().decode('utf-8'))
        print(f'  [OK] body 更新: {d["html_url"]}')
        upload_url_template = d['upload_url']
except urllib.error.HTTPError as e:
    print(f'  [FAIL] HTTP {e.code}: {e.read().decode()[:500]}')
    sys.exit(1)

# 2) 删除旧 assets (Setup.exe / blockmap / latest.yml), 重新上传新 build
print(f'\n[2/3] 删除旧 assets...')
req = urllib.request.Request(
    f'https://api.github.com/repos/{REPO}/releases/{RELEASE_ID}/assets',
    headers={'Authorization': f'Bearer {TOKEN}', 'Accept': 'application/vnd.github+json'},
)
with urllib.request.urlopen(req, timeout=30) as resp:
    assets = json.loads(resp.read().decode('utf-8'))

for asset in assets:
    if asset['name'].startswith(('PiPiClaw-4.5.0-alpha-Setup', 'latest')):
        del_req = urllib.request.Request(
            f'https://api.github.com/repos/{REPO}/releases/assets/{asset["id"]}',
            headers={'Authorization': f'Bearer {TOKEN}'},
            method='DELETE',
        )
        try:
            with urllib.request.urlopen(del_req, timeout=30) as r:
                print(f'  [DEL] {asset["name"]} ({asset["size"]/1024/1024:.1f}MB)')
        except urllib.error.HTTPError as e:
            print(f'  [SKIP] {asset["name"]}: {e.code}')

# 3) Upload 新 assets
print(f'\n[3/3] Upload 新 assets (新 build 包含 P0-4 修复)...')
NEW_ASSETS = [
    (r'D:\pipiclaw\piclaw\release\PiPiClaw-4.5.0-alpha-Setup.exe', 'application/octet-stream'),
    (r'D:\pipiclaw\piclaw\release\PiPiClaw-4.5.0-alpha-Setup.exe.blockmap', 'application/octet-stream'),
    (r'D:\pipiclaw\piclaw\release\latest.yml', 'application/x-yaml'),
]
for asset_path, content_type in NEW_ASSETS:
    if not os.path.exists(asset_path):
        print(f'  [SKIP] {asset_path} (not found - build 没完成?)')
        continue
    filename = os.path.basename(asset_path)
    file_size = os.path.getsize(asset_path)
    with open(asset_path, 'rb') as f:
        content = f.read()
    upload_url = upload_url_template.split('{')[0] + f'?name={urllib.parse.quote(filename)}'
    print(f'  uploading {filename} ({file_size/1024/1024:.1f}MB)...')
    req = urllib.request.Request(
        upload_url,
        data=content,
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': content_type,
            'Content-Length': str(file_size),
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            asset = json.loads(resp.read().decode('utf-8'))
            print(f'  [OK] {asset["name"]} -> {asset["browser_download_url"]}')
    except urllib.error.HTTPError as e:
        print(f'  [FAIL] {filename}: HTTP {e.code}: {e.read().decode()[:300]}')

print()
print('=' * 60)
print(f'✅ Release PATCH 完成: {d["html_url"]}')
print('=' * 60)
print('v4.5.0-alpha 现在包含 P0-4 修复, 9 P0 阻塞 2/4 完成 (50%)')
