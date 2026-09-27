import type { Pack, PhotoAsset, Rewrite } from "../../core/src/types";
import { parseGeminiJson } from "../../core/src/gemini";

/** Captions + platform pack — Gemini only. No deterministic fake pack. */
export async function packCaptions(
  rewrite: Rewrite,
  photo: PhotoAsset | undefined,
  deps?: {
    geminiText?: (prompt: string) => Promise<string>;
  }
): Promise<Pack> {
  if (!deps?.geminiText) throw new Error("gemini_required");
  const voice = rewrite.houseStyle ? ` Voice: ${rewrite.houseStyle}.` : "";
  const raw = await deps.geminiText(
    `JSON only {"igCaption","ytTitle","ytDescription"} for: ${rewrite.headline}\n${rewrite.body}.${voice}`
  );
  const p = parseGeminiJson<{ igCaption?: string; ytTitle?: string; ytDescription?: string }>(raw);
  if (!p.igCaption || !p.ytTitle || !p.ytDescription) {
    throw new Error("gemini_invalid_json");
  }
  return {
    igCaption: String(p.igCaption),
    ytTitle: String(p.ytTitle),
    ytDescription: String(p.ytDescription),
    stillUrl: photo?.pathOrUrl,
  };
}
