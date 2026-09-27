import type { WireBrief } from "../../core/src/types";
import { parseGeminiJson } from "../../core/src/gemini";

/**
 * Hackathon Wire — pasted headline → brief.
 * sourceUrl is always manual://wedge (never fake a publisher URL).
 * Requires a live Gemini response — no invented angle/facts.
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
    `Return JSON only: {"headline","angle","cityLead","visualPrompt","facts":string[]} for a news desk still from this pasted headline (demo, not a sourced story): ${h}`
  );
  const parsed = parseGeminiJson<Partial<WireBrief>>(raw);
  if (!parsed.headline || !parsed.angle || !parsed.visualPrompt) {
    throw new Error("gemini_invalid_json");
  }

  return {
    headline: String(parsed.headline).trim(),
    angle: String(parsed.angle).trim(),
    cityLead: String(parsed.cityLead || "City:").trim(),
    visualPrompt: String(parsed.visualPrompt).trim(),
    facts: Array.isArray(parsed.facts) ? parsed.facts.map(String) : [],
    sourceUrl: "manual://wedge",
  };
}

/**
 * Desk Wire — brief from a live page. sourceUrl is the opened URL (never invented).
 */
export async function wireFromPage(
  hit: { title: string; sourceUrl: string; pageText: string },
  deps: {
    geminiText: (prompt: string) => Promise<string>;
  }
): Promise<WireBrief> {
  if (!hit.sourceUrl || !/^https?:\/\//i.test(hit.sourceUrl)) {
    throw new Error("sourceUrl must be a live http(s) URL");
  }
  const page = (hit.pageText || "").trim();
  if (!page) throw new Error("source_page_empty");

  const raw = await deps.geminiText(
    `Return JSON only: {"headline","angle","cityLead","visualPrompt","facts":string[]} from this sourced page. Do not invent facts that are not on the page. Source URL must stay ${hit.sourceUrl}.\n\nTITLE: ${hit.title}\n\nPAGE:\n${page.slice(0, 8000)}`
  );
  const parsed = parseGeminiJson<Partial<WireBrief>>(raw);
  if (!parsed.headline || !parsed.angle || !parsed.visualPrompt) {
    throw new Error("gemini_invalid_json");
  }

  return {
    headline: String(parsed.headline).trim(),
    angle: String(parsed.angle).trim(),
    cityLead: String(parsed.cityLead || "City:").trim(),
    visualPrompt: String(parsed.visualPrompt).trim(),
    facts: Array.isArray(parsed.facts) ? parsed.facts.map(String) : [],
    sourceUrl: hit.sourceUrl,
  };
}
