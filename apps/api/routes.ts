/**
 * Thin HTTP surface for Cloud Run / Vercel.
 * POST /api/wedge  { headline }           → hackathon
 * POST /api/desk   { beatId }             → full scout pipeline
 * POST /api/approve { runId }             → needs_input → approved
 * POST /api/ship    { runId, channel }    → ig|yt|canva|zip
 */
export const ROUTES = [
  "POST /api/wedge",
  "POST /api/desk",
  "POST /api/approve",
  "POST /api/ship",
  "GET  /api/runs/:id",
] as const;
