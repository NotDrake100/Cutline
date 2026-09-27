# Deploy Cutline

Set `GEMINI_API_KEY` on the host. Never put the key in git.

Optional: `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, `PORT`, `CUTLINE_PUBLIC_URL`.

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
