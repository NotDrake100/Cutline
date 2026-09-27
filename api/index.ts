/**
 * Vercel Node entry — same handler as Cloud Run / local.
 * Set GEMINI_API_KEY on the project. Never log it.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHttp, loadDotEnv } from "../apps/api/server";

let boot: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!boot) boot = loadDotEnv();
  await boot;
  await handleHttp(req, res);
}
