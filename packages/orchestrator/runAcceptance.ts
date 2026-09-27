/**
 * Cutline Methods acceptance runner — full freeze (21) from TEST.md
 * Usage:
 *   npx tsx packages/orchestrator/runAcceptance.ts          # all 21
 *   npx tsx packages/orchestrator/runAcceptance.ts --gate   # blessed n=6
 *   npx tsx packages/orchestrator/runAcceptance.ts --ids S1,P1
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { scoutBeat } from "../scout/src/scout";
import { resolvePhoto } from "../photo/src/photo";
import { runDeskPipeline, runWedge } from "./src/runPipeline";
import { assertApproved } from "../ship/src/ship";
import type { BeatConfig, Pack, PhotoAsset, Rewrite, WireBrief } from "../core/src/types";

const ROOT = join(import.meta.dirname, "../..");

type Result = { id: string; pass: boolean; detail: string };

const GATE = new Set(["S1", "S8", "P1", "P2", "D1", "W1"]);

function ok(id: string, pass: boolean, detail: string): Result {
  return { id, pass, detail };
}

const enc = new TextEncoder();
function md5Stub(buf: ArrayBuffer): string {
  // deterministic stand-in — uniqueness only
  const b = new Uint8Array(buf);
  let h = 0;
  for (let i = 0; i < b.length; i++) h = (h * 31 + b[i]) >>> 0;
  return `md5_${h.toString(16)}`;
}

function beat(partial: Partial<BeatConfig> & { id: string }): BeatConfig {
  return {
    label: partial.label || partial.id,
    keywords: ["civic"],
    sources: ["https://example.test/section"],
    ...partial,
  };
}

function packStub(): Pack {
  return { igCaption: "ig", ytTitle: "yt", ytDescription: "desc" };
}

function briefFor(url: string, title = "Civic alert"): WireBrief {
  return {
    headline: title,
    angle: "service disruption",
    cityLead: "City:",
    visualPrompt: "flooded platform",
    facts: ["f1"],
    sourceUrl: url,
  };
}

function rewriteFor(url: string): Rewrite {
  return {
    headline: "Civic alert",
    body: "Body",
    houseStyle: "cutline",
    sourceUrl: url,
  };
}

async function happyDeskDeps(opts: {
  fetchPageOk?: (url: string) => Promise<boolean>;
  fetchSection?: (
    url: string
  ) => Promise<{ title: string; link: string; outlet: string; summary?: string }[]>;
  photo?: Parameters<typeof resolvePhoto>[1];
  sub?: (b: WireBrief, t: string) => Promise<Rewrite>;
}) {
  const fetchSection =
    opts.fetchSection ??
    (async () => [
      {
        title: "Overnight rain floods the metro station",
        link: "https://news.example/metro-rain",
        outlet: "Example",
        summary: "civic flood",
      },
    ]);
  const fetchPageOk =
    opts.fetchPageOk ?? (async (url: string) => url.startsWith("https://"));
  const photo =
    opts.photo ??
    ({
      fetchArticleImage: async () => ({
        url: "https://cdn.example/og.jpg",
        credit: "Example",
      }),
      pexelsSearch: async () => null,
      geminiImage: async () => null,
      md5: md5Stub,
      download: async () => enc.encode("og-bytes").buffer,
    } satisfies Parameters<typeof resolvePhoto>[1]);

  return {
    scout: {
      fetchSection,
      fetchPageOk,
    },
    photo,
    wire: async (hit: { title: string; sourceUrl: string }) => briefFor(hit.sourceUrl, hit.title),
    sub:
      opts.sub ??
      (async (b: WireBrief) => rewriteFor(b.sourceUrl)),
    desk: async () => packStub(),
    fetchPageText: async () => "page text with facts",
    now: () => "2026-09-27T00:00:00.000Z",
    id: () => "run_test",
  };
}

/** spend_gemini = sum of photo-agent log spend when via was gemini_gen (orchestrator logs 5). */
function spendGemini(run: { log: { agent: string; spendCents?: number; action: string }[]; photo?: PhotoAsset }) {
  if (run.photo?.via === "gemini_gen") {
    return run.log.filter((e) => e.agent === "photo").reduce((s, e) => s + (e.spendCents ?? 0), 0);
  }
  return run.log
    .filter((e) => e.agent === "photo" && e.action === "gemini_gen")
    .reduce((s, e) => s + (e.spendCents ?? 0), 0);
}

function walkFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git" || name === "_hands_review") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(ts|tsx|js|mjs|md)$/.test(name)) out.push(p);
  }
  return out;
}

// ——— Scout ———

