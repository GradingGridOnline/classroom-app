// ===== Journal module (screen) =====
// Tab "Journal" (after Report Card). Layout follows the module convention: Main button top-left, Save top-right,
// the entries, then collapsible Sections: Counts & Timeline, Search & Report, and Journal Settings (last).
// Load AFTER app.js and layout.js.
(function () {
  const J = JournalModule;
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const btn = (label, cls, fn) => { const b = mk("button", cls || "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", fn); return b; };
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;

  const tabBtn = mk("button", "tab-btn", "Journal"); tabBtn.id = "tab-journal-btn";
  reportBtn.after(tabBtn);
  const panel = mk("div", "tab-panel"); panel.id = "journal-panel"; panel.hidden = true;
  reportPanel.after(panel);

  const css = mk("style");
  css.textContent = `
#journal-panel .jr-form { border:1px solid var(--line,#ccc); border-radius:8px; padding:10px; margin:0 0 12px; display:grid; gap:8px; }
#journal-panel .jr-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
#journal-panel textarea { width:100%; min-height:90px; font:inherit; padding:6px; box-sizing:border-box; }
#journal-panel .jr-chip { display:inline-block; border:1px solid var(--line,#ccc); border-radius:999px; padding:1px 9px; margin:2px 3px 2px 0; font-size:.8rem; cursor:pointer; background:transparent; color:inherit; }
#journal-panel .jr-chip.on { background:var(--green,#3d5a40); color:#fff; border-color:transparent; }
#journal-panel .jr-chip.static { cursor:default; }
#journal-panel .jr-entry { border:1px solid var(--line,#ccc); border-radius:8px; padding:8px 10px; margin:0 0 8px; }
#journal-panel .jr-entry .jr-meta { font-size:.82rem; opacity:.85; }
#journal-panel .jr-entry .jr-text { white-space:pre-wrap; margin:4px 0; display:-webkit-box; -webkit-line-clamp:3; line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
#journal-panel .jr-entry .jr-text.full { display:block; }
#journal-panel .jr-entry .jr-subject { font-weight:700; font-size:1rem; }
#journal-panel .jr-entry details summary { cursor:pointer; font-size:.85rem; }
#journal-panel .jr-chip.tagbtn { cursor:pointer; }
#journal-panel .jr-bar.click { cursor:pointer; }
#journal-panel .jr-filterbar { margin:0 0 8px; }
#journal-panel .jr-snap { font-size:.8rem; opacity:.8; border-top:1px dashed var(--line,#ccc); margin-top:4px; padding-top:3px; }
#journal-panel .jr-pick { position:relative; }
#journal-panel .jr-pick-list { max-height:220px; overflow:auto; border:1px solid var(--line,#ccc); border-radius:6px; padding:4px 8px; margin-top:4px; }
#journal-panel .jr-pick-list label { display:block; font-size:.88rem; }
#journal-panel .jr-bar { display:flex; align-items:center; gap:6px; font-size:.85rem; margin:2px 0; }
#journal-panel .jr-bar i { display:inline-block; height:12px; background:var(--green,#3d5a40); border-radius:3px; min-width:2px; }
#journal-panel .jr-two { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
#journal-panel table.jr-table { border-collapse:collapse; font-size:.85rem; width:100%; }
#journal-panel table.jr-table th, #journal-panel table.jr-table td { border:1px solid var(--line,#ccc); padding:2px 6px; text-align:left; vertical-align:top; }
#journal-panel .jr-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin:0 0 8px; }
#journal-panel .jr-filters label { display:flex; flex-direction:column; font-size:.78rem; gap:1px; }
`;
  document.head.appendChild(css);

  let editingId = null;   // entry being edited
  let creating = false;   // new-entry form open
  let showAll = false;
  let tagFilter = ""; // clicking a tag shows only the entries with it
  let sel = { from: "", to: "", tag: "", student: "", word: "" };

  const students = () => RosterModule.students.slice().sort((a, b) => (a.classNumber || 0) - (b.classNumber || 0));
  const sName = (id) => { const s = RosterModule.students.find((x) => x.id === id); return s ? `#${s.classNumber || "—"} ${s.name || "(unnamed)"}` : "(removed student)"; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const attOk = () => AttendanceModule.currentCourseId === J.currentCourseId;
  const scoreOk = () => ScoringModule.currentCourseId === J.currentCourseId;

  /** Attendance that day + attendance-so-far + current score, for the entry's students (or the class). */
  function snapParts(e) {
    const out = [];
    const sess = attOk() ? AttendanceModule.sessions.find((s) => s.date && s.date === e.date) : null;
    if (e.students.length) {
      e.students.forEach((id) => {
        if (!RosterModule.students.some((s) => s.id === id)) return;
        const bits = [];
        if (attOk()) {
          const rec = sess ? AttendanceModule.getRecord(id, sess.id) : null;
          bits.push(`that day: ${rec && rec.code ? rec.code + (rec.infraction ? " (" + rec.infraction + ")" : "") : "—"}`);
          const st = AttendanceModule.stats(id);
          bits.push(`attended ${st.attended}, absences ${st.absences}`);
        }
        if (scoreOk()) { const pct = ScoringModule.weightedPercent(id); bits.push(`score now: ${pct === null || pct === undefined ? "—" : Math.round(pct) + "%"}`); }
        out.push({ who: sName(id), text: bits.join(" · ") });
      });
    } else if (sess) {
      const n = {};
      RosterModule.students.forEach((s) => { const c = AttendanceModule.getRecord(s.id, sess.id).code; if (c) n[c] = (n[c] || 0) + 1; });
      const t = Object.entries(n).map(([c, k]) => `${c} ${k}`).join(", ");
      if (t) out.push({ who: "Class", text: `attendance that day: ${t}` });
    }
    return out;
  }

  // ---------- the entry form ----------
  function buildForm(entry) {
    const f = mk("div", "jr-form");
    const st = { date: entry ? entry.date : today(), subject: entry ? entry.subject || "" : "", students: new Set(entry ? entry.students : []), tags: new Set(entry ? entry.tags : []) };
    const row = mk("div", "jr-row");
    const date = mk("input"); date.type = "date"; date.value = st.date; date.addEventListener("input", () => { st.date = date.value; });
    const dl = mk("label", "", "Date "); dl.appendChild(date); row.appendChild(dl);

    const det = mk("details", "jr-pick"); const sum = mk("summary"); det.appendChild(sum);
    const list = mk("div", "jr-pick-list");
    const upd = () => { sum.textContent = st.students.size ? `Students (${st.students.size}): ${[...st.students].map((id) => sName(id)).join(", ").slice(0, 80)}` : "Students (optional — none = whole class)"; };
    students().forEach((s) => {
      const l = mk("label"); const c = mk("input"); c.type = "checkbox"; c.checked = st.students.has(s.id);
      c.addEventListener("change", () => { c.checked ? st.students.add(s.id) : st.students.delete(s.id); upd(); });
      l.append(c, document.createTextNode(` ${sName(s.id)}`)); list.appendChild(l);
    });
    if (!students().length) list.appendChild(mk("em", "", "No students in this course's roster."));
    det.appendChild(list); upd(); row.appendChild(det);
    f.appendChild(row);

    const subj = mk("input"); subj.placeholder = "Subject"; subj.value = st.subject; subj.style.width = "100%"; subj.addEventListener("input", () => { st.subject = subj.value; });
    f.appendChild(subj);
    const text = mk("textarea"); text.placeholder = "Journal entry…"; text.value = entry ? entry.text : ""; f.appendChild(text);

    const tagBox = mk("div");
    const drawTags = () => {
      tagBox.innerHTML = ""; tagBox.appendChild(document.createTextNode("Tags: "));
      const all = J.cleanTags([...J.allTags(), ...st.tags]);
      all.forEach((t) => { const on = [...st.tags].some((x) => x.toLowerCase() === t.toLowerCase()); tagBox.appendChild(btn(t, "jr-chip" + (on ? " on" : ""), () => { if (on) { st.tags = new Set([...st.tags].filter((x) => x.toLowerCase() !== t.toLowerCase())); } else st.tags.add(t); drawTags(); })); });
      const ni = mk("input"); ni.placeholder = "new tag…"; ni.size = 12;
      const addTag = () => { const v = ni.value.trim(); if (v) { J.cleanTags([v]).forEach((x) => st.tags.add(x)); drawTags(); } };
      ni.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addTag(); } });
      tagBox.append(ni, btn("Add tag", "btn btn-ghost btn-small", addTag));
    };
    drawTags(); f.appendChild(tagBox);

    const acts = mk("div", "jr-row");
    acts.appendChild(btn(entry ? "Save changes" : "Add entry", "btn btn-primary btn-small", () => {
      if (!st.date) { alert("Choose a date."); return; }
      if (!text.value.trim() && !st.subject.trim() && !st.tags.size) { alert("Write something first."); return; }
      const data = { date: st.date, subject: st.subject, text: text.value, students: [...st.students], tags: [...st.tags] };
      if (entry) J.updateEntry(entry.id, data); else J.addEntry(data);
      editingId = null; creating = false; render();
    }));
    acts.appendChild(btn("Cancel", "btn btn-ghost btn-small", () => { editingId = null; creating = false; render(); }));
    f.appendChild(acts);
    return f;
  }

  function entryCard(e) {
    if (editingId === e.id) return buildForm(e);
    const c = mk("div", "jr-entry");
    c.appendChild(mk("div", "jr-subject", e.subject || "(no subject)"));
    c.appendChild(mk("div", "jr-meta", e.date));
    if (e.tags.length) { const t = mk("div"); e.tags.forEach((x) => t.appendChild(btn(x, "jr-chip tagbtn", () => { tagFilter = x; render(); }))); c.appendChild(t); }
    if (e.students.length) {
      const d = mk("details"); d.appendChild(mk("summary", "", `Students (${e.students.length})`));
      d.appendChild(mk("div", "jr-meta", e.students.map(sName).join(", "))); c.appendChild(d);
    } else c.appendChild(mk("div", "jr-meta", "Whole class"));
    const tx = mk("div", "jr-text", e.text); c.appendChild(tx);
    const long = (e.text.match(/\n/g) || []).length >= 3 || e.text.length > 240;
    if (long) { const more = btn("Show full entry", "btn btn-ghost btn-small", () => { const on = tx.classList.toggle("full"); more.textContent = on ? "Show first 3 lines" : "Show full entry"; }); c.appendChild(more); }
    if (J.settings.snapshots) {
      const sn = snapParts(e);
      if (sn.length) { const d = mk("div", "jr-snap"); sn.forEach((p) => d.appendChild(mk("div", "", `${p.who}: ${p.text}`))); c.appendChild(d); }
    }
    const a = mk("div", "jr-row");
    a.appendChild(btn("Edit", "btn btn-ghost btn-small", () => { editingId = e.id; creating = false; render(); }));
    a.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm("Delete this entry?")) { J.removeEntry(e.id); render(); } }));
    c.appendChild(a);
    return c;
  }

  // ---------- sections ----------
  function section(id, title) {
    const s = mk("div", "settings-section"); s.id = `journal-sec-${id}`;
    s.appendChild(mk("h3", "", title));
    return s;
  }
  const bars = (rows, fmt, onClick) => {
    const max = Math.max(1, ...rows.map((r) => r[1])); const box = mk("div");
    rows.forEach(([label, n]) => { const d = mk("div", "jr-bar" + (onClick ? " click" : "")); if (onClick) d.addEventListener("click", () => onClick(label)); const i = mk("i"); i.style.width = `${Math.round((n / max) * 160)}px`; d.append(mk("span", "", fmt ? fmt(label) : label), i, mk("span", "", String(n))); box.appendChild(d); });
    if (!rows.length) box.appendChild(mk("p", "hint", "Nothing yet."));
    return box;
  };

  function countsSection() {
    const s = section("counts", "Entry Counts & Timeline"); const body = mk("div"); s.appendChild(body);
    const E = J.entries;
    const days = new Set(E.map((e) => e.date)).size;
    const mentioned = new Set(E.flatMap((e) => e.students)).size;
    body.appendChild(mk("p", "hint", `${E.length} entr${E.length === 1 ? "y" : "ies"} on ${days} day${days === 1 ? "" : "s"}; ${mentioned} of ${RosterModule.students.length} students mentioned.`));
    const months = {}; E.forEach((e) => { const m = e.date.slice(0, 7); months[m] = (months[m] || 0) + 1; });
    const mrows = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
    const two = mk("div", "jr-two");
    const c1 = mk("div"); c1.appendChild(mk("h4", "", "Timeline (entries per month)")); c1.appendChild(bars(mrows)); two.appendChild(c1);
    const tags = {}; E.forEach((e) => e.tags.forEach((t) => { const k = t.toLowerCase(); tags[k] = tags[k] || { name: t, n: 0 }; tags[k].n++; }));
    const c2 = mk("div"); c2.appendChild(mk("h4", "", "By tag")); c2.appendChild(bars(Object.values(tags).sort((a, b) => b.n - a.n).map((t) => [t.name, t.n]), null, (name) => { tagFilter = name; render(); window.scrollTo({ top: 0 }); })); two.appendChild(c2);
    body.appendChild(two);
    const per = students().map((st) => [sName(st.id), E.filter((e) => e.students.includes(st.id)).length]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], undefined, { numeric: true }));
    body.appendChild(mk("h4", "", "By student (fewest entries first)"));
    body.appendChild(bars(per));
    return s;
  }

  function csvText(rows) {
    return "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  }
  function exportRows(list) {
    const rows = [["Date", "Subject", "Students", "Tags", "Entry", "Attendance / score snapshot"]];
    list.forEach((e) => rows.push([e.date, e.subject || "", e.students.length ? e.students.map(sName).join("; ") : "whole class", e.tags.join("; "), e.text, snapParts(e).map((p) => `${p.who}: ${p.text}`).join(" | ")]));
    return rows;
  }

  function searchSection() {
    const s = section("search", "Search & Report"); const body = mk("div"); s.appendChild(body);
    const f = mk("div", "jr-filters");
    const lab = (t, input) => { const l = mk("label", "", t); l.appendChild(input); f.appendChild(l); return input; };
    const from = lab("From", Object.assign(mk("input"), { type: "date", value: sel.from }));
    const to = lab("To", Object.assign(mk("input"), { type: "date", value: sel.to }));
    const tag = mk("select"); tag.appendChild(Object.assign(mk("option"), { value: "", textContent: "Any" })); J.allTags().forEach((t) => tag.appendChild(Object.assign(mk("option"), { value: t, textContent: t }))); tag.value = sel.tag; lab("Tag", tag);
    const stu = mk("select"); stu.appendChild(Object.assign(mk("option"), { value: "", textContent: "Anyone" })); students().forEach((x) => stu.appendChild(Object.assign(mk("option"), { value: x.id, textContent: sName(x.id) }))); stu.value = sel.student; lab("Student", stu);
    const word = lab("Word", Object.assign(mk("input"), { type: "search", value: sel.word, placeholder: "keyword…" }));
    body.appendChild(f);
    const out = mk("div"); body.appendChild(out);
    const run = () => {
      sel = { from: from.value, to: to.value, tag: tag.value, student: stu.value, word: word.value };
      const list = J.search(sel); out.innerHTML = "";
      const bar = mk("div", "jr-row"); bar.appendChild(mk("span", "hint", `${list.length} matching entr${list.length === 1 ? "y" : "ies"}`));
      bar.appendChild(btn("Export CSV", "btn btn-ghost btn-small", () => {
        const a = mk("a"); a.href = URL.createObjectURL(new Blob([csvText(exportRows(list))], { type: "text/csv;charset=utf-8" }));
        a.download = `journal-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
      }));
      out.appendChild(bar);
      if (!list.length) return;
      const t = mk("table", "jr-table"); const hr = mk("tr"); ["Date", "Subject", "Students", "Tags", "Entry", "Snapshot"].forEach((h) => hr.appendChild(mk("th", "", h)));
      const th = mk("thead"); th.appendChild(hr); t.appendChild(th); const tb = mk("tbody"); t.appendChild(tb);
      list.forEach((e) => { const tr = mk("tr"); [e.date, e.subject || "", e.students.length ? e.students.map(sName).join(", ") : "whole class", e.tags.join(", "), e.text, snapParts(e).map((p) => `${p.who}: ${p.text}`).join("\n")].forEach((v) => { const td = mk("td", "", v); td.style.whiteSpace = "pre-wrap"; tr.appendChild(td); }); tb.appendChild(tr); });
      out.appendChild(t);
    };
    [from, to, tag, stu].forEach((i) => i.addEventListener("change", run));
    word.addEventListener("input", run);
    run();
    return s;
  }

  function settingsSection() {
    const s = section("settings", "Journal Settings"); const body = mk("div"); s.appendChild(body);
    const l = mk("label"); const c = mk("input"); c.type = "checkbox"; c.checked = J.settings.snapshots;
    c.addEventListener("change", () => { J.settings.snapshots = c.checked; render(); });
    l.append(c, document.createTextNode(" Show attendance / score snapshot beside entries")); body.appendChild(l);
    body.appendChild(mk("h4", "", "Quick-pick tags"));
    const box = mk("div");
    J.settings.tags.forEach((t) => { const chip = mk("span", "jr-chip static", t + " "); chip.appendChild(btn("✕", "btn btn-ghost btn-small", () => { J.removeSettingsTag(t); render(); })); box.appendChild(chip); });
    if (!J.settings.tags.length) box.appendChild(mk("p", "hint", "None yet. Tags you type into an entry are also offered next time."));
    body.appendChild(box);
    const ni = mk("input"); ni.placeholder = "add a tag…";
    const add = () => { if (ni.value.trim()) { J.addSettingsTag(ni.value); render(); } };
    ni.addEventListener("keydown", (ev) => { if (ev.key === "Enter") add(); });
    body.append(ni, btn("Add", "btn btn-ghost btn-small", add));
    return s;
  }

  // ---------- the panel ----------
  const status = mk("span", "result");
  function render() {
    panel.innerHTML = "";
    const bar = mk("div", "panel-toolbar");
    const left = mk("div", "panel-toolbar-buttons");
    left.appendChild(btn("+ New Entry", "btn btn-ghost", () => { creating = true; editingId = null; render(); }));
    bar.appendChild(left);
    const right = mk("div", "panel-toolbar-buttons"); right.appendChild(status);
    right.appendChild(btn("Save Journal", "btn btn-primary", async () => {
      try { status.textContent = "Saving…"; await J.save(); status.textContent = "Saved ✓"; } catch (e) { status.textContent = `Couldn't save: ${e.message}`; }
    }));
    bar.appendChild(right); panel.appendChild(bar);

    if (creating) panel.appendChild(buildForm(null));
    if (tagFilter) {
      const fb = mk("div", "jr-filterbar jr-row"); fb.appendChild(mk("span", "", `Showing entries tagged “${tagFilter}”`));
      fb.appendChild(btn("Show all entries", "btn btn-ghost btn-small", () => { tagFilter = ""; render(); })); panel.appendChild(fb);
    }
    const sorted = J.entries.filter((e) => !tagFilter || e.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (!sorted.length && !creating) panel.appendChild(mk("p", "hint", "No entries to show. Click “+ New Entry”."));
    (showAll ? sorted : sorted.slice(0, 20)).forEach((e) => panel.appendChild(entryCard(e)));
    if (sorted.length > 20) panel.appendChild(btn(showAll ? "Show latest 20 only" : `Show all ${sorted.length} entries`, "btn btn-ghost btn-small", () => { showAll = !showAll; render(); }));

    [["journal-counts", countsSection()], ["journal-search", searchSection()], ["journal-settings", settingsSection()]].forEach(([id, sec]) => {
      panel.appendChild(sec);
      if (window.GGOSections) window.GGOSections.add(id, `#${sec.id}`);
    });
  }

  let loadedFor = null;
  async function ensureLoaded() {
    const cid = AttendanceModule.currentCourseId || ScoringModule.currentCourseId;
    if (!cid) { status.textContent = ""; return; }
    if (loadedFor === cid && J.currentCourseId === cid) return;
    try { status.textContent = "Loading…"; await J.load(cid); loadedFor = cid; status.textContent = ""; editingId = null; creating = false; showAll = false; }
    catch (e) { J.entries = []; status.textContent = `Couldn't load journal: ${e.message}`; }
  }

  const origShowTab = window.showTab;
  window.showTab = function (tab) {
    origShowTab.apply(this, arguments);
    const on = tab === "journal";
    panel.hidden = !on;
    tabBtn.classList.toggle("tab-btn-active", on);
    if (on) ensureLoaded().then(render);
  };
  tabBtn.addEventListener("click", () => window.showTab("journal"));
  window.JournalUI = { render, ensureLoaded };
})();
