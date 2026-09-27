/**
 * Vercel Node entry — cutline.dev. Same handler as local.
 * Public traffic is Demo (no Gemini). Owner session + GEMINI_API_KEY for HIS desk.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHttp, loadDotEnv } from "../apps/api/server";

let boot: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!boot) boot = loadDotEnv();
  await boot;
  await handleHttp(req, res);
}
