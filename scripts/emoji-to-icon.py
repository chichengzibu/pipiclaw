"""
Emoji → Element Plus icon name 映射
"""
import re
from pathlib import Path

# emoji → Element Plus icon (PascalCase)
EMOJI_TO_ICON = {
    '⚙️': 'Setting',
    '⚙': 'Setting',
    '🤖': 'MagicStick',
    '🔌': 'Connection',
    '🧠': 'Memo',
    'ℹ️': 'InfoFilled',
    'ℹ': 'InfoFilled',
    '☀️': 'Sunny',
    '☀': 'Sunny',
    '🌙': 'Moon',
    '🖥️': 'Monitor',
    '🖥': 'Monitor',
    '📷': 'Camera',
    '🎥': 'Camera',
    '📄': 'Document',
    '🔍': 'Search',
    '⚡': 'Lightning',
    '✨': 'MagicStick',
    '💬': 'ChatDotRound',
    '💡': 'MagicStick',
    '🛒': 'Box',
    '🏠': 'House',
    '🛠️': 'Tools',
    '🛠': 'Tools',
    '🔄': 'Refresh',
    '🧹': 'Delete',
    '🌐': 'Connection',
    '🐛': 'Warning',
    '📅': 'Document',
    '📦': 'Box',
    '🦙': 'MagicStick',
    '🦅': 'MagicStick',
    '🦐': 'MagicStick',
    '👋': 'UserFilled',
    '👤': 'User',
    '🚀': 'Promotion',
    '🔒': 'Box',
    '🎉': 'Star',
    '🚧': 'Tools',
    '📍': 'House',
    '📁': 'Document',
    '📊': 'Lightning',
    '📨': 'Message',
    '🧩': 'Tools',
    '✅': 'SuccessFilled',
    '❌': 'Warning',
    '⏳': 'Refresh',
    '📝': 'EditPen',
    '📌': 'Connection',
    '📂': 'Document',
}


def find_emoji_in_file(path: Path) -> list[tuple[int, str, str]]:
    """找文件中所有 emoji + 上下文"""
    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        return []
    results = []
    for line_num, line in enumerate(text.splitlines(), 1):
        for emoji in EMOJI_TO_ICON:
            if emoji in line:
                results.append((line_num, line.strip()[:100], emoji))
    return results


def scan_all_emoji(src_dir: str = 'src') -> dict[str, list[tuple[str, int, str]]]:
    """扫描所有 .vue / .ts 文件中的 emoji"""
    src = Path(src_dir)
    found = {}
    for f in src.rglob('*.vue'):
        ems = find_emoji_in_file(f)
        if ems:
            found[str(f.relative_to(src))] = [(emoji, line, ctx) for line, ctx, emoji in ems]
    for f in src.rglob('*.ts'):
        ems = find_emoji_in_file(f)
        if ems:
            found[str(f.relative_to(src))] = [(emoji, line, ctx) for line, ctx, emoji in ems]
    return found


if __name__ == '__main__':
    import sys
    result = scan_all_emoji(sys.argv[1] if len(sys.argv) > 1 else 'src')
    for f, ems in sorted(result.items()):
        print(f'\n=== {f} ({len(ems)} 个 emoji) ===')
        for emoji, line, ctx in ems[:5]:
            print(f'  L{line}: {emoji}  | {ctx}')
        if len(ems) > 5:
            print(f'  ... {len(ems) - 5} more')