async function S1(): Promise<Result> {
  const b = beat({ id: "s1" });
  const deps = await happyDeskDeps({ fetchPageOk: async () => false });
  const run = await runDeskPipeline(b, deps);
  const pass = run.hits.length === 0 && run.status === "failed";
  return ok("S1", pass, `hits_n=${run.hits.length} status=${run.status}`);
}

async function S2(): Promise<Result> {
  const url = "https://news.example/live-1";
  const hits = await scoutBeat(
    beat({ id: "s2", keywords: ["civic"] }),
    {
      fetchSection: async () => [
        { title: "Civic update on the wire", link: url, outlet: "Ex", summary: "civic" },
      ],
      fetchPageOk: async (u) => u === url,
    },
    5
  );
  const pass = hits.length >= 1 && hits.some((h) => h.sourceUrl === url);
  return ok("S2", pass, `hits_n=${hits.length} kept=${hits[0]?.sourceUrl ?? "none"}`);
}

async function S3(): Promise<Result> {
  const b = beat({ id: "s3", keywords: ["zzzz-no-match"] });
  const deps = await happyDeskDeps({
    fetchSection: async () => [
      { title: "Overnight rain", link: "https://news.example/x", outlet: "Ex", summary: "weather" },
    ],
  });
  const run = await runDeskPipeline(b, deps);
  const pass = run.hits.length === 0 && run.status === "failed";
  return ok("S3", pass, `hits_n=${run.hits.length} status=${run.status}`);
}

async function S4(): Promise<Result> {
  const called: string[] = [];
  const hits = await scoutBeat(
    beat({
      id: "s4",
      keywords: ["civic"],
      sources: ["https://example.test/a", "https://example.test/b"],
    }),
    {
      fetchSection: async (url) => {
        called.push(url);
        if (url.endsWith("/a")) return [];
        return [
          {
            title: "Second section civic brief",
            link: "https://news.example/s2",
            outlet: "Ex",
            summary: "civic",
          },
        ];
      },
      fetchPageOk: async () => true,
    },
    5
  );
  const pass = called.length === 2 && hits.length === 1 && hits[0].via === "fetch";
  return ok("S4", pass, `sources=${called.length} hits_n=${hits.length} via=${hits[0]?.via}`);
}

async function S5(): Promise<Result> {
  const hits = await scoutBeat(
    beat({ id: "s5", keywords: [], sources: ["https://example.test/dead"] }),
    {
      fetchSection: async () => [
        {
          title: "Dead page should drop",
          link: "https://news.example/dead",
          outlet: "Ex",
          summary: "gone",
        },
      ],
      fetchPageOk: async () => false,
    },
    5
  );
  const pass = hits.length === 0;
  return ok("S5", pass, `hits_n=${hits.length}`);
}

async function S6(): Promise<Result> {
  const url = "https://news.example/same";
  const hits = await scoutBeat(
    beat({ id: "s6", keywords: ["civic"], sources: ["a", "b"] }),
    {
      fetchSection: async () => [
        { title: "Civic A on the desk", link: url, outlet: "A", summary: "civic" },
        { title: "Civic B on the desk", link: url, outlet: "B", summary: "civic" },
      ],
      fetchPageOk: async () => true,
    },
    5
  );
  const pass = hits.length === 1 && hits[0].sourceUrl === url;
  return ok("S6", pass, `hits_n=${hits.length}`);
}

async function S7(): Promise<Result> {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    title: `Civic story on the desk ${i}`,
    link: `https://news.example/s${i}`,
    outlet: "Ex",
    summary: "civic",
  }));
  const hits = await scoutBeat(
    beat({ id: "s7", keywords: ["civic"] }),
    {
      fetchSection: async () => entries,
      fetchPageOk: async () => true,
    },
    3
  );
  const pass = hits.length === 3;
  return ok("S7", pass, `hits_n=${hits.length} limit=3`);
}

