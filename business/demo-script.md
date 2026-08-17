# 60–90 Second Demo Script

*I can't record a screen video myself — here's a shot-by-shot script so
you (or whoever holds Loom/OBS) can record it in one take. Total runtime
target: ~75 seconds.*

## Setup
- Deploy the app first (or run `npm run dev` locally) so the browser is
  already pointed at the live report.
- Zoom browser to ~110% so text is legible in the recording.
- Have the cursor start at the top-left, page freshly loaded.

## Shot list

**0:00–0:10 — Cold open on the dashboard**
> "This is the new Reports module in the SafeX Intern Management System."

Action: Let the page sit for 2 seconds so viewers register the branding
and stat strip, then slowly scroll to the chart.

**0:10–0:25 — Chart**
> "At the top, we get completion trends by week — with a target line so a
> program manager can spot who's falling behind at a glance."

Action: Filter by Track (e.g. "Frontend") to show the chart update live.

**0:25–0:40 — Table + pagination**
> "Below that is the full intern record — filterable, and paginated so it
> stays fast even with a large cohort."

Action: Change "Rows per page" from 10 → 20, click through to page 2 once.

**0:40–0:60 — PDF export**
> "And the part clients ask for most: one click, and the whole report —
> chart included — exports as a clean, branded PDF."

Action: Click **Download PDF**, wait for the toast confirmation, then
open the downloaded file and show 1–2 seconds of the actual PDF (chart +
table visible).

**0:60–0:75 — Close**
> "Built this week, live now — link's in the description."

Action: Cut back to the dashboard, end on the branded header.

## Recording checklist
- [ ] Mic check — no background noise
- [ ] Browser notifications muted
- [ ] Sensitive data hidden (only mock intern names are in the demo build, so this is safe)
- [ ] Export the recording as MP4, keep it under 90 seconds
- [ ] Upload to Loom (preferred — auto-generates a shareable link) or export from OBS and upload to Drive/YouTube (unlisted)
- [ ] Paste the final link into the outreach email and LinkedIn post drafts
