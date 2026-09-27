/**
 * Publish a pack with an already-connected account. Never claims success
 * unless the channel API accepts the post.
 */
import type { StoryRun } from "../../core/src/types";
import type { StoredAccount } from "./oauth";
import type { ShipChannel, ShipResult } from "./ship";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function publicHttps(run: StoryRun): string | undefined {
  const raw = run.pack?.stillUrl || run.photo?.pathOrUrl || "";
  return /^https:\/\//i.test(raw) ? raw : undefined;
}

function caption(run: StoryRun, shareText: string): string {
  return (run.pack?.igCaption || shareText || run.rewrite?.headline || run.brief?.headline || "").trim();
}

function headline(run: StoryRun): string {
  return (run.pack?.ytTitle || run.rewrite?.headline || run.brief?.headline || "Cutline").trim();
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function failed(channel: ShipChannel, detail: string): ShipResult {
  return { ok: false, channel, status: "failed", nextStep: detail };
}

export async function publishConnected(
  account: StoredAccount,
  run: StoryRun,
  shareText: string
): Promise<ShipResult> {
  const channel = account.channel;
  try {
    if (channel === "x") return await publishX(account, run, shareText);
    if (channel === "telegram") return await publishTelegram(account, shareText, headline(run));
    if (channel === "canva") return await publishCanva(account, run);
    if (channel === "ig") return await publishIg(account, run, shareText);
    if (channel === "tiktok") return await publishTikTok(account, run, shareText);
    if (channel === "yt") return await publishYouTube(account, run);
    const _exhaustive: never = channel;
    return failed(_exhaustive, "Unknown channel");
  } catch (err) {
    const message = err instanceof Error ? err.message : "publish_failed";
    return failed(channel, message);
  }
}

async function publishX(account: StoredAccount, run: StoryRun, shareText: string): Promise<ShipResult> {
  const text = (shareText || headline(run)).slice(0, 280);
  if (!text) return failed("x", "Nothing to post.");
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(res);
  if (!res.ok) return failed("x", `X rejected the post (${res.status}).`);
  const id = isRecord(body) && isRecord(body.data) ? str(body.data.id) : undefined;
  return {
    ok: true,
    channel: "x",
    status: "published",
    nextStep: id ? `Posted on X · ${id}` : "Posted on X.",
    connectUrl: id ? `https://x.com/i/web/status/${id}` : undefined,
  };
}

async function publishTelegram(account: StoredAccount, shareText: string, title: string): Promise<ShipResult> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) return failed("telegram", "TELEGRAM_BOT_TOKEN is missing.");
  const text = [title, shareText].filter(Boolean).join("\n\n").slice(0, 4000);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: account.accountId, text }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(res);
  const ok = isRecord(body) && body.ok === true;
  if (!res.ok || !ok) {
    return failed(
      "telegram",
      "Telegram did not deliver. Open the bot and tap Start, then ship again."
    );
  }
  return { ok: true, channel: "telegram", status: "published", nextStep: `Sent to ${account.accountLabel}.` };
}

async function publishCanva(account: StoredAccount, run: StoryRun): Promise<ShipResult> {
  const title = headline(run).slice(0, 80);
  const res = await fetch("https://api.canva.com/rest/v1/designs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      design_type: { type: "custom", width: 1080, height: 1350 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(res);
  if (!res.ok || !isRecord(body)) return failed("canva", `Canva rejected the design (${res.status}).`);
  const design = isRecord(body.design) ? body.design : body;
  const urls = isRecord(design.urls) ? design.urls : null;
  const edit = urls ? str(urls.edit_url) : undefined;
  return {
    ok: true,
    channel: "canva",
    status: "published",
    nextStep: "Design created in your Canva account.",
    connectUrl: edit,
  };
}

async function publishIg(account: StoredAccount, run: StoryRun, shareText: string): Promise<ShipResult> {
  const image = publicHttps(run);
  if (!image) {
    return failed("ig", "Instagram is connected. This pack needs a public https still URL before it can publish.");
  }
  const text = caption(run, shareText).slice(0, 2200);
  const mediaRes = await fetch(`https://graph.instagram.com/v21.0/${account.accountId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ image_url: image, caption: text }),
    signal: AbortSignal.timeout(20_000),
  });
  const media = await readJson(mediaRes);
  const creationId = isRecord(media) ? str(media.id) : undefined;
  if (!mediaRes.ok || !creationId) return failed("ig", `Instagram rejected the media (${mediaRes.status}).`);
  const pubRes = await fetch(`https://graph.instagram.com/v21.0/${account.accountId}/media_publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ creation_id: creationId }),
    signal: AbortSignal.timeout(20_000),
  });
  const published = await readJson(pubRes);
  if (!pubRes.ok) return failed("ig", `Instagram did not publish (${pubRes.status}).`);
  const id = isRecord(published) ? str(published.id) : undefined;
  return {
    ok: true,
    channel: "ig",
    status: "published",
    nextStep: id ? `Published on Instagram · ${id}` : "Published on Instagram.",
  };
}

async function publishTikTok(account: StoredAccount, run: StoryRun, shareText: string): Promise<ShipResult> {
  const image = publicHttps(run);
  if (!image) {
    return failed("tiktok", "TikTok is connected. This pack needs a public https image before it can publish.");
  }
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: headline(run).slice(0, 90),
        description: caption(run, shareText).slice(0, 400),
        privacy_level: "SELF_ONLY",
        disable_comment: false,
        auto_add_music: true,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: [image],
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(res);
  const errBag = isRecord(body) && isRecord(body.error) ? body.error : null;
  const errCode = errBag ? str(errBag.code) : undefined;
  if (!res.ok || (errCode && errCode !== "ok")) {
    return failed("tiktok", `TikTok rejected the post (${res.status}).`);
  }
  return {
    ok: true,
    channel: "tiktok",
    status: "published",
    nextStep: "Posted to TikTok as private (SELF_ONLY) until the app is audited.",
  };
}

async function publishYouTube(account: StoredAccount, run: StoryRun): Promise<ShipResult> {
  const clip = run.pack?.clipUrl || "";
  if (!clip) {
    return failed(
      "yt",
      `YouTube is connected as ${account.accountLabel}. This pack has no video file to upload.`
    );
  }
  return failed(
    "yt",
    `YouTube is connected as ${account.accountLabel}. Video upload is linked; this desk does not push the file yet.`
  );
}
