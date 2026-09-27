/**
 * OAuth connect for the desk. Tokens stay in .secrets/ — never returned to the browser.
 * Connecting does not require a story run.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../../..");
const SECRETS = join(ROOT, ".secrets");
const ACCOUNTS_PATH = join(SECRETS, "oauth-accounts.json");
const PENDING_PATH = join(SECRETS, "oauth-pending.json");
const STATE_TTL_MS = 10 * 60 * 1000;

export const OAUTH_CHANNELS = ["ig", "yt", "canva", "telegram", "x", "tiktok"] as const;
export type OauthChannel = (typeof OAUTH_CHANNELS)[number];

export function isOauthChannel(value: string): value is OauthChannel {
  return (OAUTH_CHANNELS as readonly string[]).includes(value);
}

export interface ConnectionView {
  channel: OauthChannel;
  configured: boolean;
  missing: string[];
  connected: boolean;
  accountLabel?: string;
  redirectUri: string;
}

interface StoredAccount {
  channel: OauthChannel;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId: string;
  accountLabel: string;
  scopes: string;
  connectedAt: string;
}

interface PendingAuth {
  state: string;
  channel: OauthChannel;
  verifier?: string;
  createdAt: number;
}

interface AccountFile {
  accounts: StoredAccount[];
}

interface PendingFile {
  items: PendingAuth[];
}

export interface StartConnectResult {
  authorizeUrl: string;
  redirectUri: string;
}

export type FinishConnectResult =
  | { ok: true; channel: OauthChannel; accountLabel: string }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function envValue(name: string): string {
  return (process.env[name] || "").trim();
}

export function publicBase(): string {
  const fromEnv = envValue("CUTLINE_PUBLIC_URL").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const port = envValue("PORT") || "8787";
  return `http://127.0.0.1:${port}`;
}

export function redirectUri(channel: OauthChannel): string {
  return `${publicBase()}/api/oauth/callback/${channel}`;
}

export function missingEnv(channel: OauthChannel): string[] {
  const need: Record<OauthChannel, string[]> = {
    ig: ["IG_APP_ID", "IG_APP_SECRET"],
    yt: ["YT_CLIENT_ID", "YT_CLIENT_SECRET"],
    canva: ["CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET"],
    telegram: ["TELEGRAM_BOT_TOKEN"],
    x: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  };
  return need[channel].filter((name) => !envValue(name));
}

function b64url(size: number): string {
  return randomBytes(size).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function readJson(path: string): Promise<unknown> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (err) {
    const code = isRecord(err) ? err.code : undefined;
    if (code === "ENOENT") return null;
    throw err;
  }
}

async function writeJson(path: string, body: unknown): Promise<void> {
  await mkdir(SECRETS, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(body), { encoding: "utf8", mode: 0o600 });
  await rename(tmp, path);
}

function parseAccounts(raw: unknown): StoredAccount[] {
  if (!isRecord(raw) || !Array.isArray(raw.accounts)) return [];
  const out: StoredAccount[] = [];
  for (const item of raw.accounts) {
    if (!isRecord(item)) continue;
    const channel = str(item.channel);
    const accessToken = str(item.accessToken);
    const accountId = str(item.accountId);
    const accountLabel = str(item.accountLabel);
    const connectedAt = str(item.connectedAt);
    if (!channel || !isOauthChannel(channel) || !accessToken || !accountId || !accountLabel || !connectedAt) {
      continue;
    }
    const expiresAt = num(item.expiresAt);
    out.push({
      channel,
      accessToken,
      refreshToken: str(item.refreshToken),
      expiresAt,
      accountId,
      accountLabel,
      scopes: str(item.scopes) || "",
      connectedAt,
    });
  }
  return out;
}

async function loadAccounts(): Promise<StoredAccount[]> {
  return parseAccounts(await readJson(ACCOUNTS_PATH));
}

async function saveAccounts(accounts: StoredAccount[]): Promise<void> {
  const body: AccountFile = { accounts };
  await writeJson(ACCOUNTS_PATH, body);
}

async function upsertAccount(account: StoredAccount): Promise<void> {
  const accounts = await loadAccounts();
  const next = accounts.filter((item) => item.channel !== account.channel);
  next.push(account);
  await saveAccounts(next);
}

async function loadPending(): Promise<PendingAuth[]> {
  const raw = await readJson(PENDING_PATH);
  if (!isRecord(raw) || !Array.isArray(raw.items)) return [];
  const now = Date.now();
  const items: PendingAuth[] = [];
  for (const item of raw.items) {
    if (!isRecord(item)) continue;
    const state = str(item.state);
    const channel = str(item.channel);
    const createdAt = num(item.createdAt);
    if (!state || !channel || !isOauthChannel(channel) || createdAt === undefined) continue;
    if (now - createdAt > STATE_TTL_MS) continue;
    items.push({
      state,
      channel,
      verifier: str(item.verifier),
      createdAt,
    });
  }
  return items;
}

async function savePending(items: PendingAuth[]): Promise<void> {
  const body: PendingFile = { items };
  await writeJson(PENDING_PATH, body);
}

export async function connectionViews(): Promise<ConnectionView[]> {
  const accounts = await loadAccounts();
  return OAUTH_CHANNELS.map((channel) => {
    const account = accounts.find((item) => item.channel === channel);
    const missing = missingEnv(channel);
    return {
      channel,
      configured: missing.length === 0,
      missing,
      connected: !!account,
      accountLabel: account?.accountLabel,
      redirectUri: redirectUri(channel),
    };
  });
}

export async function disconnectChannel(channel: OauthChannel): Promise<void> {
  const accounts = await loadAccounts();
  await saveAccounts(accounts.filter((item) => item.channel !== channel));
}

export async function getFreshAccount(channel: OauthChannel): Promise<StoredAccount | null> {
  const accounts = await loadAccounts();
  const current = accounts.find((item) => item.channel === channel);
  if (!current) return null;
  const expiring = current.expiresAt !== undefined && current.expiresAt < Date.now() + 60_000;
  if (!expiring || !current.refreshToken) return current;
  const refreshed = await refreshAccount(current);
  if (!refreshed) return current;
  await upsertAccount(refreshed);
  return refreshed;
}

function authorizeUrl(channel: OauthChannel, state: string, verifier: string | undefined): string {
  const back = redirectUri(channel);
  if (channel === "ig") {
    const q = new URLSearchParams({
      client_id: envValue("IG_APP_ID"),
      redirect_uri: back,
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_content_publish",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${q}`;
  }
  if (channel === "yt") {
    const q = new URLSearchParams({
      client_id: envValue("YT_CLIENT_ID"),
      redirect_uri: back,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: pkceChallenge(verifier || ""),
      code_challenge_method: "S256",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  if (channel === "canva") {
    const q = new URLSearchParams({
      client_id: envValue("CANVA_CLIENT_ID"),
      redirect_uri: back,
      response_type: "code",
      scope: "design:content:write design:meta:read profile:read",
      state,
      code_challenge: pkceChallenge(verifier || ""),
      code_challenge_method: "S256",
    });
    return `https://www.canva.com/api/oauth/authorize?${q}`;
  }
  if (channel === "x") {
    const q = new URLSearchParams({
      client_id: envValue("X_CLIENT_ID"),
      redirect_uri: back,
      response_type: "code",
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: pkceChallenge(verifier || ""),
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${q}`;
  }
  if (channel === "tiktok") {
    const q = new URLSearchParams({
      client_key: envValue("TIKTOK_CLIENT_KEY"),
      redirect_uri: back,
      response_type: "code",
      scope: "user.info.basic,video.publish",
      state,
      code_challenge: pkceChallenge(verifier || ""),
      code_challenge_method: "S256",
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  }
  const token = envValue("TELEGRAM_BOT_TOKEN");
  const botId = token.split(":")[0] || "";
  const origin = new URL(publicBase()).origin;
  const q = new URLSearchParams({
    bot_id: botId,
    origin,
    embed: "0",
    request_access: "write",
    return_to: back,
  });
  return `https://oauth.telegram.org/auth?${q}`;
}

export async function startConnect(channel: OauthChannel): Promise<StartConnectResult> {
  const missing = missingEnv(channel);
  if (missing.length) {
    const err = new Error(`oauth_not_configured:${missing.join(",")}`);
    throw err;
  }
  const state = b64url(24);
  const verifier = channel === "telegram" || channel === "ig" ? undefined : b64url(32);
  const pending = await loadPending();
  pending.push({ state, channel, verifier, createdAt: Date.now() });
  await savePending(pending);
  return { authorizeUrl: authorizeUrl(channel, state, verifier), redirectUri: redirectUri(channel) };
}

async function takePending(state: string, channel: OauthChannel): Promise<PendingAuth | null> {
  const pending = await loadPending();
  const found = pending.find((item) => item.state === state && item.channel === channel) || null;
  await savePending(pending.filter((item) => item.state !== state));
  return found;
}

async function postForm(url: string, body: URLSearchParams, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    throw new Error(`token_http_${res.status}`);
  }
  return parsed;
}

async function getJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`profile_http_${res.status}`);
  return (await res.json()) as unknown;
}

function expiresAtFrom(seconds: unknown): number | undefined {
  const value = num(seconds) ?? (str(seconds) ? Number(str(seconds)) : undefined);
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Date.now() + value * 1000;
}

async function exchangeCode(
  channel: OauthChannel,
  code: string,
  verifier: string | undefined
): Promise<StoredAccount> {
  const back = redirectUri(channel);
  if (channel === "ig") {
    const parsed = await postForm(
      "https://api.instagram.com/oauth/access_token",
      new URLSearchParams({
        client_id: envValue("IG_APP_ID"),
        client_secret: envValue("IG_APP_SECRET"),
        grant_type: "authorization_code",
        redirect_uri: back,
        code: code.replace(/#_$/, ""),
      })
    );
    if (!isRecord(parsed) || !str(parsed.access_token)) throw new Error("token_missing");
    let accessToken = str(parsed.access_token) || "";
    let expiresAt: number | undefined;
    try {
      const longLived = await fetch(
        `https://graph.instagram.com/access_token?${new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: envValue("IG_APP_SECRET"),
          access_token: accessToken,
        })}`,
        { signal: AbortSignal.timeout(20_000) }
      );
      if (longLived.ok) {
        const body = (await longLived.json()) as unknown;
        if (isRecord(body) && str(body.access_token)) {
          accessToken = str(body.access_token) || accessToken;
          expiresAt = expiresAtFrom(body.expires_in);
        }
      }
    } catch {
      /* short-lived token still connects */
    }
    const userId = str(parsed.user_id) || String(num(parsed.user_id) ?? "");
    let label = "Instagram";
    let accountId = userId || "ig";
    try {
      const me = await getJson("https://graph.instagram.com/v21.0/me?fields=user_id,username", accessToken);
      if (isRecord(me)) {
        label = str(me.username) ? `@${str(me.username)}` : label;
        accountId = str(me.user_id) || str(me.id) || accountId;
      }
    } catch {
      /* label stays generic */
    }
    return {
      channel,
      accessToken,
      expiresAt,
      accountId,
      accountLabel: label,
      scopes: "instagram_business_basic,instagram_business_content_publish",
      connectedAt: new Date().toISOString(),
    };
  }

  if (channel === "yt") {
    const parsed = await postForm(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: envValue("YT_CLIENT_ID"),
        client_secret: envValue("YT_CLIENT_SECRET"),
        redirect_uri: back,
        grant_type: "authorization_code",
        code_verifier: verifier || "",
      })
    );
    if (!isRecord(parsed) || !str(parsed.access_token)) throw new Error("token_missing");
    const accessToken = str(parsed.access_token) || "";
    let label = "YouTube";
    let accountId = "yt";
    try {
      const me = await getJson(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        accessToken
      );
      if (isRecord(me) && Array.isArray(me.items) && isRecord(me.items[0])) {
        const item = me.items[0];
        accountId = str(item.id) || accountId;
        const snippet = isRecord(item.snippet) ? item.snippet : null;
        label = (snippet && str(snippet.title)) || label;
      }
    } catch {
      /* label stays generic */
    }
    return {
      channel,
      accessToken,
      refreshToken: str(parsed.refresh_token),
      expiresAt: expiresAtFrom(parsed.expires_in),
      accountId,
      accountLabel: label,
      scopes: str(parsed.scope) || "",
      connectedAt: new Date().toISOString(),
    };
  }

  if (channel === "canva") {
    const basic = Buffer.from(`${envValue("CANVA_CLIENT_ID")}:${envValue("CANVA_CLIENT_SECRET")}`).toString("base64");
    const parsed = await postForm(
      "https://api.canva.com/rest/v1/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: back,
        code_verifier: verifier || "",
      }),
      { Authorization: `Basic ${basic}` }
    );
    if (!isRecord(parsed) || !str(parsed.access_token)) throw new Error("token_missing");
    const accessToken = str(parsed.access_token) || "";
    let label = "Canva";
    let accountId = "canva";
    try {
      const me = await getJson("https://api.canva.com/rest/v1/users/me", accessToken);
      if (isRecord(me)) {
        const profile = isRecord(me.profile) ? me.profile : me;
        label = str(profile.display_name) || str(profile.displayName) || label;
        accountId = str(profile.id) || str(me.team_user_id) || accountId;
      }
    } catch {
      /* label stays generic */
    }
    return {
      channel,
      accessToken,
      refreshToken: str(parsed.refresh_token),
      expiresAt: expiresAtFrom(parsed.expires_in),
      accountId,
      accountLabel: label,
      scopes: "design:content:write design:meta:read profile:read",
      connectedAt: new Date().toISOString(),
    };
  }

  if (channel === "x") {
    const basic = Buffer.from(`${envValue("X_CLIENT_ID")}:${envValue("X_CLIENT_SECRET")}`).toString("base64");
    const parsed = await postForm(
      "https://api.twitter.com/2/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: back,
        code_verifier: verifier || "",
      }),
      { Authorization: `Basic ${basic}` }
    );
    if (!isRecord(parsed) || !str(parsed.access_token)) throw new Error("token_missing");
    const accessToken = str(parsed.access_token) || "";
    let label = "X";
    let accountId = "x";
    try {
      const me = await getJson("https://api.twitter.com/2/users/me", accessToken);
      if (isRecord(me) && isRecord(me.data)) {
        label = str(me.data.username) ? `@${str(me.data.username)}` : label;
        accountId = str(me.data.id) || accountId;
      }
    } catch {
      /* label stays generic */
    }
    return {
      channel,
      accessToken,
      refreshToken: str(parsed.refresh_token),
      expiresAt: expiresAtFrom(parsed.expires_in),
      accountId,
      accountLabel: label,
      scopes: str(parsed.scope) || "",
      connectedAt: new Date().toISOString(),
    };
  }

  if (channel === "tiktok") {
    const parsed = await postForm(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: envValue("TIKTOK_CLIENT_KEY"),
        client_secret: envValue("TIKTOK_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
        redirect_uri: back,
        code_verifier: verifier || "",
      })
    );
    const bag = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : parsed;
    if (!isRecord(bag) || !str(bag.access_token)) throw new Error("token_missing");
    const accessToken = str(bag.access_token) || "";
    let label = "TikTok";
    let accountId = str(bag.open_id) || "tiktok";
    try {
      const me = await getJson(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
        accessToken
      );
      if (isRecord(me) && isRecord(me.data) && isRecord(me.data.user)) {
        const user = me.data.user;
        label = str(user.display_name) || label;
        accountId = str(user.open_id) || accountId;
      }
    } catch {
      /* label stays generic */
    }
    return {
      channel,
      accessToken,
      refreshToken: str(bag.refresh_token),
      expiresAt: expiresAtFrom(bag.expires_in),
      accountId,
      accountLabel: label,
      scopes: str(bag.scope) || "user.info.basic,video.publish",
      connectedAt: new Date().toISOString(),
    };
  }

  throw new Error("telegram_uses_login");
}

