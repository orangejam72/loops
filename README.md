# Loops

Dashboard for Norfolk Vanguard ICT loop testing, built from the daily "Loop test daily Look Ahead" email thread.

- **Dashboard:** [`index.html`](index.html). Open it in a browser; no server needed.
- **README (full):** [`README.html`](README.html)
- **PRD:** [`docs/PRD.html`](docs/PRD.html)
- **PDF export:** [`exports/loops-dashboard.pdf`](exports/loops-dashboard.pdf)
- **Offline page:** [`exports/loops-dashboard-offline.html`](exports/loops-dashboard-offline.html), a single file with no internet needed
- **Live site:** loops-blue.vercel.app (Vercel login, or the share link; see README.html)

Every page has an Auto / Light / Dark theme switch.

Rebuild the data after adding a new `.eml` to `source/` and its figures to `data/daily_reports.json`:

```sh
python3 scripts/build_data.py
NODE_PATH="$(npm root -g)" node scripts/build_exports.cjs   # PDF + offline page (needs: npm install -g playwright@1.56.1)
NODE_PATH="$(npm root -g)" node scripts/test_dashboard.cjs  # browser checks
```

## Deploy to Vercel

Static site, no build step. Import `orangejam72/loops` in Vercel with Framework Preset **Other** and empty build settings, or run `npx vercel --prod`. Routes: `/` dashboard, `/prd`, `/readme`. `.vercelignore` keeps `source/` (the raw email) and `scripts/` off the deployed site. Deployment Protection (Vercel Authentication) is on for all deployments; guests use the share link described in README.html. The share secret is not stored in this repo.
