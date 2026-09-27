/**
 * Thin HTTP surface for Cloud Run / Vercel.
 * POST /api/wedge  { headline }           → demo (manual://wedge)
 * POST /api/desk   { sourceUrl, title? }  → sourced rewrite
 * POST /api/approve { runId }
 * POST /api/ship    { runId, channel }
 * GET  /api/plugins
 * GET  /api/connect/:channel
 * POST /api/connect/:channel/disconnect
 * GET  /api/oauth/callback/:channel
 * GET  /api/desks
 * GET  /api/hunt?desk=
 * GET  /api/library
 * POST /api/library
 * GET  /api/library/:id
 * POST /api/clip                       → raw video upload (cut pending)
 * GET  /api/status                     → { ok, gemini } boolean only for the key
 */
export const ROUTES = [
  "POST /api/wedge",
  "POST /api/desk",
  "POST /api/approve",
  "POST /api/ship",
  "POST /api/clip",
  "GET  /api/plugins",
  "GET  /api/connect/:channel",
  "POST /api/connect/:channel/disconnect",
  "GET  /api/oauth/callback/:channel",
  "GET  /api/runs/:id",
  "GET  /api/health",
  "GET  /api/status",
  "GET  /api/desks",
  "GET  /api/hunt",
  "POST /api/hunt",
  "GET  /api/library",
  "POST /api/library",
  "GET  /api/library/:id",
] as const;
