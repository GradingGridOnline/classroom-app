// ===== Roster column widths =====
// Pronunciation column: as wide as the longest pronunciation (but if the longest is more than twice
// as wide as the second-longest, only as wide as the second-longest). Notes column: narrower.
// Load AFTER app.js.
(function () {
  const css = document.createElement("style");
  css.textContent = `.roster-notes-th { width: 20% !important; min-width: 9em !important; }`;
  document.head.appendChild(css);

  const ctx = document.createElement("canvas").getContext("2d");

  function fit() {
    const tbody = document.getElementById("roster-tbody") || document.querySelector("table.roster-table tbody");
    if (!tbody) return;
    const table = tbody.closest("table");
    const th = table.querySelectorAll("thead th")[2]; // Class #, Name, Pronunciation
    if (!th) return;
    const inputs = Array.from(tbody.querySelectorAll("tr > td:nth-child(3) > input"));
    const sample = inputs[0] || table.querySelector("td > input");
    if (sample) ctx.font = getComputedStyle(sample).font;
    const widths = inputs.map((i) => ctx.measureText(i.value || "").width).sort((a, b) => b - a);
    let w = widths[0] || 0;
    if (widths.length > 1 && w > 2 * widths[1]) w = widths[1];
    const px = Math.ceil(Math.max(w, 60) + 28); // text + the box's padding and a little breathing room
    th.style.width = px + "px";
    th.style.minWidth = px + "px";
  }
  window.fitRosterColumns = fit;

  const orig = window.renderRoster;
  if (typeof orig === "function") {
    window.renderRoster = function (...a) {
      const r = orig.apply(this, a);
      fit();
      return r;
    };
  }
  const tb = document.getElementById("roster-tbody");
  if (tb) tb.addEventListener("change", fit);
})();
