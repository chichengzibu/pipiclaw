#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publish v4.5.0-alpha to GitHub:
1. POST release payload (prerelease: true, UTF-8 no BOM)
2. Upload 3 assets: Setup.exe + latest.yml + .blockmap
"""
import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error

REPO = 'chichengzibu/pipiclaw'
# PAT 来自 git remote URL (Mavis 旧 release 已用过, 安全存)
TOKEN = 'REDACTED_GH_PAT'
RELEASE_PAYLOAD = r'D:\pipiclaw\piclaw\release-payload-v4.5.0-alpha.json'
ASSETS = [
    (r'D:\pipiclaw\piclaw\release\PiPiClaw-4.5.0-alpha-Setup.exe', 'application/octet-stream'),
    (r'D:\pipiclaw\piclaw\release\PiPiClaw-4.5.0-alpha-Setup.exe.blockmap', 'application/octet-stream'),
    (r'D:\pipiclaw\piclaw\release\latest.yml', 'application/x-yaml'),
]

def http_request(url, data, headers, method='POST'):
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8')), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'[FAIL] HTTP {e.code}: {body[:500]}')
        sys.exit(1)

# 1) POST release
print('[1/2] Creating release v4.5.0-alpha (prerelease)...')
with open(RELEASE_PAYLOAD, 'rb') as f:
    payload = f.read()
data, status = http_request(
    f'https://api.github.com/repos/{REPO}/releases',
    data=payload,
    headers={
        'Authorization': f'Bearer {TOKEN}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'PiPiClaw-publisher',
    },
)
release_id = data['id']
release_url = data['html_url']
upload_url_template = data['upload_url']
prerelease = data['prerelease']
print(f'  [OK] Created: {release_url}')
print(f'       id={release_id}, prerelease={prerelease}')
print(f'       assets before upload: {len(data.get("assets", []))}')

# 2) Upload 3 assets
print(f'\n[2/2] Uploading {len(ASSETS)} assets...')
for asset_path, content_type in ASSETS:
    if not os.path.exists(asset_path):
        print(f'  [SKIP] {asset_path} (not found)')
        continue
    filename = os.path.basename(asset_path)
    file_size = os.path.getsize(asset_path)
    with open(asset_path, 'rb') as f:
        content = f.read()
    # upload_url 模板带 {?name,label}, 替换为具体 name
    upload_url = upload_url_template.split('{')[0] + f'?name={urllib.parse.quote(filename)}'
    print(f'  uploading {filename} ({file_size/1024/1024:.1f}MB)...')
    asset_data, asset_status = http_request(
        upload_url,
        data=content,
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': content_type,
            'Content-Length': str(file_size),
            'User-Agent': 'PiPiClaw-publisher',
        },
    )
    print(f'  [OK] {asset_data["name"]} -> {asset_data["browser_download_url"]} ({asset_data["size"]/1024/1024:.1f}MB)')

print()
print('=' * 60)
print(f'✅ Release published: {release_url}')
print('=' * 60)
print()
print('Note: prerelease=true → auto-update 不会默认升级到此版本')
print('      已装 v4.4.0 / v4.3.1 用户需手动下载或显式选 channel')
