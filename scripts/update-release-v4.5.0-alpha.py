#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PATCH release body + upload 3 assets for v4.5.0-alpha (id=365353649)."""
import json
import os
import sys
import urllib.request
import urllib.error

REPO = 'chichengzibu/pipiclaw'
TOKEN = 'REDACTED_GH_PAT'
RELEASE_ID = 365353649
PAYLOAD_PATH = r'D:\pipiclaw\piclaw\release-payload-v4.5.0-alpha.json'
ASSETS = [
    (r'D:\pipiclaw\piclaw\release\PiPiClaw-4.5.0-alpha-Setup.exe', 'application/octet-stream'),
    (r'D:\pipiclaw\piclaw\release\PiPiClaw-4.5.0-alpha-Setup.exe.blockmap', 'application/octet-stream'),
    (r'D:\pipiclaw\piclaw\release\latest.yml', 'application/x-yaml'),
]

# 1) PATCH release (用 payload 里的 body + name + prerelease, 但 release 已创建所以走 PATCH)
print(f'[1/3] PATCH release {RELEASE_ID} (body + name + prerelease)...')
with open(PAYLOAD_PATH, 'rb') as f:
    payload = f.read()
data = json.loads(payload.decode('utf-8'))
# PATCH 只要这些字段
patch_body = {
    'tag_name': data['tag_name'],
    'name': data['name'],
    'body': data['body'],
    'prerelease': data['prerelease'],
    'target_commitish': data['target_commitish'],
}
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
        print(f'  [OK] PATCH success: {d["html_url"]}')
        print(f'       name: {d["name"]}')
        print(f'       prerelease: {d["prerelease"]}')
        upload_url_template = d['upload_url']
except urllib.error.HTTPError as e:
    print(f'  [FAIL] HTTP {e.code}: {e.read().decode()[:500]}')
    sys.exit(1)

# 2) Upload 3 assets
print(f'\n[2/3] Uploading {len(ASSETS)} assets to release {RELEASE_ID}...')
for asset_path, content_type in ASSETS:
    if not os.path.exists(asset_path):
        print(f'  [SKIP] {asset_path} (not found)')
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
            print(f'  [OK] {asset["name"]} ({asset["size"]/1024/1024:.1f}MB) -> {asset["browser_download_url"]}')
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'  [FAIL] {filename}: HTTP {e.code}: {body[:300]}')

# 3) Final verify
print(f'\n[3/3] Verifying release {RELEASE_ID}...')
req = urllib.request.Request(
    f'https://api.github.com/repos/{REPO}/releases/{RELEASE_ID}',
    headers={
        'Authorization': f'Bearer {TOKEN}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }
)
with urllib.request.urlopen(req, timeout=30) as resp:
    d = json.loads(resp.read().decode('utf-8'))
    print(f'  name: {d["name"]}')
    print(f'  prerelease: {d["prerelease"]}')
    print(f'  assets: {len(d["assets"])}')
    for a in d['assets']:
        print(f'    - {a["name"]} ({a["size"]/1024/1024:.1f}MB)')

print()
print('=' * 60)
print(f'✅ Release URL: {d["html_url"]}')
print('=' * 60)
print('Note: prerelease=true → auto-update 默认不升级到此版本')
