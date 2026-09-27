import type { Pack, PhotoAsset, Rewrite } from "../../core/src/types";

/** Captions + platform pack — Flash or deterministic fallback. */
export async function packCaptions(
  rewrite: Rewrite,
  photo: PhotoAsset | undefined,
  deps?: {
    geminiText?: (prompt: string) => Promise<string>;
  }
): Promise<Pack> {
  if (deps?.geminiText) {
    const raw = await deps.geminiText(
      `JSON only {"igCaption","ytTitle","ytDescription"} for: ${rewrite.headline}\n${rewrite.body}`
    );
    try {
      const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      return {
        igCaption: p.igCaption || rewrite.headline,
        ytTitle: p.ytTitle || rewrite.headline,
        ytDescription: p.ytDescription || rewrite.body,
        stillUrl: photo?.pathOrUrl,
      };
    } catch {
      /* fall through */
    }
  }
  return {
    igCaption: `${rewrite.headline}\n\n${rewrite.body}`.slice(0, 2200),
    ytTitle: rewrite.headline.slice(0, 100),
    ytDescription: rewrite.body,
    stillUrl: photo?.pathOrUrl,
  };
}
