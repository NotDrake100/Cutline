# Cutline

Your AI desk. Hunt a live page, rewrite with Gemini, approve, then ship.

## Cloud env

Set these on the server (Cloud Run / Vercel). Never commit values.

```
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=
GEMINI_IMAGE_MODEL=
```

Optional: `PEXELS_API_KEY`, `CUTLINE_PUBLIC_URL`, and Connect app credentials in `.env.example`.

Missing `GEMINI_API_KEY` returns a clear error. The desk does not invent headlines, stills, or pack copy.

## Run

```
npm install
npm run dev
```

- `/` landing
- `/studio` desk — Hunt, Browser, Library, Connect

## Product rules

- Hunt only keeps items with a live `sourceUrl`. Browser holds that URL.
- Gemini rewrite/pack runs on sourced page text. A pasted headline is labeled demo (`manual://wedge`) and is not a sourced story.
- Connect plugins stay `connect_required` until an account is linked. No fake publish.
- Library stores clips, stills, videos, and captions in SQLite (`data/cutline.db`).
