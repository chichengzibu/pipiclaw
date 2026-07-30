"""Find emoji in a file with line numbers"""
import re
import sys
from pathlib import Path

EMOJI_RE = re.compile(r'[\U0001F300-\U0001F9FF\u2600-\u27BF\u2B00-\u2BFF\u2700-\u27BF]')

if __name__ == '__main__':
    path = Path(sys.argv[1])
    text = path.read_text(encoding='utf-8')
    for i, line in enumerate(text.splitlines(), 1):
        for m in EMOJI_RE.finditer(line):
            print(f'L{i}: {m.group()} | {line.strip()[:120]}')
