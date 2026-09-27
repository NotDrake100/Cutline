# Deploy Cutline

Node 20+. The library uses `better-sqlite3` (not `node:sqlite`) so local Node 20, Vercel, and Cloud Run images all boot.

Set `GEMINI_API_KEY` on the host. Never put the key in git.

Local `npm run dev` reads a gitignored repo-root `.env` into `process.env` only when the var is unset or empty — so a key Archit already has locally stays local, and Vercel/Cloud Run env always wins.

Optional: `GEMINI_TEXT_MODEL` (default `gemini-3.8-flash`; `gemini-flash-latest` also works), `GEMINI_IMAGE_MODEL` (default `gemini-3.1-flash-image` — paid/quota may be required; a 429 does not fail the pack — the desk uses the sourced page photo), `PORT`, `CUTLINE_PUBLIC_URL`.

`GET /api/health` and `GET /api/status` return `{ ok, geminiConfigured }` where `geminiConfigured` is a boolean. They never echo the key.

## Vercel — public URL

Create the project as **`cutline`**. Vercel then serves:

`https://cutline.vercel.app`

No custom domain required.

```
npx vercel
```

When prompted, set the project name to `cutline`.

Or in the Vercel dashboard: Import the repo → Project Name `cutline` → Env `GEMINI_API_KEY` → Deploy.

`vercel.json` routes `/` to the desk front and `/api/*` to the Node handler.

On Vercel the library writes to `/tmp` for the instance.

## Cloud Run

```
gcloud run deploy cutline \
  --source . \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY
```

Or build the Dockerfile and set `GEMINI_API_KEY` in the service. The container listens on `PORT` (default 8080).

Hunt and Browser work without Gemini. Rewrite uses the key when present. Missing or failed Gemini settles on the sourced page photo and last-good copy — the desk never invents news.
