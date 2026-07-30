"""Rewrite SideNav.vue CSS to Linear/Raycast minimal style"""
import re
from pathlib import Path

path = Path('src/components/layout/SideNav.vue')
text = path.read_text(encoding='utf-8')

# 找 <style lang="scss" scoped> 开头到 </style> 结束
m = re.search(r'<style lang="scss" scoped>.*?</style>', text, re.DOTALL)
if not m:
    print('FAIL: no <style> found')
    exit(1)

new_css = '''<style lang="scss" scoped>
/* ========== 容器 (极简 Linear 风格) ========== */
.side-nav {
  --nav-width: 56px;
  --nav-width-expanded: 200px;
  display: flex;
  flex-direction: column;
  width: var(--nav-width);
  height: 100%;
  flex-shrink: 0;
  background: var(--bg-material);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-right: 1px solid var(--border-subtle);
  transition: width var(--duration-slow) var(--ease-spring);
  position: relative;
  overflow: hidden;
  user-select: none;

  &.expanded {
    width: var(--nav-width-expanded);
  }
}

/* ========== 品牌 (只 logo) ========== */
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0 16px;
  flex-shrink: 0;
}

.brand-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-base);
  border-radius: 8px;
  background: var(--accent-soft);

  svg {
    width: 18px;
    height: 18px;
  }
}

/* ========== 核心导航 (单列,无分组) ========== */
.nav-list {
  flex: 1;
  padding: 4px 8px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;

  &::-webkit-scrollbar {
    width: 0;
  }
}

/* ========== 导航项 (Linear / Raycast 风) ========== */
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  height: 36px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--fg-secondary);
  position: relative;
  transition: background-color 120ms var(--ease-standard),
    color 120ms var(--ease-standard);

  &:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }

  &.active {
    background: var(--accent-soft);
    color: var(--accent-base);

    .nav-icon {
      color: var(--accent-base);
    }
  }

  /* 选中左侧 2px 蓝条 (Raycast 风格) */
  &.active::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--accent-base);
    border-radius: 0 2px 2px 0;
  }
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  transition: color 120ms var(--ease-standard);
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* ========== 底部 (极简,只 user) ========== */
.nav-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0 14px;
  flex-shrink: 0;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 120ms var(--ease-spring);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>'''

new_text = text[:m.start()] + new_css + text[m.end():]
path.write_text(new_text, encoding='utf-8')
print(f'OK: replaced {len(text) - len(new_text)} chars in SideNav.vue')
