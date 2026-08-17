/**
 * data.js
 * Mock data layer for the SafeX Intern Reports module.
 * In production, replace `getInternRecords()` with a fetch() call to your API
 * (e.g. GET /api/interns/progress) — the rest of the app only depends on the
 * row shape returned here, so nothing else needs to change.
 */

const SAFEX_NAMES = [
  "Amina Yousafzai", "Bilal Khattak", "Sara Durrani", "Hamza Afridi",
  "Fatima Marwat", "Usman Tariq", "Ayesha Noor", "Zain Malik",
  "Mehak Iqbal", "Danish Raza", "Areeba Shah", "Talha Jadoon",
  "Hira Baig", "Osama Sethi", "Noor ul Ain", "Faizan Gul",
  "Sana Wazir", "Rehan Khalil", "Iqra Bangash", "Waqas Hoti"
];

const WEEK_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];
const TRACKS = ["Frontend", "Backend", "Data/Analytics", "Design", "QA"];
const STATUSES = ["On Track", "Needs Attention", "At Risk"];

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

let _cache = null;

/**
 * Generates deterministic mock records: one row per intern per week.
 * Row shape: { id, name, track, week, weekIndex, tasksAssigned,
 *              tasksCompleted, completionPct, status }
 */
function getInternRecords() {
  if (_cache) return _cache;

  const rand = seededRandom(42);
  const records = [];
  let id = 1;

  SAFEX_NAMES.forEach((name, internIdx) => {
    const track = TRACKS[internIdx % TRACKS.length];
    let baseline = 55 + Math.floor(rand() * 15);

    WEEK_LABELS.forEach((week, weekIndex) => {
      const drift = weekIndex * (4 + rand() * 3);
      const noise = (rand() - 0.5) * 12;
      let pct = Math.round(baseline + drift + noise);
      pct = Math.max(20, Math.min(100, pct));

      const tasksAssigned = 6 + Math.floor(rand() * 4);
      const tasksCompleted = Math.round((pct / 100) * tasksAssigned);
      const actualPct = Math.round((tasksCompleted / tasksAssigned) * 100);

      let status = "On Track";
      if (actualPct < 50) status = "At Risk";
      else if (actualPct < 75) status = "Needs Attention";

      records.push({
        id: id++,
        name,
        track,
        week,
        weekIndex,
        tasksAssigned,
        tasksCompleted,
        completionPct: actualPct,
        status
      });
    });
  });

  _cache = records;
  return records;
}

/** Average completion % per week across the given (already filtered) records. */
function getWeeklyCompletionSummary(records) {
  return WEEK_LABELS.map((label, idx) => {
    const rows = records.filter((r) => r.weekIndex === idx);
    const avg = rows.reduce((s, r) => s + r.completionPct, 0) / (rows.length || 1);
    return {
      week: label,
      avgCompletionPct: Math.round(avg),
      completedTasks: rows.reduce((s, r) => s + r.tasksCompleted, 0),
      assignedTasks: rows.reduce((s, r) => s + r.tasksAssigned, 0)
    };
  });
}

/** Average completion % per track across the given (already filtered) records. */
function getTrackBreakdown(records) {
  return TRACKS.map((track) => {
    const rows = records.filter((r) => r.track === track);
    const avg = rows.length
      ? rows.reduce((s, r) => s + r.completionPct, 0) / rows.length
      : 0;
    return { track, avgCompletionPct: Math.round(avg), internCount: new Set(rows.map((r) => r.name)).size };
  }).filter((t) => t.internCount > 0);
}

/** Full six-week history for a single intern, for the trend drawer sparkline. */
function getInternHistory(name) {
  const rows = getInternRecords()
    .filter((r) => r.name === name)
    .sort((a, b) => a.weekIndex - b.weekIndex);
  return rows;
}

window.SafeXData = {
  WEEK_LABELS,
  TRACKS,
  STATUSES,
  getInternRecords,
  getWeeklyCompletionSummary,
  getTrackBreakdown,
  getInternHistory
};
