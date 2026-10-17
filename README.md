# Loops

Dashboard for Norfolk Vanguard ICT loop testing, built from the daily "Loop test daily Look Ahead" email thread.

- **Dashboard:** [`index.html`](index.html). Open it in a browser; no server needed.
- **README (full):** [`README.html`](README.html)
- **PRD:** [`docs/PRD.html`](docs/PRD.html)

Rebuild the data after adding a new `.eml` to `source/` and its figures to `data/daily_reports.json`:

```sh
python3 scripts/build_data.py
```

## Deploy to Vercel

Static site, no build step. Import `orangejam72/loops` in Vercel with Framework Preset **Other** and empty build settings, or run `npx vercel --prod`. Routes: `/` dashboard, `/prd`, `/readme`. `.vercelignore` keeps `source/` (the raw email) and `scripts/` off the deployed site. Turn on Deployment Protection to limit access.
