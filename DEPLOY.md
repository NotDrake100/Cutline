# Deploy Cutline

Host the public product on **Vercel**. Public URL: **https://cutline.dev** (also `https://cutline.vercel.app`). Do not invent a DCN / droplet deploy.

Node 20+. The library uses `better-sqlite3` so local Node 20 and Vercel both boot.

## Vercel

```
npx vercel
```

Dashboard: Import the repo → Project Name `cutline` → add env → Deploy. Attach the `cutline.dev` domain to the project.

`vercel.json` routes `/` to the landing, `/studio` to the desk, `/api/*` to the Node handler. On Vercel the library writes to `/tmp`.

## Env (Vercel project settings)

Required for HIS owner desk:

```
GEMINI_API_KEY=
CUTLINE_OWNER_KEY=
CUTLINE_PUBLIC_URL=https://cutline.dev
```

Canva OAuth (tokens stay server-side, never in the browser):

```
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
```

Register the Canva redirect: `https://cutline.dev/api/oauth/callback/canva`

To persist HIS Canva account across serverless instances, also set `CANVA_ACCESS_TOKEN`, `CANVA_REFRESH_TOKEN`, `CANVA_ACCOUNT_LABEL` after the first connect.

Optional: `GEMINI_TEXT_MODEL` (default `gemini-3.8-flash`), `GEMINI_IMAGE_MODEL` (default `gemini-3.1-flash-image`).

`CUTLINE_FORCE_DEMO=1` forces Demo even with an owner cookie.

## Demo vs owner AI

Public / anonymous → Demo fixtures. No Gemini `generateContent`.
Owner cookie or `x-cutline-owner: CUTLINE_OWNER_KEY` → real Gemini.
On Vercel, a missing owner session is always Demo even if `GEMINI_API_KEY` is set.

`GET /api/health` returns `{ mode, owner, geminiConfigured }`. Public `geminiConfigured` is false so judges do not see a live key.

Hunt and Browser work without Gemini. Owner rewrite uses the key when present.
