// ===== Progress Tracker columns as Main Scores sources =====
// Load AFTER app.js. Adds:
//  1. A switch above each Progress Tracker: Main Scores takes its "Total Score" (the default,
//     exactly as before) or its individual "Columns".
//  2. With the switch on Columns, each item's Sources panel gets a drop-down under that tracker
//     to choose ONE column. Only that column's score is used (not the sum of all columns).
//     In "max" scoring the column's score is scaled by the column's own maximum.

(function () {
  // ----- data -----
  Object.assign(ScoringModule, {
    getTableSourceMode(toolId) {
      const cfg = this.getTableConfig(toolId);
      return cfg && cfg.sourceMode === "columns" ? "columns" : "total";
    },
    setTableSourceMode(toolId, mode) {
      const cfg = this.getTableConfig(toolId);
      if (cfg) cfg.sourceMode = mode === "columns" ? "columns" : "total";
    },
    setItemColumnSelection(itemId, toolId, columnId) {
      const sources = this.getItemScoreSources(itemId);
      if (!sources.columnSelections || typeof sources.columnSelections !== "object") sources.columnSelections = {};
      if (columnId) sources.columnSelections[toolId] = columnId;
      else delete sources.columnSelections[toolId];
    },
    /** One student's (or group's) score in one tracker column, or null. */
    trackerColumnScore(tool, studentId, columnId) {
      const cfg = this.getTableConfig(tool.id);
      const column = cfg && cfg.columns.find((c) => c.id === columnId);
      const rowKey = column ? this._trackerRowKey(tool, studentId) : null;
      if (!column || rowKey === null) return null;
      return this.tableCellNumber(tool.id, rowKey, column);
    },
  });

  // Replace a tracker's Total-Score source with the chosen column's score when the tracker is on "Columns".
  const origBreakdown = ScoringModule.itemSourceBreakdown;
  ScoringModule.itemSourceBreakdown = function (studentId, item) {
    const result = origBreakdown.apply(this, arguments);
    const cfgSrc = this.getItemScoreSources(item.id);
    Object.entries(cfgSrc.toolWeights || {}).forEach(([toolId, weight]) => {
      if (!(weight > 0)) return;
      const tool = this.findTool(toolId);
      if (!tool || tool.type !== "table" || this.getTableSourceMode(toolId) !== "columns") return;
      result.sources = result.sources.filter((s) => s.key !== toolId); // drop the Total Score version
      const columnId = (cfgSrc.columnSelections || {})[toolId];
      if (!columnId) return;
      const value = this.trackerColumnScore(tool, studentId, columnId);
      if (value === null) return;
      const cfg = this.getTableConfig(toolId);
      const column = cfg.columns.find((c) => c.id === columnId);
      const rowKey = this._trackerRowKey(tool, studentId);
      const colMax = cfg.mode === "max" ? this.tableColumnMax(toolId, column, rowKey) : 0;
      const points = this._scaleToItem(value, { mode: cfg.mode === "max" ? "max" : "raw", maxPoints: colMax }, item);
      if (points === null) return;
      result.sources.push({ key: toolId, label: `${tool.name} — ${column.name}`, weight, points, contribution: (points * weight) / 100 });
    });
    return result;
  };

  // ----- switch above the Progress Tracker -----
  const origTable = SCORING_TOOL_RENDERERS.table;
  SCORING_TOOL_RENDERERS.table = function (tool, container) {
    origTable(tool, container);
    const mode = ScoringModule.getTableSourceMode(tool.id);
    const row = document.createElement("div");
    row.className = "tracker-mode-row";
    const label = document.createElement("label");
    label.className = "tracker-switch";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = mode === "columns";
    const track = document.createElement("span");
    track.className = "tracker-switch-track";
    const text = document.createElement("span");
    text.className = "tracker-switch-text";
    text.textContent = mode === "columns" ? "Main Scores takes: Columns" : "Main Scores takes: Total Score";
    label.append(box, track, text);
    box.addEventListener("change", async () => {
      ScoringModule.setTableSourceMode(tool.id, box.checked ? "columns" : "total");
      if (typeof saveScoringThen === "function") await saveScoringThen(() => {});
      renderScoringToolView(tool, container);
      if (typeof renderScoring === "function") renderScoring();
    });
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent =
      mode === "columns"
        ? "In Main Scores → an item's Sources, choose which column this tracker supplies; only that column's score is used."
        : "Main Scores uses each row's Total Score. Switch to Columns to pick a single column as a source instead.";
    row.append(label, hint);
    const first = container.querySelector(".tracker-mode-row");
    if (first) container.insertBefore(row, first);
    else container.appendChild(row);
  };

  // ----- drop-down in an item's Sources panel -----
  const origPanel = window.buildItemScoreSourcesPanel;
  window.buildItemScoreSourcesPanel = function (item) {
    const panel = origPanel.apply(this, arguments);
    const sources = ScoringModule.getItemScoreSources(item.id);
    const body = panel.querySelector("table.source-grid tbody");
    if (!body) return panel;
    ScoringModule.tools.forEach((tool) => {
      if (tool.type !== "table" || ScoringModule.getTableSourceMode(tool.id) !== "columns") return;
      const rowEl = Array.from(body.children).find((tr) => {
        const n = tr.querySelector(".source-grid-name");
        return n && n.textContent === tool.name;
      });
      if (!rowEl) return;
      const cfg = ScoringModule.getTableConfig(tool.id);
      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.marginBottom = "6px";
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "— choose a column —";
      select.appendChild(blank);
      cfg.columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col.id;
        opt.textContent = col.name || "(unnamed column)";
        if ((sources.columnSelections || {})[tool.id] === col.id) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", async () => {
        ScoringModule.setItemColumnSelection(item.id, tool.id, select.value);
        await saveScoringThen(renderScoring);
      });
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 2;
      td.className = "source-grid-wide";
      td.appendChild(select);
      tr.appendChild(td);
      rowEl.insertAdjacentElement("afterend", tr);
    });
    return panel;
  };
})();