function telegramDataCheck(params: URLSearchParams): { ok: true; id: string; label: string } | { ok: false } {
  const hash = params.get("hash") || "";
  const id = params.get("id") || "";
  const authDate = Number(params.get("auth_date") || "0");
  if (!hash || !id || !Number.isFinite(authDate)) return { ok: false };
  if (Date.now() / 1000 - authDate > 86_400) return { ok: false };
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const secret = createHash("sha256").update(envValue("TELEGRAM_BOT_TOKEN")).digest();
  const digest = createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  if (!safeEqual(digest, hash)) return { ok: false };
  const username = params.get("username");
  const first = params.get("first_name") || "";
  const label = username ? `@${username}` : first || "Telegram";
  return { ok: true, id, label };
}

export async function finishConnect(channel: OauthChannel, params: URLSearchParams): Promise<FinishConnectResult> {
  if (params.get("error")) return { ok: false, reason: "denied" };
  if (channel === "telegram") {
    if (missingEnv("telegram").length) return { ok: false, reason: "not_configured" };
    const checked = telegramDataCheck(params);
    if (!checked.ok) return { ok: false, reason: "telegram_hash" };
    await upsertAccount({
      channel: "telegram",
      accessToken: "telegram-login",
      accountId: checked.id,
      accountLabel: checked.label,
      scopes: "login",
      connectedAt: new Date().toISOString(),
    });
    return { ok: true, channel, accountLabel: checked.label };
  }

  const code = params.get("code") || "";
  const state = params.get("state") || "";
  if (!code || !state) return { ok: false, reason: "missing_code" };
  const pending = await takePending(state, channel);
  if (!pending) return { ok: false, reason: "state" };
  try {
    const account = await exchangeCode(channel, code, pending.verifier);
    await upsertAccount(account);
    return { ok: true, channel, accountLabel: account.accountLabel };
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange";
    if (message.startsWith("token_http_") || message === "token_missing" || message.startsWith("profile_http_")) {
      return { ok: false, reason: message.startsWith("profile_") ? "profile" : "token_exchange" };
    }
    return { ok: false, reason: "token_exchange" };
  }
}

