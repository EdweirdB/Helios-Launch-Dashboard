(() => {
  const REFRESH_MS = 30000;
  const state = {
    platforms: [],
    selectedId: null,
    tickTimer: null,
    refreshTimer: null,
  };

  const els = {
    fleetName: document.getElementById("fleet-name"),
    nowClock: document.getElementById("now-clock"),
    syncStatus: document.getElementById("sync-status"),
    nearestName: document.getElementById("nearest-name"),
    nearestSub: document.getElementById("nearest-sub"),
    nearestClock: document.getElementById("nearest-clock"),
    board: document.getElementById("board"),
    footerNote: document.getElementById("footer-note"),
    drawer: document.getElementById("drawer"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),
    drawerClose: document.getElementById("drawer-close"),
    drawerStatus: document.getElementById("drawer-status"),
    drawerTitle: document.getElementById("drawer-title"),
    drawerSummary: document.getElementById("drawer-summary"),
    drawerClock: document.getElementById("drawer-clock"),
    drawerBuildLabel: document.getElementById("drawer-build-label"),
    drawerBuildCount: document.getElementById("drawer-build-count"),
    drawerBar: document.getElementById("drawer-bar"),
    drawerCurrent: document.getElementById("drawer-current"),
    drawerBody: document.getElementById("drawer-body"),
  };

  function pad(n) {
    return String(Math.max(0, n)).padStart(2, "0");
  }

  function parseLaunch(iso) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  function remainingParts(launchMs, nowMs) {
    let diff = launchMs - nowMs;
    if (diff <= 0) {
      return { launched: true, d: 0, h: 0, m: 0, s: 0, totalMs: 0 };
    }
    const s = Math.floor(diff / 1000);
    return {
      launched: false,
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
      totalMs: diff,
    };
  }

  function writeClock(root, parts) {
    if (!root) return;
    root.querySelector('[data-u="d"]').textContent = pad(parts.d);
    root.querySelector('[data-u="h"]').textContent = pad(parts.h);
    root.querySelector('[data-u="m"]').textContent = pad(parts.m);
    root.querySelector('[data-u="s"]').textContent = pad(parts.s);
  }

  function formatNow(d) {
    return d.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function statusLabel(s) {
    return String(s || "unknown").replaceAll("_", " ");
  }

  function renderBoard() {
    const html = state.platforms
      .map((p) => {
        const outstanding = p.builds_outstanding ?? Math.max((p.builds_total || 0) - (p.builds_completed || 0), 0);
        return `
      <button class="tile" type="button" data-id="${p.id}" aria-label="Open details for ${escapeHtml(p.name)}">
        <div class="tile-top">
          <div>
            <h3 class="tile-name">${escapeHtml(p.short_name || p.name)}</h3>
            <p class="tile-repo">${escapeHtml(p.repo || p.local_path || "local")}</p>
          </div>
          <span class="status-chip ${escapeHtml(p.status)}">${escapeHtml(statusLabel(p.status))}</span>
        </div>
        <div class="tile-clock mono" data-clock-for="${p.id}">
          <div class="unit"><span data-u="d">00</span><label>Days</label></div>
          <div class="sep">:</div>
          <div class="unit"><span data-u="h">00</span><label>Hours</label></div>
          <div class="sep">:</div>
          <div class="unit"><span data-u="m">00</span><label>Mins</label></div>
          <div class="sep">:</div>
          <div class="unit"><span data-u="s">00</span><label>Secs</label></div>
        </div>
        <div class="tile-progress">
          <div class="progress-row">
            <span>${escapeHtml(p.unit_label || "builds")} complete</span>
            <strong class="mono">${p.builds_completed} / ${p.builds_total}</strong>
          </div>
          <div class="bar"><span style="width:${p.progress_pct || 0}%"></span></div>
          <div class="progress-row" style="margin-top:8px">
            <span>Outstanding</span>
            <strong class="mono">${outstanding}</strong>
          </div>
        </div>
        <p class="tile-hint">Click for details</p>
      </button>`;
      })
      .join("");
    els.board.innerHTML = html;
    els.board.querySelectorAll(".tile").forEach((btn) => {
      btn.addEventListener("click", () => openDrawer(btn.dataset.id));
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function listSection(title, items) {
    if (!items || !items.length) return "";
    const rows = items
      .map(
        (it) => `<li>
        <span class="id">${escapeHtml(it.id || "")}</span>
        <span>${escapeHtml(it.title || "")}</span>
        <span class="st">${escapeHtml(it.status || "")}</span>
      </li>`
      )
      .join("");
    return `<section class="drawer-section"><h3>${escapeHtml(title)}</h3><ul>${rows}</ul></section>`;
  }

  function openDrawer(id) {
    const p = state.platforms.find((x) => x.id === id);
    if (!p) return;
    state.selectedId = id;
    els.drawerStatus.textContent = statusLabel(p.status);
    els.drawerTitle.textContent = p.name;
    els.drawerSummary.textContent = p.summary || "";
    els.drawerBuildLabel.textContent = `${p.unit_label || "builds"} complete`;
    els.drawerBuildCount.textContent = `${p.builds_completed} / ${p.builds_total}`;
    els.drawerBar.style.width = `${p.progress_pct || 0}%`;
    els.drawerCurrent.textContent = p.current_build || "";

    const links = [];
    if (p.repo_url) links.push(`<div><a href="${escapeHtml(p.repo_url)}" target="_blank" rel="noopener">Repository</a></div>`);
    if (p.production_url) links.push(`<div><a href="${escapeHtml(p.production_url)}" target="_blank" rel="noopener">Production</a></div>`);
    if (p.local_path) links.push(`<div class="mono" style="color:var(--muted);font-size:12px;margin-top:6px">${escapeHtml(p.local_path)}</div>`);

    const detailHtml = (p.detail_sections || [])
      .map(
        (sec) => `<section class="drawer-section"><h3>${escapeHtml(sec.title)}</h3><p>${escapeHtml(sec.body)}</p></section>`
      )
      .join("");

    const blockers = (p.blockers || []).length
      ? `<section class="drawer-section"><h3>Blockers</h3><ul>${p.blockers
          .map((b) => `<li style="grid-template-columns:1fr"><span>${escapeHtml(b)}</span></li>`)
          .join("")}</ul></section>`
      : "";

    els.drawerBody.innerHTML = `
      ${listSection("Completed", p.completed_builds)}
      ${listSection("Outstanding", p.outstanding_builds)}
      ${blockers}
      ${detailHtml}
      <section class="drawer-section drawer-links"><h3>Links</h3>${links.join("") || "<p>No links configured.</p>"}</section>
      <section class="drawer-section"><h3>Target launch</h3><p class="mono">${escapeHtml(p.launch_at)}</p></section>
    `;

    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    tick();
  }

  function closeDrawer() {
    state.selectedId = null;
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
  }

  function nearestPlatform(nowMs) {
    let best = null;
    for (const p of state.platforms) {
      const launchMs = parseLaunch(p.launch_at);
      if (launchMs == null) continue;
      const parts = remainingParts(launchMs, nowMs);
      if (!best || parts.totalMs < best.parts.totalMs) {
        best = { platform: p, parts, launchMs };
      }
    }
    return best;
  }

  function tick() {
    const now = new Date();
    const nowMs = now.getTime();
    els.nowClock.textContent = formatNow(now);

    for (const p of state.platforms) {
      const launchMs = parseLaunch(p.launch_at);
      const parts = launchMs == null ? { launched: false, d: 0, h: 0, m: 0, s: 0 } : remainingParts(launchMs, nowMs);
      const clock = els.board.querySelector(`[data-clock-for="${p.id}"]`);
      writeClock(clock, parts);
      const tile = els.board.querySelector(`.tile[data-id="${p.id}"]`);
      if (tile) tile.classList.toggle("launched", !!parts.launched);
    }

    const nearest = nearestPlatform(nowMs);
    if (nearest) {
      els.nearestName.textContent = nearest.platform.name;
      if (nearest.parts.launched) {
        els.nearestSub.textContent = "Launch target reached — standing by for next update.";
      } else {
        const outstanding =
          nearest.platform.builds_outstanding ??
          Math.max((nearest.platform.builds_total || 0) - (nearest.platform.builds_completed || 0), 0);
        els.nearestSub.textContent = `${nearest.platform.builds_completed} complete · ${outstanding} outstanding · target ${nearest.platform.launch_at}`;
      }
      writeClock(els.nearestClock, nearest.parts);
    }

    if (state.selectedId) {
      const p = state.platforms.find((x) => x.id === state.selectedId);
      if (p) {
        const launchMs = parseLaunch(p.launch_at);
        const parts = launchMs == null ? { d: 0, h: 0, m: 0, s: 0 } : remainingParts(launchMs, nowMs);
        writeClock(els.drawerClock, parts);
      }
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      els.fleetName.textContent = data.fleet_name || "Platform Launch";
      state.platforms = data.platforms || [];
      els.footerNote.textContent = data.notes || "";
      els.syncStatus.textContent = `ok · ${new Date().toLocaleTimeString()}`;
      renderBoard();
      if (state.selectedId) openDrawer(state.selectedId);
      tick();
    } catch (err) {
      els.syncStatus.textContent = `err · ${err.message}`;
    }
  }

  els.drawerBackdrop.addEventListener("click", closeDrawer);
  els.drawerClose.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  refresh();
  state.tickTimer = setInterval(tick, 250);
  state.refreshTimer = setInterval(refresh, REFRESH_MS);
})();
