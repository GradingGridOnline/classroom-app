// ===== Progress Tracker: "Give full credit" tool (in bulk) =====
// Load AFTER app.js (and trackercolumns.js). A collapsible tool above the tracker grid:
//   1. tick the COLUMNS to include (listed left to right),
//   2. tick what to fill: "Rows" and/or each sub-row,
//   3. click the button — every student/group gets full credit in those boxes.
// Full credit = the column's own maximum score. For a column with no maximum set, the optional
// "score for columns without a maximum" box is used. Boxes switched off with "Choose boxes" and
// Test/Quiz columns (which take their scores from a test) are skipped.

(function () {
  const state = new Map(); // toolId -> { open, cols:Set, lines:Set, fallback, msg }
  const get = (toolId) => {
    if (!state.has(toolId)) state.set(toolId, { open: false, cols: new Set(), lines: new Set(), fallback: "", msg: "" });
    return state.get(toolId);
  };

  const prev = SCORING_TOOL_RENDERERS.table;
  SCORING_TOOL_RENDERERS.table = function (tool, container) {
    prev(tool, container);
    const cfg = ScoringModule.getTableConfig(tool.id);
    const st = get(tool.id);
    const rerender = () => renderScoringToolView(tool, container);

    const det = document.createElement("details");
    det.className = "tracker-fullcredit";
    det.open = st.open;
    det.style.cssText = "margin:0 0 14px;border:1px solid var(--line);border-radius:6px;padding:8px 12px;background:var(--card);";
    det.addEventListener("toggle", () => { st.open = det.open; });
    const sum = document.createElement("summary");
    sum.textContent = "Assign Multiple Scores";
    sum.style.cssText = "cursor:pointer;font-weight:700;";
    det.appendChild(sum);

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:12px;margin-top:10px;";
    det.appendChild(body);

    const cols = cfg.columns.filter((c) => c.type !== "test");
    const rowWord = cfg.firstColumn.mode === "groups" ? "group" : "student";
    // Valid selections only (columns / sub-rows may have been removed)
    st.cols = new Set([...st.cols].filter((id) => cols.some((c) => c.id === id)));
    st.lines = new Set([...st.lines].filter((id) => (id === "rows" && !cfg.subRows.length) || cfg.subRows.some((s) => s.id === id)));

    if (cols.length === 0) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Add score columns in this tracker's Settings first.";
      body.appendChild(p);
    } else {
      const section = (title, selectAll) => {
        const wrap = document.createElement("div");
        const head = document.createElement("div");
        head.style.cssText = "display:flex;gap:10px;align-items:center;margin-bottom:4px;";
        const t = document.createElement("strong");
        t.textContent = title;
        head.appendChild(t);
        if (selectAll) head.append(selectAll.all, selectAll.none);
        wrap.appendChild(head);
        return wrap;
      };
      const smallBtn = (label, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-ghost btn-small";
        b.textContent = label;
        b.addEventListener("click", fn);
        return b;
      };
      const checkbox = (label, checked, onChange) => {
        const lab = document.createElement("label");
        lab.style.cssText = "display:inline-grid;grid-template-columns:auto max-content;gap:6px;align-items:center;white-space:nowrap;";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.addEventListener("change", () => { onChange(cb.checked); updateBtn(); });
        lab.append(cb, document.createTextNode(label));
        return lab;
      };

      // 1. Columns, left to right
      const colsWrap = section("Columns", {
        all: smallBtn("Select all", () => { st.cols = new Set(cols.map((c) => c.id)); rerender(); }),
        none: smallBtn("Select none", () => { st.cols = new Set(); rerender(); }),
      });
      const colRow = document.createElement("div");
      colRow.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(max-content,auto));gap:6px 24px;justify-content:start;";
      cols.forEach((c) => {
        const label = (c.name || "(unnamed)") + (cfg.mode === "max" && c.maxPoints > 0 ? ` (${c.maxPoints})` : "");
        colRow.appendChild(checkbox(label, st.cols.has(c.id), (on) => { if (on) st.cols.add(c.id); else st.cols.delete(c.id); }));
      });
      colsWrap.appendChild(colRow);
      body.appendChild(colsWrap);

      // 2. Rows, then each sub-row, one under the other
      const linesWrap = section("Fill in", null);
      const list = document.createElement("div");
      list.style.cssText = "display:grid;grid-template-columns:max-content;gap:6px;justify-items:start;";
      if (!cfg.subRows.length) {
        list.appendChild(checkbox("Rows", st.lines.has("rows"), (on) => { if (on) st.lines.add("rows"); else st.lines.delete("rows"); }));
      }
      cfg.subRows.forEach((sub) => {
        list.appendChild(checkbox(sub.name, st.lines.has(sub.id), (on) => { if (on) st.lines.add(sub.id); else st.lines.delete(sub.id); }));
      });
      linesWrap.appendChild(list);
      body.appendChild(linesWrap);

      // 3. Score fallback + go
      const fbLabel = document.createElement("label");
      fbLabel.textContent = "Score for columns without a maximum: ";
      const fb = document.createElement("input");
      fb.type = "text";
      fb.inputMode = "decimal";
      fb.style.width = "5em";
      fb.value = st.fallback;
      fb.placeholder = "e.g. 5";
      fb.addEventListener("input", () => { st.fallback = fb.value; });
      fbLabel.appendChild(fb);
      body.appendChild(fbLabel);

      const go = document.createElement("button");
      go.type = "button";
      go.className = "btn btn-primary btn-small";
      const msg = document.createElement("span");
      msg.className = "result";
      msg.textContent = st.msg;
      const updateBtn = () => {
        const n = st.cols.size * st.lines.size;
        go.disabled = n === 0;
        go.textContent = n === 0 ? "Choose columns and rows" : `Assign scores to every ${rowWord} in ${st.cols.size} column${st.cols.size === 1 ? "" : "s"} × ${st.lines.size} ${cfg.subRows.length ? "sub-row" : "line"}${st.lines.size === 1 ? "" : "s"}`;
      };
      updateBtn();
      go.addEventListener("click", async () => {
        const lines = ScoringModule.getTableIdentityRows(tool.id);
        let done = 0, off = 0;
        const noMax = [];
        try {
          cols.filter((c) => st.cols.has(c.id)).forEach((col) => {
            let score = col.maxPoints > 0 ? String(col.maxPoints) : String(st.fallback).trim();
            if (score === "" || Number.isNaN(Number(score))) { noMax.push(col.name || "(unnamed)"); return; }
            lines.forEach((r) => {
              st.lines.forEach((ln) => {
                const subId = ln === "rows" ? undefined : ln;
                if (!ScoringModule.isTableCellOn(tool.id, r.key, col.id, subId)) { off++; return; }
                ScoringModule.setTableValue(tool.id, r.key, col.id, score, subId);
                done++;
              });
            });
          });
          st.msg = `Filled ${done} box${done === 1 ? "" : "es"}.` +
            (off ? ` ${off} switched-off box${off === 1 ? "" : "es"} skipped.` : "") +
            (noMax.length ? ` No maximum set for: ${noMax.join(", ")} — enter a score above or set the maximum in Settings.` : "");
        } catch (err) {
          st.msg = `Stopped: ${err.message}`;
        }
        st.open = true;
        await saveScoringThen(rerender);
      });
      const line = document.createElement("div");
      line.style.cssText = "display:flex;gap:12px;align-items:center;flex-wrap:wrap;";
      line.append(go, msg);
      body.appendChild(line);
    }

    // Sits right under the instructions, above the grid.
    const intro = container.querySelector(":scope > p.hint");
    if (intro) intro.insertAdjacentElement("afterend", det);
    else container.insertBefore(det, container.firstChild);

    // The Scoring (type / Choose boxes) and Total Score (Total Score / Columns) switches live in the tool's Settings.
    const settings = container.querySelector(":scope > .attendance-settings");
    const editing = typeof scoringToolSettingsEditing !== "undefined" && scoringToolSettingsEditing.get(tool.id);
    container.querySelectorAll(":scope > .tracker-mode-row").forEach((row) => {
      const first = row.querySelector(".tracker-switch-text");
      const title = first && first.textContent === "Total Score" ? "Total Score" : "Scoring";
      if (editing && settings) {
        const block = document.createElement("div");
        block.className = "attendance-settings-block";
        const h = document.createElement("h4");
        h.textContent = title;
        block.append(h, row);
        settings.appendChild(block);
      } else row.remove();
    });
  };
})();
