/**
 * Thin HTTP surface for Cloud Run / Vercel.
 * POST /api/wedge  { headline, styleId? } → pasted headline (manual://wedge)
 * POST /api/desk   { sourceUrl, title?, styleId? }
 * POST /api/approve { runId, styleId? }
 * POST /api/restyle { runId, styleId }
 * POST /api/ship    { runId, channel }
 * GET  /api/styles  PUT /api/style
 * GET  /api/status  → { ok, geminiConfigured } boolean only for the key
 */
export const ROUTES = [
  "POST /api/wedge",
  "POST /api/desk",
  "POST /api/approve",
  "POST /api/restyle",
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
  "GET  /api/styles",
  "PUT  /api/style",
] as const;
