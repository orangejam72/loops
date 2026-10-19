#!/usr/bin/env node
/* Browser checks for the dashboard, its exports and the docs pages.

Run after scripts/build_exports.cjs:
  NODE_PATH="$(npm root -g)" node scripts/test_dashboard.cjs

Exits non-zero if any check fails. Set CHROMIUM_PATH to use a local Chromium.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const url = (p) => "file://" + path.join(ROOT, p);
let failed = 0;
const check = (cond, msg) => {
  console.log((cond ? "PASS " : "FAIL ") + msg);
  if (!cond) failed++;
};

// Expected headline numbers come from the data, so the checks stay valid as reports are added.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data/data.js"), "utf8"), sandbox);
const days = sandbox.window.LOOPS_DATA.days;
const last = days[days.length - 1];
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const expectedKpis = [last.commenced, last.fieldComplete, last.cwaTotal, Math.round((last.cwaPb / last.cwaTotal) * 100) + "%", last.awaitingCwa, sum(last.ioBySystem)].join(",");
const DARK_BG = "rgb(13, 17, 23)";
const LIGHT_BG = "rgb(244, 246, 249)";

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const watch = (page) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    return errors;
  };

  // Dashboard: data, charts, exports, theme-aware chart colours
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(url("index.html"));
    await page.waitForTimeout(500);
    const kpis = (await page.$$eval(".kpi .val", (e) => e.map((x) => x.textContent))).join(",");
    check(kpis === expectedKpis, `dashboard: KPIs match latest data (${kpis})`);
    check((await page.$$eval(".finding", (e) => e.length)) === 5, "dashboard: five findings");
    check(!(await page.content()).includes("undefined"), "dashboard: no 'undefined' in rendered text");
    check((await page.$$eval("#c-cum svg path, #c-io svg path, #c-cwa svg path, #c-rec svg path", (e) => e.length)) > 30, "dashboard: charts drawn");
    const hrefs = await page.$$eval(".actions a", (e) => e.map((a) => a.getAttribute("href")));
    check(hrefs.every((h) => fs.existsSync(path.join(ROOT, h))), `dashboard: export files exist (${hrefs.join(", ")})`);
    const fill = () => page.$eval("#c-cwa svg path", (e) => e.getAttribute("fill"));
    const before = await fill();
    await page.click('[data-theme-set="dark"]');
    await page.waitForTimeout(150);
    check(before !== (await fill()), "dashboard: chart colours redraw on theme change");
    await page.setViewportSize({ width: 400, height: 800 });
    await page.waitForTimeout(200);
    check((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "dashboard: no sideways scroll at phone width");
    check(errors.length === 0, "dashboard: no script errors " + errors.join("; "));
    await ctx.close();
  }

  // Theme switch on every page
  for (const file of ["index.html", "README.html", "docs/PRD.html"]) {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    const errors = watch(page);
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.goto(url(file));
    await page.waitForTimeout(200);
    check((await bg()) === DARK_BG, `${file}: Auto follows a dark device`);
    await page.click('[data-theme-set="light"]');
    check((await bg()) === LIGHT_BG, `${file}: Light overrides a dark device`);
    await page.reload();
    await page.waitForTimeout(200);
    check((await bg()) === LIGHT_BG, `${file}: choice remembered after reload`);
    await page.click('[data-theme-set="system"]');
    check((await bg()) === DARK_BG, `${file}: Auto restores the device setting`);
    check(errors.length === 0, `${file}: no script errors ` + errors.join("; "));
    await ctx.close();
  }

  // Offline page with every network request blocked
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const blocked = [];
    await ctx.route("**/*", (r) => {
      const u = r.request().url();
      if (u.startsWith("file:") || u.startsWith("data:")) return r.continue();
      blocked.push(u);
      return r.abort();
    });
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(url("exports/loops-dashboard-offline.html"));
    await page.waitForTimeout(500);
    check(blocked.length === 0, "offline: makes no network requests " + blocked.join(", "));
    const kpis = (await page.$$eval(".kpi .val", (e) => e.map((x) => x.textContent))).join(",");
    check(kpis === expectedKpis, `offline: KPIs match latest data (${kpis})`);
    check(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes("Plex") && f.status === "loaded")), "offline: embedded fonts load");
    check((await page.$$eval("#reg-b tr", (e) => e.length)) > 0, "offline: loop register present");
    check((await page.$$eval("[data-online-only]", (e) => e.length)) === 0, "offline: no links to files that are not there");
    await page.click('[data-theme-set="dark"]');
    check((await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === DARK_BG, "offline: theme switch works");
    check(errors.length === 0, "offline: no script errors " + errors.join("; "));
    await ctx.close();
  }

  // PDF export
  {
    const pdf = fs.readFileSync(path.join(ROOT, "exports/loops-dashboard.pdf"));
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    check(pdf.slice(0, 5).toString() === "%PDF-", "pdf: valid PDF header");
    check(pages >= 3 && pages <= 10, `pdf: ${pages} pages`);
    const age = Date.now() - fs.statSync(path.join(ROOT, "exports/loops-dashboard.pdf")).mtimeMs;
    const dataAge = Date.now() - fs.statSync(path.join(ROOT, "data/data.js")).mtimeMs;
    check(age <= dataAge, "pdf: built after the latest data");
  }

  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})();
