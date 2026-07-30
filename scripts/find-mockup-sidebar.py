"""Find sidebar/rail patterns in v4-mockup.html"""
import re
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/v4-mockup.html')
text = path.read_text(encoding='utf-8')

# 找 nav 标签 (sidebar 主体)
for i, m in enumerate(re.finditer(r'<nav[^>]*>(.{0,1500}?)</nav>', text, re.DOTALL)):
    if i >= 3: break
    print(f'=== NAV #{i+1} ({len(m.group())} chars) ===')
    print(m.group()[:1500])
    print()

# 找 class 包含 sidebar / rail / side-nav 的 div
for i, m in enumerate(re.finditer(r'<(?:div|aside)[^>]*class="[^"]*(?:sidebar|side-nav|rail)[^"]*"[^>]*>', text)):
    if i >= 5: break
    print(f'--- DIV/ASIDE {i+1} ---')
    print(m.group()[:200])
    # 取接下来 500 字
    print(text[m.end():m.end()+500])
    print()
