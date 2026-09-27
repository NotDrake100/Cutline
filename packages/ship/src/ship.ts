import type { Pack, StoryRun } from "../../core/src/types";

/** Ship MUST throw unless status === "approved". */
export async function assertApproved(run: StoryRun) {
  if (run.status !== "approved") {
    throw new Error(`ship_blocked: status=${run.status}`);
  }
}

/** Preview share text OK at needs_input; real post still needs assertApproved. */
export function buildSharePack(run: StoryRun): {
  shareText: string;
  pack: Pack | undefined;
  channels: ("zip" | "ig" | "yt" | "canva")[];
} {
  if (run.status !== "approved" && run.status !== "needs_input") {
    throw new Error("share preview requires needs_input or approved");
  }
  const pack = run.pack;
  const shareText = [
    pack?.ytTitle || run.rewrite?.headline || "",
    pack?.igCaption || "",
    run.brief?.sourceUrl === "manual://wedge"
      ? "(demo / pasted headline)"
      : run.brief?.sourceUrl,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { shareText, pack, channels: ["zip"] };
}