function stripComments(src: string): string {
  // remove block comments then line comments — enough for call-site scan
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

async function S8(): Promise<Result> {
  const files = walkFiles(ROOT);
  const callOffenders: string[] = [];
  for (const f of files) {
    if (!/\.(ts|tsx|js|mjs)$/.test(f)) continue;
    // exclude this runner (mentions the forbidden symbol in strings/expects)
    if (f.endsWith("runAcceptance.ts")) continue;
    const code = stripComments(readFileSync(f, "utf8"));
    if (/\bgpt_fallback_headlines\s*\(/.test(code) || /\bimport\s+[^;]*gpt_fallback_headlines/.test(code)) {
      callOffenders.push(relative(ROOT, f));
    }
  }
  const pass = callOffenders.length === 0;
  return ok(
    "S8",
    pass,
    pass ? "no gpt_fallback_headlines() call in executable code" : `calls in: ${callOffenders.join(", ")}`
  );
}

// ——— Photo ———

async function P1(): Promise<Result> {
  const deps = await happyDeskDeps({});
  const run = await runDeskPipeline(beat({ id: "p1" }), deps);
  const via = run.photo?.via;
  const banned = run.photo?.bannedForPrint;
  const sg = spendGemini(run);
  const pass = via === "article_og" && banned === false && sg === 0;
  return ok("P1", pass, `via=${via} bannedForPrint=${banned} spend_gemini=${sg}`);
}

async function P2(): Promise<Result> {
  const photo = await resolvePhoto(
    { sourceUrl: "https://news.example/x", photoQuery: "city" },
    {
      fetchArticleImage: async () => null,
      pexelsSearch: async () => ({ url: "https://images.pexels.com/x.jpg" }),
      md5: md5Stub,
      download: async () => enc.encode("pexels").buffer,
    }
  );
  const pass = photo?.via === "pexels" && photo.bannedForPrint === true;
  return ok("P2", pass, `via=${photo?.via} bannedForPrint=${photo?.bannedForPrint}`);
}

async function P3(): Promise<Result> {
  const photo = await resolvePhoto(
    {
      sourceUrl: "https://news.example/x",
      photoQuery: "city",
      uploadPath: "/tmp/upload.jpg",
    },
    {
      fetchArticleImage: async () => ({ url: "https://cdn.example/og.jpg", credit: "X" }),
      pexelsSearch: async () => ({ url: "https://images.pexels.com/x.jpg" }),
      md5: md5Stub,
      download: async () => enc.encode("x").buffer,
    }
  );
  const pass = photo?.via === "upload";
  return ok("P3", pass, `via=${photo?.via}`);
}

async function P4(): Promise<Result> {
  // Expect photo=null when allowGeminiGen=false and no article/pexels.
  // Do not invent null-photo product copy.
  const photo = await resolvePhoto(
    {
      sourceUrl: "https://news.example/x",
      photoQuery: "city",
      allowGeminiGen: false,
    },
    {
      fetchArticleImage: async () => null,
      pexelsSearch: async () => null,
      geminiImage: async () => ({ url: "https://gen.example/x.png" }),
      md5: md5Stub,
      download: async () => enc.encode("x").buffer,
    }
  );
  const pass = photo === null;
  return ok("P4", pass, `photo=${photo === null ? "null" : photo.via}`);
}

async function P5(): Promise<Result> {
  const deps = await happyDeskDeps({
    photo: {
      fetchArticleImage: async () => null,
      pexelsSearch: async () => null,
      geminiImage: async () => ({ url: "https://gen.example/g.png" }),
      md5: md5Stub,
      download: async () => enc.encode("g").buffer,
    },
  });
  const run = await runDeskPipeline(beat({ id: "p5" }), deps, { allowGeminiGen: true });
  const via = run.photo?.via;
  const banned = run.photo?.bannedForPrint;
  const sg = spendGemini(run);
  const pass = via === "gemini_gen" && banned === true && sg > 0;
  return ok("P5", pass, `via=${via} bannedForPrint=${banned} spend_gemini=${sg}`);
}

// ——— Desk ———

async function D1(): Promise<Result> {
  const deps = await happyDeskDeps({});
  const run = await runDeskPipeline(beat({ id: "d1" }), deps);
  const pass = run.status === "needs_input" && run.status !== "shipped";
  return ok("D1", pass, `status=${run.status}`);
}

async function D2(): Promise<Result> {
  const deps = await happyDeskDeps({});
  const run = await runDeskPipeline(beat({ id: "d2" }), deps, { autoApprove: true });
  const pass = run.status === "approved" && run.status !== "shipped";
  return ok("D2", pass, `status=${run.status}`);
}

async function D3(): Promise<Result> {
  const deps = await happyDeskDeps({
    sub: async () => rewriteFor("https://evil.example/wrong"),
  });
  const run = await runDeskPipeline(beat({ id: "d3" }), deps);
  const pass = run.status === "failed";
  return ok("D3", pass, `status=${run.status}`);
}

async function D4(): Promise<Result> {
  const deps = await happyDeskDeps({});
  const run = await runDeskPipeline(beat({ id: "d4" }), deps);
  let threw = false;
  try {
    await assertApproved(run);
  } catch {
    threw = true;
  }
  const pass = run.status === "needs_input" && threw;
  return ok("D4", pass, `status=${run.status} threw=${threw}`);
}

async function D5(): Promise<Result> {
  const deps = await happyDeskDeps({});
  const run = await runDeskPipeline(beat({ id: "d5" }), deps, { autoApprove: true });
  let threw = false;
  try {
    await assertApproved(run);
  } catch {
    threw = true;
  }
  const pass = run.status === "approved" && !threw;
  return ok("D5", pass, `status=${run.status} threw=${threw}`);
}

// ——— Wedge ———

async function W1(): Promise<Result> {
  const run = await runWedge("Overnight rain floods streets", {
    wireFromHeadline: async (h) => ({
      headline: h,
      angle: "civic",
      cityLead: "City:",
      visualPrompt: "rain",
      facts: [],
      sourceUrl: "manual://wedge",
    }),
    stillGemini: async () => ({
      pathOrUrl: "https://gen.example/w.png",
      credit: "Generated",
      md5: "gen",
      via: "gemini_gen",
      bannedForPrint: true,
    }),
    desk: async () => packStub(),
    now: () => "2026-09-27T00:00:00.000Z",
    id: () => "wedge_1",
  });
  const su = run.brief?.sourceUrl ?? "";
  const publisherHost = /^https?:\/\//i.test(su) && !su.startsWith("manual://");
  const pass = su === "manual://wedge" && !publisherHost;
  return ok("W1", pass, `sourceUrl=${su}`);
}

async function W2(): Promise<Result> {
  const run = await runWedge("Markets close mixed", {
    wireFromHeadline: async (h) => ({
      headline: h,
      angle: "markets",
      cityLead: "City:",
      visualPrompt: "sensex",
      facts: [],
      sourceUrl: "manual://wedge",
    }),
    stillGemini: async () => ({
      pathOrUrl: "https://gen.example/w.png",
      credit: "Generated",
      md5: "gen",
      via: "gemini_gen",
      bannedForPrint: false, // wedge must force true
    }),
    desk: async () => packStub(),
    now: () => "2026-09-27T00:00:00.000Z",
    id: () => "wedge_2",
  });
  const pass = run.photo?.bannedForPrint === true;
  return ok("W2", pass, `bannedForPrint=${run.photo?.bannedForPrint}`);
}

async function W3(): Promise<Result> {
  let scoutTouched = false;
  // Patch: if runWedge imported scoutBeat it would be in module graph; also ensure deps never include scout.
  // Behavioral: runWedge with no scout deps; hits stay empty; beat === "wedge".
  const run = await runWedge("Cricket night", {
    wireFromHeadline: async (h) => ({
      headline: h,
      angle: "sports",
      cityLead: "City:",
      visualPrompt: "stadium",
      facts: [],
      sourceUrl: "manual://wedge",
    }),
    stillGemini: async () => ({
      pathOrUrl: "https://gen.example/w.png",
      credit: "Generated",
      md5: "gen",
      via: "gemini_gen",
      bannedForPrint: true,
    }),
    desk: async () => packStub(),
    now: () => "2026-09-27T00:00:00.000Z",
    id: () => "wedge_3",
  });
  // Static: runWedge source must not reference scoutBeat
  const pipeSrc = readFileSync(join(ROOT, "packages/orchestrator/src/runPipeline.ts"), "utf8");
  const wedgeFn = pipeSrc.slice(pipeSrc.indexOf("export async function runWedge"));
  const callsScout = /scoutBeat\s*\(/.test(wedgeFn);
  scoutTouched = callsScout;
  const pass = !scoutTouched && run.hits.length === 0 && run.beat === "wedge";
  return ok("W3", pass, `scoutInWedge=${callsScout} hits_n=${run.hits.length} beat=${run.beat}`);
}

const ALL: Record<string, () => Promise<Result>> = {
  S1, S2, S3, S4, S5, S6, S7, S8,
  P1, P2, P3, P4, P5,
  D1, D2, D3, D4, D5,
  W1, W2, W3,
};

async function main() {
  const args = process.argv.slice(2);
  const gateOnly = args.includes("--gate");
  const idsArg = args.find((a) => a.startsWith("--ids="))?.slice(6);
  let ids = Object.keys(ALL);
  if (gateOnly) ids = [...GATE];
  if (idsArg) ids = idsArg.split(",").map((s) => s.trim());

  const results: Result[] = [];
  for (const id of ids) {
    const fn = ALL[id];
    if (!fn) {
      results.push(ok(id, false, "unknown id"));
      continue;
    }
    try {
      results.push(await fn());
    } catch (e) {
      results.push(ok(id, false, `threw: ${(e as Error).message}`));
    }
  }

  const mode = gateOnly ? "GATE n=6" : `FULL freeze (${results.length})`;
  console.log(`# Cutline acceptance — ${mode}`);
  console.log(`# ${new Date().toISOString()} | root=${ROOT}`);
  console.log("");
  console.log("| ID | Result | Detail |");
  console.log("|----|--------|--------|");
  for (const r of results) {
    console.log(`| ${r.id} | ${r.pass ? "PASS" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`);
  }
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log("");
  console.log(`Summary: ${passed} PASS / ${failed} FAIL / ${results.length} total`);
  if (gateOnly) {
    console.log("Blessed gate IDs: S1 S8 P1 P2 D1 W1");
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
