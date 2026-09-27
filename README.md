# Cutline

Your AI desk. Hunt a live page, rewrite with Gemini, approve, then ship.

## Cloud env

Set these on the server (Cloud Run / Vercel). Never commit values.

```
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

Optional: `PEXELS_API_KEY`, `CUTLINE_PUBLIC_URL`, and Connect app credentials in `.env.example`.

Missing `GEMINI_API_KEY` returns a clear error. The desk does not invent headlines, stills, or pack copy.

Deploy: see `DEPLOY.md` (Cloud Run Dockerfile or Vercel). Health: `GET /api/health` → `{ geminiConfigured: true|false }`.

Needs Node 20+. `GEMINI_API_KEY` is read from `process.env`. Locally, `npm run dev` loads a gitignored repo-root `.env` when the var is empty; Vercel/Cloud Run env is not overwritten.

## Run

```
npm install
npm run dev
```

- `/` landing
- `/studio` desk — Hunt, Browser, Library, Connect

## Product rules

- Hunt only keeps items with a live `sourceUrl`. Browser holds that URL.
- Gemini rewrite/pack runs on sourced page text. A pasted headline is not a sourced story.
- Writing styles (Tight news, Social caption, Long lede, Neutral brief) apply on Approve and Magic Layer.
- Connect plugins stay `connect_required` until an account is linked. No fake publish.
- Library stores clips, stills, videos, and captions in SQLite.
