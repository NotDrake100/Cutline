import type { Rewrite, WireBrief } from "../../core/src/types";

/**
 * House-voice rewrite vs fetched page text.
 * Hard rule: rewrite.sourceUrl must equal brief.sourceUrl.
 */
export async function rewriteHouse(
  brief: WireBrief,
  pageText: string,
  deps: {
    geminiText: (prompt: string) => Promise<string>;
    houseStyle?: string;
  }
): Promise<Rewrite> {
  const style = deps.houseStyle || "DCN News Network";
  const raw = await deps.geminiText(
    `Rewrite in house voice (${style}). Sentence-case headline. City lead. No invented quotes. JSON {"headline","body","caption"}. Source URL must stay ${brief.sourceUrl}.\n\nBRIEF:\n${JSON.stringify(brief)}\n\nPAGE:\n${pageText.slice(0, 8000)}`
  );
  let parsed: Partial<Rewrite> = {};
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    parsed = { headline: brief.headline, body: brief.angle };
  }
  return {
    headline: parsed.headline || brief.headline,
    body: parsed.body || brief.angle,
    caption: parsed.caption,
    houseStyle: style,
    sourceUrl: brief.sourceUrl, // never drift
  };
}
