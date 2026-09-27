# Cutline

Your AI desk. Hunt a live page, rewrite, approve, then ship.

Public site: **https://cutline.dev** (Vercel). Same app as `cutline.vercel.app`. Do not deploy this to a DCN droplet.

Landing CTA **Open the desk** opens the public demo (`/studio?demo=1`). Paste an Instagram / X / YouTube URL (or a DCN chip) to analyze a post into the desk — Demo uses OG / oEmbed / fixtures, never Gemini.

## Demo vs owner AI

Public / judges / anonymous traffic is **Demo**. Hunt, Browser, Magic Layer, Approve, and Canva handoff use fixtures and cached source pages. The desk never calls Gemini `generateContent` for that traffic — even if `GEMINI_API_KEY` is set on Vercel.

Owner desk (Archit): set `CUTLINE_OWNER_KEY` on Vercel, then enter it in Settings (or send `x-cutline-owner`). That session may call Gemini. Local `npm run studio` without an owner key is treated as owner.

Hard gate: `packages/core/src/gemini.ts` refuses `generateContent` unless `withGeminiPermit()` is open, and the server only opens that permit for an owner session.

## Cloud env

Set these on Vercel. Never commit values.

```
GEMINI_API_KEY=
CUTLINE_OWNER_KEY=
CUTLINE_PUBLIC_URL=https://cutline.dev
GEMINI_TEXT_MODEL=gemini-3.8-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
```

Optional: `CANVA_ACCESS_TOKEN` / `CANVA_REFRESH_TOKEN` to persist HIS Canva OAuth across Vercel instances. Tokens otherwise live server-side in `data/secrets` (local) or `/tmp/cutline/secrets` (Vercel).

`GET /api/health` → `{ mode: "demo"|"owner", geminiConfigured }` — public health hides a configured Gemini key.

Needs Node 20+. Local `npm run dev` loads a gitignored repo-root `.env` when the var is empty; Vercel env is not overwritten.

## Run

```
npm install
npm run dev
```

- `/` landing — **See it work**
- `/studio` desk — Hunt, Browser, Magic Layer, Connect Canva

## Product rules

- Hunt only keeps items with a live `sourceUrl`. Browser holds that URL.
- Public demo uses cached city pages (Pune / Mumbai / Delhi / Bengaluru). Owner hunt fetches live section pages.
- Gemini rewrite/pack runs only on an owner session, and only on sourced page text.
- Connect shows working tiles only: Canva (real OAuth) and ZIP.
- Library stores clips, stills, videos, and captions in SQLite.
