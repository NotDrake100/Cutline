import type { AgentLogEntry, BeatConfig, StoryRun } from "../../core/src/types";
import { scoutBeat } from "../../scout/src/scout";
import { resolvePhoto } from "../../photo/src/photo";

export interface PipelineDeps {
  scout: Parameters<typeof scoutBeat>[1];
  photo: Parameters<typeof resolvePhoto>[1];
  wire: (hit: { title: string; sourceUrl: string; pageText: string }) => Promise<import("../../core/src/types").WireBrief>;
  sub: (brief: import("../../core/src/types").WireBrief, pageText: string) => Promise<import("../../core/src/types").Rewrite>;
  desk: (rewrite: import("../../core/src/types").Rewrite, photo?: import("../../core/src/types").PhotoAsset) => Promise<import("../../core/src/types").Pack>;
  fetchPageText: (url: string) => Promise<string>;
  now: () => string;
  id: () => string;
}

function log(run: StoryRun, agent: AgentLogEntry["agent"], action: string, ok: boolean, spendCents = 0, detail?: string) {
  run.log.push({ agent, at: run.createdAt, action, ok, spendCents, detail });
  run.spendCents += spendCents;
}

/**
 * Full desk pipeline. Pauses at needs_input before ship.
 * Hackathon wedge can call runWedge(headline) instead (skip scout).
 */
export async function runDeskPipeline(
  beat: BeatConfig,
  deps: PipelineDeps,
  opts: { allowGeminiGen?: boolean; autoApprove?: boolean } = {}
): Promise<StoryRun> {
  const run: StoryRun = {
    id: deps.id(),
    beat: beat.id,
    status: "hunting",
    hits: [],
    log: [],
    spendCents: 0,
    createdAt: deps.now(),
  };

  run.hits = await scoutBeat(beat, deps.scout, 5);
  log(run, "scout", `hits=${run.hits.length}`, run.hits.length > 0);
  if (!run.hits.length) {
    run.status = "failed";
    return run;
  }

  const hit = run.hits[0];
  const pageText = await deps.fetchPageText(hit.sourceUrl);
  run.status = "drafting";

  run.brief = await deps.wire({ title: hit.title, sourceUrl: hit.sourceUrl, pageText });
  log(run, "wire", "brief", true, 1);

  run.rewrite = await deps.sub(run.brief, pageText);
  if (run.rewrite.sourceUrl !== hit.sourceUrl) {
    run.status = "failed";
    log(run, "sub", "source_url_mismatch", false);
    return run;
  }
  log(run, "sub", "rewrite", true, 1);

  run.photo =
    (await resolvePhoto(
      {
        sourceUrl: hit.sourceUrl,
        photoQuery: run.brief.visualPrompt,
        allowGeminiGen: opts.allowGeminiGen,
      },
      deps.photo
    )) ?? undefined;
  log(run, "photo", run.photo?.via ?? "none", !!run.photo, run.photo?.via === "gemini_gen" ? 5 : 0);

  run.pack = await deps.desk(run.rewrite, run.photo);
  log(run, "desk", "pack", true, 1);

  run.status = opts.autoApprove ? "approved" : "needs_input";
  log(run, "night", run.status, true);
  return run;
}

/** Hackathon wedge: pasted headline only — still Gemini path, no fake news. */
export async function runWedge(
  headline: string,
  deps: {
    wireFromHeadline: (h: string) => Promise<import("../../core/src/types").WireBrief>;
    stillGemini: (brief: import("../../core/src/types").WireBrief) => Promise<import("../../core/src/types").PhotoAsset>;
    desk: PipelineDeps["desk"];
    now: () => string;
    id: () => string;
  }
): Promise<StoryRun> {
  const run: StoryRun = {
    id: deps.id(),
    beat: "wedge",
    status: "drafting",
    hits: [],
    log: [],
    spendCents: 0,
    createdAt: deps.now(),
  };
  run.brief = await deps.wireFromHeadline(headline);
  run.brief.sourceUrl = run.brief.sourceUrl || "manual://wedge";
  run.photo = await deps.stillGemini(run.brief);
  run.photo.bannedForPrint = true;
  run.rewrite = {
    headline: run.brief.headline,
    body: run.brief.angle,
    sourceUrl: run.brief.sourceUrl,
    houseStyle: "cutline-wedge",
  };
  run.pack = await deps.desk(run.rewrite, run.photo);
  run.status = "needs_input";
  return run;
}
