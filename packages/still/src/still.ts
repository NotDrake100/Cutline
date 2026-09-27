import type { PhotoAsset, WireBrief } from "../../core/src/types";

/**
 * Gemini still — generated image only (bannedForPrint always true).
 * Photo lane (article OG) is the sourced path; pasted-headline runs use this.
 */
export async function stillFromBrief(
  brief: WireBrief,
  deps: {
    geminiImage: (prompt: string) => Promise<{ url: string; bytes?: ArrayBuffer } | null>;
    md5?: (bytes: ArrayBuffer) => string;
  }
): Promise<PhotoAsset> {
  let gen: { url: string; bytes?: ArrayBuffer } | null = null;
  try {
    gen = await deps.geminiImage(brief.visualPrompt);
  } catch {
    gen = null;
  }
  if (!gen?.url) throw new Error("still_unavailable");

  return {
    pathOrUrl: gen.url,
    credit: "Generated · Gemini",
    md5: gen.bytes && deps.md5 ? deps.md5(gen.bytes) : "gen",
    via: "gemini_gen",
    bannedForPrint: true,
  };
}
