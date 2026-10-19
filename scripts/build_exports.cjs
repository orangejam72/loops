#!/usr/bin/env node
/* Build the shareable exports from the current dashboard and data.

Writes:
  exports/loops-dashboard-offline.html   one self-contained file: data, fonts, theme script inlined
  exports/loops-dashboard.pdf            A4 landscape, light theme, rendered from the offline file
  exports/manifest.json                  size and SHA-256 of each export, to check a deployment

Run after scripts/build_data.py:
  npm install -g playwright@1.56.1     (once; uses its bundled Chromium)
  NODE_PATH="$(npm root -g)" node scripts/build_exports.cjs

Set CHROMIUM_PATH to use a Chromium already on the machine instead of Playwright's download.
*/
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "exports");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function inlineFonts() {
  const dir = path.join(ROOT, "assets", "fonts");
  return read("assets/fonts/fonts.css").replace(/url\(([^)]+\.woff2)\)/g, (_, file) => {
    const b64 = fs.readFileSync(path.join(dir, file)).toString("base64");
    return `url(data:font/woff2;base64,${b64})`;
  });
}

function buildOffline() {
  const data = read("data/data.js").replace(/<\//g, "<\\/");
  const lastDay = /"progressThrough": "([\d-]+)"(?![\s\S]*"progressThrough")/.exec(data)[1];
  const stamp = new Date().toISOString().slice(0, 10);
  let html = read("index.html");

  const swaps = [
    ['<link rel="stylesheet" href="assets/fonts/fonts.css">', `<style>\n${inlineFonts()}</style>`],
    ['<script src="assets/theme.js"></script>', `<script>\n${read("assets/theme.js")}</script>`],
    ['<script src="data/data.js"></script>', `<script>\n${data}</script>`],
  ];
  for (const [from, to] of swaps) {
    if (!html.includes(from)) throw new Error(`index.html no longer contains: ${from}`);
    html = html.replace(from, () => to);
  }
  // Links to the hosted PDF, offline copy, PRD and README do not exist next to a standalone file.
  html = html
    .replace(/<a\b[^>]*\bdata-online-only\b[^>]*>[\s\S]*?<\/a>\s*/g, "")
    .replace(/<span data-online-only>[\s\S]*?<\/span><\/span>/, "</span>")
    .replace("<title>Loops Dashboard</title>", "<title>Loops Dashboard (offline)</title>")
    .replace(/email thread, (9–\d+ \w+ \d{4})\./, (_, range) => `email thread, ${range}. Copy generated ${stamp} from data through ${lastDay}.`);

  if (/\bsrc="(?!data:)[^"]+"|href="(?:assets|data|exports|docs)\//.test(html)) {
    throw new Error("Offline page still references a local file");
  }
  const file = path.join(OUT, "loops-dashboard-offline.html");
  fs.writeFileSync(file, html);
  return file;
}

async function buildPdf(offlineFile) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, colorScheme: "light" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + offlineFile);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  await page.waitForTimeout(300);
  if (errors.length) throw new Error("Dashboard script errors: " + errors.join("; "));
  const file = path.join(OUT, "loops-dashboard.pdf");
  await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  return file;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const offline = buildOffline();
  const pdf = await buildPdf(offline);
  const data = read("data/data.js");
  const manifest = {
    dataThrough: /"progressThrough": "([\d-]+)"(?![\s\S]*"progressThrough")/.exec(data)[1],
    files: Object.fromEntries([offline, pdf].map((f) => {
      const buf = fs.readFileSync(f);
      return [path.basename(f), { bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") }];
    })),
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  for (const f of [offline, pdf]) console.log(`${path.relative(ROOT, f)}  ${(fs.statSync(f).size / 1024).toFixed(0)} KB`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
