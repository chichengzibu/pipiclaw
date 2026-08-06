#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PATCH v4.5.0-alpha PATCH 3: P0-1 老 config migration fix.
- 删旧 3 assets
- 上传新 3 assets (含 P0-1 migration fix)
- PATCH body 加 P0-1 段
"""
import os
import sys
import json
import subprocess
import re
import urllib.request
import urllib.error

PROJECT = "D:/pipiclaw/piclaw"
RELEASE_ID = "365353649"
REPO = "chichengzibu/pipiclaw"

def get_pat():
    env = os.environ.get("GH_PAT")
    if env:
        return env.strip()
    out = subprocess.run(["git", "config", "--get", "remote.origin.url"], cwd=PROJECT, capture_output=True, text=True).stdout.strip()
    m = re.search(r"https://[^:]+:([^@]+)@", out)
    if m:
        return m.group(1)
    raise RuntimeError("PAT not found")

PAT = get_pat()
HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {PAT}",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PiPiClaw-Release-Bot",
}

def patch_body():
    body_path = f"{PROJECT}/release-body-v4.5.0-alpha.md"
    raw = open(body_path, "rb").read().decode("utf-8")
    addition = (
        "\n## 🐛 PATCH 3 (commit b5ff363) — P0-1 老 config migration\n\n"
        "**真根因 (3 层)**:\n"
        "1. 之前 P0-1 修复 (309375d 删 main.ts 启动调用 forceResetToPermissive) 只对**新用户**有效\n"
        "2. 老用户 (v4.3.0 activeSetId=\"preset_permissive\") 升级到 v4.5.0-alpha, loadConfig 读老 config, **没 migration** → 仍 permissive\n"
        "3. dev mode 下 `app.getVersion()` 返 electron version (30.5.1), 让老 config 的 `version: \"30.5.1\"` 跟 currentVersion 相等 → migration 比较 bypass\n\n"
        "**修法 (1 文件, 3 段)**:\n"
        "1. `loadConfig` 加老 config migration: `configVersion !== currentVersion && activeSetId === 'preset_permissive'` → 切 safe + emit 'upgrade-default' + saveConfig\n"
        "2. `saveConfig` 用 `getAppVersion()` (dev mode fallback 到 root package.json)\n"
        "3. `getAppVersion()` helper: prod 走 app.getVersion() (4.5.0-alpha), dev 检测 30.5.1 后 fallback 读 require('../../package.json').version\n\n"
        "**真实用户 dogfooding 验证**:\n"
        "- ✅ UI 顶部: \"当前: 安全模式\"\n"
        "- ✅ 左侧: \"安全模式 使用中\" (高亮)\n"
        "- ✅ 警告 UI: \"无限制模式 ⚠️ (不推荐)\" + 红字 \"此模式允许所有操作,无任何安全防护\"\n"
        "- ✅ 权限规则: 文件系统只读 / 网络禁止 / 进程禁止 / 系统禁止 / Shell 禁止\n"
        "- ✅ IPC `permissions.active` 返 id: \"preset_safe\" name: \"安全模式\"\n"
        "- ✅ config.json: version: \"4.5.0-alpha\" activeSetId: \"preset_safe\"\n\n"
    )
    insert_marker = "### 🔨 下载"
    if insert_marker in raw:
        body = raw.replace(insert_marker, addition + insert_marker)
    else:
        body = raw + addition
    body_path_b = body.encode("utf-8")
    open(body_path, "wb").write(body_path_b)
    url = f"https://api.github.com/repos/{REPO}/releases/{RELEASE_ID}"
    req = urllib.request.Request(url, data=json.dumps({"body": body}).encode("utf-8"), headers={**HEADERS, "Content-Type": "application/json"}, method="PATCH")
    with urllib.request.urlopen(req) as r:
        print(f"[OK] PATCH body, len={len(body)} bytes")

def list_assets():
    url = f"https://api.github.com/repos/{REPO}/releases/{RELEASE_ID}/assets"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def delete_asset(asset_id, name):
    url = f"https://api.github.com/repos/{REPO}/releases/assets/{asset_id}"
    req = urllib.request.Request(url, headers=HEADERS, method="DELETE")
    with urllib.request.urlopen(req) as r:
        print(f"[OK] delete {name}")

def upload_asset(file_path, name):
    url = f"https://uploads.github.com/repos/{REPO}/releases/{RELEASE_ID}/assets?name={urllib.parse.quote(name)}"
    data = open(file_path, "rb").read()
    req = urllib.request.Request(url, data=data, headers={**HEADERS, "Content-Type": "application/octet-stream", "Content-Length": str(len(data))}, method="POST")
    with urllib.request.urlopen(req) as r:
        print(f"[OK] upload {name} ({len(data)} bytes)")

def main():
    print("=== PATCH v4.5.0-alpha PATCH 3 (P0-1 migration) ===\n")
    patch_body()
    old = list_assets()
    for a in old:
        delete_asset(a["id"], a["name"])
    files = [
        (f"{PROJECT}/release/PiPiClaw-4.5.0-alpha-Setup.exe", "PiPiClaw-4.5.0-alpha-Setup.exe"),
        (f"{PROJECT}/release/PiPiClaw-4.5.0-alpha-Setup.exe.blockmap", "PiPiClaw-4.5.0-alpha-Setup.exe.blockmap"),
        (f"{PROJECT}/release/latest.yml", "latest.yml"),
    ]
    for path, name in files:
        upload_asset(path, name)
    print("\n=== PATCH 3 DONE ===")

if __name__ == "__main__":
    main()
