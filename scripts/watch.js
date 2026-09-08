#!/usr/bin/env node
// FreeTierWatch daily watcher: fetch each service's source page, diff text
// against last snapshot, record quota-relevant changes, regenerate RSS.
// No dependencies. Node 18+ (global fetch).

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
const SNAPSHOTS = path.join(ROOT, "snapshots");
const SITE_DATA = path.join(ROOT, "docs", "data");
const MAX_DIFF_LINES = 10;
const FEED_ITEMS = 50;
const FETCH_TIMEOUT_MS = 30000;
const UA = "FreeTierWatch/1.0 (+https://github.com/guillemmontejo/freetierwatch)";

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJson = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

const htmlToLines = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;|&\w+;/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

const fetchPage = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

// Only lines containing digits can describe a quota change; the rest is copy noise.
// ponytail: whole-page text diff, per-service CSS-scoped extraction if noise bites.
const quotaDiff = (oldLines, newLines) => {
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const hasDigit = (line) => /\d/.test(line);
  return {
    added: newLines.filter((l) => !oldSet.has(l) && hasDigit(l)).slice(0, MAX_DIFF_LINES),
    removed: oldLines.filter((l) => !newSet.has(l) && hasDigit(l)).slice(0, MAX_DIFF_LINES),
  };
};

const xmlEscape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const buildFeed = (changes, siteUrl) => {
  const items = changes
    .slice(-FEED_ITEMS)
    .reverse()
    .map((c) => {
      const detail = [
        c.added.length ? `Added/changed: ${c.added.join(" | ")}` : "",
        c.removed.length ? `Removed: ${c.removed.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join(" — ");
      return [
        "    <item>",
        `      <title>${xmlEscape(`${c.service_name}: pricing/limits page changed`)}</title>`,
        `      <link>${xmlEscape(c.source_url)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(`${c.service_id}-${c.date}`)}</guid>`,
        `      <pubDate>${new Date(c.date + "T06:00:00Z").toUTCString()}</pubDate>`,
        `      <description>${xmlEscape(detail || "Page content changed.")}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>FreeTierWatch — free tier changes</title>
    <link>${xmlEscape(siteUrl)}</link>
    <description>Daily automated monitoring of free-tier limits across dev and AI services.</description>
${items}
  </channel>
</rss>
`;
};

const main = async () => {
  const db = readJson(path.join(DATA, "freetiers.json"), null);
  if (!db || !Array.isArray(db.services)) {
    console.error("data/freetiers.json missing or invalid");
    process.exit(1);
  }
  fs.mkdirSync(SNAPSHOTS, { recursive: true });
  fs.mkdirSync(SITE_DATA, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const changes = readJson(path.join(DATA, "changes.json"), []);
  const status = readJson(path.join(DATA, "status.json"), {});
  const newChanges = [];

  for (const svc of db.services) {
    const snapFile = path.join(SNAPSHOTS, `${svc.id}.txt`);
    try {
      const lines = htmlToLines(await fetchPage(svc.source_url));
      status[svc.id] = { last_ok: today, consecutive_errors: 0 };
      if (!fs.existsSync(snapFile)) {
        fs.writeFileSync(snapFile, lines.join("\n") + "\n");
        console.log(`baseline: ${svc.id} (${lines.length} lines)`);
        continue;
      }
      const oldLines = fs.readFileSync(snapFile, "utf8").split("\n").filter(Boolean);
      const { added, removed } = quotaDiff(oldLines, lines);
      const alreadyToday = changes.some((c) => c.service_id === svc.id && c.date === today);
      if ((added.length || removed.length) && !alreadyToday) {
        newChanges.push({
          date: today,
          service_id: svc.id,
          service_name: svc.name,
          source_url: svc.source_url,
          added,
          removed,
        });
        console.log(`CHANGE: ${svc.id} (+${added.length}/-${removed.length})`);
      }
      fs.writeFileSync(snapFile, lines.join("\n") + "\n");
    } catch (err) {
      const prev = status[svc.id] || {};
      status[svc.id] = {
        last_ok: prev.last_ok || null,
        consecutive_errors: (prev.consecutive_errors || 0) + 1,
        last_error: `${today}: ${err.message}`,
      };
      console.error(`fetch failed: ${svc.id}: ${err.message}`);
    }
  }

  const allChanges = [...changes, ...newChanges];
  writeJson(path.join(DATA, "changes.json"), allChanges);
  writeJson(path.join(DATA, "status.json"), status);

  // Publish to the Pages-served docs/data/ dir.
  const siteUrl = db.site_url || "https://github.com/guillemmontejo/freetierwatch";
  fs.copyFileSync(path.join(DATA, "freetiers.json"), path.join(SITE_DATA, "freetiers.json"));
  writeJson(path.join(SITE_DATA, "changes.json"), allChanges);
  fs.writeFileSync(path.join(SITE_DATA, "feed.xml"), buildFeed(allChanges, siteUrl));
  console.log(`done: ${db.services.length} services, ${newChanges.length} new changes`);
};

module.exports = { htmlToLines, quotaDiff };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
