import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pack, StoryRun } from "../../core/src/types";
import { runsRoot } from "../../core/src/runs";
import { getFreshAccount, isOauthChannel, type ConnectionView } from "./oauth";
import { publishConnected } from "./publish";

export type ShipChannel =
  | "ig"
  | "yt"
  | "canva"
  | "zip"
  | "telegram"
  | "x"
  | "tiktok"
  | "gmail"
  | "drive"
  | "slack";

export type ShipStatus = "ready" | "queued" | "connect_required" | "downloaded" | "published" | "failed";

export interface PluginInfo {
  id: ShipChannel;
  name: string;
  description: string;
  connected: boolean;
  primary: boolean;
  /** Always-available local export — no OAuth. */
  local: boolean;
  comingSoon?: boolean;
  /** App credentials are in the environment. */
  configured: boolean;
  /** Env names still empty. Never values. */
  missing: string[];
  accountLabel?: string;
  /** Public app URL for Open — never implies Connected. */
  openUrl?: string;
  /** Connect OAuth only this pass — no auto-send/publish. */
  openOnly?: boolean;
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

const PLUGINS: Omit<PluginInfo, "configured" | "missing">[] = [
  {
    id: "canva",
    name: "Canva",
    description: "Design handoff — real OAuth when CANVA_* is set",
    connected: false,
    primary: true,
    local: false,
    openUrl: "https://www.canva.com/",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Newsroom inbox — Google OAuth when GOOGLE_* is set",
    connected: false,
    primary: true,
    local: false,
    openUrl: "https://mail.google.com/",
    openOnly: true,
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Packs & assets — same Google OAuth family as Gmail",
    connected: false,
    primary: true,
    local: false,
    openUrl: "https://drive.google.com/",
    openOnly: true,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Desk alerts — OAuth when SLACK_* is set",
    connected: false,
    primary: false,
    local: false,
    openUrl: "https://app.slack.com/",
    openOnly: true,
  },
  {
    id: "x",
    name: "X / Twitter",
    description: "Post + media — OAuth when X_CLIENT_* is set",
    connected: false,
    primary: false,
    local: false,
    openUrl: "https://x.com/",
  },
  {
    id: "yt",
    name: "YouTube",
    description: "Title, description + thumbnail",
    connected: false,
    primary: true,
    local: false,
    openUrl: "https://studio.youtube.com/",
  },
  {
    id: "ig",
    name: "Instagram",
    description: "Still + IG caption pack",
    connected: false,
    primary: true,
    local: false,
    openUrl: "https://www.instagram.com/",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Channel message",
    connected: false,
    primary: false,
    local: false,
    openUrl: "https://telegram.org/",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Photo publish via TikTok Login",
    connected: false,
    primary: false,
    local: false,
    openUrl: "https://www.tiktok.com/",
  },
  {
    id: "zip",
    name: "Download ZIP",
    description: "JSON + caption bundle — always works, no login",
    connected: true,
    primary: false,
    local: true,
  },
];

/** Desk Plugins page — newsroom connectors. Honesty: Connected only after real OAuth. */
const WORKING_PLUGIN_IDS: ReadonlySet<ShipChannel> = new Set([
  "canva",
  "gmail",
  "drive",
  "slack",
  "x",
  "yt",
  "ig",
  "zip",
]);

export function listPlugins(links: readonly ConnectionView[] = []): PluginInfo[] {
  const byChannel = new Map(links.map((link) => [link.channel, link]));
  return PLUGINS.filter((plugin) => WORKING_PLUGIN_IDS.has(plugin.id)).map((plugin) => {
    if (plugin.local || !isOauthChannel(plugin.id)) {
      return { ...plugin, connected: plugin.local, configured: true, missing: [] as string[] };
    }
    const link = byChannel.get(plugin.id);
    return {
      ...plugin,
      connected: !!link?.connected,
      configured: !!link?.configured,
      missing: link?.missing ?? [],
      accountLabel: link?.accountLabel,
    };
  });
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
      ? "(pasted headline)"
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
    gmail: "Gmail",
    drive: "Google Drive",
    slack: "Slack",
  };
  const connectUrls: Partial<Record<ShipChannel, string>> = {
    ig: "https://www.instagram.com/accounts/login/",
    yt: "https://studio.youtube.com/",
    canva: canvaCreateUrl(run),
    telegram: "https://telegram.org/",
    x: "https://x.com/i/flow/login",
    tiktok: "https://www.tiktok.com/login",
    gmail: "https://mail.google.com/",
    drive: "https://drive.google.com/",
    slack: "https://app.slack.com/",
  };
  return {
    ok: false,
    channel,
    status: "connect_required",
    connectUrl: connectUrls[channel],
    nextStep: `Connect ${names[channel] || channel} on the Connect page first. No story required to link the account.`,
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
 * - zip: local pack download
 * - oauth channels: publish with the linked account, or connect_required when none is linked
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

  if (!isOauthChannel(channel)) {
    throw new Error(`unknown_channel: ${channel}`);
  }

  const account = await getFreshAccount(channel);
  if (!account) {
    /* Honest gate: never toast Published without a real OAuth-linked account */
    if (channel === "canva") {
      return connectStub(channel, run, shareText, {
        connectUrl: `/studio.html?view=connect`,
        nextStep: "Connect Canva with OAuth to publish. Until then, use ZIP or open canva.com yourself.",
        warning: warning || "Canva is not connected — no publish happened.",
      });
    }
    return connectStub(channel, run, shareText, {
      connectUrl: `/studio.html?view=connect`,
    });
  }
  /* Gmail / Drive / Slack: Connect OAuth + Open is enough this pass — never fake a send. */
  if (channel === "gmail" || channel === "drive" || channel === "slack") {
    const openUrl =
      channel === "gmail"
        ? "https://mail.google.com/"
        : channel === "drive"
          ? "https://drive.google.com/"
          : "https://app.slack.com/";
    return {
      ok: true,
      channel,
      status: "ready",
      connectUrl: openUrl,
      nextStep: `Connected as ${account.accountLabel}. Open the app to work — auto-send is not wired yet.`,
      pack: packPreview(run, shareText),
      warning,
    };
  }
  const published = await publishConnected(account, run, shareText);
  return {
    ...published,
    warning,
    pack: packPreview(run, shareText),
  };
}
