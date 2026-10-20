// ===== Progress Tracker: "Give full credit" tool =====
// Load AFTER app.js (and trackercolumns.js). Adds a collapsible tool above the tracker grid:
// pick a column, pick the rows (and sub-rows, if the tracker has them), and it types the
// full-credit score into every selected box in one click. The score defaults to the column's
// maximum and can be changed. Boxes switched off with "Choose boxes", and Test/Quiz columns
// (which take their scores from a test), are skipped.

(function () {
  const state = new Map(); // toolId -> { open, colId, rows:Set|null (null = all), subs:Set|null, value, msg }
  const get = (toolId) => {
    if (!state.has(toolId)) state.set(toolId, { open: false, colId: "", rows: new Set(), subs: null, value: "", msg: "" });
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
    sum.textContent = "Give full credit…";
    sum.style.cssText = "cursor:pointer;font-weight:700;";
    det.appendChild(sum);

    const cols = cfg.columns.filter((c) => c.type !== "test");
    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;gap:10px;margin-top:10px;";
    det.appendChild(body);

    if (cols.length === 0) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Add score columns in this tracker's Settings first.";
      body.appendChild(p);
    } else {
      if (!cols.some((c) => c.id === st.colId)) st.colId = cols[0].id;
      const col = cols.find((c) => c.id === st.colId);

      // column + score
      const line1 = document.createElement("div");
      line1.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;";
      const l1 = document.createElement("label");
      l1.textContent = "Column: ";
      const colSel = document.createElement("select");
      cols.forEach((c) => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.name || "(unnamed column)";
        if (c.id === st.colId) o.selected = true;
        colSel.appendChild(o);
      });
      colSel.addEventListener("change", () => { st.colId = colSel.value; st.value = ""; rerender(); });
      l1.appendChild(colSel);
      const l2 = document.createElement("label");
      l2.textContent = "Full credit score: ";
      const val = document.createElement("input");
      val.type = "text";
      val.inputMode = "decimal";
      val.style.width = "5em";
      val.value = st.value !== "" ? st.value : col.maxPoints > 0 ? String(col.maxPoints) : "";
      val.placeholder = col.maxPoints > 0 ? "" : "e.g. 5";
      val.addEventListener("input", () => { st.value = val.value; });
      l2.appendChild(val);
      line1.append(l1, l2);
      body.appendChild(line1);

      // rows
      const rows = ScoringModule.getTableIdentityRows(tool.id);
      const mkList = (title, items, selected, onChange) => {
        const wrap = document.createElement("div");
        const head = document.createElement("div");
        head.style.cssText = "display:flex;gap:10px;align-items:center;margin-bottom:4px;";
        const t = document.createElement("strong");
        t.textContent = title;
        const all = document.createElement("button");
        all.type = "button";
        all.className = "btn btn-ghost btn-small";
        all.textContent = "Select all";
        all.addEventListener("click", () => { onChange(new Set(items.map((i) => i.key))); rerender(); });
        const none = document.createElement("button");
        none.type = "button";
        none.className = "btn btn-ghost btn-small";
        none.textContent = "Select none";
        none.addEventListener("click", () => { onChange(new Set()); rerender(); });
        head.append(t, all, none);
        wrap.appendChild(head);
        const box = document.createElement("div");
        box.style.cssText = "display:flex;flex-wrap:wrap;gap:4px 16px;max-height:180px;overflow:auto;padding:6px;border:1px solid var(--line);border-radius:4px;";
        items.forEach((i) => {
          const lab = document.createElement("label");
          lab.style.cssText = "display:inline-flex;gap:5px;align-items:center;white-space:nowrap;";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = selected.has(i.key);
          cb.addEventListener("change", () => {
            const next = new Set(selected);
            if (cb.checked) next.add(i.key); else next.delete(i.key);
            onChange(next);
            updateBtn();
          });
          lab.append(cb, document.createTextNode(i.label));
          box.appendChild(lab);
        });
        wrap.appendChild(box);
        return wrap;
      };
      const rowLabel = cfg.firstColumn.mode === "groups" ? "Groups" : "Rows (students)";
      if (rows.length === 0) {
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = "No rows yet.";
        body.appendChild(p);
      } else {
        body.appendChild(mkList(rowLabel, rows, st.rows, (s) => { st.rows = s; }));
      }
      const subs = cfg.subRows.map((s) => ({ key: s.id, label: s.name }));
      if (subs.length > 0) {
        if (st.subs === null) st.subs = new Set(subs.map((s) => s.key));
        body.appendChild(mkList("Sub-rows", subs, st.subs, (s) => { st.subs = s; }));
      }

      // go
      const go = document.createElement("button");
      go.type = "button";
      go.className = "btn btn-primary btn-small";
      const msg = document.createElement("span");
      msg.className = "result";
      msg.textContent = st.msg;
      const updateBtn = () => {
        const n = st.rows.size * (subs.length ? st.subs.size : 1);
        go.textContent = `Assign full credit to ${n} box${n === 1 ? "" : "es"}`;
        go.disabled = n === 0;
      };
      updateBtn();
      go.addEventListener("click", async () => {
        const v = String(val.value).trim();
        if (v === "" || Number.isNaN(Number(v))) { st.msg = "Enter the full-credit score first."; rerender(); return; }
        let done = 0, skipped = 0;
        try {
          st.rows.forEach((lineId) => {
            if (!rows.some((r) => r.key === lineId)) return;
            if (subs.length) {
              st.subs.forEach((subId) => {
                if (!ScoringModule.isTableCellOn(tool.id, lineId, col.id, subId)) { skipped++; return; }
                ScoringModule.setTableValue(tool.id, lineId, col.id, v, subId);
                done++;
              });
            } else {
              if (!ScoringModule.isTableCellOn(tool.id, lineId, col.id)) { skipped++; return; }
              ScoringModule.setTableValue(tool.id, lineId, col.id, v);
              done++;
            }
          });
          st.msg = `Gave ${v} in "${col.name}" to ${done} box${done === 1 ? "" : "es"}` + (skipped ? ` (${skipped} switched-off box${skipped === 1 ? "" : "es"} skipped)` : "") + ".";
        } catch (err) {
          st.msg = `Stopped: ${err.message}`;
        }
        st.open = true;
        await saveScoringThen(rerender);
      });
      const line3 = document.createElement("div");
      line3.style.cssText = "display:flex;gap:12px;align-items:center;flex-wrap:wrap;";
      line3.append(go, msg);
      body.appendChild(line3);
    }

    // sit right under the switch row(s), above the grid
    const modeRows = container.querySelectorAll(".tracker-mode-row");
    const anchor = modeRows[modeRows.length - 1];
    if (anchor) anchor.insertAdjacentElement("afterend", det);
    else container.appendChild(det);
  };
})();
