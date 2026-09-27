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
 */
export const ROUTES = [
  "POST /api/wedge",
  "POST /api/desk",
  "POST /api/approve",
  "POST /api/ship",
  "GET  /api/plugins",
  "GET  /api/connect/:channel",
  "POST /api/connect/:channel/disconnect",
  "GET  /api/oauth/callback/:channel",
  "GET  /api/runs/:id",
  "GET  /api/health",
  "GET  /api/desks",
  "GET  /api/hunt",
  "POST /api/hunt",
  "GET  /api/library",
  "POST /api/library",
  "GET  /api/library/:id",
] as const;
