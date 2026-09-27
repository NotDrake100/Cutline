/** Product writing styles — Gemini uses the selected voice on rewrite / pack. */

export type WritingStyleId = "tight_news" | "social_caption" | "long_lede" | "neutral_brief";

export interface WritingStyle {
  id: WritingStyleId;
  label: string;
  brief: string;
  prompt: string;
}

export const WRITING_STYLES: WritingStyle[] = [
  {
    id: "tight_news",
    label: "Tight news",
    brief: "Short headline. One graf. Facts first.",
    prompt:
      "Tight news: sentence-case headline under 12 words. One-graf lede. Facts first. No hype, no questions, no invented quotes.",
  },
  {
    id: "social_caption",
    label: "Social caption",
    brief: "Hook line. Clean close. No tag spam.",
    prompt:
      "Social caption: punchy first line, one hook, one clean close. Conversational and precise. No hashtag spam. No emoji piles.",
  },
  {
    id: "long_lede",
    label: "Long lede",
    brief: "Opening graf that earns the click.",
    prompt:
      "Long lede: an opening graf that earns the click, then the nut. Sourced color only. No invented scene-setting.",
  },
  {
    id: "neutral_brief",
    label: "Neutral brief",
    brief: "Calm. Attribution-first. No take.",
    prompt:
      "Neutral brief: calm, attribution-first, no take. Desk voice. Short sentences. Name the source when a claim is attributed.",
  },
];

export const DEFAULT_STYLE_ID: WritingStyleId = "tight_news";

export function getStyle(id?: string | null): WritingStyle {
  const found = WRITING_STYLES.find((s) => s.id === id);
  return found || WRITING_STYLES[0]!;
}

export function isStyleId(id: unknown): id is WritingStyleId {
  return typeof id === "string" && WRITING_STYLES.some((s) => s.id === id);
}

export function stylePrompt(id?: string | null): string {
  return getStyle(id).prompt;
}

export function listStyles(): WritingStyle[] {
  return WRITING_STYLES.slice();
}
