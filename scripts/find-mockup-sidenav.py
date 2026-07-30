"""Find sidenav full structure"""
import re
import sys
from pathlib import Path

text = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/v4-mockup.html').read_text(encoding='utf-8')

# sidenav 整个 block
m = re.search(r'<nav class="sidenav">.*?</nav>', text, re.DOTALL)
if m:
    print('--- sidenav FULL ---')
    print(m.group())
    print()
# 找 sidenav css
m = re.search(r'\.sidenav[^{]*\{[^}]+\}', text)
if m:
    print('--- sidenav CSS ---')
    print(m.group())
# 找 nav-icon css
m = re.search(r'\.nav-icon[^{]*\{[^}]+\}', text)
if m:
    print('--- nav-icon CSS ---')
    print(m.group())
# 找 topbar css
m = re.search(r'\.topbar[^{]*\{[^}]+\}', text)
if m:
    print('--- topbar CSS ---')
    print(m.group())
# 找 search button css
m = re.search(r'\.topbar[^{]*\.search[^{]*\{[^}]+\}', text)
if m:
    print('--- topbar search CSS ---')
    print(m.group())
# 找 nav-icon active
m = re.search(r'\.nav-icon\.active[^{]*\{[^}]+\}', text)
if m:
    print('--- nav-icon active CSS ---')
    print(m.group())
