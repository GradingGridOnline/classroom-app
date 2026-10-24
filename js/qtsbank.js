// ===== QTS Bank: every quiz, test and survey from all active courses, in one place =====
// A tab to the right of Report Card. Sections: one per active course (split by its Test & Quiz Bank tabs),
// plus "Independent" (your own list not tied to any course — the same list as "Shared Tests & Quizzes" in each
// Test & Quiz Bank) and one per group you belong to. Each item has an Actions menu (copy / move to a course, the
// Independent list or a group) and an Export menu (CSV or Excel). Copying carries the questions and settings, not
// students' answers or scores. The same bank also appears inside every course's Test & Quiz Bank (with an
// "Add to this course" button). Load AFTER app.js, quizbank.js and groupshare.js.
//
// INDEX: a small file (qtsindex.json) lists every course's tests/quizzes/surveys (name, type, counts, content
// fingerprint). It is refreshed whenever a course's scoring file is saved, so opening the QTS Bank reads that one
// small file instead of every course's full scoring data (which includes students' answers).
//
// SYNC: copies made through the QTS Bank (or "Copy to QTS Bank" / "Add to this course") share a family id (`fam`).
// An item's Actions → "Sync with copies…" lists the other copies of the same quiz/survey, says which differ, and
// lets you update this one from a copy, or send this one's questions and settings to a copy. Names, students'
// answers, scores and QR links are never overwritten.

