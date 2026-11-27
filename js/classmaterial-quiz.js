// ===== Class Material → Quizzes =====
// One list. Every quiz exists once (a Library item) and can be used in any number of courses; each course keeps its own
// students' answers, scores and QR codes. Editing a quiz anywhere changes it in every course that uses it, and answers
// already given are re-graded. A variation is a separate quiz: Duplicate. Built on the engine in qtsbank.js (QTSBank.core).
(function () {
  const CMX = window.ClassMaterial; if (!CMX) return;
  const mk = CMX.mk;
  const core = () => window.QTSBank && QTSBank.core;
  const KINDS = [["standard", "Quiz"], ["answers", "Answer Collection"], ["survey", "Research Survey"], ["formative", "Formative Survey"]];
  const F = { q: "", scope: "course", type: "" };
  let busy = false, note = "";
  const live = () => ScoringModule.currentCourseId;
  async function saveNow() { try { if (window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush(); else await ScoringModule.save(); } catch (e) {} }
  const rebuildTabs = () => { try { if (typeof renderScoringToolTabs === "function") renderScoringToolTabs(); } catch (e) {} };
  function openEditor(toolId, testId) {
    QuizBankUI.open(toolId, testId);
    window.showTab("scoring");
    if (typeof showScoringMode === "function") showScoringMode(toolId);
  }
  /** The open course's Test & Quiz Bank (made if the course has none). */
  function liveTool() {
    let tool = ScoringModule.tools.find((t) => t.type === "testbank");
    if (!tool) { tool = ScoringModule.addTool("testbank"); rebuildTabs(); }
    return tool;
  }
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // ---------- making ----------
  /** A new quiz is made in this course and put in the Library at once, so it can be used anywhere. */
  async function newQuiz(kind, label) {
    const c = core(), name = prompt(`${label} name:`, `${label} ${c.getLib().items.length + 1}`);
    if (name === null || !name.trim()) return "";
    const tool = liveTool(), t = ScoringModule.addQuizTest(tool.id, name.trim(), kind);
    await c.addToLibrary({ courseId: live(), toolId: tool.id, id: t.id });
    await saveNow(); openEditor(tool.id, t.id);
    return "";
  }
  function uploadQuiz(done) {
    QuizSheet.pick(async (p, f) => {
      try {
        const tool = liveTool(), t = ScoringModule.addQuizTest(tool.id, p.name || f.name.replace(/\.[^.]+$/, ""), p.kind);
        Object.assign(t.quiz.settings, p.settings); t.quiz.sections = p.sections;
        ScoringModule.normalizeQuiz(t); ScoringModule.regradeQuiz(tool.id, t.id);
        await core().addToLibrary({ courseId: live(), toolId: tool.id, id: t.id });
        alert(QuizSheet.summary({ ...p, name: t.name })); await saveNow(); openEditor(tool.id, t.id);
      } catch (e) { done(`Couldn't make the quiz: ${e.message}`); }
    });
  }

  // ---------- one quiz's actions ----------
  /** Edits in this course when it uses the quiz (students here are re-graded live); otherwise in the no-students editor. */
  async function editQuiz(item, uses) {
    const here = uses.find((u) => u.courseId === live());
    if (here) { openEditor(here.toolId, here.id); return ""; }
    await core().openTplEditor({ id: item.id });
    return "";
  }
  /** Tick the courses that should use this quiz. Unticking a course removes the quiz (and its answers) from it. */
  async function useInCourses(item, uses, model) {
    const c = core();
    const byCourse = new Map();
    uses.forEach((u) => { if (!byCourse.has(u.courseId)) byCourse.set(u.courseId, []); byCourse.get(u.courseId).push(u); });
    const picked = await c.dialog((box, done) => {
      box.appendChild(mk("h3", "", `Use “${item.name}” in…`));
      box.appendChild(mk("p", "hint", "Each course runs the same quiz with its own students, answers, scores and QR codes. Changes to the questions reach every course ticked here."));
      const boxes = model.courses.map((co) => {
        const l = mk("label", "qts-check"), cb = mk("input"); cb.type = "checkbox"; cb.value = co.id; cb.checked = byCourse.has(co.id);
        const here = byCourse.get(co.id) || [], ans = here.reduce((a, u) => a + (u.d.answers || 0), 0);
        l.append(cb, mk("span", "", `${co.name}${co.id === live() ? " (this course)" : ""}${ans ? ` — ${plural(ans, "student")} answered` : ""}`));
        box.appendChild(l); return cb;
      });
      const acts = mk("div", "qts-actions");
      const no = mk("button", "btn btn-ghost", "Cancel"); no.type = "button"; no.addEventListener("click", () => done(null));
      const go = mk("button", "btn btn-primary", "Save"); go.type = "button";
      go.addEventListener("click", () => done(new Set(boxes.filter((b) => b.checked).map((b) => b.value))));
      acts.append(no, go); box.appendChild(acts);
    });
    if (!picked) return "";
    const add = model.courses.filter((co) => picked.has(co.id) && !byCourse.has(co.id));
    const drop = [...byCourse.entries()].filter(([cid]) => !picked.has(cid));
    const open = drop.filter(([, us]) => us.some((u) => u.d.qr));
    if (open.length) throw new Error(`close the QR code in ${open.map(([cid]) => (model.courses.find((x) => x.id === cid) || {}).name || cid).join(", ")} first`);
    const lost = drop.reduce((a, [, us]) => a + us.reduce((b, u) => b + (u.d.answers || 0), 0), 0);
    if (lost && !confirm(`Remove “${item.name}” from ${plural(drop.length, "course")}?\n\n${plural(lost, "student")}' answers and scores for it will be deleted there. The quiz itself stays in your list.`)) return "";
    await c.libLoad(true);
    const it = c.itemById(item.id); if (!it) throw new Error("That quiz no longer exists.");
    const errs = [];
    for (const co of add) {
      try {
        const toolId = co.id === live() ? liveTool().id : co.tools.length ? co.tools[0].toolId : "__new";
        await c.courseAdd(co.id, toolId, c.useOf(it, it.name));
      } catch (e) { errs.push(`${co.name}: ${e.message}`); }
    }
    for (const [, us] of drop) for (const u of us) { try { await c.courseRemove(u.courseId, u.toolId, u.id); } catch (e) { errs.push(`${u.courseName}: ${e.message}`); } }
    if (add.some((co) => co.id === live()) || drop.some(([cid]) => cid === live())) rebuildTabs();
    const parts = [];
    if (add.length) parts.push(`added to ${plural(add.length, "course")}`);
    if (drop.length) parts.push(`removed from ${plural(drop.length, "course")}`);
    return `${parts.length ? `“${it.name}” ${parts.join(", ")}.` : "No change."}${errs.length ? ` Couldn't change: ${errs.join("; ")}` : ""}`;
  }
  /** A separate quiz with the same questions, used in no course yet. */
  async function duplicate(item) {
    const c = core(), lib = await c.libLoad(true);
    if (lib.items.length >= c.MAX_LIB) throw new Error(`you have reached the limit of ${c.MAX_LIB} quizzes`);
    const src = c.itemById(item.id); if (!src) throw new Error("That quiz no longer exists.");
    const name = prompt("Name for the copy:", `${src.name} (copy)`); if (name === null || !name.trim()) return "";
    lib.items.push(c.newItem(c.itemTest(src), name.trim())); await c.libSave();
    return `“${name.trim()}” made. It's a separate quiz: use “Use in…” to add it to courses.`;
  }
  /** One name everywhere: renames the quiz and its copy in every course. */
  async function rename(item, uses) {
    const c = core(), v = prompt("New name:", item.name); if (v === null || !v.trim()) return "";
    await c.libLoad(true); const it = c.itemById(item.id); if (!it) throw new Error("That quiz no longer exists.");
    it.name = v.trim(); await c.libSave();
    for (const u of uses) { try { await c.editCourseTest(u, (t) => { t.name = it.name; }); } catch (e) {} }
    if (uses.some((u) => u.courseId === live())) rebuildTabs();
    return "Renamed.";
  }
  async function remove(item, uses, model) {
    if (uses.length) {
      const names = [...new Set(uses.map((u) => u.courseName))].join(", ");
      throw new Error(`it's used in ${names}. Untick those courses in “Use in…” first`);
    }
    if (!confirm(`Delete “${item.name}”? No course uses it.`)) return "";
    const c = core(), lib = await c.libLoad(true);
    lib.items = lib.items.filter((x) => x.id !== item.id); await c.libSave();
    return "Deleted.";
  }

  // ---------- drawing ----------
  let statusEl = null, model = null, pendingHost = null;
  const say = (t) => { note = t || ""; if (statusEl) statusEl.textContent = note; };
  const act = (host, fn) => async () => { try { const m = await fn(); if (m) note = m; else if (m === "") return; model = null; await draw(host); } catch (e) { say(`Couldn't do that: ${e.message}`); } };
  const b = (label, fn, cls, title) => { const x = mk("button", cls || "btn btn-ghost btn-small", label); x.type = "button"; if (title) x.title = title; x.addEventListener("click", (e) => { e.stopPropagation(); fn(); }); return x; };

  function toolbar(host, c, shown, total) {
    const bar = mk("div", "panel-toolbar pad-toolbar cmq-bar");
    const ro = mk("div", "pad-readout pad-readout-tron");
    ro.append(mk("span", "count-badge", String(shown)), mk("span", "pad-readout-label", "Quizzes"));
    const main = mk("div", "panel-toolbar-buttons pad-main");
    const create = mk("div", "pad-group"); create.dataset.label = "Create";
    create.appendChild(c.menuButton("+ New", () => KINDS.map(([k, l]) => ({ label: l, onClick: act(host, () => newQuiz(k, l)) }))));
    if (window.QuizSheet) {
      create.appendChild(b("Upload from sheet", () => uploadQuiz((m) => say(m)), null, "Make a new quiz from a filled-in CSV or Excel sheet."));
      create.appendChild(b("Example sheet", () => QuizSheet.example("standard"), "btn btn-ghost btn-small pad-minor", "Downloads an example sheet showing what to type where."));
    }
    const show = mk("div", "pad-group cmq-show"); show.dataset.label = "Show";
    [["course", "This course"], ["all", "All courses"]].forEach(([k, l]) => {
      const x = b(l, () => { F.scope = k; draw(host, true); }, `btn btn-small ${F.scope === k ? "btn-primary" : "btn-ghost"}`);
      x.setAttribute("aria-pressed", String(F.scope === k)); show.appendChild(x);
    });
    const ts = mk("select"); ts.setAttribute("aria-label", "Type");
    [["", "All types"], ["quiz", "Quiz"], ["answers", "Answer Collection"], ["survey", "Research Survey"], ["formative", "Formative Survey"]].forEach(([v, t]) => { const o = mk("option", "", t); o.value = v; ts.appendChild(o); });
    ts.value = F.type; ts.addEventListener("change", () => { F.type = ts.value; draw(host, true); });
    const si = mk("input"); si.type = "search"; si.placeholder = "Search names"; si.value = F.q; si.className = "cmq-search";
    si.addEventListener("input", () => { F.q = si.value; const pos = si.selectionStart; draw(host, true).then(() => { const n = host.querySelector(".cmq-search"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }); });
    show.append(ts, si, b("↻", () => { model = null; draw(host); }, "btn btn-ghost btn-small pad-minor", "Refresh"));
    main.append(create, show);
    bar.append(ro, main);
    if (shown !== total) bar.title = `${shown} of ${total} quizzes shown`;
    return bar;
  }

  async function draw(host, keepModel) {
    const c = core();
    if (!c) { host.textContent = "The quiz engine isn't loaded."; return; }
    if (busy) { pendingHost = host; return; } // drawn into the newest host once the current load finishes
    busy = true; pendingHost = null;
    try {
      if (!keepModel || !model) {
        host.textContent = ""; host.appendChild(mk("p", "hint", "Loading your quizzes…"));
        await c.libEnsure();
        const ad = await c.adoptOrphans(); // quizzes made in a Test & Quiz Bank, or before the one-list change
        model = await c.loadModel({ flush: true });
        const r = await c.syncPass();
        if (r.updated || ad.made || ad.joined) model = await c.loadModel({});
        if (r.updated) note = note || `${plural(r.updated, "course")} brought up to date${r.regraded ? ` (${plural(r.regraded, "student")} re-graded)` : ""}.`;
      }
    } catch (e) { host.textContent = ""; host.appendChild(mk("p", "hint", `Couldn't load: ${e.message}`)); busy = false; return; }
    busy = false;
    if (pendingHost) { host = pendingHost; pendingHost = null; } // the section was re-rendered while loading
    host.textContent = ""; host.classList.add("qts-root");
    const lib = c.getLib(), cid = live(), q = F.q.trim().toLowerCase();
    const rows = model.rows.filter((r) => r.d.kind !== "test");
    const all = lib.items.map((it) => ({ it, uses: rows.filter((r) => r.d.libId === it.id) }));
    const shown = all.filter(({ it, uses }) =>
      (!q || String(it.name).toLowerCase().includes(q)) &&
      (!F.type || c.kindKey(it.kind) === F.type) &&
      (F.scope !== "course" || uses.some((u) => u.courseId === cid)))
      .sort((a, z) => String(a.it.name).localeCompare(String(z.it.name)));

    host.appendChild(toolbar(host, c, shown.length, all.length));
    statusEl = mk("p", "result cmq-note", note); host.appendChild(statusEl); note = "";

    const tb = mk("table", "source-grid qts-grid cmq-grid"), hr = mk("tr");
    ["Name", "Type", "Questions", "Max", "Used in", "Answered", ""].forEach((x) => hr.appendChild(mk("th", "nosort", x)));
    const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
    const body = mk("tbody"); tb.appendChild(body);
    if (!shown.length) {
      const tr = mk("tr"), td = mk("td", "hint", F.scope === "course" && !q && !F.type
        ? (all.length ? "This course doesn't use any quizzes yet. Make one with “+ New”, or show All courses and use “Use in…” on one you already have." : "No quizzes yet. Make one with “+ New”.")
        : "Nothing matches.");
      td.colSpan = 7; tr.appendChild(td); body.appendChild(tr);
    }
    shown.forEach(({ it, uses }) => {
      const tr = mk("tr");
      const isSurvey = it.kind === "survey" || it.kind === "formative";
      tr.appendChild(mk("td", "qts-name", it.name || "(untitled)"));
      tr.appendChild(mk("td", "qts-n", c.KIND_LABEL[c.kindKey(it.kind)]));
      tr.appendChild(mk("td", "qts-n", String(c.qCount(it))));
      tr.appendChild(mk("td", "qts-n", isSurvey ? "—" : String(it.max == null ? "—" : it.max)));
      const usedTd = mk("td", "cmq-used");
      if (!uses.length) usedTd.appendChild(mk("span", "hint", "No course"));
      [...new Map(uses.map((u) => [u.courseId, u])).values()].sort((a, z) => (a.courseId === cid ? -1 : z.courseId === cid ? 1 : a.courseName.localeCompare(z.courseName))).forEach((u) => {
        const waiting = c.isStale(u.d, it);
        const chip = mk("span", `cmq-chip${u.courseId === cid ? " cmq-here" : ""}${waiting ? " qts-stale" : ""}`, u.courseName);
        if (waiting) chip.title = u.d.qr ? "Changes waiting: they apply when this course's QR code closes." : "Updating…";
        usedTd.appendChild(chip);
      });
      tr.appendChild(usedTd);
      const ans = uses.reduce((a, u) => a + (u.d.answers || 0), 0);
      tr.appendChild(mk("td", "qts-n", ans ? String(ans) : "—"));
      const ctl = mk("td", "qts-ctl");
      ctl.appendChild(b("Edit", act(host, () => editQuiz(it, uses)), "btn btn-ghost btn-small", "Edit the questions. Every course using this quiz gets the change; answers already given are re-graded."));
      ctl.appendChild(b("Use in…", act(host, () => useInCourses(it, uses, model)), "btn btn-ghost btn-small", "Choose the courses that use this quiz"));
      ctl.appendChild(b("Duplicate", act(host, () => duplicate(it)), "btn btn-ghost btn-small", "A separate quiz with the same questions (for a variation)"));
      if (window.QRStyles && QRStyles.menuButton) {
        ctl.appendChild(QRStyles.menuButton(() => it.style || null, async (st) => {
          await c.libLoad(true); const x = c.itemById(it.id); if (!x) return;
          x.style = st || undefined; x.hash = c.hashOf(c.itemTest(x)); x.rev += 1; x.updatedAt = new Date().toISOString();
          await c.libSave(); await c.syncPass(x.id); model = null; draw(host);
        }, say, "btn btn-ghost btn-small"));
      }
      const ex = c.exportMenuItems({ courseId: c.LIB, toolId: "", id: it.id, d: { kind: c.kindKey(it.kind) } }, say);
      ctl.appendChild(c.menuButton("More", () => [
        { label: "Rename…", onClick: act(host, () => rename(it, uses)) },
        ...(ex.length ? ["-", ...ex.map((x) => ({ ...x, label: `Export: ${x.label}` }))] : []),
        "-",
        { label: "Delete…", onClick: act(host, () => remove(it, uses, model)) },
      ]));
      tr.appendChild(ctl);
      body.appendChild(tr);
    });
    const w = mk("div", "qts-wrap"); w.appendChild(tb); host.appendChild(w);
  }

  CMX.quizLibrary = (host) => { host.classList.add("qts-root"); model = null; draw(host); };
  const css = mk("style");
  css.textContent = `
.cm-sections { margin-bottom:12px; }
.cmq-bar .cmq-search { min-width:150px; max-width:220px; padding:4px 8px; }
.cmq-bar select { padding:3px 6px; }
.cmq-note:empty { display:none; }
table.cmq-grid td.cmq-used { white-space:normal; }
.cmq-chip { display:inline-block; font-size:.78rem; padding:1px 8px; margin:2px 4px 2px 0; border:1px solid var(--line); border-radius:10px; white-space:nowrap; }
.cmq-chip.cmq-here { border-color:var(--green); font-weight:700; }
[data-theme="tron-legacy"] .cmq-chip { border-radius:0; border-color:rgba(0,217,255,.35); color:#9fd8e3; font-family:"Share Tech Mono", ui-monospace, monospace; }
[data-theme="tron-legacy"] .cmq-chip.cmq-here { border-color:var(--tron-cyan); color:#fff; box-shadow:inset 0 0 8px rgba(0,217,255,.35); }
`;
  document.head.appendChild(css);
})();
