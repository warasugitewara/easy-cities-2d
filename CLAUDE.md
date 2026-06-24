# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 必ず参照する

作業前に、ユーザーのグローバル個人ルール `~/.claude/CLAUDE.md`（Windows: `C:\Users\waras\.claude\CLAUDE.md`）を**必ず参照し遵守すること**。基本方針・ワークフロー（調査→計画提示→承認後実装）、Git運用（自動コミット禁止、commit/push 前に承認）、禁止事項などはそちらに従う。本ファイルの内容と矛盾する場合はグローバルルールを優先する。

## Project

Browser-based 2D city-building simulation (Cities Skylines-style), TypeScript + Vite+, deployed to GitHub Pages. Supports mouse and touch (pinch-zoom, 2-finger pan, 1-finger draw). README.md (Japanese) holds the full gameplay/balance spec; `.github/copilot-instructions.md` mirrors much of this guidance.

## Commands

This project uses **Vite+** (`vp`), a unified toolchain. Do NOT call npm/pnpm/yarn, vitest, oxlint, or oxfmt directly.

```sh
vp dev      # Dev server at localhost:5173
vp build    # Production build → dist/
vp check    # Format + lint + type-check — run before committing
vp check --fix  # Auto-fix
vp test     # Run tests (Vitest, via vite-plus)
vp lint     # Lint only (Oxlint, type-aware)
vp fmt      # Format only (Oxfmt)
```

Run `vp install` after pulling. `npm run dev|build|preview` are thin wrappers over `vp`.

- Import toolchain modules from `vite-plus`, never from `vite`/`vitest` directly: `import { defineConfig } from "vite-plus"`, `import { expect, test } from "vite-plus/test"`.
- Type-aware lint and type-check are configured in `vite.config.ts` (`lint.options.typeAware/typeCheck`); no separate tsc step needed.

## Architecture

All source is flat in `src/` (no subdirectories). `GameEngine.state` (a single `GameState` object, defined in `engine.ts`) is the single source of truth — `Renderer`, `UIManager`, and `StorageManager` all read/write that same object; nothing else holds mutable game state.

| File           | Responsibility                                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts` | All game data: `TileType` enum, build costs, tax/maintenance, infrastructure & synergy effects. **Tune balance numbers here, not in `engine.ts`.**                                                                                                                    |
| `engine.ts`    | `GameEngine` — owns `GameState`; key methods `build()`, `grow()`, `monthlyUpdate()`, `reset()`. Also owns the parallel grids (`powerGrid`, `waterGrid`, `fireMap`, `pollutionMap`, `diseaseMap`, etc.), each a `gridSize × gridSize` array recomputed during updates. |
| `renderer.ts`  | `Renderer` — Canvas 2D rendering with viewport culling and camera pan/zoom; provides `screenToWorld()`.                                                                                                                                                               |
| `storage.ts`   | `StorageManager` — localStorage save/load (3 slots) and JSON export/import.                                                                                                                                                                                           |
| `ui.ts`        | `UIManager` — DOM-based HUD, draggable/resizable panels; separate desktop and mobile-tab layouts.                                                                                                                                                                     |
| `main.ts`      | Entry point — wires the classes together and owns all input event handlers.                                                                                                                                                                                           |

### TileType encoding (`constants.ts`)

Infrastructure tiles are **negative** integers; zone tiles are **positive**, grouped by type with level as the ones digit:

- Residential L1–L4 = 1–4, Commercial = 11–14, Industrial = 21–24
- Infrastructure: ROAD = −1, STATION = −2, … WATER_TREATMENT = −9
- Landmarks: STADIUM = −50, AIRPORT = −51

Auto-growth upgrades a tile by **incrementing its `TileType`** (e.g. `RESIDENTIAL_L1` → `RESIDENTIAL_L2`), so contiguous numbering per zone type is load-bearing — keep levels adjacent when editing the enum.

### Game loop (`main.ts`)

`requestAnimationFrame` → `engine.grow()` every frame → `engine.monthlyUpdate()` every N frames (`N = 20 / gameSpeed`). Renderer and UI update every frame regardless of pause state.

### Input → world coordinates

Always convert pointer events CSS → canvas → world via `renderer.screenToWorld()` (handles DPR, CSS-vs-internal canvas size, and camera offset/zoom). Never read raw `clientX/Y` against world tiles.

### Road drawing

Drag-to-build fills tiles between the pointer's previous and current position with `bresenhamLine()` in `main.ts`, avoiding gaps during fast drags.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml` → `npm run build` → publishes `dist/` to GitHub Pages at https://warasugitewara.github.io/easy-cities-2d/. `vite.config.ts` uses `base: "/"` (custom domain via `public/CNAME`).
