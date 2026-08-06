#!/usr/bin/env python3
"""Get existing GitHub release ID for v4.5.0-alpha, save to file."""
import json
import urllib.request
import urllib.error

TOKEN = 'REDACTED_GH_PAT'
TAG = 'v4.5.0-alpha'

req = urllib.request.Request(
    f'https://api.github.com/repos/chichengzibu/pipiclaw/releases/tags/{TAG}',
    headers={
        'Authorization': f'Bearer {TOKEN}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        d = json.loads(resp.read().decode('utf-8'))
        rid = d['id']
        print(f'id={rid}')
        print(f'name={d["name"]}')
        print(f'url={d["html_url"]}')
        print(f'prerelease={d["prerelease"]}')
        print(f'draft={d["draft"]}')
        print(f'assets before upload: {len(d.get("assets", []))}')
        for a in d.get('assets', []):
            print(f'  - {a["name"]} ({a["size"]/1024/1024:.1f}MB)')

        with open(r'D:\pipiclaw\piclaw\release-id-v4.5.0-alpha.txt', 'w') as f:
            f.write(str(rid))
        print(f'[OK] wrote release_id to release-id-v4.5.0-alpha.txt')

        # 同时更新 publish script 跳过 POST 直接 PATCH
        print(f'[INFO] Patch endpoint: PATCH /releases/{rid}')

except urllib.error.HTTPError as e:
    print(f'HTTP {e.code}: {e.read().decode()[:500]}')
