// ===== QTS Bank: every quiz, test and survey from all active courses, in one place =====
// A tab to the right of Report Card. Sections: one per active course (split by its Test & Quiz Bank tabs),
// plus "Independent" (your own list not tied to any course — the same list as "Shared Tests & Quizzes" in each
// Test & Quiz Bank) and one per group you belong to. Each item has an Actions menu (copy / move to a course, the
// Independent list or a group) and an Export menu (CSV or Excel). Copying carries the questions and settings, not
// students' answers or scores. Load AFTER app.js, quizbank.js and groupshare.js.

(function () {
  const MAX_LIB = 100; // same cap as the Shared Tests & Quizzes list
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const flush = () => { try { if (window.GGOAutosave && GGOAutosave.enabled()) GGOAutosave.flush(); } catch (e) {} };
  const COLLAPSE_KEY = "ggo-qts-open";

  // ---------- the tab + panel ----------
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;
  const tabBtn = mk("button", "tab-btn", "QTS Bank"); tabBtn.id = "tab-qts-btn";
  reportBtn.after(tabBtn);
  const panel = mk("div", "tab-panel"); panel.id = "qts-panel"; panel.hidden = true;
  reportPanel.after(panel);

  const origShowTab = window.showTab;
  window.showTab = function (tab) {
    origShowTab.apply(this, arguments);
    const on = tab === "qts";
    panel.hidden = !on;
    tabBtn.classList.toggle("tab-btn-active", on);
    if (on) refresh();
  };
  tabBtn.addEventListener("click", () => window.showTab("qts"));

  const css = mk("style");
  css.textContent = `
#qts-panel .qts-head { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:0 0 8px; }
#qts-panel .qts-head input[type=search] { flex:1; min-width:180px; max-width:340px; padding:6px 8px; }
#qts-panel .qts-sec { border:1px solid var(--line); border-radius:8px; margin:10px 0; background:var(--card); }
#qts-panel .qts-sec > .qts-sec-head { display:flex; align-items:center; gap:8px; width:100%; padding:8px 12px; border:0; background:var(--hdr-bg,#3d5a40); color:#fff; font:inherit; font-weight:700; text-align:left; cursor:pointer; border-radius:7px 7px 0 0; }
#qts-panel .qts-sec.closed > .qts-sec-head { border-radius:7px; }
#qts-panel .qts-sec-body { padding:8px 12px 12px; }
#qts-panel .qts-sec h4 { margin:10px 0 4px; font-size:.95rem; }
#qts-panel .qts-acts { display:flex; gap:4px; flex-wrap:wrap; }
#qts-panel table.roster-table td { vertical-align:middle; }
.qts-menu { position:fixed; z-index:20010; background:var(--card,#fff); color:var(--ink,#222); border:1px solid var(--line,#ccc); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.25); padding:4px; min-width:210px; max-height:70vh; overflow:auto; }
.qts-menu button { display:block; width:100%; text-align:left; border:0; background:transparent; color:inherit; font:inherit; font-size:.9rem; padding:6px 8px; border-radius:5px; cursor:pointer; }
.qts-menu button:hover { background:color-mix(in srgb, var(--green,#3d5a40) 16%, transparent); }
.qts-menu hr { border:0; border-top:1px solid var(--line,#ccc); margin:4px 0; }
#qts-overlay { position:fixed; inset:0; z-index:20012; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#qts-box { background:var(--card,#fff); color:var(--ink,#222); width:min(520px,100%); border-radius:10px; border:2px solid var(--green,#3d5a40); padding:16px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5); }
#qts-box h3 { margin:0 0 8px; } #qts-box select { width:100%; margin:4px 0 10px; }
#qts-box .qts-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
`;
  document.head.appendChild(css);

  // ---------- data ----------
  let model = null, filter = "", busy = false;
  let openSet = new Set();
  try { openSet = new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || ["lib:mine"]); } catch (e) { openSet = new Set(["lib:mine"]); }
  const saveOpen = () => { try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...openSet])); } catch (e) {} };

  async function loadModel() {
    if (window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush();
    const m = { libs: [], courses: [] };
    const mine = await storage.loadFile("sharedtests.json");
    m.libs.push({ key: "mine", label: "Independent — not in any course", items: (mine && mine.items) || [], doc: mine || {} });
    if (window.GroupShare) {
      const groups = await GroupShare.myGroups(true);
      for (const g of groups) {
        try {
          const d = await GroupShare.loadDoc(g.id, "tests");
          m.libs.push({ key: g.id, label: `Group: ${g.name}`, items: (d && d.items) || [], doc: d || {} });
        } catch (e) { m.libs.push({ key: g.id, label: `Group: ${g.name}`, items: [], doc: {}, error: e.message }); }
      }
    }
    for (const c of CoursesModule.activeCourses()) {
      const live = ScoringModule.currentCourseId === c.id;
      const data = live ? { tools: ScoringModule.tools } : await storage.loadFile(`scoring-${c.id}.json`);
      const tools = ((data && data.tools) || []).filter((t) => t.type === "testbank")
        .map((t) => ({ toolId: t.id, toolName: t.name, tests: (t.config && Array.isArray(t.config.tests)) ? t.config.tests : [] }));
      m.courses.push({ id: c.id, name: c.name, tools });
    }
    return m;
  }

  async function refresh(msg) {
    if (busy) return;
    busy = true;
    panel.textContent = "";
    panel.appendChild(mk("p", "hint", "Loading your tests, quizzes and surveys…"));
    try { model = await loadModel(); } catch (e) { panel.textContent = ""; panel.appendChild(mk("p", "hint", `Couldn't load: ${e.message}`)); busy = false; return; }
    busy = false;
    render(msg);
  }

  // ---------- item info ----------
  function info(test) {
    let quiz = null;
    if (test.quiz) { const t = clone(test); quiz = ScoringModule.normalizeQuiz(t); }
    const kind = quiz ? (quiz.kind === "answers" ? "Answer Collection" : quiz.kind === "survey" ? "Survey" : "Quiz") : "Test (uploaded scores)";
    const questions = quiz ? quiz.sections.reduce((a, s) => a + (s.questions || []).length, 0) : null;
    const max = quiz ? (quiz.kind === "survey" ? null : ScoringModule.quizTotal(quiz)) : Number(test.maxPoints) || 0;
    const answers = quiz ? new Set((quiz.submissions || []).map((s) => s.sid)).size : Object.keys(test.scores || {}).length;
    return { quiz, kind, questions, max, answers, qr: !!(test.quiz && test.quiz.token) };
  }

  // ---------- menus ----------
  let openMenu = null;
  const closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu = null; } };
  document.addEventListener("click", (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);
  function menuButton(label, getItems) {
    const b = mk("button", "btn btn-ghost btn-small", `${label} ▾`); b.type = "button";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu) { closeMenu(); return; }
      const list = mk("div", "qts-menu"); openMenu = list;
      getItems().forEach((it) => {
        if (it === "-") { list.appendChild(mk("hr")); return; }
        const i = mk("button", "", it.label); i.type = "button";
        i.addEventListener("click", (ev) => { ev.stopPropagation(); closeMenu(); it.onClick(); });
        list.appendChild(i);
      });
      document.body.appendChild(list);
      const r = b.getBoundingClientRect();
      const below = r.bottom + 4;
      list.style.top = `${below + list.offsetHeight > window.innerHeight ? Math.max(8, r.top - list.offsetHeight - 4) : below}px`;
      list.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - list.offsetWidth - 8))}px`;
    });
    return b;
  }

  // ---------- exports ----------
  function exportItems(test) {
    if (test.quiz && window.QuizExport) return window.QuizExport.items(test, !test.__hasData);
    return [];
  }
  function uploadedExport(test, fmt) {
    const rows = [["Student", "School ID", "Score", "Max score"]];
    (test.rows || []).forEach((r) => rows.push([r.name || "", r.schoolId || "", r.score === undefined ? "" : r.score, Number(test.maxPoints) || ""]));
    QuizExport.download(`${test.name || "test"} - scores`, rows, fmt);
  }
  function exportMenuItems(test, isLib) {
    if (test.quiz) return window.QuizExport.items(test, isLib);
    if (isLib) return [];
    return [
      { label: "CSV: Scores", onClick: () => uploadedExport(test, "csv") },
      { label: "Excel: Scores", onClick: () => uploadedExport(test, "xlsx") },
    ];
  }

  // ---------- placing / removing ----------
  const libDocOf = (key) => model.libs.find((l) => l.key === key);
  async function libLoad(key) { return key === "mine" ? await storage.loadFile("sharedtests.json") : await GroupShare.loadDoc(key, "tests"); }
  async function libSave(key, doc) {
    const out = { items: doc.items || [], sections: doc.sections || [] };
    if (key === "mine") await storage.saveFile("sharedtests.json", out); else await GroupShare.saveDoc(key, "tests", out);
    const S = window.SharedTestsModule;
    if (S && S.scope === key) S.loaded = false; // the Test & Quiz Bank's Shared list re-reads next time
  }
  async function libAdd(key, item) {
    const d = (await libLoad(key)) || {}; d.items = d.items || [];
    if (d.items.length >= MAX_LIB) throw new Error(`That list is at its limit of ${MAX_LIB}.`);
    d.items.push(item); await libSave(key, d);
  }
  async function libRemove(key, id) {
    const d = (await libLoad(key)) || {}; d.items = (d.items || []).filter((x) => x.id !== id); await libSave(key, d);
  }
  function snapshotOf(src) {
    if (src.lib) { const c = clone(src.test); c.id = rid("shared"); c.createdAt = new Date().toISOString(); return c; }
    return window.SharedTestsModule.snapshot(clone(src.test), src.courseName || "");
  }
  function courseTestFrom(snap) {
    const t = { id: rid("test"), name: snap.name, maxPoints: Number(snap.maxPoints) || 0, sourceFile: snap.quiz ? "Quiz editor" : "Shared test", rows: [], scores: {}, unmatched: [] };
    if (snap.quiz) t.quiz = { ...clone(snap.quiz), token: null, submissions: [] };
    return t;
  }
  async function courseAdd(courseId, toolId, test) {
    if (ScoringModule.currentCourseId === courseId) {
      let id = toolId;
      if (id === "__new") id = ScoringModule.addTool("testbank").id;
      const cfg = ScoringModule.getTestBankConfig(id);
      if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`That bank is at its limit of ${MAX_TESTS_PER_BANK}.`);
      cfg.tests.push(test); flush(); return;
    }
    const data = (await storage.loadFile(`scoring-${courseId}.json`)) || { categories: [], records: {}, weights: { attendance: 0 }, tools: [], presentationMigrated: true };
    data.tools = data.tools || [];
    let tool;
    if (toolId === "__new") {
      if (data.tools.length >= MAX_SCORING_TOOLS) throw new Error(`That course already has ${MAX_SCORING_TOOLS} scoring tabs.`);
      const n = data.tools.filter((t) => t.type === "testbank").length;
      tool = { id: rid("tool"), type: "testbank", name: n === 0 ? "Test & Quiz Bank" : `Test & Quiz Bank ${n + 1}`, config: { tests: [] } };
      data.tools.push(tool);
    } else tool = data.tools.find((t) => t.id === toolId);
    if (!tool) throw new Error("That Test & Quiz Bank no longer exists.");
    if (!tool.config || typeof tool.config !== "object") tool.config = {};
    if (!Array.isArray(tool.config.tests)) tool.config.tests = [];
    if (tool.config.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`That bank is at its limit of ${MAX_TESTS_PER_BANK}.`);
    tool.config.tests.push(test);
    await storage.saveFile(`scoring-${courseId}.json`, data);
  }
  async function courseRemove(courseId, toolId, testId) {
    if (ScoringModule.currentCourseId === courseId) { ScoringModule.removeTest(toolId, testId); flush(); return; }
    const data = await storage.loadFile(`scoring-${courseId}.json`);
    if (!data) return;
    const tool = (data.tools || []).find((t) => t.id === toolId);
    if (tool && tool.config && Array.isArray(tool.config.tests)) tool.config.tests = tool.config.tests.filter((t) => t.id !== testId);
    (data.categories || []).forEach((c) => (c.items || []).forEach((i) => {
      const sel = i.scoreSources && i.scoreSources.testSelections;
      if (sel && sel[toolId] === testId) delete sel[toolId];
    }));
    (data.tools || []).forEach((t) => {
      if (t.type !== "table" || !t.config || !Array.isArray(t.config.columns)) return;
      t.config.columns.forEach((col) => { if (col.testSource && col.testSource.toolId === toolId && col.testSource.testId === testId) col.testSource = { toolId: "", testId: "" }; });
    });
    await storage.saveFile(`scoring-${courseId}.json`, data);
  }

  // ---------- the copy / move dialog ----------
  function chooseDestination(src, move) {
    return new Promise((resolve) => {
      const ov = mk("div"); ov.id = "qts-overlay";
      const box = mk("div"); box.id = "qts-box"; ov.appendChild(box);
      box.appendChild(mk("h3", "", `${move ? "Move" : "Copy"} “${src.test.name}”`));
      box.appendChild(mk("p", "hint", move
        ? "The questions and settings go to the new place; students' answers and scores do NOT travel. The original is then removed."
        : "The questions and settings are copied; students' answers and scores are not."));
      box.appendChild(mk("label", "", move ? "Move to" : "Copy to"));
      const dest = mk("select"); box.appendChild(dest);
      const here = src.lib ? `lib:${src.libKey}` : null;
      model.libs.forEach((l) => { const o = mk("option", "", l.label.replace("Independent — not in any course", "Independent (not in any course)")); o.value = `lib:${l.key}`; if (move && `lib:${l.key}` === here) o.disabled = true; dest.appendChild(o); });
      model.courses.forEach((c) => { const o = mk("option", "", `Course: ${c.name}`); o.value = `course:${c.id}`; dest.appendChild(o); });
      const tabLabel = mk("label", "", "Test & Quiz Bank tab"); const tab = mk("select");
      box.append(tabLabel, tab);
      const syncTabs = () => {
        const isCourse = dest.value.startsWith("course:");
        tabLabel.hidden = tab.hidden = !isCourse;
        tab.textContent = "";
        if (!isCourse) return;
        const c = model.courses.find((x) => x.id === dest.value.slice(7));
        (c ? c.tools : []).forEach((t) => {
          const o = mk("option", "", t.toolName); o.value = t.toolId;
          if (move && !src.lib && c.id === src.courseId && t.toolId === src.toolId) o.disabled = true;
          tab.appendChild(o);
        });
        if (!c || !c.tools.length) { const o = mk("option", "", "(new) Test & Quiz Bank tab"); o.value = "__new"; tab.appendChild(o); }
        const first = Array.from(tab.options).find((o) => !o.disabled); if (first) tab.value = first.value;
      };
      dest.addEventListener("change", syncTabs);
      const first = Array.from(dest.options).find((o) => !o.disabled); if (first) dest.value = first.value;
      syncTabs();
      const acts = mk("div", "qts-actions");
      const done = (v) => { ov.remove(); resolve(v); };
      const cancel = mk("button", "btn btn-ghost", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => done(null));
      const go = mk("button", "btn btn-primary", move ? "Move" : "Copy"); go.type = "button";
      go.addEventListener("click", () => done({ kind: dest.value.startsWith("lib:") ? "lib" : "course", id: dest.value.split(":").slice(1).join(":"), toolId: tab.value }));
      acts.append(cancel, go); box.appendChild(acts);
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) done(null); });
      document.body.appendChild(ov);
    });
  }

  async function transfer(src, move) {
    if (move && !src.lib && src.test.quiz && src.test.quiz.token) { say("Close this quiz's QR code first (Test & Quiz Bank → QR Code → Close QR Code), then move it."); return; }
    const dest = await chooseDestination(src, move);
    if (!dest) return;
    try {
      say(`${move ? "Moving" : "Copying"}…`);
      const snap = snapshotOf(src);
      if (dest.kind === "lib") await libAdd(dest.id, snap);
      else await courseAdd(dest.id, dest.toolId, courseTestFrom(snap));
      if (move) {
        if (src.lib) await libRemove(src.libKey, src.test.id);
        else await courseRemove(src.courseId, src.toolId, src.test.id);
      }
      await refresh(`${move ? "Moved" : "Copied"} “${src.test.name}”.`);
    } catch (e) { say(`Couldn't do that: ${e.message}`); }
  }

  // ---------- rendering ----------
  let statusEl = null;
  function say(t) { if (statusEl) statusEl.textContent = t; }

  function itemRow(src, cols) {
    const t = src.test, i = info(t);
    const tr = mk("tr");
    tr.appendChild(mk("td", "", t.name || "(untitled)"));
    tr.appendChild(mk("td", "", i.kind));
    tr.appendChild(mk("td", "", i.questions == null ? "—" : String(i.questions)));
    tr.appendChild(mk("td", "", i.max == null ? "—" : i.max ? String(i.max) : "—"));
    if (src.lib) tr.appendChild(mk("td", "hint", t.sourceCourseName || "—"));
    else { tr.appendChild(mk("td", "", i.quiz || i.answers ? String(i.answers) : "0")); tr.appendChild(mk("td", "", i.qr ? "QR open" : "")); }
    const td = mk("td"); const acts = mk("div", "qts-acts");
    acts.appendChild(menuButton("Actions", () => {
      const items = [
        { label: "Copy to…", onClick: () => transfer(src, false) },
        { label: "Move to…", onClick: () => transfer(src, true) },
      ];
      if (src.lib) {
        items.push("-", {
          label: "Rename…", onClick: async () => {
            const v = prompt("New name:", t.name); if (v === null || !v.trim()) return;
            try { const d = (await libLoad(src.libKey)) || {}; const it = (d.items || []).find((x) => x.id === t.id); if (it) { it.name = v.trim(); await libSave(src.libKey, d); } await refresh("Renamed."); } catch (e) { say(`Couldn't do that: ${e.message}`); }
          },
        }, {
          label: "Delete", onClick: async () => {
            if (!confirm(`Remove “${t.name}” from this list? Copies already in courses are not affected.`)) return;
            try { await libRemove(src.libKey, t.id); await refresh("Removed."); } catch (e) { say(`Couldn't do that: ${e.message}`); }
          },
        });
      }
      return items;
    }));
    const ex = exportMenuItems(t, !!src.lib);
    if (ex.length) acts.appendChild(menuButton("Export", () => ex));
    td.appendChild(acts); tr.appendChild(td);
    return tr;
  }

  function table(headers) {
    const tb = mk("table", "roster-table"); const hr = mk("tr");
    headers.forEach((x) => hr.appendChild(mk("th", "", x)));
    const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
    const body = mk("tbody"); tb.appendChild(body);
    return { tb, body };
  }
  function section(key, title, count) {
    const f = filter;
    const isOpen = f ? true : openSet.has(key);
    const sec = mk("div", "qts-sec" + (isOpen ? "" : " closed"));
    const head = mk("button", "qts-sec-head", `${isOpen ? "▾" : "▸"} ${title}  (${count})`); head.type = "button";
    head.addEventListener("click", () => { if (openSet.has(key)) openSet.delete(key); else openSet.add(key); saveOpen(); render(); });
    sec.appendChild(head);
    const body = mk("div", "qts-sec-body"); body.hidden = !isOpen;
    sec.appendChild(body);
    return { sec, body };
  }
  const matches = (t) => !filter || String(t.name || "").toLowerCase().includes(filter);

  function render(msg) {
    panel.textContent = "";
    const head = mk("div", "qts-head");
    head.appendChild(mk("h3", "", "QTS Bank"));
    const search = mk("input"); search.type = "search"; search.placeholder = "Search by name…"; search.value = filter;
    search.addEventListener("input", () => { filter = search.value.trim().toLowerCase(); const pos = search.selectionStart; render(); const s = panel.querySelector("input[type=search]"); if (s) { s.focus(); s.setSelectionRange(pos, pos); } });
    const re = mk("button", "btn btn-ghost btn-small", "Refresh"); re.type = "button"; re.addEventListener("click", () => refresh());
    head.append(search, re);
    panel.appendChild(head);
    panel.appendChild(mk("p", "hint", "Every quiz, test and survey from your active courses, plus an Independent list that isn't tied to any course. Use Actions to copy or move one to another course, the Independent list or a group, and Export for CSV or Excel. Copies carry the questions and settings, not students' answers."));
    statusEl = mk("p", "result", msg || ""); panel.appendChild(statusEl);
    if (!model) return;

    model.libs.forEach((lib) => {
      const items = lib.items.filter(matches);
      if (filter && !items.length) return;
      const { sec, body } = section(`lib:${lib.key}`, lib.label, items.length);
      if (lib.error) body.appendChild(mk("p", "hint", `Couldn't load this list: ${lib.error}`));
      else if (!items.length) body.appendChild(mk("p", "hint", lib.key === "mine"
        ? "Nothing here yet. Use “Copy to Shared” in a Test & Quiz Bank, or Actions → Copy to… → Independent on any item below."
        : "Nothing shared in this group yet."));
      else { const { tb, body: tbody } = table(["Test / Quiz / Survey", "Type", "Questions", "Max score", "From course", ""]); items.forEach((t) => tbody.appendChild(itemRow({ lib: true, libKey: lib.key, test: t }))); body.appendChild(tb); }
      panel.appendChild(sec);
    });

    model.courses.forEach((c) => {
      const filtered = c.tools.map((t) => ({ ...t, shown: t.tests.filter(matches) }));
      const total = filtered.reduce((a, t) => a + t.shown.length, 0);
      if (filter && !total) return;
      const { sec, body } = section(`course:${c.id}`, c.name, total);
      if (!c.tools.length) body.appendChild(mk("p", "hint", "This course has no Test & Quiz Bank tab yet."));
      filtered.forEach((t) => {
        body.appendChild(mk("h4", "", `${t.toolName}`));
        if (!t.shown.length) { body.appendChild(mk("p", "hint", filter ? "No matches." : "Empty.")); return; }
        const { tb, body: tbody } = table(["Test / Quiz / Survey", "Type", "Questions", "Max score", "Students answered", "QR", ""]);
        t.shown.forEach((test) => tbody.appendChild(itemRow({ lib: false, courseId: c.id, courseName: c.name, toolId: t.toolId, test })));
        body.appendChild(tb);
      });
      panel.appendChild(sec);
    });
  }
})();
