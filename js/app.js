/**
 * app.js
 * SafeX Intern Reports — search, sort, filter, pagination, dual chart views,
 * PDF/CSV export, intern detail drawer, dark mode, skeleton loading.
 * No build step: runs from CDN <script> tags declared in index.html.
 */

(function () {
  "use strict";

  const {
    getInternRecords,
    getWeeklyCompletionSummary,
    getTrackBreakdown,
    getInternHistory,
    WEEK_LABELS,
    TRACKS,
    STATUSES
  } = window.SafeXData;

  const allRecords = getInternRecords();

  const state = {
    track: "all",
    week: "all",
    status: "all",
    search: "",
    sortKey: "completionPct",
    sortDir: "desc",
    page: 1,
    pageSize: 10,
    chartView: "weekly",
    loading: true
  };

  let chartInstance = null;
  let drawerChartInstance = null;
  let searchDebounce = null;
  let lastFocusedEl = null;

  const el = {};

  function cacheDom() {
    const ids = [
      "trackFilter", "weekFilter", "statusFilter", "pageSizeSelect",
      "searchInput", "searchClear", "activeFilters",
      "tableBody", "paginationInfo", "paginationControls", "emptyState",
      "clearFiltersBtn", "statAvg", "statInterns", "statOnTrack", "statAtRisk",
      "sx-pdf-btn", "sx-csv-btn", "sx-print-btn", "sx-theme-toggle",
      "sx-toast", "sx-toast-text", "completionChart", "generatedAt",
      "tabWeekly", "tabTrack", "chartDesc", "chartLegend",
      "drawerOverlay", "drawerPanel", "drawerClose", "drawerName", "drawerTrack",
      "drawerAvg", "drawerBest", "drawerLatest", "drawerChart", "drawerHistory"
    ];
    ids.forEach((id) => {
      const key = id.replace(/^sx-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      el[key] = document.getElementById(id);
    });
  }

  // ---------------------------------------------------------------------
  // Init filter dropdowns
  // ---------------------------------------------------------------------
  function initFilterOptions() {
    TRACKS.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      el.trackFilter.appendChild(opt);
    });
    WEEK_LABELS.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      el.weekFilter.appendChild(opt);
    });
    STATUSES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      el.statusFilter.appendChild(opt);
    });
  }

  // ---------------------------------------------------------------------
  // Filtering + sorting
  // ---------------------------------------------------------------------
  function getFilteredRecords() {
    const q = state.search.trim().toLowerCase();
    let rows = allRecords.filter((r) => {
      const trackOk = state.track === "all" || r.track === state.track;
      const weekOk = state.week === "all" || r.week === state.week;
      const statusOk = state.status === "all" || r.status === state.status;
      const searchOk = !q || r.name.toLowerCase().includes(q);
      return trackOk && weekOk && statusOk && searchOk;
    });

    const { sortKey, sortDir } = state;
    rows = rows.slice().sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (typeof av === "string") {
        av = av.toLowerCase();
        bv = bv.toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }

  // ---------------------------------------------------------------------
  // Animated stat counters
  // ---------------------------------------------------------------------
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animateValue(elNode, from, to, suffix) {
    if (prefersReducedMotion || from === to) {
      elNode.textContent = to + (suffix || "");
      return;
    }
    const duration = 450;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);
      elNode.textContent = value + (suffix || "");
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderStats(filtered) {
    const avg = Math.round(
      filtered.reduce((s, r) => s + r.completionPct, 0) / (filtered.length || 1)
    );
    const internSet = new Set(filtered.map((r) => r.name));
    const onTrack = filtered.filter((r) => r.status === "On Track").length;
    const atRisk = filtered.filter((r) => r.status === "At Risk").length;

    animateValue(el.statAvg, Number(el.statAvg.dataset.target || 0), avg, "%");
    animateValue(el.statInterns, Number(el.statInterns.dataset.target || 0), internSet.size, "");
    animateValue(el.statOnTrack, Number(el.statOnTrack.dataset.target || 0), onTrack, "");
    animateValue(el.statAtRisk, Number(el.statAtRisk.dataset.target || 0), atRisk, "");

    el.statAvg.dataset.target = avg;
    el.statInterns.dataset.target = internSet.size;
    el.statOnTrack.dataset.target = onTrack;
    el.statAtRisk.dataset.target = atRisk;
  }

  // ---------------------------------------------------------------------
  // Main chart (weekly trend or per-track breakdown)
  // ---------------------------------------------------------------------
  function renderChart(filtered) {
    if (state.chartView === "weekly") {
      const summary = getWeeklyCompletionSummary(filtered);
      const labels = summary.map((s) => s.week);
      const data = summary.map((s) => s.avgCompletionPct);

      el.chartDesc.textContent = "Average across filtered interns, vs. 80% target";
      el.chartLegend.style.display = "flex";
      el.chartLegend.innerHTML =
        '<span><i style="background:#0f9e94"></i>Avg. completion</span>' +
        '<span><i style="background:#e2a53a"></i>Target (80%)</span>';

      buildOrUpdateChart({
        type: "bar",
        data: {
          labels,
          datasets: [
            { type: "bar", label: "Avg. completion %", data, backgroundColor: "#0f9e94", borderRadius: 6, maxBarThickness: 46, order: 2 },
            { type: "line", label: "Target (80%)", data: data.map(() => 80), borderColor: "#e2a53a", borderDash: [6, 5], borderWidth: 2, pointRadius: 0, fill: false, order: 1 }
          ]
        },
        options: baseChartOptions()
      });
    } else {
      const breakdown = getTrackBreakdown(filtered);
      const labels = breakdown.map((b) => b.track);
      const data = breakdown.map((b) => b.avgCompletionPct);
      const palette = ["#0f9e94", "#2ec4b6", "#1f4c73", "#e2a53a", "#7c93a8"];

      el.chartDesc.textContent = "Average completion by track, filtered interns only";
      el.chartLegend.style.display = "none";

      buildOrUpdateChart({
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "Avg. completion %",
              data,
              backgroundColor: labels.map((_, i) => palette[i % palette.length]),
              borderRadius: 6,
              maxBarThickness: 56
            }
          ]
        },
        options: { ...baseChartOptions(), indexAxis: "y" }
      });
    }
  }

  function baseChartOptions() {
    const gridColor = document.documentElement.getAttribute("data-theme") === "dark" ? "#1e2f42" : "#eef2f5";
    const tickColor = document.documentElement.getAttribute("data-theme") === "dark" ? "#a9b8c6" : "#4b5a68";
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: prefersReducedMotion ? 0 : 400 },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%", color: tickColor }, grid: { color: gridColor } },
        x: { grid: { display: false }, ticks: { color: tickColor } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y ?? ctx.parsed.x}%` } }
      }
    };
  }

  function buildOrUpdateChart(config) {
    if (chartInstance) {
      chartInstance.destroy();
    }
    chartInstance = new Chart(el.completionChart.getContext("2d"), config);
  }

  // ---------------------------------------------------------------------
  // Sortable table headers
  // ---------------------------------------------------------------------
  function wireSortHeaders() {
    document.querySelectorAll(".sx-th-btn[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "name" || key === "track" || key === "status" ? "asc" : "desc";
        }
        state.page = 1;
        document.querySelectorAll(".sx-th-btn[data-sort]").forEach((b) => b.setAttribute("aria-sort", "none"));
        btn.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
        refresh();
      });
    });
  }

  // ---------------------------------------------------------------------
  // Table + pagination
  // ---------------------------------------------------------------------
  function statusBadgeClass(status) {
    if (status === "On Track") return "on-track";
    if (status === "Needs Attention") return "needs-attention";
    return "at-risk";
  }

  function initials(name) {
    return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  function renderSkeletonRows(count) {
    el.tableBody.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const tr = document.createElement("tr");
      tr.className = "sx-skeleton-row";
      tr.innerHTML = new Array(6).fill('<td><div class="sx-skeleton-block"></div></td>').join("");
      el.tableBody.appendChild(tr);
    }
  }

  function renderTable(filtered) {
    el.emptyState.classList.toggle("visible", filtered.length === 0);

    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const pageRows = filtered.slice(start, start + state.pageSize);

    el.tableBody.innerHTML = "";
    pageRows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = "sx-row-clickable";
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `View ${r.name}'s full trend`);
      tr.innerHTML = `
        <td>
          <div class="sx-name-cell">
            <span class="sx-avatar" aria-hidden="true">${escapeHtml(initials(r.name))}</span>
            <span>${escapeHtml(r.name)}</span>
          </div>
        </td>
        <td>${escapeHtml(r.track)}</td>
        <td>${escapeHtml(r.week)}</td>
        <td class="num">${r.tasksCompleted}/${r.tasksAssigned}</td>
        <td>
          <div class="sx-progress-cell">
            <div class="sx-progress-track"><div class="sx-progress-fill" style="width:${r.completionPct}%"></div></div>
            <span class="num" style="min-width:34px;font-family:var(--sx-font-mono);font-size:12.5px;">${r.completionPct}%</span>
          </div>
        </td>
        <td><span class="sx-badge ${statusBadgeClass(r.status)}">${r.status}</span></td>
      `;
      tr.addEventListener("click", () => openDrawer(r.name, tr));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDrawer(r.name, tr);
        }
      });
      el.tableBody.appendChild(tr);
    });

    renderPagination(filtered.length, totalPages);
  }

  function renderPagination(totalRows, totalPages) {
    const start = totalRows === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const end = Math.min(state.page * state.pageSize, totalRows);
    el.paginationInfo.textContent = `Showing ${start}–${end} of ${totalRows} records`;

    el.paginationControls.innerHTML = "";

    const prevBtn = makePageButton("‹", state.page === 1, () => { state.page -= 1; refresh(); });
    prevBtn.setAttribute("aria-label", "Previous page");
    el.paginationControls.appendChild(prevBtn);

    const maxButtons = 5;
    let startPage = Math.max(1, state.page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);

    for (let p = startPage; p <= endPage; p++) {
      const btn = makePageButton(String(p), false, () => { state.page = p; refresh(); });
      if (p === state.page) {
        btn.classList.add("current");
        btn.setAttribute("aria-current", "page");
      }
      el.paginationControls.appendChild(btn);
    }

    const nextBtn = makePageButton("›", state.page === totalPages, () => { state.page += 1; refresh(); });
    nextBtn.setAttribute("aria-label", "Next page");
    el.paginationControls.appendChild(nextBtn);
  }

  function makePageButton(label, disabled, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sx-page-btn";
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------------------------------------------------------------
  // Active filter chips
  // ---------------------------------------------------------------------
  function renderActiveFilters() {
    const chips = [];
    if (state.search) chips.push({ label: `Search: "${state.search}"`, clear: () => { state.search = ""; el.searchInput.value = ""; } });
    if (state.track !== "all") chips.push({ label: `Track: ${state.track}`, clear: () => { state.track = "all"; el.trackFilter.value = "all"; } });
    if (state.week !== "all") chips.push({ label: `Week: ${state.week}`, clear: () => { state.week = "all"; el.weekFilter.value = "all"; } });
    if (state.status !== "all") chips.push({ label: `Status: ${state.status}`, clear: () => { state.status = "all"; el.statusFilter.value = "all"; } });

    el.activeFilters.innerHTML = "";
    chips.forEach((c) => {
      const chip = document.createElement("span");
      chip.className = "sx-chip";
      chip.textContent = c.label;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Remove filter ${c.label}`);
      btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      btn.addEventListener("click", () => { c.clear(); state.page = 1; refresh(); });
      chip.appendChild(btn);
      el.activeFilters.appendChild(chip);
    });
  }

  function clearAllFilters() {
    state.search = ""; el.searchInput.value = "";
    state.track = "all"; el.trackFilter.value = "all";
    state.week = "all"; el.weekFilter.value = "all";
    state.status = "all"; el.statusFilter.value = "all";
    state.page = 1;
    refresh();
  }

  // ---------------------------------------------------------------------
  // Refresh pipeline
  // ---------------------------------------------------------------------
  function refresh() {
    const filtered = getFilteredRecords();
    el.searchClear.classList.toggle("visible", !!state.search);
    renderStats(filtered);
    renderChart(filtered);
    renderTable(filtered);
    renderActiveFilters();
  }

  // ---------------------------------------------------------------------
  // Intern detail drawer
  // ---------------------------------------------------------------------
  function openDrawer(name, triggerEl) {
    lastFocusedEl = triggerEl;
    const history = getInternHistory(name);
    if (!history.length) return;

    const avg = Math.round(history.reduce((s, r) => s + r.completionPct, 0) / history.length);
    const best = history.reduce((a, b) => (b.completionPct > a.completionPct ? b : a));
    const latest = history[history.length - 1];

    el.drawerName.textContent = name;
    el.drawerTrack.textContent = `${history[0].track} track`;
    el.drawerAvg.textContent = avg + "%";
    el.drawerBest.textContent = `${best.week} (${best.completionPct}%)`;
    el.drawerLatest.textContent = `${latest.week} · ${latest.status}`;

    el.drawerHistory.innerHTML = "";
    history.forEach((h) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(h.week)}</span><span class="num" style="font-family:var(--sx-font-mono)">${h.completionPct}%</span>`;
      el.drawerHistory.appendChild(li);
    });

    if (drawerChartInstance) drawerChartInstance.destroy();
    const gridColor = document.documentElement.getAttribute("data-theme") === "dark" ? "#1e2f42" : "#eef2f5";
    const tickColor = document.documentElement.getAttribute("data-theme") === "dark" ? "#a9b8c6" : "#4b5a68";
    drawerChartInstance = new Chart(el.drawerChart.getContext("2d"), {
      type: "line",
      data: {
        labels: history.map((h) => h.week),
        datasets: [{
          data: history.map((h) => h.completionPct),
          borderColor: "#0f9e94",
          backgroundColor: "rgba(15,158,148,0.12)",
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#0f9e94",
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: prefersReducedMotion ? 0 : 400 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%", color: tickColor }, grid: { color: gridColor } },
          x: { grid: { display: false }, ticks: { color: tickColor } }
        }
      }
    });

    el.drawerOverlay.classList.add("visible");
    el.drawerOverlay.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", onDrawerKeydown);
    el.drawerClose.focus();
  }

  function closeDrawer() {
    el.drawerOverlay.classList.remove("visible");
    el.drawerOverlay.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onDrawerKeydown);
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  function onDrawerKeydown(e) {
    if (e.key === "Escape") closeDrawer();
  }

  // ---------------------------------------------------------------------
  // Theme toggle
  // ---------------------------------------------------------------------
  function initTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    el.themeToggle.setAttribute("aria-pressed", String(current === "dark"));
    el.themeToggle.addEventListener("click", () => {
      const now = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", now);
      try { localStorage.setItem("sx-theme", now); } catch (e) {}
      el.themeToggle.setAttribute("aria-pressed", String(now === "dark"));
      renderChart(getFilteredRecords()); // re-theme gridlines/text colors
    });
  }

  // ---------------------------------------------------------------------
  // Toast helper
  // ---------------------------------------------------------------------
  let toastTimer = null;
  function showToast(message, opts = {}) {
    el.toastText.textContent = message;
    el.toast.classList.toggle("loading", !!opts.loading);
    el.toast.classList.toggle("error", !!opts.error);
    el.toast.classList.add("visible");
    clearTimeout(toastTimer);
    if (!opts.sticky) {
      toastTimer = setTimeout(() => el.toast.classList.remove("visible"), 3200);
    }
  }

  // ---------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------
  function exportCsv() {
    const filtered = getFilteredRecords();
    if (!filtered.length) {
      showToast("No rows to export — adjust your filters.", { error: true });
      return;
    }
    const header = ["Intern", "Track", "Week", "Tasks Completed", "Tasks Assigned", "Completion %", "Status"];
    const rows = filtered.map((r) => [r.name, r.track, r.week, r.tasksCompleted, r.tasksAssigned, r.completionPct, r.status]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safex-intern-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV downloaded ✓");
  }

  // ---------------------------------------------------------------------
  // PDF export (html2canvas snapshot of chart + jsPDF autotable for data)
  // ---------------------------------------------------------------------
  async function exportPdf() {
    if (!window.jspdf || !window.html2canvas) {
      showToast("PDF library failed to load — try Print instead.", { error: true });
      return;
    }
    const filtered = getFilteredRecords();
    if (!filtered.length) {
      showToast("No rows to export — adjust your filters.", { error: true });
      return;
    }

    el.pdfBtn.disabled = true;
    showToast("Generating PDF…", { loading: true, sticky: true });

    // PDFs are always exported on a white page, so temporarily force the
    // chart to render with light-mode colors even if the UI is in dark
    // mode — otherwise dark-theme gridlines/text would be baked into the
    // captured image at low contrast.
    const wasDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (wasDark) {
      document.documentElement.setAttribute("data-theme", "light");
      renderChart(filtered);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;

      doc.setFillColor(11, 31, 51);
      doc.rect(0, 0, pageWidth, 64, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("SafeX Solutions — Intern Progress Report", margin, 36);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const filterBits = [];
      if (state.search) filterBits.push(`search "${state.search}"`);
      if (state.track !== "all") filterBits.push(`track ${state.track}`);
      if (state.week !== "all") filterBits.push(state.week);
      if (state.status !== "all") filterBits.push(state.status);
      const filterLabel = filterBits.length ? ` · Filtered: ${filterBits.join(", ")}` : "";
      doc.text(`Generated ${new Date().toLocaleString()}${filterLabel}`, margin, 52);

      let cursorY = 90;

      const canvas = await html2canvas(el.completionChart, { backgroundColor: "#ffffff", scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;

      doc.setTextColor(11, 31, 51);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        state.chartView === "weekly" ? "Completion % by Week" : "Completion % by Track",
        margin,
        cursorY
      );
      cursorY += 10;
      doc.addImage(imgData, "PNG", margin, cursorY, imgWidth, imgHeight);
      cursorY += imgHeight + 26;

      const rows = filtered.map((r) => [r.name, r.track, r.week, `${r.tasksCompleted}/${r.tasksAssigned}`, `${r.completionPct}%`, r.status]);

      doc.autoTable({
        startY: cursorY,
        head: [["Intern", "Track", "Week", "Tasks", "Completion", "Status"]],
        body: rows,
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: [11, 31, 51], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 247, 249] },
        margin: { left: margin, right: margin },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(140, 150, 160);
          doc.text(
            `SafeX Solutions · Confidential · Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`,
            margin,
            doc.internal.pageSize.getHeight() - 20
          );
        }
      });

      doc.save(`safex-intern-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast("PDF downloaded ✓");
    } catch (err) {
      console.error(err);
      showToast("Couldn't generate the PDF — try Print instead.", { error: true });
    } finally {
      if (wasDark) {
        document.documentElement.setAttribute("data-theme", "dark");
        renderChart(getFilteredRecords());
      }
      el.pdfBtn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------
  function wireEvents() {
    el.trackFilter.addEventListener("change", (e) => { state.track = e.target.value; state.page = 1; refresh(); });
    el.weekFilter.addEventListener("change", (e) => { state.week = e.target.value; state.page = 1; refresh(); });
    el.statusFilter.addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; refresh(); });
    el.pageSizeSelect.addEventListener("change", (e) => { state.pageSize = Number(e.target.value); state.page = 1; refresh(); });

    el.searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.search = val;
        state.page = 1;
        refresh();
      }, 200);
    });
    el.searchClear.addEventListener("click", () => {
      el.searchInput.value = "";
      state.search = "";
      state.page = 1;
      refresh();
      el.searchInput.focus();
    });

    el.clearFiltersBtn.addEventListener("click", clearAllFilters);

    el.pdfBtn.addEventListener("click", exportPdf);
    el.csvBtn.addEventListener("click", exportCsv);
    el.printBtn.addEventListener("click", () => window.print());

    el.tabWeekly.addEventListener("click", () => switchChartView("weekly"));
    el.tabTrack.addEventListener("click", () => switchChartView("track"));

    el.drawerClose.addEventListener("click", closeDrawer);
    el.drawerOverlay.addEventListener("click", (e) => {
      if (e.target === el.drawerOverlay) closeDrawer();
    });

    wireSortHeaders();
  }

  function switchChartView(view) {
    state.chartView = view;
    el.tabWeekly.setAttribute("aria-selected", String(view === "weekly"));
    el.tabTrack.setAttribute("aria-selected", String(view === "track"));
    renderChart(getFilteredRecords());
  }

  // ---------------------------------------------------------------------
  // Boot (simulated fetch → skeleton → real render, mirrors a real API call)
  // ---------------------------------------------------------------------
  function boot() {
    cacheDom();
    initFilterOptions();
    initTheme();
    wireEvents();

    if (el.generatedAt) {
      el.generatedAt.textContent = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }

    renderSkeletonRows(state.pageSize);

    const bootDelay = prefersReducedMotion ? 0 : 450;
    setTimeout(() => {
      state.loading = false;
      refresh();
    }, bootDelay);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
