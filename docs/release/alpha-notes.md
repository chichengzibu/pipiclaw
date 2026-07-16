# PiPiClaw v2.0.0 alpha-1 Internal Test Notes

## Scope

- Invite 5 internal users to run all 6 demos (D1 screenshot QA / D2-Prime project scaffold / D3 one-line remote via Feishu / D5 recording-to-skill / A5 Computer Use / Insight trace)
- Collect bugs + UX feedback
- Fix all blockers

## Known issues at W12 closure

1. **D2-Prime true preview requires docker / webcontainer env** — cannot run in CI; W12+ verify on real user machines
2. **3 truly connected IM channels (Feishu / DingTalk / WeCom)** — needs real appId/appSecret; W12+ verify with real accounts
3. **OCR / image recognition (W8) is stub** — A5 Computer Use screenshot returns empty; W12+ integrate Tesseract / Ollama Vision
4. **SandboxL1 Windows platform is stub** — W9 plan explicitly leaves placeholder; Windows users fall back to seatbelt / bwrap
5. **W12.1-W12.3 some tests soft-fail in TRAE sandbox env** — need verification on user local env

## Rollout plan

- v2.0.0-rc.1: 5 percent users (W12.7 tag, 3 day monitoring)
- 0 crash + 0 blocker -> v2.0.0 GA
- 1+ blocker -> v2.0.0-rc.2 fix -> rerun 3 days

## Acceptance

- 5 alpha users 0 blocker
- release-checklist 7 steps all pass
- README numbers synced (unit test count >= 100)
- typecheck 0 errors
- 0 new npm dependencies (besides W11.1 `@webcontainer/api`)
