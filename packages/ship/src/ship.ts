import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pack, StoryRun } from "../../core/src/types";
import { runsRoot } from "../../core/src/runs";

export type ShipChannel =
  | "ig"
  | "yt"
  | "canva"
  | "zip"
  | "telegram"
  | "x"
  | "tiktok";

export type ShipStatus = "ready" | "queued" | "connect_required" | "downloaded";

export interface PluginInfo {
  id: ShipChannel;
  name: string;
  description: string;
  connected: boolean;
  primary: boolean;
  /** Always-available local export — no OAuth. */
  local: boolean;
  comingSoon?: boolean;
}

export interface PackPreview {
  igCaption?: string;
  ytTitle?: string;
  ytDescription?: string;
  canvaNotes?: string;
  stillUrl?: string;
  headline?: string;
  shareText: string;
}

export interface ShipResult {
  ok: boolean;
  channel: ShipChannel;
  status: ShipStatus;
  warning?: string;
  connectUrl?: string;
  nextStep?: string;
  pack?: PackPreview;
  /** Present when channel=zip — files written under runs/{id}/pack/ */
  files?: { json: string; caption: string };
  /** Browser download payload for zip */
  download?: {
    filename: string;
    mime: string;
    content: string;
  };
}

const PLUGINS: PluginInfo[] = [
  {
    id: "ig",
    name: "Instagram",
    description: "Still + IG caption pack",
    connected: false,
    primary: true,
    local: false,
  },
  {
    id: "yt",
    name: "YouTube",
    description: "Title, description + thumbnail",
    connected: false,
    primary: true,
    local: false,
  },
  {
    id: "canva",
    name: "Canva",
    description: "Open design handoff",
    connected: false,
    primary: true,
    local: false,
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "DCN-proven ship lane",
    connected: false,
    primary: false,
    local: false,
  },
  {
    id: "x",
    name: "X / Twitter",
    description: "Post + media",
    connected: false,
    primary: false,
    local: false,
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Shorts handoff",
    connected: false,
    primary: false,
    local: false,
    comingSoon: true,
  },
  {
    id: "zip",
    name: "Download ZIP",
    description: "JSON + caption bundle — always works",
    connected: true,
    primary: false,
    local: true,
  },
];

export function listPlugins(): PluginInfo[] {
  // Honest: nothing OAuth-connected yet
  return PLUGINS.map((p) => ({
    ...p,
    connected: p.local ? true : false,
  }));
}

/** Real post still needs approved; preview/pack OK at needs_input. */
export async function assertApproved(run: StoryRun) {
  if (run.status !== "approved") {
    throw new Error(`ship_blocked: status=${run.status}`);
  }
}

export function buildSharePack(run: StoryRun): {
  shareText: string;
  pack: Pack | undefined;
  channels: ShipChannel[];
} {
  if (run.status !== "approved" && run.status !== "needs_input") {
    throw new Error("share preview requires needs_input or approved");
  }
  const pack = run.pack;
  const shareText = [
    pack?.ytTitle || run.rewrite?.headline || "",
    pack?.igCaption || "",
    run.brief?.sourceUrl === "manual://wedge"
      ? "(demo / pasted headline)"
      : run.brief?.sourceUrl,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    shareText,
    pack,
    channels: ["zip", "ig", "yt", "canva", "telegram", "x"],
  };
}

function packPreview(run: StoryRun, shareText: string): PackPreview {
  const p = run.pack;
  return {
    igCaption: p?.igCaption,
    ytTitle: p?.ytTitle,
    ytDescription: p?.ytDescription,
    canvaNotes: p?.canvaNotes,
    stillUrl: p?.stillUrl || run.photo?.pathOrUrl,
    headline: run.rewrite?.headline || run.brief?.headline,
    shareText,
  };
}

/** Canva create / Magic Studio — honest open URL (no fake publish). */
export function canvaCreateUrl(run: StoryRun): string {
  const title =
    run.pack?.ytTitle || run.rewrite?.headline || run.brief?.headline || "Cutline pack";
  // Public Canva create entry; user pastes pack from preview
  const q = encodeURIComponent(title.slice(0, 80));
  return `https://www.canva.com/create?type=instagram-post&query=${q}`;
}