(function () {
  const MAX_LIB = 100; // same cap as the Shared Tests & Quizzes list
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const flush = () => { try { if (window.GGOAutosave && GGOAutosave.enabled()) GGOAutosave.flush(); } catch (e) {} };
  const COLLAPSE_KEY = "ggo-qts-closed"; // sections are open unless you collapse them

  // ---------- the tab + panel ----------
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;
  const tabBtn = mk("button", "tab-btn", "QTS Bank"); tabBtn.id = "tab-qts-btn";
  reportBtn.after(tabBtn);
  const panel = mk("div", "tab-panel"); panel.id = "qts-panel"; panel.hidden = true;
  reportPanel.after(panel);


  const css = mk("style");
  css.textContent = `
.qts-root .qts-head { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:0 0 8px; }
.qts-root .qts-head input[type=search] { flex:1; min-width:180px; max-width:340px; padding:6px 8px; }
.qts-root .qts-sec { border:1px solid var(--line); border-radius:8px; margin:10px 0; background:var(--card); }
.qts-root .qts-sec > .qts-sec-head { display:flex; align-items:center; gap:8px; width:100%; padding:8px 12px; border:0; background:var(--hdr-bg,#3d5a40); color:#fff; font:inherit; font-weight:700; text-align:left; cursor:pointer; border-radius:7px 7px 0 0; }
.qts-root .qts-sec.closed > .qts-sec-head { border-radius:7px; }
.qts-root .qts-sec-body { padding:8px 12px 12px; }
.qts-root .qts-sec h4 { margin:10px 0 4px; font-size:.95rem; }
.qts-root .qts-acts { display:flex; gap:4px; flex-wrap:wrap; }
.qts-root table.roster-table td { vertical-align:middle; }
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
  let closedSet = new Set();
  try { closedSet = new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || []); } catch (e) { closedSet = new Set(); }
  const saveOpen = () => { try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...closedSet])); } catch (e) {} };

  // Group lists are cached for two minutes (Refresh, or any change made here, clears the cache).
  const cache = new Map();
  const TTL = 120000;
  async function cached(key, loader) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
    const v = await loader();
    cache.set(key, { t: Date.now(), v });
    return v;
  }
  const invalidate = () => cache.clear();

  // ---------- content fingerprints ----------
  function stable(v) {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    return JSON.stringify(v === undefined ? null : v);
  }
  function fingerprint(str) { // cyrb53
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  /** The part of a quiz that is copied and synced: kind, settings, sections (not name, answers, scores, token). */
  function contentOf(test) {
    if (!test || !test.quiz) return null;
    const t = { quiz: { kind: test.quiz.kind, settings: clone(test.quiz.settings || {}), sections: clone(test.quiz.sections || []) } };
    const q = ScoringModule.normalizeQuiz(t);
    return { kind: q.kind, settings: q.settings, sections: q.sections, max: q.kind === "survey" ? 0 : ScoringModule.quizTotal(q) };
  }
  function hashOf(test) {
    const c = contentOf(test);
    return c ? fingerprint(stable({ k: c.kind, s: c.settings, c: c.sections })) : "";
  }
  const KIND_LABEL = { quiz: "Quiz", answers: "Answer Collection", survey: "Survey", test: "Test (uploaded scores)" };
  /** One-line facts about a full test object (what the index stores and the rows show). */
  function describe(test) {
    const quizOn = !!test.quiz;
    let kind = "test", questions = null, max = Number(test.maxPoints) || 0, answers = Object.keys(test.scores || {}).length, qr = false;
    if (quizOn) {
      const c = contentOf(test);
      kind = c.kind === "answers" ? "answers" : c.kind === "survey" ? "survey" : "quiz";
      questions = c.sections.reduce((a, sec) => a + (sec.questions || []).length, 0);
      max = kind === "survey" ? null : c.max;
      answers = new Set((test.quiz.submissions || []).map((x) => x.sid)).size;
      qr = !!test.quiz.token;
    }
    return { id: test.id, name: test.name || "", kind, questions, max, answers, qr, fam: test.fam || "", hash: quizOn ? hashOf(test) : "", contentAt: test.contentAt || test.createdAt || "" };
  }

  // ---------- the index (qtsindex.json) ----------
  const INDEX_FILE = "qtsindex.json";
  const isTmp = (id) => String(id).startsWith("tmpledit-");
  function describeTools(tools) {
    return (tools || []).filter((t) => t.type === "testbank").map((t) => ({
      toolId: t.id, toolName: t.name,
      tests: ((t.config && Array.isArray(t.config.tests)) ? t.config.tests : []).map(describe),
    }));
  }
  /** Keeps each item's "content last changed" time: unchanged content keeps the old time, changed or new content gets now. */
  function stampTimes(tools, prev) {
    const now = new Date().toISOString();
    const old = new Map();
    ((prev && prev.tools) || []).forEach((t) => t.tests.forEach((x) => old.set(x.id, x)));
    tools.forEach((t) => t.tests.forEach((x) => {
      const o = old.get(x.id);
      if (o) x.contentAt = o.hash === x.hash ? (o.contentAt || x.contentAt) : now;
      else if (prev) x.contentAt = x.contentAt || now;
    }));
    return tools;
  }
  const Index = {
    queue: new Map(), gone: new Set(), timer: null, running: null, rawSave: null, rawLoad: null,
    queueCourse(courseId, tools) { if (isTmp(courseId)) return; this.gone.delete(courseId); this.queue.set(courseId, describeTools(tools)); this.arm(); },
    queueDelete(courseId) { this.queue.delete(courseId); this.gone.add(courseId); this.arm(); },
    arm() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush().catch(() => {}), 1500); },
    async flush() {
      clearTimeout(this.timer);
      if (this.running) { try { await this.running; } catch (e) {} }
      if (!this.queue.size && !this.gone.size) return;
      const q = new Map(this.queue), g = new Set(this.gone);
      this.queue.clear(); this.gone.clear();
      this.running = (async () => {
        const idx = (await storage.loadFile(INDEX_FILE)) || {};
        idx.courses = idx.courses || {};
        q.forEach((tools, id) => { idx.courses[id] = { at: new Date().toISOString(), tools: stampTimes(tools, idx.courses[id]) }; });
        g.forEach((id) => { delete idx.courses[id]; });
        await storage.saveFile(INDEX_FILE, idx);
      })();
      try { await this.running; } finally { this.running = null; }
    },
    async load() { await this.flush().catch(() => {}); const d = await storage.loadFile(INDEX_FILE); return d && d.courses ? d : { courses: {} }; },
  };
  // Every save/delete of a course's scoring file refreshes that course's index entry.
  function hookStorage(P) {
    if (!P || P.__qtsHooked) return;
    P.__qtsHooked = true;
    const rawSave = P.saveFile, rawDelete = P.deleteFile;
    P.saveFile = async function (name, data) {
      const r = await rawSave.apply(this, arguments);
      const m = /^scoring-(.+)\.json$/.exec(String(name));
      if (m && data && Array.isArray(data.tools)) { try { Index.queueCourse(m[1], data.tools); } catch (e) {} }
      return r;
    };
    if (rawDelete) {
      P.deleteFile = async function (name) {
        const r = await rawDelete.apply(this, arguments);
        const m = /^scoring-(.+)\.json$/.exec(String(name));
        if (m) Index.queueDelete(m[1]);
        return r;
      };
    }
  }
  if (typeof SupabaseProvider !== "undefined") hookStorage(SupabaseProvider.prototype);
  window.addEventListener("beforeunload", () => { try { if (Index.queue.size) Index.flush(); } catch (e) {} });

  // ---------- reading everything ----------
  async function loadModel(opts) {
    if (opts && opts.flush && window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush();
    const m = { libs: [], courses: [] };
    const mine = await cached("lib:mine", () => storage.loadFile("sharedtests.json"));
    m.libs.push({ key: "mine", label: "Independent — not in any course", items: (mine && Array.isArray(mine.items) && mine.items) || [], doc: mine || {} });
    if (window.GroupShare) {
      let groups = [];
      try { groups = await cached("groups", () => GroupShare.myGroups(true)); } catch (e) { groups = []; }
      for (const g of groups || []) {
        try {
          const d = await cached(`lib:${g.id}`, () => GroupShare.loadDoc(g.id, "tests"));
          m.libs.push({ key: g.id, label: `Group: ${g.name}`, items: (d && Array.isArray(d.items) && d.items) || [], doc: d || {} });
        } catch (e) { m.libs.push({ key: g.id, label: `Group: ${g.name}`, items: [], doc: {}, error: e.message }); }
      }
    }
    // Courses come from the small index; a course missing from it (or all of them after "Rebuild") is read once.
    const idx = opts && opts.rebuild ? { courses: {} } : await Index.load();
    let changedIdx = !!(opts && opts.rebuild);
    for (const c of CoursesModule.activeCourses()) {
      let tools;
      if (ScoringModule.currentCourseId === c.id) {
        tools = stampTimes(describeTools(ScoringModule.tools), idx.courses[c.id]); // the open course is always read live
      } else if (idx.courses[c.id]) {
        tools = idx.courses[c.id].tools;
      } else {
        let data = null;
        try { data = await storage.loadFile(`scoring-${c.id}.json`); } catch (e) { data = null; }
        tools = describeTools((data && data.tools) || []);
        idx.courses[c.id] = { at: new Date().toISOString(), tools };
        changedIdx = true;
      }
      m.courses.push({ id: c.id, name: c.name, tools: tools.map((t) => ({ toolId: t.toolId, toolName: t.toolName, tests: t.tests })) });
    }
    if (changedIdx) { try { await storage.saveFile(INDEX_FILE, idx); } catch (e) {} }
    // Families: every copy of the same quiz/survey (same `fam`), wherever it lives.
    m.fams = new Map();
    const add = (fam, mem) => { if (!fam) return; if (!m.fams.has(fam)) m.fams.set(fam, []); m.fams.get(fam).push(mem); };
    m.libs.forEach((l) => l.items.forEach((it) => { if (it.quiz && it.fam) add(it.fam, { kind: "lib", libKey: l.key, id: it.id, label: l.label.replace("Independent — not in any course", "Independent"), d: describe(it) }); }));
    m.courses.forEach((c) => c.tools.forEach((t) => t.tests.forEach((x) => { if (x.fam) add(x.fam, { kind: "course", courseId: c.id, toolId: t.toolId, id: x.id, label: `${c.name} › ${t.toolName}`, d: x }); })));
    return m;
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

  // ---------- finding the full item behind a row ----------
  const live = (courseId) => ScoringModule.currentCourseId === courseId;
  const nowIso = () => new Date().toISOString();
  async function courseFile(courseId) { return await storage.loadFile(`scoring-${courseId}.json`); }
  /** The complete test object (questions, answers…) for a row. Library items are already complete; other courses are read on demand. */
  async function fullOf(ref) {
    if (ref.lib || ref.kind === "lib") {
      const l = (await libLoad(ref.libKey)) || {};
      return (l.items || []).find((x) => x.id === ref.id || x.id === (ref.d && ref.d.id)) || null;
    }
    const id = ref.id || (ref.d && ref.d.id);
    if (live(ref.courseId)) return ScoringModule.findTest(ref.toolId, id);
    const data = await courseFile(ref.courseId);
    const tool = ((data && data.tools) || []).find((t) => t.id === ref.toolId);
    return (tool && tool.config && (tool.config.tests || []).find((x) => x.id === id)) || null;
  }
  /** Writes a change to one course test (live course: in memory + autosave; other course: that file). */
  async function editCourseTest(ref, fn) {
    const id = ref.id || (ref.d && ref.d.id);
    if (live(ref.courseId)) { const t = ScoringModule.findTest(ref.toolId, id); if (!t) throw new Error("That item no longer exists."); const r = fn(t, true); flush(); invalidate(); return r; }
    const data = await courseFile(ref.courseId);
    const tool = ((data && data.tools) || []).find((x) => x.id === ref.toolId);
    const t = tool && tool.config && (tool.config.tests || []).find((x) => x.id === id);
    if (!t) throw new Error("That item no longer exists.");
    const r = fn(t, false);
    await storage.saveFile(`scoring-${ref.courseId}.json`, data);
    invalidate();
    return r;
  }

  // ---------- exports ----------
  function exportLabels(d, isLib) {
    if (d.kind === "test") return isLib ? [] : [["CSV: Scores", "csv"], ["Excel: Scores", "xlsx"]];
    if (!window.QuizExport) return [];
    const stub = { name: "x", quiz: { kind: d.kind === "answers" ? "answers" : d.kind === "survey" ? "survey" : "standard", settings: {}, sections: [], submissions: [] } };
    return window.QuizExport.items(stub, isLib).map((it) => [it.label, null]);
  }
  function uploadedExport(test, fmt) {
    const rows = [["Student", "School ID", "Score", "Max score"]];
    (test.rows || []).forEach((r) => rows.push([r.name || "", r.schoolId || "", r.score === undefined ? "" : r.score, Number(test.maxPoints) || ""]));
    QuizExport.download(`${test.name || "test"} - scores`, rows, fmt);
  }
  function exportMenuItems(src, say) {
    const isLib = !!src.lib;
    return exportLabels(src.d, isLib).map(([label, fmt]) => ({
      label,
      onClick: async () => {
        try {
          say("Preparing export…");
          const test = isLib ? src.test : await fullOf(src);
          if (!test) throw new Error("That item no longer exists.");
          if (!test.quiz) { uploadedExport(test, fmt); say(""); return; }
          const hit = window.QuizExport.items(test, isLib).find((x) => x.label === label);
          if (hit) hit.onClick();
          say("");
        } catch (e) { say(`Couldn't export: ${e.message}`); }
      },
    }));
  }

  // ---------- placing / removing ----------
  async function libLoad(key) { return key === "mine" ? await storage.loadFile("sharedtests.json") : await GroupShare.loadDoc(key, "tests"); }
  async function libSave(key, doc) {
    const out = { items: doc.items || [], sections: doc.sections || [] };
    if (key === "mine") await storage.saveFile("sharedtests.json", out); else await GroupShare.saveDoc(key, "tests", out);
    invalidate();
    const S = window.SharedTestsModule;
    if (S && (S.scope === key || key === "mine")) S.loaded = false; // the Test & Quiz Bank's own Shared list re-reads next time
  }
  async function libAdd(key, item) {
    const d = (await libLoad(key)) || {}; d.items = d.items || [];
    if (d.items.length >= MAX_LIB) throw new Error(`That list is at its limit of ${MAX_LIB}.`);
    item.contentAt = nowIso();
    d.items.push(item); await libSave(key, d);
  }
  async function libRemove(key, id) {
    const d = (await libLoad(key)) || {}; d.items = (d.items || []).filter((x) => x.id !== id); await libSave(key, d);
  }
  /** Gives a quiz/survey a family id (once), so its copies can be found and synced. Returns the full item. */
  async function ensureFam(src) {
    const test = await fullOf(src);
    if (!test) throw new Error("That item no longer exists.");
    if (!test.quiz || test.fam) return test;
    const fam = rid("fam");
    if (src.lib) { const d = (await libLoad(src.libKey)) || {}; const it = (d.items || []).find((x) => x.id === test.id); if (it) { it.fam = fam; await libSave(src.libKey, d); } test.fam = fam; return test; }
    await editCourseTest(src, (t) => { t.fam = fam; });
    test.fam = fam;
    return live(src.courseId) ? test : (await fullOf(src));
  }
  function snapshotOf(src, test) {
    if (src.lib) { const c = clone(test); c.id = rid("shared"); c.createdAt = nowIso(); return c; }
    const snap = window.SharedTestsModule.snapshot(clone(test), src.courseName || "");
    if (test.fam) snap.fam = test.fam;
    return snap;
  }
  function courseTestFrom(snap) {
    const t = { id: rid("test"), name: snap.name, maxPoints: Number(snap.maxPoints) || 0, sourceFile: snap.quiz ? "Quiz editor" : "Shared test", rows: [], scores: {}, unmatched: [], createdAt: nowIso() };
    if (snap.fam) t.fam = snap.fam;
    if (snap.quiz) t.quiz = { ...clone(snap.quiz), token: null, submissions: [] };
    return t;
  }
  async function courseAdd(courseId, toolId, test) {
    if (live(courseId)) {
      let id = toolId;
      if (id === "__new") id = ScoringModule.addTool("testbank").id;
      const cfg = ScoringModule.getTestBankConfig(id);
      if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`That bank is at its limit of ${MAX_TESTS_PER_BANK}.`);
      cfg.tests.push(test); flush(); invalidate(); return;
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
    invalidate();
  }
  async function courseRemove(courseId, toolId, testId) {
    if (live(courseId)) { ScoringModule.removeTest(toolId, testId); flush(); invalidate(); return; }
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
    invalidate();
  }

  // ---------- syncing copies ----------
  const sameSpot = (a, b) => a.kind === b.kind && a.id === b.id && (a.kind === "lib" ? a.libKey === b.libKey : a.courseId === b.courseId && a.toolId === b.toolId);
  const selfOf = (src) => (src.lib ? { kind: "lib", libKey: src.libKey, id: src.d.id } : { kind: "course", courseId: src.courseId, toolId: src.toolId, id: src.d.id });
  function othersOf(model, src) {
    if (!src.d.fam) return [];
    const me = selfOf(src);
    return (model.fams.get(src.d.fam) || []).filter((x) => !sameSpot(x, me));
  }
  /** Replaces a copy's questions and settings. Its name, students' answers, scores and QR link stay as they are. */
  async function applyContent(target, content) {
    if (target.kind === "lib") {
      const d = (await libLoad(target.libKey)) || {};
      const it = (d.items || []).find((x) => x.id === target.id);
      if (!it) throw new Error("That item no longer exists.");
      it.quiz = { kind: content.kind, settings: clone(content.settings), sections: clone(content.sections) };
      it.maxPoints = content.max; it.contentAt = nowIso();
      await libSave(target.libKey, d);
      return;
    }
    const probe = await fullOf(target);
    if (!probe) throw new Error("That item no longer exists.");
    if (probe.quiz && probe.quiz.token) throw new Error("its QR code is open — close it first (Test & Quiz Bank → QR Code → Close QR Code)");
    if (!live(target.courseId) && probe.quiz && (probe.quiz.submissions || []).length) throw new Error("it has students' answers, which need regrading — open that course and update it from its own Test & Quiz Bank");
    await editCourseTest(target, (t, isLive) => {
      t.quiz = { ...(t.quiz || {}), kind: content.kind, settings: clone(content.settings), sections: clone(content.sections) };
      if (!Array.isArray(t.quiz.submissions)) t.quiz.submissions = [];
      t.maxPoints = content.max; t.contentAt = nowIso();
      if (isLive) ScoringModule.regradeQuiz(target.toolId, t.id);
    });
  }
  function syncDialog(src, model) {
    return new Promise((resolve) => {
      const others = othersOf(model, src), me = selfOf(src);
      const ov = mk("div"); ov.id = "qts-overlay";
      const box = mk("div"); box.id = "qts-box"; box.style.width = "min(680px,100%)"; ov.appendChild(box);
      box.appendChild(mk("h3", "", `Sync “${src.d.name}”`));
      box.appendChild(mk("p", "hint", "These are copies of the same quiz/survey. “Update this” takes the other copy's questions and settings. “Send this” overwrites the other copy with this one's. Names, students' answers, scores and QR links are never changed."));
      const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : "unknown");
      const here = mk("p", "hint", `This copy: ${src.lib ? "library" : `${src.courseName}`} · content last changed ${fmt(src.d.contentAt)}`);
      box.appendChild(here);
      const done = (v) => { ov.remove(); resolve(v); };
      if (!others.length) box.appendChild(mk("p", "", "No other copies found."));
      others.forEach((o) => {
        const same = o.d.hash === src.d.hash;
        const row = mk("div"); row.style.cssText = "border:1px solid var(--line);border-radius:6px;padding:8px 10px;margin:8px 0;";
        row.appendChild(mk("div", "", `${o.label} — “${o.d.name}”`));
        const status = mk("div", "hint", same ? "✓ Same questions and settings" : `Different · theirs last changed ${fmt(o.d.contentAt)}`);
        row.appendChild(status);
        const acts = mk("div", "qts-actions"); acts.style.justifyContent = "flex-start";
        const upd = mk("button", "btn btn-ghost btn-small", "Update this from it"); upd.type = "button"; upd.disabled = same;
        const snd = mk("button", "btn btn-ghost btn-small", "Send this to it"); snd.type = "button"; snd.disabled = same;
        const run = (dir) => async () => {
          const fromRef = dir === "update" ? o : me, toRef = dir === "update" ? me : o;
          if (!confirm(dir === "update" ? `Replace this copy's questions and settings with those from “${o.label}”?` : `Replace the questions and settings of “${o.label}” with this copy's?`)) return;
          try {
            status.textContent = "Working…";
            const srcTest = await fullOf(fromRef);
            if (!srcTest) throw new Error("the source item no longer exists");
            await applyContent(toRef, contentOf(srcTest));
            done({ ok: true, msg: dir === "update" ? `Updated “${src.d.name}” from ${o.label}.` : `Sent to ${o.label}.` });
          } catch (e) { status.textContent = `Couldn't do that: ${e.message}`; }
        };
        upd.addEventListener("click", run("update")); snd.addEventListener("click", run("send"));
        acts.append(upd, snd); row.appendChild(acts); box.appendChild(row);
      });
      const bar = mk("div", "qts-actions");
      const close = mk("button", "btn btn-primary", "Close"); close.type = "button"; close.addEventListener("click", () => done(null));
      bar.appendChild(close); box.appendChild(bar);
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) done(null); });
      document.body.appendChild(ov);
    });
  }

  // ---------- the copy / move dialog ----------
  function chooseDestination(src, move, model) {
    return new Promise((resolve) => {
      const ov = mk("div"); ov.id = "qts-overlay";
      const box = mk("div"); box.id = "qts-box"; ov.appendChild(box);
      box.appendChild(mk("h3", "", `${move ? "Move" : "Copy"} “${src.d.name}”`));
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

  // ---------- one view of the bank (used by the tab and inside each Test & Quiz Bank) ----------
  // ctx (optional, inside a Test & Quiz Bank): { toolId, rerender }
  let pendingMsg = "";
  function makeView(host, ctx) {
    ctx = ctx || {};
    let model = null, filter = "", busy = false, statusEl = null;
    const inTool = !!ctx.toolId;
    host.classList.add("qts-root");
    const say = (t) => { if (statusEl) statusEl.textContent = t; };

    async function refresh(msg, force, rebuild) {
      if (busy) return;
      if (force) invalidate();
      busy = true;
      host.textContent = "";
      host.appendChild(mk("p", "hint", "Loading your tests, quizzes and surveys…"));
      try { model = await loadModel({ flush: !inTool, rebuild: !!rebuild }); }
      catch (e) { host.textContent = ""; host.appendChild(mk("p", "hint", `Couldn't load: ${e.message}`)); busy = false; return; }
      busy = false;
      render(msg);
    }
    // after a change: the Test & Quiz Bank redraws itself (so its own list is current); the tab just reloads
    const changed = async (msg) => {
      invalidate();
      try { await Index.flush(); } catch (e) {}
      if (inTool && ctx.rerender) { pendingMsg = msg || ""; ctx.rerender(); } else await refresh(msg);
    };

    async function transfer(src, move) {
      if (move && !src.lib && src.d.qr) { say("Close this quiz's QR code first (Test & Quiz Bank → QR Code → Close QR Code), then move it."); return; }
      const dest = await chooseDestination(src, move, model);
      if (!dest) return;
      try {
        say(`${move ? "Moving" : "Copying"}…`);
        const test = await ensureFam(src); // quizzes/surveys get a family id so their copies can be synced
        if (move && !src.lib && test.quiz && test.quiz.token) { say("Close this quiz's QR code first, then move it."); return; }
        const snap = snapshotOf(src, test);
        if (dest.kind === "lib") await libAdd(dest.id, snap);
        else await courseAdd(dest.id, dest.toolId, courseTestFrom(snap));
        if (move) {
          if (src.lib) await libRemove(src.libKey, src.d.id);
          else await courseRemove(src.courseId, src.toolId, src.d.id);
        }
        await changed(`${move ? "Moved" : "Copied"} “${src.d.name}”.`);
      } catch (e) { say(`Couldn't do that: ${e.message}`); }
    }

    function itemRow(src) {
      const d = src.d;
      const tr = mk("tr");
      tr.appendChild(mk("td", "", d.name || "(untitled)"));
      tr.appendChild(mk("td", "", KIND_LABEL[d.kind] || "Quiz"));
      tr.appendChild(mk("td", "", d.questions == null ? "—" : String(d.questions)));
      tr.appendChild(mk("td", "", d.max == null ? "—" : d.max ? String(d.max) : "—"));
      if (src.lib) {
        tr.appendChild(mk("td", "hint", src.sectionName || "—"));
        tr.appendChild(mk("td", "hint", src.test.sourceCourseName || "—"));
      } else { tr.appendChild(mk("td", "", String(d.answers || 0))); tr.appendChild(mk("td", "", d.qr ? "QR open" : "")); }
      const others = othersOf(model, src);
      const diff = others.filter((x) => x.d.hash !== d.hash).length;
      const syncTd = mk("td", others.length ? "" : "hint");
      syncTd.textContent = !others.length ? "—" : diff ? `⟳ ${others.length} cop${others.length === 1 ? "y" : "ies"}, ${diff} differ${diff === 1 ? "s" : ""}` : `✓ ${others.length} cop${others.length === 1 ? "y" : "ies"}, same`;
      if (diff) syncTd.style.fontWeight = "700";
      tr.appendChild(syncTd);
      const td = mk("td"); const acts = mk("div", "qts-acts");
      const here = inTool && !src.lib && src.courseId === ScoringModule.currentCourseId && src.toolId === ctx.toolId;
      if (inTool && !here) {
        const add = mk("button", "btn btn-primary btn-small", "Add to this course"); add.type = "button";
        add.title = "Copy the questions and settings into this Test & Quiz Bank (this course's students are used)";
        add.addEventListener("click", async () => {
          try {
            say("Adding…");
            const test = await ensureFam(src);
            await courseAdd(ScoringModule.currentCourseId, ctx.toolId, courseTestFrom(snapshotOf(src, test)));
            await changed(`“${d.name}” added to this course.`);
          } catch (e) { say(`Couldn't do that: ${e.message}`); }
        });
        acts.appendChild(add);
      }
      acts.appendChild(menuButton("Actions", () => {
        const items = [];
        if (others.length) items.push({ label: diff ? `Sync with copies… (${diff} differ)` : "Sync with copies…", onClick: async () => { const r = await syncDialog(src, model); if (r && r.ok) await changed(r.msg); } }, "-");
        items.push(
          { label: "Copy to…", onClick: () => transfer(src, false) },
          { label: "Move to…", onClick: () => transfer(src, true) },
        );
        if (src.lib) {
          items.push("-", {
            label: "Rename…", onClick: async () => {
              const v = prompt("New name:", d.name); if (v === null || !v.trim()) return;
              try { const dd = (await libLoad(src.libKey)) || {}; const it = (dd.items || []).find((x) => x.id === d.id); if (it) { it.name = v.trim(); await libSave(src.libKey, dd); } await changed("Renamed."); } catch (e) { say(`Couldn't do that: ${e.message}`); }
            },
          }, {
            label: "Delete", onClick: async () => {
              if (!confirm(`Remove “${d.name}” from this list? Copies already in courses are not affected.`)) return;
              try { await libRemove(src.libKey, d.id); await changed("Removed."); } catch (e) { say(`Couldn't do that: ${e.message}`); }
            },
          });
        }
        return items;
      }));
      const ex = exportMenuItems(src, say);
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
      const isOpen = filter ? true : !closedSet.has(key);
      const sec = mk("div", "qts-sec" + (isOpen ? "" : " closed"));
      const head = mk("button", "qts-sec-head", `${isOpen ? "▾" : "▸"} ${title}  (${count})`); head.type = "button";
      head.addEventListener("click", () => { if (closedSet.has(key)) closedSet.delete(key); else closedSet.add(key); saveOpen(); render(); });
      sec.appendChild(head);
      const body = mk("div", "qts-sec-body"); body.hidden = !isOpen;
      sec.appendChild(body);
      return { sec, body };
    }
    const matches = (t) => !filter || String(t.name || "").toLowerCase().includes(filter);

    function render(msg) {
      host.textContent = "";
      const head = mk("div", "qts-head");
      if (!inTool) head.appendChild(mk("h3", "", "QTS Bank"));
      const search = mk("input"); search.type = "search"; search.placeholder = "Search by name…"; search.value = filter;
      search.addEventListener("input", () => { filter = search.value.trim().toLowerCase(); const pos = search.selectionStart; render(); const s = host.querySelector("input[type=search]"); if (s) { s.focus(); s.setSelectionRange(pos, pos); } });
      const re = mk("button", "btn btn-ghost btn-small", "Refresh"); re.type = "button"; re.addEventListener("click", () => refresh("", true));
      const rb = mk("button", "btn btn-ghost btn-small", "Rebuild index"); rb.type = "button";
      rb.title = "Re-reads every course once. Use it if a list looks out of date (for example after changes made on another device).";
      rb.addEventListener("click", () => { if (confirm("Re-read every course to rebuild the QTS index? This reads all your courses' scoring data once.")) refresh("", true, true); });
      head.append(search, re, rb);
      host.appendChild(head);
      host.appendChild(mk("p", "hint", inTool
        ? "Every quiz, test and survey from all your active courses, plus an Independent list that isn't tied to any course. “Add to this course” copies one into this Test & Quiz Bank (this course's students are used; nobody's answers travel). Actions copies or moves it elsewhere; Export gives CSV or Excel. This is the same bank as the QTS Bank tab."
        : "Every quiz, test and survey from your active courses, plus an Independent list that isn't tied to any course. Use Actions to copy or move one to another course, the Independent list or a group, and Export for CSV or Excel. Copies carry the questions and settings, not students' answers."));
      statusEl = mk("p", "result", msg || ""); host.appendChild(statusEl);
      if (!model) return;

      model.libs.forEach((lib) => {
        const secs = (lib.doc && Array.isArray(lib.doc.sections)) ? lib.doc.sections.filter((x) => x && x.id) : [];
        const nameOf = (it) => { const sc = secs.find((x) => x.id === it.section); return sc ? (sc.name || "") : ""; };
        const order = (it) => { const k = secs.findIndex((x) => x.id === it.section); return k < 0 ? secs.length : k; };
        const items = lib.items.filter(matches).map((it, k) => ({ it, k })).sort((a, b) => order(a.it) - order(b.it) || a.k - b.k).map((x) => x.it);
        if (filter && !items.length) return;
        const { sec, body } = section(`lib:${lib.key}`, lib.label, items.length);
        if (lib.error) body.appendChild(mk("p", "hint", `Couldn't load this list: ${lib.error}`));
        else if (!items.length) body.appendChild(mk("p", "hint", lib.key === "mine"
          ? "Nothing here yet. Use “Copy to QTS Bank” on a test or quiz in a Test & Quiz Bank, or Actions → Copy to… → Independent on any item below."
          : "Nothing shared in this group yet."));
        else { const { tb, body: tbody } = table(["Test / Quiz / Survey", "Type", "Questions", "Max score", "Section", "From course", "Copies", ""]); items.forEach((t) => tbody.appendChild(itemRow({ lib: true, libKey: lib.key, test: t, d: describe(t), sectionName: nameOf(t) }))); body.appendChild(tb); }
        host.appendChild(sec);
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
          const { tb, body: tbody } = table(["Test / Quiz / Survey", "Type", "Questions", "Max score", "Students answered", "QR", "Copies", ""]);
          t.shown.forEach((test) => tbody.appendChild(itemRow({ lib: false, courseId: c.id, courseName: c.name, toolId: t.toolId, d: test })));
          body.appendChild(tb);
        });
        host.appendChild(sec);
      });
    }

    return { refresh, render };
  }

  // ---------- the tab ----------
  const tabView = makeView(panel, null);
  const origShowTab = window.showTab;
  window.showTab = function (tab) {
    origShowTab.apply(this, arguments);
    const on = tab === "qts";
    panel.hidden = !on;
    tabBtn.classList.toggle("tab-btn-active", on);
    if (on) tabView.refresh("", true);
  };
  tabBtn.addEventListener("click", () => window.showTab("qts"));

  // ---------- inside a Test & Quiz Bank ----------
  window.QTSBank = {
    invalidate,
    hookStorage, // exposed for testing
    flushIndex: () => Index.flush(),
    buildSection(tool, container) {
      const { section, body } = makePresSection("QTS Bank — all tests, quizzes & surveys");
      section.classList.add("qz-sec-shared");
      const host = mk("div");
      body.appendChild(host);
      const view = makeView(host, { toolId: tool.id, rerender: () => renderScoringToolView(tool, container) });
      const msg = pendingMsg; pendingMsg = "";
      view.refresh(msg);
      return section;
    },
  };
})();
