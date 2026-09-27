/**
 * Persist StoryRun under runs/{id}/run.json (or /tmp on Vercel).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoryRun } from "./types";
import { runsRoot as dataRunsRoot } from "./paths";

export function runsRoot(): string {
  return dataRunsRoot();
}

export async function saveRun(run: StoryRun): Promise<string> {
  const dir = join(RUNS, run.id);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "run.json");
  await writeFile(path, JSON.stringify(run, null, 2), "utf8");
  return path;
}

export async function loadRun(id: string): Promise<StoryRun> {
  if (!id || /[^a-zA-Z0-9_-]/.test(id)) {
    throw new Error("invalid run id");
  }
  const path = join(RUNS, id, "run.json");
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as StoryRun;
}
