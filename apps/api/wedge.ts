import { runWedge } from "../../packages/orchestrator/src/runPipeline";
import { wireFromHeadline } from "../../packages/wire/src/wire";
import { stillFromBrief } from "../../packages/still/src/still";
import { packCaptions } from "../../packages/desk/src/desk";
import type { WedgeRequest, WedgeResponse } from "../../packages/core/src/types";
import { getStyle } from "../../packages/core/src/styles";
import { getWritingStyleId } from "../../packages/library/src/db";

/**
 * POST /api/wedge  { headline, styleId? }
 * Wires runWedge → needs_input StoryRun. No Scout.
 * sourceUrl stays manual://wedge — never invent a publisher URL.
 *
 * Caller must inject Gemini (or mocks). This module does not read process.env
 * values into logs.
 */
export async function handleWedge(
  body: WedgeRequest,
  gemini: {
    text: (prompt: string) => Promise<string>;
    image: (prompt: string) => Promise<{ url: string } | null>;
  }
): Promise<WedgeResponse> {
  if (!body?.headline?.trim()) {
    throw new Error("headline required");
  }

  const style = getStyle(body.styleId || getWritingStyleId());
  const run = await runWedge(body.headline.trim(), {
    wireFromHeadline: (h) => wireFromHeadline(h, { geminiText: gemini.text }),
    stillGemini: (brief) => stillFromBrief(brief, { geminiImage: gemini.image }),
    desk: (rewrite, photo) => packCaptions(rewrite, photo, { geminiText: gemini.text }),
    now: () => new Date().toISOString(),
    id: () => `wedge_${Date.now().toString(36)}`,
    styleId: style.id,
    houseStyle: style.label,
  });
  run.styleId = style.id;

  return { run, mode: "wedge" };
}
