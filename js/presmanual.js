// ===== Presentation Calc: type Teacher scores and comments in by hand =====
// Adds an "Enter by hand" button to every Teacher data set on the QR Forms tab. It opens a window with one
// row per group (a box for each active Teacher rubric plus a comment) and a box for a comment to everyone.
// What you type is stored in the data set under the respondent "manual:<name>", next to any QR answers;
// Get Responses keeps it. Load AFTER app.js.
(function () {
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const PREFIX = "manual:";

  function openWindow(tool, project, set, onSaved) {
    const columns = ScoringModule.presentationColumns(tool.id, project.id).filter((c) => c.kind === "teacher");
    const groups = ScoringModule.presentationGroups(tool.id, project.id);
    if (!columns.length) { alert('There are no Active Teacher Rubrics yet. Open "Rubrics" and activate at least one.'); return; }
    if (!groups.length) { alert("There are no groups yet."); return; }

    const root = mk("div"); root.id = "pres-manual-modal";
    root.style.cssText = "position:fixed;inset:0;z-index:20050;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;";
    const box = mk("div");
    box.style.cssText = "background:var(--card,#fff);color:var(--ink,#222);border:1px solid var(--line,#ccc);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.45);width:min(960px,96vw);max-height:90vh;overflow:auto;padding:18px 20px;";
    root.appendChild(box);
    const close = () => { root.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);

    const head = mk("div"); head.style.cssText = "display:flex;justify-content:space-between;gap:12px;align-items:flex-start;";
    const title = mk("h3", "", `Enter Teacher scores by hand — ${set.name}`); title.style.margin = "0 0 6px";
    head.append(title, Object.assign(mk("button", "btn btn-ghost btn-small", "✕ Close"), { type: "button", onclick: close }));
    box.appendChild(head);
    box.appendChild(mk("p", "hint", "One row per group. Leave a box empty to skip it. Scores run from 0 to the rubric's points. Typing the same name again later edits what you entered before; use a different name for another teacher."));

    // who
    const who = mk("input"); who.type = "text"; who.value = "Teacher"; who.style.maxWidth = "220px";
    const whoRow = mk("div", "mapping-row"); whoRow.append(mk("label", "", "Entered by"), who);
    box.appendChild(whoRow);

    const state = { scores: {}, comments: {}, global: "" };
    const load = () => {
      const key = PREFIX + (who.value.trim() || "Teacher");
      state.scores = {}; state.comments = {}; state.global = "";
      (set.scores || []).forEach(([k, g, e, v]) => { if (k === key) state.scores[`${g}|${e}`] = String(v); });
      (set.comments || []).forEach(([k, g, t]) => { if (k === key) { if (g === 0) state.global = t; else state.comments[g] = t; } });
    };

    const holder = mk("div");
    box.appendChild(holder);
    const draw = () => {
      load();
      holder.innerHTML = "";
      const table = mk("table", "roster-table"); table.style.width = "100%";
      const hr = mk("tr"); hr.appendChild(mk("th", "", "Group"));
      columns.forEach((c) => hr.appendChild(mk("th", "", `${c.text} (/${c.points})`)));
      hr.appendChild(mk("th", "", "Comment"));
      const th = mk("thead"); th.appendChild(hr); table.appendChild(th);
      const tb = mk("tbody"); table.appendChild(tb);
      groups.forEach((g) => {
        const tr = mk("tr");
        const members = project.roster.filter((e) => e.group === g).map((e) => e.name || "(unnamed)").join(", ");
        const gtd = mk("td", "", `Group ${g}`); if (members) gtd.appendChild(Object.assign(mk("div", "hint"), { textContent: members }));
        tr.appendChild(gtd);
        columns.forEach((c) => {
          const td = mk("td"); const inp = mk("input"); inp.type = "text"; inp.inputMode = "decimal"; inp.className = "scoring-score-input"; inp.placeholder = `/${c.points}`;
          inp.value = state.scores[`${g}|${c.entryId}`] || "";
          inp.addEventListener("input", () => { state.scores[`${g}|${c.entryId}`] = inp.value; });
          td.appendChild(inp); tr.appendChild(td);
        });
        const ctd = mk("td"); const ta = mk("textarea"); ta.rows = 2; ta.style.cssText = "width:100%;min-width:180px;font:inherit;";
        ta.value = state.comments[g] || ""; ta.addEventListener("input", () => { state.comments[g] = ta.value; });
        ctd.appendChild(ta); tr.appendChild(ctd);
        tb.appendChild(tr);
      });
      holder.appendChild(table);
      const gl = mk("div", "mapping-row"); gl.appendChild(mk("label", "", "Comment to everyone"));
      const gta = mk("textarea"); gta.rows = 2; gta.style.cssText = "width:100%;font:inherit;"; gta.value = state.global;
      gta.addEventListener("input", () => { state.global = gta.value; });
      gl.appendChild(gta); holder.appendChild(gl);
    };
    who.addEventListener("change", draw);
    draw();

    const msg = mk("p", "result");
    const bar = mk("div", "panel-toolbar-buttons"); bar.style.marginTop = "10px";
    bar.appendChild(Object.assign(mk("button", "btn btn-primary", "Save"), { type: "button", onclick: () => {
      const key = PREFIX + (who.value.trim() || "Teacher");
      const newScores = []; const newComments = []; let clamped = 0, bad = [];
      groups.forEach((g) => {
        columns.forEach((c) => {
          const raw = String(state.scores[`${g}|${c.entryId}`] ?? "").trim();
          if (raw === "") return;
          let v = Number(raw);
          if (Number.isNaN(v)) { bad.push(`Group ${g} ${c.text}`); return; }
          if (v < 0) { v = 0; clamped++; }
          if (c.points > 0 && v > c.points) { v = c.points; clamped++; }
          newScores.push([key, g, c.entryId, v]);
        });
        const t = String(state.comments[g] || "").trim();
        if (t) newComments.push([key, g, t]);
      });
      if (bad.length) { msg.textContent = `Not a number: ${bad.slice(0, 4).join("; ")}. Fix those boxes and save again.`; return; }
      if (String(state.global || "").trim()) newComments.push([key, 0, String(state.global).trim()]);
      set.scores = (set.scores || []).filter((r) => r[0] !== key).concat(newScores);
      set.comments = (set.comments || []).filter((r) => r[0] !== key).concat(newComments);
      const names = new Set([...set.scores, ...set.comments].filter((r) => String(r[0]).startsWith(PREFIX)).map((r) => r[0]));
      const qrCount = Math.max(0, (set.respondentCount || 0) - (set._manualCount || 0));
      set._manualCount = names.size;
      set.respondentCount = qrCount + names.size;
      set.syncedAt = new Date().toISOString();
      close();
      onSaved(clamped);
    } }));
    bar.appendChild(Object.assign(mk("button", "btn btn-ghost", "Cancel"), { type: "button", onclick: close }));
    box.appendChild(bar); box.appendChild(msg);
    document.body.appendChild(root);
  }

  const orig = window.buildPresDataSetTable;
  if (typeof orig !== "function") return;
  window.buildPresDataSetTable = function (tool, project, container, kind, statusEl) {
    const table = orig.apply(this, arguments);
    if (kind !== "teacher") return table;
    const sets = ScoringModule.presentationDataSets(tool.id, project.id, kind);
    const rows = [...table.querySelectorAll("tbody > tr")].filter((tr) => tr.children.length > 1);
    rows.forEach((tr, i) => {
      const set = sets[i]; const cell = tr.lastElementChild;
      if (!set || !cell) return;
      const b = mk("button", "btn btn-ghost btn-small", "Enter by hand"); b.type = "button";
      b.title = "Type Teacher scores and comments in yourself, group by group";
      b.addEventListener("click", () => openWindow(tool, project, set, (clamped) => {
        let extra = "";
        const inUse = ScoringModule.presentationSelectedSet(tool.id, project.id, "teacher");
        if (inUse && inUse.id === set.id) { const r = ScoringModule.presLoadDataSet(tool.id, project.id, "teacher"); extra = ` Loaded into the scoring grid (${r.applied} cell(s)).`; }
        if (typeof presFormStatus !== "undefined") presFormStatus.set(`${tool.id}|${project.id}|teacher`, `Saved your typed-in scores and comments in "${set.name}".${clamped ? ` ${clamped} score(s) were limited to the rubric's range.` : ""}${extra}`);
        if (typeof presFormsSave === "function") presFormsSave();
        renderScoringToolView(tool, container);
      }));
      cell.insertBefore(b, cell.firstChild);
    });
    return table;
  };
})();
