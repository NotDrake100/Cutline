# Architecture

Cutline is a TypeScript news desk: a static front end plus a Node API.

## Layout

| Path | Role |
|------|------|
| `apps/web` | Landing page and studio (`index.html`, `studio.html`) |
| `apps/api` | HTTP server (local port 8787) |
| `api/index.ts` | Vercel entry; same handler as local |
| `packages/` | Hunt, rewrite, library, and export |

## Surfaces

| Route | Job |
|-------|-----|
| `/` | Landing |
| `/studio.html` | Desk: Hunt, Browser, Library, Connect |
| `/api/*` | API |

## Flow

Hunt opens public news section pages and keeps only items with a live `sourceUrl`. The browser pane shows that URL. Rewrites use Google Gemini on sourced page text. Nothing is exported until a post is approved. Approved posts go to Canva or download as a ZIP.

Public demo traffic uses fixtures and cached pages, so it does not call Gemini.

## Data

SQLite (`better-sqlite3`) stores desk items and media (clips, stills, videos, captions). Locally that is `data/cutline.db`.
