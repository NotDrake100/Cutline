import { createHash } from "node:crypto";
import { runSourcedDesk } from "../../packages/orchestrator/src/runPipeline";
import { wireFromPage } from "../../packages/wire/src/wire";
import { rewriteHouse } from "../../packages/sub/src/sub";
import { packCaptions } from "../../packages/desk/src/desk";
import { fetchPageText, fetchArticleImage, fetchArticleImages } from "../../packages/scout/src/http";
import { downloadBytes, pexelsSearch } from "../../packages/photo/src/http";
import type { DeskRequest, DeskResponse, StoryRun } from "../../packages/core/src/types";
import { getStyle } from "../../packages/core/src/styles";
import { getWritingStyleId } from "../../packages/library/src/db";

function md5(buf: ArrayBuffer): string {
  return createHash("md5").update(Buffer.from(buf)).digest("hex");
}

function outletFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "outlet";
  }
}

/**
 * POST /api/desk  { sourceUrl, title?, beat? }
 * Rewrite + pack on a live opened page. Gemini when present; else sourced photo + page text.
 */
export async function handleDesk(
  body: DeskRequest,
  gemini: {
    text: (prompt: string) => Promise<string>;
    image: (prompt: string) => Promise<{ url: string } | null>;
  }
): Promise<DeskResponse> {
  const sourceUrl = (body.sourceUrl || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error("sourceUrl must be a live http(s) URL");
  }
  const title = (body.title || sourceUrl).trim();
  const beat = (body.beat || body.beatId || "desk").trim();
  const style = getStyle(body.styleId || getWritingStyleId());

  const run = await runSourcedDesk(
    {
      title,
      sourceUrl,
      outlet: body.outlet || outletFromUrl(sourceUrl),
      via: "fetch",
    },
    {
      photo: {
        fetchArticleImage,
        pexelsSearch,
        geminiImage: gemini.image,
        md5,
        download: downloadBytes,
      },
      wire: (hit) => wireFromPage(hit, { geminiText: gemini.text }),
      sub: (brief, pageText) =>
        rewriteHouse(brief, pageText, { geminiText: gemini.text, houseStyle: style.id }),
      desk: (rewrite, photo) => packCaptions(rewrite, photo, { geminiText: gemini.text }),
      fetchPageText,
      now: () => new Date().toISOString(),
      id: () => `desk_${Date.now().toString(36)}`,
    },
    { beat, allowGeminiGen: false, styleId: style.id }
  );
  run.styleId = style.id;
  try {
    const images = await fetchArticleImages(sourceUrl, 8);
    run.photos = images;
    if (!run.photo && images[0]) {
      run.photo = {
        pathOrUrl: images[0].url,
        credit: images[0].credit,
        md5: "og",
        via: "article_og",
        bannedForPrint: false,
      };
      if (run.pack) run.pack.stillUrl = images[0].url;
    }
  } catch {
    /* page photos optional */
  }

  return { run, mode: "desk" };
}

export function ensureDeskLog(run: StoryRun): StoryRun {
  if (run.log.length > 0) return run;
  const at = run.createdAt;
  run.log = [
    { agent: "wire", at, action: "brief", ok: !!run.brief, spendCents: 1 },
    { agent: "sub", at, action: "rewrite", ok: !!run.rewrite, spendCents: 1 },
    { agent: "photo", at, action: run.photo?.via ?? "none", ok: !!run.photo, spendCents: 0 },
    { agent: "desk", at, action: "pack", ok: !!run.pack, spendCents: 1 },
    { agent: "ship", at, action: "await_approve", ok: true, detail: run.status },
  ];
  run.spendCents = run.log.reduce((s, e) => s + (e.spendCents ?? 0), 0);
  return run;
}
