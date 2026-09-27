import type { Pack, Rewrite, StoryRun } from "../../core/src/types";
import { parseGeminiJson } from "../../core/src/gemini";
import { getStyle, type WritingStyle } from "../../core/src/styles";

export interface RestyleCopy {
  rewrite: Rewrite;
  pack: Pack;
}

/**
 * Apply a writing style to existing headline / body / pack.
 * Facts stay; voice changes. Requires live Gemini JSON.
 */
export async function restyleRunCopy(
  run: Pick<StoryRun, "rewrite" | "brief" | "pack" | "photo">,
  styleId: string | undefined,
  geminiText: (prompt: string) => Promise<string>
): Promise<RestyleCopy> {
  const style: WritingStyle = getStyle(styleId);
  const sourceUrl = run.rewrite?.sourceUrl || run.brief?.sourceUrl || "";
  const raw = await geminiText(
    `Rewrite this desk pack in this voice: ${style.label}. ${style.prompt}
Keep facts. Do not invent. Source URL must stay ${sourceUrl || "(none)"}.
JSON only {"headline","body","caption","igCaption","ytTitle","ytDescription"}.

HEADLINE: ${run.rewrite?.headline || run.brief?.headline || ""}
BODY: ${run.rewrite?.body || run.brief?.angle || ""}
CAPTION: ${run.rewrite?.caption || run.pack?.igCaption || ""}
IG: ${run.pack?.igCaption || ""}
YT TITLE: ${run.pack?.ytTitle || ""}
YT DESC: ${run.pack?.ytDescription || ""}`
  );
  const parsed = parseGeminiJson<{
    headline?: string;
    body?: string;
    caption?: string;
    igCaption?: string;
    ytTitle?: string;
    ytDescription?: string;
  }>(raw);
  if (!parsed.headline || !parsed.body || !parsed.igCaption || !parsed.ytTitle || !parsed.ytDescription) {
    throw new Error("gemini_invalid_json");
  }
  const rewrite: Rewrite = {
    headline: String(parsed.headline).trim(),
    body: String(parsed.body).trim(),
    caption: parsed.caption ? String(parsed.caption).trim() : undefined,
    houseStyle: style.label,
    sourceUrl: sourceUrl || run.rewrite?.sourceUrl || "manual://wedge",
  };
  const pack: Pack = {
    igCaption: String(parsed.igCaption).trim(),
    ytTitle: String(parsed.ytTitle).trim(),
    ytDescription: String(parsed.ytDescription).trim(),
    canvaNotes: run.pack?.canvaNotes,
    stillUrl: run.pack?.stillUrl || run.photo?.pathOrUrl,
    clipUrl: run.pack?.clipUrl,
  };
  return { rewrite, pack };
}
