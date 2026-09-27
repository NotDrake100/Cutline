# Deploy Cutline

Set `GEMINI_API_KEY` on the host. Never put the key in git.

Optional: `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, `PORT`, `CUTLINE_PUBLIC_URL`.

`GET /api/health` and `GET /api/status` return `{ ok, geminiConfigured }` where `geminiConfigured` is a boolean. They never echo the key.

## Cloud Run

```
gcloud run deploy cutline \
  --source . \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY
```

Or build the Dockerfile and set `GEMINI_API_KEY` in the service. The container listens on `PORT` (default 8080).

## Vercel

1. Import the repo.
2. Project env: `GEMINI_API_KEY`.
3. Deploy. `vercel.json` routes `/` to the desk front and `/api/*` to the Node handler.

Hunt works without Gemini. Rewrite, still, and pack need the key. Missing key → honest error, no invented pack.

On Vercel the library writes to `/tmp` for the instance. Cloud Run keeps `data/` on the container disk.
