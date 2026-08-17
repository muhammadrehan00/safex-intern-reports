# SafeX Solutions — Intern Reports Module (Week 2, v3)

A production-grade reporting dashboard for the SafeX Intern Management
System. Extends the Week 1 progress table with two chart views, a
searchable/sortable/paginated data table, PDF + CSV export, a per-intern
trend drawer, dark mode, and a print-friendly fallback.

**Live demo:** _add your deployed Vercel/Netlify URL here_
**Repo:** _add your GitHub repo URL here_

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Markup / structure | Semantic HTML5 | No framework needed for a single-page report; keeps Lighthouse scores high |
| Styling | Hand-written CSS (`css/styles.css`, `css/print.css`) | Full control over brand tokens, no CSS framework bloat |
| Charting | [Chart.js 4](https://www.chartjs.org/) (CDN) | Lightweight, accessible canvas charts, no build step |
| PDF export | [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) + [html2canvas](https://html2canvas.hertzen.com/) | Renders the chart as an image and the table as native PDF text (searchable, not just a screenshot) |
| Fonts | Inter (UI) + JetBrains Mono (numeric data) via Google Fonts | Clear hierarchy between labels and data |
| Data | `js/data.js` — deterministic mock generator | Swap `getInternRecords()` for a real API call when the backend is ready |

No bundler, no framework, no `node_modules` required to run it — it's a
static site that loads its three third-party libraries from CDN.

---

## Project structure

```
safex-reports/
├── index.html          Page shell, brand header, chart + table + drawer markup
├── manifest.json        PWA manifest (installable dashboard)
├── assets/
│   └── icon.svg          App icon used by manifest + favicon
├── css/
│   ├── styles.css       Design tokens (incl. dark mode), layout, components
│   └── print.css        @media print fallback export stylesheet
├── js/
│   ├── data.js           Mock data + weekly/track aggregation + intern history
│   └── app.js             Search, sort, filters, pagination, charts, PDF/CSV export, drawer, theme
├── business/
│   ├── outreach-email.md
│   ├── linkedin-post.md
│   └── demo-script.md
├── package.json          Optional npm scripts (local static server)
├── netlify.toml          Zero-config Netlify deploy settings
└── README.md
```

---

## Run it locally

You don't need Node.js — any static file server works. Pick one:

**Option A — no install, Python (already on most machines):**
```bash
cd safex-reports
python3 -m http.server 5173
# open http://localhost:5173
```

**Option B — npm:**
```bash
cd safex-reports
npm install    # installs nothing but sets up the scripts, or skip this line
npm run dev    # serves on http://localhost:5173 via `npx serve`
```

**Option C — just open the file:**
Double-click `index.html`. Everything works, but some browsers restrict
`fetch`/canvas-to-image in the `file://` context — a local server (A or B)
is recommended for the PDF export button to behave consistently.

---

## Deploying

**Vercel:**
1. Push this folder to a GitHub repo.
2. Import the repo in Vercel → Framework preset: **Other** → no build
   command, output directory `.`.
3. Deploy.

**Netlify:**
1. Push to GitHub.
2. New site from Git → the included `netlify.toml` already sets
   `publish = "."` with no build command, so it deploys as-is.

---

## Features

**Core reporting (Week 2 spec)**
- **Weekly completion chart** — Chart.js bar chart of average completion %
  per week, with an 80% target reference line, live-filtered by track/week/status/search.
- **PDF export** — "Download PDF" captures the active chart and renders the
  full filtered data set as a real, searchable table via jsPDF + autotable —
  not a screenshot of the page. Always exports in light mode for readability,
  even if you're viewing the dashboard in dark mode.
- **Pagination** — client-side, with a rows-per-page control (10/20/50).
- **Print fallback** — `css/print.css` gives a clean, full-data printout via
  File → Print → Save as PDF, forced to light/paper colors regardless of theme.
- **Accessibility** — semantic landmarks, labelled controls, skip link,
  visible focus rings, `aria-live` regions, `aria-sort` on table headers,
  chart described via `aria-label`, `prefers-reduced-motion` respected.
- **Branding** — SafeX navy/teal palette, logo placeholder mark, Inter for
  UI text, JetBrains Mono for numeric data.

**Added on top (v3 — "world-class" pass)**
- **Dark mode** — toggle in the top bar, respects OS preference on first
  visit, persisted in `localStorage`, applied before first paint (no flash).
- **Live search** — debounced, filters interns by name as you type.
- **Sortable columns** — click any table header to sort asc/desc; state
  reflected via `aria-sort`.
- **Second chart view** — tab between "By Week" (trend) and "By Track"
  (breakdown), both exportable to the PDF.
- **CSV export** — one click, alongside PDF, for anyone who wants raw data
  in a spreadsheet.
- **Intern detail drawer** — click any row to open a side panel with that
  intern's full six-week trend line, best week, and history — without
  leaving the page. Closes on `Escape`, click-outside, or the close button;
  returns focus to the triggering row.
- **Active filter chips** — every applied filter/search shows as a
  removable chip above the table.
- **Empty state** — a clear "no results" message with a one-click "clear
  all filters" action instead of a blank table.
- **Skeleton loading** — the table shows shimmering placeholder rows while
  data "loads" (simulates a real API call — replace the timeout in
  `boot()` with your actual fetch when wiring up a backend).
- **Installable (PWA-lite)** — `manifest.json` + SVG icon so the dashboard
  can be added to a phone's home screen or installed as a desktop app.
- **Animated stat counters** — the summary strip counts up/down when
  filters change, respecting `prefers-reduced-motion`.

---

## QA checklist before shipping

- [ ] Test in Chrome, Firefox, and mobile Safari (iOS)
- [ ] Run Lighthouse (Chrome DevTools → Lighthouse) — target 90+ on
      Performance, Accessibility, Best Practices, and SEO
- [ ] Confirm PDF export works with 1 row, 0 rows (empty filter), and 100+
      rows
- [ ] Confirm `window.print()` output looks correct on A4 and Letter
- [ ] Swap the mock `getInternRecords()` for your real API before go-live

---

## Connecting real data

Everything downstream of `getInternRecords()` in `js/data.js` only depends
on this row shape:

```js
{
  id, name, track, week, weekIndex,
  tasksAssigned, tasksCompleted, completionPct, status
}
```

Replace the function body with a `fetch()` to your backend (e.g.
`GET /api/interns/progress`) that returns rows in this shape, and the chart,
stats, table, pagination, and PDF export all continue to work unchanged.
