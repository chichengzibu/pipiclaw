"""Find title-bar in v4-mockup.html"""
import re
import sys
from pathlib import Path

text = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/v4-mockup.html').read_text(encoding='utf-8')

# 找 title bar / top bar
for kw in ['title-bar', 'topbar', 'titlebar', 'app-header', 'window-bar']:
    m = re.search(r'<(?:div|header)[^>]*class="[^"]*\b' + kw + r'\b[^"]*"[^>]*>', text)
    if m:
        print(f'--- {kw} ---')
        print(text[m.start():m.start()+1500])
        print()

# 找第一个有 "搜索" 或 "PiPiClaw" 的 div
m = re.search(r'<(?:div|header)[^>]*(?:搜索命令|PiPiClaw v4\.4)[^>]*>', text)
if m:
    print('--- DIV with 搜索/PiPiClaw v4.4 ---')
    print(text[m.start():m.start()+2000])