function connectStub(
  channel: ShipChannel,
  run: StoryRun,
  shareText: string,
  extra?: Partial<ShipResult>
): ShipResult {
  const names: Record<string, string> = {
    ig: "Instagram",
    yt: "YouTube",
    canva: "Canva",
    telegram: "Telegram",
    x: "X / Twitter",
    tiktok: "TikTok",
  };
  const connectUrls: Partial<Record<ShipChannel, string>> = {
    ig: "https://www.instagram.com/accounts/login/",
    yt: "https://studio.youtube.com/",
    canva: canvaCreateUrl(run),
    telegram: "https://telegram.org/",
    x: "https://x.com/i/flow/login",
    tiktok: "https://www.tiktok.com/login",
  };
  return {
    ok: true,
    channel,
    status: "connect_required",
    connectUrl: connectUrls[channel],
    nextStep: `Connect ${names[channel] || channel} OAuth (not live yet). Copy pack below, or download ZIP.`,
    pack: packPreview(run, shareText),
    warning:
      run.status === "needs_input"
        ? "Run still needs_input — approve before a real publish. Pack preview only."
        : undefined,
    ...extra,
  };
}

/**
 * Ship a run to a channel.
 * - zip: always writes pack files + returns download payload (works at needs_input or approved)
 * - ig/yt/canva/telegram/x/tiktok: honest connect_required stubs — never fake publish
 */
export async function shipRun(
  run: StoryRun,
  channel: ShipChannel
): Promise<ShipResult> {
  if (run.status !== "approved" && run.status !== "needs_input") {
    throw new Error(`ship_blocked: status=${run.status}`);
  }

  const { shareText, pack } = buildSharePack(run);
  const warning =
    run.status === "needs_input"
      ? "Run still needs_input — prefer Approve before ship. Pack available."
      : undefined;

  if (channel === "zip") {
    const packDir = join(runsRoot(), run.id, "pack");
    await mkdir(packDir, { recursive: true });
    const bundle = {
      runId: run.id,
      status: run.status,
      channel: "zip",
      exportedAt: new Date().toISOString(),
      headline: run.rewrite?.headline || run.brief?.headline,
      sourceUrl: run.brief?.sourceUrl || run.rewrite?.sourceUrl,
      photo: run.photo
        ? {
            pathOrUrl: run.photo.pathOrUrl,
            credit: run.photo.credit,
            via: run.photo.via,
            bannedForPrint: run.photo.bannedForPrint,
          }
        : undefined,
      pack: pack || null,
      shareText,
    };
    const jsonPath = join(packDir, "pack.json");
    const captionPath = join(packDir, "caption.txt");
    const jsonBody = JSON.stringify(bundle, null, 2);
    const captionBody = [
      pack?.ytTitle || run.rewrite?.headline || "",
      "",
      "— IG —",
      pack?.igCaption || "",
      "",
      "— YT —",
      pack?.ytTitle || "",
      pack?.ytDescription || "",
      "",
      "— Canva notes —",
      pack?.canvaNotes || "(paste still + captions into canva.com/create)",
      "",
      shareText,
    ].join("\n");
    await writeFile(jsonPath, jsonBody, "utf8");
    await writeFile(captionPath, captionBody, "utf8");

    return {
      ok: true,
      channel: "zip",
      status: "downloaded",
      warning,
      pack: packPreview(run, shareText),
      files: { json: jsonPath, caption: captionPath },
      download: {
        filename: `cutline-${run.id}-pack.json`,
        mime: "application/json",
        content: jsonBody,
      },
    };
  }

  if (channel === "canva") {
    // Handoff: return connect to Canva create + pack; never claim published
    return connectStub("canva", run, shareText, {
      nextStep:
        "Copy pack (caption + still), then Open in Canva — or paste into canva.com/create. OAuth publish not live.",
      connectUrl: canvaCreateUrl(run),
    });
  }

  if (
    channel === "ig" ||
    channel === "yt" ||
    channel === "telegram" ||
    channel === "x" ||
    channel === "tiktok"
  ) {
    return connectStub(channel, run, shareText);
  }

  throw new Error(`unknown_channel: ${channel}`);
}
