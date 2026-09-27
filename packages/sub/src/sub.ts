import type { Rewrite, WireBrief } from "../../core/src/types";
import { parseGeminiJson } from "../../core/src/gemini";

/**
 * House-voice rewrite vs fetched page text.
 * Hard rule: rewrite.sourceUrl must equal brief.sourceUrl.
 * Requires a live Gemini JSON response — no invented body.
 */
export async function rewriteHouse(
  brief: WireBrief,
  pageText: string,
  deps: {
    geminiText: (prompt: string) => Promise<string>;
    houseStyle?: string;
  }
): Promise<Rewrite> {
  const style = deps.houseStyle || "Cutline";
  const raw = await deps.geminiText(
    `Rewrite in house voice (${style}). Sentence-case headline. City lead. No invented quotes. JSON {"headline","body","caption"}. Source URL must stay ${brief.sourceUrl}.\n\nBRIEF:\n${JSON.stringify(brief)}\n\nPAGE:\n${pageText.slice(0, 8000)}`
  );
  const parsed = parseGeminiJson<Partial<Rewrite>>(raw);
  if (!parsed.headline || !parsed.body) throw new Error("gemini_invalid_json");
  return {
    headline: String(parsed.headline).trim(),
    body: String(parsed.body).trim(),
    caption: parsed.caption ? String(parsed.caption) : undefined,
    houseStyle: style,
    sourceUrl: brief.sourceUrl,
  };
}
