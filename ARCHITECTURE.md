# Cutline — architecture

**Product:** Your AI desk. Hunt a live page → Gemini rewrite → still + pack → approve → ship.  
**Engine:** Google Gemini on the API server.  
**UI:** Ace-grade studio.

## Surfaces

| Route | Job |
|-------|-----|
| `/` | Marketing |
| `/studio` | Desk: Hunt, Browser, Library, Connect |
| `/api/*` | Cloud Run / local Node |

## Env (server / cloud)

```
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=
GEMINI_TEXT_MODEL=
CUTLINE_PUBLIC_URL=
```

`.env` on the machine. Never committed.

## Hunt

Each desk lists public section pages. The server opens those pages, extracts article URLs, and keeps only live `sourceUrl`s. Browser shows the URL.

## Library

SQLite at `data/cutline.db`: desk items + media (clip, photo, video, caption).