async function refreshAccount(account: StoredAccount): Promise<StoredAccount | null> {
  try {
    if (account.channel === "ig") {
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
          grant_type: "ig_refresh_token",
          access_token: account.accessToken,
        })}`,
        { signal: AbortSignal.timeout(20_000) }
      );
      if (!res.ok) return null;
      const body = (await res.json()) as unknown;
      if (!isRecord(body) || !str(body.access_token)) return null;
      return { ...account, accessToken: str(body.access_token) || account.accessToken, expiresAt: expiresAtFrom(body.expires_in) };
    }
    if (account.channel === "yt" && account.refreshToken) {
      const parsed = await postForm(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
          client_id: envValue("YT_CLIENT_ID"),
          client_secret: envValue("YT_CLIENT_SECRET"),
        })
      );
      if (!isRecord(parsed) || !str(parsed.access_token)) return null;
      return { ...account, accessToken: str(parsed.access_token) || account.accessToken, expiresAt: expiresAtFrom(parsed.expires_in) };
    }
    if (account.channel === "canva" && account.refreshToken) {
      const basic = Buffer.from(`${envValue("CANVA_CLIENT_ID")}:${envValue("CANVA_CLIENT_SECRET")}`).toString("base64");
      const parsed = await postForm(
        "https://api.canva.com/rest/v1/oauth/token",
        new URLSearchParams({ grant_type: "refresh_token", refresh_token: account.refreshToken }),
        { Authorization: `Basic ${basic}` }
      );
      if (!isRecord(parsed) || !str(parsed.access_token)) return null;
      return {
        ...account,
        accessToken: str(parsed.access_token) || account.accessToken,
        refreshToken: str(parsed.refresh_token) || account.refreshToken,
        expiresAt: expiresAtFrom(parsed.expires_in),
      };
    }
    if (account.channel === "x" && account.refreshToken) {
      const basic = Buffer.from(`${envValue("X_CLIENT_ID")}:${envValue("X_CLIENT_SECRET")}`).toString("base64");
      const parsed = await postForm(
        "https://api.twitter.com/2/oauth2/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
          client_id: envValue("X_CLIENT_ID"),
        }),
        { Authorization: `Basic ${basic}` }
      );
      if (!isRecord(parsed) || !str(parsed.access_token)) return null;
      return {
        ...account,
        accessToken: str(parsed.access_token) || account.accessToken,
        refreshToken: str(parsed.refresh_token) || account.refreshToken,
        expiresAt: expiresAtFrom(parsed.expires_in),
      };
    }
    if (account.channel === "tiktok" && account.refreshToken) {
      const parsed = await postForm(
        "https://open.tiktokapis.com/v2/oauth/token/",
        new URLSearchParams({
          client_key: envValue("TIKTOK_CLIENT_KEY"),
          client_secret: envValue("TIKTOK_CLIENT_SECRET"),
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
        })
      );
      const bag = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : parsed;
      if (!isRecord(bag) || !str(bag.access_token)) return null;
      return {
        ...account,
        accessToken: str(bag.access_token) || account.accessToken,
        refreshToken: str(bag.refresh_token) || account.refreshToken,
        expiresAt: expiresAtFrom(bag.expires_in),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export type { StoredAccount };
