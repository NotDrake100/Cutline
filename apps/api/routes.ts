/**
 * Thin HTTP surface for Cloud Run / Vercel.
 * POST /api/wedge  { headline }           → hackathon
 * POST /api/desk   { beatId }             → full scout pipeline
 * POST /api/approve { runId }             → needs_input → approved
 * POST /api/ship    { runId, channel }    → ig|yt|canva|zip|telegram|x|tiktok
 * GET  /api/plugins                       → channel list + connected flags
 * GET  /api/connect/:channel             → OAuth authorize URL (no run required)
 * POST /api/connect/:channel/disconnect
 * GET  /api/oauth/callback/:channel      → provider redirect, stores token, returns to studio
 * GET  /api/beats                         → beat catalog
 * GET  /api/hunt?beat=&q=                 → scoutBeat live hunt
 * POST /api/hunt { beat, query? }         → same
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
  "GET  /api/beats",
  "GET  /api/hunt",
  "POST /api/hunt",
] as const;
