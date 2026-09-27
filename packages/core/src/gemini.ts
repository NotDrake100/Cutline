/**
 * Gemini adapter — live API only.
 * Missing key or a failed call throws. Never invents headlines, stills, or pack copy.
 */
import { ENV } from "./env";

function apiKey(): string | undefined {
  const k = process.env[ENV.GEMINI_API_KEY];
  return k && k.trim() ? k.trim() : undefined;
}

function textModel(): string {
  return process.env[ENV.GEMINI_TEXT_MODEL]?.trim() || "gemini-2.0-flash";
}

function imageModel(): string {
  return process.env[ENV.GEMINI_IMAGE_MODEL]?.trim() || "gemini-2.0-flash-preview-image-generation";
}

export function requireGeminiKey(): string {
  const key = apiKey();
  if (!key) throw new Error("gemini_not_configured");
  return key;
}

export function parseGeminiJson<T>(raw: string): T {
  const cleaned = String(raw || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!cleaned) throw new Error("gemini_invalid_json");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("gemini_invalid_json");
  }
}

async function generateContent(
  model: string,
  key: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`gemini_http_${res.status}`);
  }
  return res.json();
}

function extractText(data: unknown): string {
  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text || "").join("").trim();
}

function extractImageDataUrl(data: unknown): string | null {
  const d = data as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
    }[];
  };
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      const mime = p.inlineData.mimeType || "image/png";
      return `data:${mime};base64,${p.inlineData.data}`;
    }
  }
  return null;
}

export const gemini = {
  async text(prompt: string): Promise<string> {
    const key = requireGeminiKey();
    const data = await generateContent(textModel(), key, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4 },
    });
    const out = extractText(data);
    if (!out) throw new Error("gemini_empty");
    return out;
  },

  async image(prompt: string): Promise<{ url: string } | null> {
    const key = requireGeminiKey();
    const data = await generateContent(imageModel(), key, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });
    const url = extractImageDataUrl(data);
    if (!url) throw new Error("gemini_image_empty");
    return { url };
  },

  hasKey(): boolean {
    return !!apiKey();
  },
};

export type GeminiClient = {
  text: (prompt: string) => Promise<string>;
  image: (prompt: string) => Promise<{ url: string } | null>;
};
