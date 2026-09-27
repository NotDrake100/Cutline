/**
 * Writable roots. Local: repo data/ + runs/.
 * Vercel: /tmp/cutline (instance-local). One env — GEMINI_API_KEY — lights Gemini.
 */
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../../..");

export function dataRoot(): string {
  const override = process.env.CUTLINE_DATA_DIR?.trim();
  if (override) return override;
  if (process.env.VERCEL) return "/tmp/cutline";
  return join(ROOT, "data");
}

export function runsRoot(): string {
  const override = process.env.CUTLINE_RUNS_DIR?.trim();
  if (override) return override;
  if (process.env.VERCEL) return join(dataRoot(), "runs");
  return join(ROOT, "runs");
}

export function uploadsRoot(): string {
  return join(dataRoot(), "uploads");
}

export function dbFile(): string {
  return join(dataRoot(), "cutline.db");
}
