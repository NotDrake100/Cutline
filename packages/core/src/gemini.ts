/**
 * Thin Gemini adapter for Mode A wedge.
 * Reads ENV name constants only — never logs key values.
 * Missing key → deterministic stubs so studio still boots.
 */
import { ENV } from "./env";

const STUB_STILL = "/assets/demo-still.jpg";

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

function stubText(prompt: string): string {
  const isPack = /igCaption|ytTitle/i.test(prompt);
  if (isPack) {
    const head = prompt.split("for:")[1]?.trim().split("\n")[0] || "Stub headline";
    return JSON.stringify({
      igCaption: `${head.slice(0, 80)}\n\n#cutline #stub`,
      ytTitle: head.slice(0, 100),
      ytDescription: "Stub pack — set GEMINI_API_KEY for live captions.",
    });
  }
  const m = prompt.match(/headline:\s*(.+)$/i);
  const h = (m?.[1] || "Stub story").trim().slice(0, 200);
  return JSON.stringify({
    headline: h,
    angle: `Desk angle on: ${h}`,
    cityLead: "City:",
    visualPrompt: `Editorial news still, square crop, documentary light: ${h}`,
    facts: ["stub_mode", "no_gemini_key"],
  });
}

async function generateContent(
  model: string,
  key: string,
  body: Record<string, unknown>
): Promise<unknown> {
  // Key in header only — never append to URL (avoids accidental log leaks).
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
    const key = apiKey();
    if (!key) return stubText(prompt);
    try {
      const data = await generateContent(textModel(), key, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      });
      const out = extractText(data);
      return out || stubText(prompt);
    } catch {
      return stubText(prompt);
    }
  },

  async image(prompt: string): Promise<{ url: string } | null> {
    const key = apiKey();
    if (!key) return { url: STUB_STILL };
    try {
      const data = await generateContent(imageModel(), key, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });
      const url = extractImageDataUrl(data);
      if (url) return { url };
      return { url: STUB_STILL };
    } catch {
      return { url: STUB_STILL };
    }
  },

  hasKey(): boolean {
    return !!apiKey();
  },
};

export type GeminiClient = {
  text: (prompt: string) => Promise<string>;
  image: (prompt: string) => Promise<{ url: string } | null>;
};
