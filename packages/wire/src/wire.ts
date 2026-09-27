import type { WireBrief } from "../../core/src/types";

/**
 * Hackathon Wire — pasted headline → brief.
 * sourceUrl is always manual://wedge (never fake a publisher URL).
 */
export async function wireFromHeadline(
  headline: string,
  deps: {
    geminiText: (prompt: string) => Promise<string>;
  }
): Promise<WireBrief> {
  const h = headline.trim();
  if (!h) throw new Error("headline required");

  const raw = await deps.geminiText(
    `Return JSON only: {"headline","angle","cityLead","visualPrompt","facts":string[]} for news desk still from headline: ${h}`
  );
  let parsed: Partial<WireBrief> = {};
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    parsed = {};
  }

  return {
    headline: parsed.headline || h,
    angle: parsed.angle || h,
    cityLead: parsed.cityLead || "City:",
    visualPrompt:
      parsed.visualPrompt ||
      `Editorial news still, square crop, documentary light: ${h}`,
    facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    sourceUrl: "manual://wedge",
  };
}
