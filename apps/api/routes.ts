/**
 * Thin HTTP surface for Cloud Run / Vercel.
 * POST /api/wedge  { headline }           → hackathon
 * POST /api/desk   { beatId }             → full scout pipeline
 * POST /api/approve { runId }             → needs_input → approved
 * POST /api/ship    { runId, channel }    → ig|yt|canva|zip
 * GET  /api/beats                         → beat catalog
 * GET  /api/hunt?beat=&q=                 → scoutBeat live hunt
 * POST /api/hunt { beat, query? }         → same
 */
export const ROUTES = [
  "POST /api/wedge",
  "POST /api/desk",
  "POST /api/approve",
  "POST /api/ship",
  "GET  /api/runs/:id",
  "GET  /api/health",
  "GET  /api/beats",
  "GET  /api/hunt",
  "POST /api/hunt",
] as const;
