#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Capture screenshots of the v4 mockup in both themes + all 5 pages."""
import os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(r"D:\pipiclaw\piclaw\docs\v4-mockup.html").resolve()
OUT = Path(r"D:\pipiclaw\piclaw\docs\review-screenshots")
OUT.mkdir(parents=True, exist_ok=True)

PAGES = ["dashboard", "chat", "models", "skills", "settings"]

def cap(page, name):
    out = OUT / f"{name}.png"
    page.screenshot(path=str(out), full_page=True)
    print(f"  -> {out}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5)
    page = ctx.new_page()
    page.goto(f"file:///{HTML.as_posix()}")
    page.wait_for_load_state("networkidle")
    time.sleep(0.5)

    for theme in ("light", "dark"):
        # set theme via JS
        page.evaluate(f"document.body.dataset.theme = '{theme}'")
        # also force the radio button state
        page.evaluate(f"document.querySelectorAll('[data-theme-set]').forEach(b => b.classList.toggle('active', b.dataset.themeSet === '{theme}'))")
        time.sleep(0.3)
        for pg in PAGES:
            # click the page button in mockup bar
            page.click(f'button[data-page="{pg}"]')
            time.sleep(0.3)
            cap(page, f"{theme}_{pg}")
            # also click sidenav icon to verify cross-link
    # Hover state: hover a model card to see active state
    page.click('button[data-page="models"]')
    time.sleep(0.2)
    page.hover('.model-card')
    time.sleep(0.2)
    cap(page, "light_models_hover")

    # Test thinking block visibility — scroll to it
    page.click('button[data-page="chat"]')
    time.sleep(0.2)
    page.evaluate("document.querySelector('.thinking')?.scrollIntoView({block:'center'})")
    time.sleep(0.2)
    cap(page, "light_chat_thinking")

    # Click a toggle in settings
    page.click('button[data-page="settings"]')
    time.sleep(0.3)
    page.click('.toggle')  # toggle the first one
    time.sleep(0.2)
    cap(page, "light_settings_toggled")

    browser.close()
print("done")
