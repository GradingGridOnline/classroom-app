// ===== QTS Bank: every quiz, test and survey (Qs, Ts, Ss) from all active courses, in one filterable grid =====
// A tab to the right of Report Card, and the same grid inside every course's Test & Quiz Bank. Qs/Ts/Ss live only in
// courses (there is no Independent list). Each item's menu has "Copy to other courses…" (checkbox list). Copies — in
// the same course or others — are siblings in a FAMILY (hidden id `fam` on each item); nobody is "the original".
// "Family Ties" opens a grid under the item listing its siblings, with per-sibling actions.
// Changing questions/settings pushes them to the siblings automatically (names, answers, scores, QR links never
// travel). A sibling that already has students' answers asks first; "no" takes it out of the family (`famLeft`),
// and "Rejoin family…" brings it back (push mine to the others, or change mine to match theirs).
// MASTER TEMPLATES: a section above the grid (stored in sharedtests.json) holds often-used Qs/Ts/Ss that live in no
// course. A copy kept there is a "clone" (no link). A copy sent to a course is a CHILD: the template becomes its
// PARENT and the same family. Parent changes flow to all children (asking first where students have answered);
// a child's changes flow to its sibling children, and the user is asked before the parent is changed.
// INDEX: qtsindex.json lists every course's items (name, type, counts, dates, content fingerprint). It is refreshed
// whenever a course's scoring file is saved, so the grid reads one small file. Load AFTER app.js and quizbank.js.

(function () {
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const flush = () => { try { if (window.GGOAutosave && GGOAutosave.enabled()) GGOAutosave.flush(); } catch (e) {} };
  const nowIso = () => new Date().toISOString();
  const live = (courseId) => ScoringModule.currentCourseId === courseId;
  const TPL = "__tpl__", TPL_FILE = "sharedtests.json", TPL_NAME = "QTS Master Templates", MAX_TPL = 100;
  const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

  // ---------- the tab + panel ----------
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;
  const tabBtn = mk("button", "tab-btn", "QTS Bank"); tabBtn.id = "tab-qts-btn";
  (document.getElementById("tab-journal-btn") || reportBtn).after(tabBtn);
  const panel = mk("div", "tab-panel"); panel.id = "qts-panel"; panel.hidden = true;
  reportPanel.after(panel);

  const css = mk("style");
  css.textContent = `
.qts-root .qts-head { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 6px; }
.qts-root .qts-head input[type=search] { flex:1; min-width:160px; max-width:280px; padding:4px 8px; }
.qts-root .qts-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin:0 0 8px; }
.qts-root .qts-filters label { display:flex; flex-direction:column; font-size:.78rem; gap:1px; }
.qts-root .qts-filters select { padding:2px 4px; font-size:.85rem; }
.qts-root .qts-wrap { overflow-x:auto; }
table.source-grid.qts-grid { font-size:.85rem; min-width:0; }
table.qts-grid th { border:1px solid #000; background:#e6e6e6; color:#000; padding:2px 6px; text-align:left; white-space:nowrap; cursor:pointer; height:24px; font-weight:700; user-select:none; }
table.qts-grid th.nosort { cursor:default; }
table.qts-grid td { padding:0 6px; vertical-align:middle; }
table.qts-grid td.qts-n { text-align:center; white-space:nowrap; }
table.qts-grid td.qts-name { min-width:9em; font-weight:600; }
table.qts-grid .btn { padding:1px 8px; margin:1px 0; font-size:.8rem; }
table.qts-grid tr.qts-me td { background:#fff6c8; }
table.qts-grid td.qts-detail { padding:6px; background:#f4f4f4; }
table.qts-grid .qts-link { cursor:pointer; text-decoration:underline; }
.qts-root h4.qts-h { font-size:1.2rem; margin:28px 0 6px; border-top:1px solid var(--line); padding-top:14px; }
.qts-root h4.qts-h:first-of-type { border-top:0; padding-top:0; margin-top:8px; }
.qts-root .qts-ties-title { font-weight:700; margin:0 0 4px; color:#000; }
.qts-root .qts-ties-hint { font-size:.8rem; margin:0 0 4px; color:#333; }
.qts-menu { position:fixed; z-index:20010; background:var(--card,#fff); color:var(--ink,#222); border:1px solid var(--line,#ccc); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.25); padding:4px; min-width:210px; max-height:70vh; overflow:auto; }
.qts-menu button { display:block; width:100%; text-align:left; border:0; background:transparent; color:inherit; font:inherit; font-size:.9rem; padding:6px 8px; border-radius:5px; cursor:pointer; }
.qts-menu button:hover { background:color-mix(in srgb, var(--green,#3d5a40) 16%, transparent); }
.qts-menu hr { border:0; border-top:1px solid var(--line,#ccc); margin:4px 0; }
#qts-overlay { position:fixed; inset:0; z-index:20012; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#qts-box { background:var(--card,#fff); color:var(--ink,#222); width:min(520px,100%); max-height:90vh; overflow:auto; border-radius:10px; border:2px solid var(--green,#3d5a40); padding:16px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5); }
#qts-box h3 { margin:0 0 8px; } #qts-box select { width:100%; margin:4px 0 10px; }
#qts-box label.qts-check { display:flex; gap:8px; align-items:center; margin:4px 0; }
#qts-box .qts-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; }
.qts-toast { position:fixed; left:50%; bottom:20px; transform:translateX(-50%); z-index:20020; background:#222; color:#fff; padding:8px 14px; border-radius:8px; max-width:90vw; box-shadow:0 6px 20px rgba(0,0,0,.4); }
`;
  document.head.appendChild(css);
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!msg) return;
    if (toastEl) toastEl.remove();
    toastEl = mk("div", "qts-toast", msg); document.body.appendChild(toastEl);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { if (toastEl) toastEl.remove(); toastEl = null; }, 6000);
  }

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
    return { kind: q.kind, settings: q.settings, sections: q.sections, max: isSurveyKind(q.kind) ? 0 : ScoringModule.quizTotal(q) };
  }
  function hashOf(test) {
    const c = contentOf(test);
    return c ? fingerprint(stable({ k: c.kind, s: c.settings, c: c.sections })) : "";
  }
  const KIND_LABEL = { quiz: "Quiz", answers: "Answer Collection", survey: "Research Survey", formative: "Formative Survey", test: "Test" };
  const madeOf = (test) => {
    if (test.createdAt) return test.createdAt;
    const m = /^(?:test|shared)-(\d{11,})-/.exec(String(test.id || ""));
    return m ? new Date(Number(m[1])).toISOString() : "";
  };
  /** One-line facts about a full test object (what the index stores and the grid shows). */
  function describe(test) {
    const quizOn = !!test.quiz;
    let kind = "test", questions = null, max = Number(test.maxPoints) || 0, answers = Object.keys(test.scores || {}).length, qr = false, scoresAt = "";
    if (quizOn) {
      const c = contentOf(test);
      kind = c.kind === "answers" ? "answers" : c.kind === "survey" ? "survey" : c.kind === "formative" ? "formative" : "quiz";
      questions = c.sections.reduce((a, sec) => a + (sec.questions || []).length, 0);
      max = isSurveyKind(kind) ? null : c.max;
      const subs = test.quiz.submissions || [];
      answers = new Set(subs.map((x) => x.sid)).size;
      qr = !!test.quiz.token;
      scoresAt = subs.reduce((a, s) => (s.at && s.at > a ? s.at : a), "");
    }
    return { id: test.id, name: test.name || "", kind, questions, max, answers, qr, scoresAt, made: madeOf(test), master: !!test.master, clone: !!test.clone, fam: test.fam || "", famLeft: test.famLeft || "", hash: quizOn ? hashOf(test) : "", contentAt: test.contentAt || test.createdAt || "" };
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
  /** Keeps each item's "content last changed" time. Returns the items whose family content changed since the last index. */
  function stampTimes(tools, prev, courseId, changes) {
    const now = nowIso();
    const old = new Map();
    ((prev && prev.tools) || []).forEach((t) => t.tests.forEach((x) => old.set(x.id, x)));
    tools.forEach((t) => t.tests.forEach((x) => {
      const o = old.get(x.id);
      if (o) {
        x.contentAt = o.hash === x.hash ? (o.contentAt || x.contentAt) : now;
        if (changes && x.fam && x.hash && o.hash !== x.hash) changes.push({ courseId, toolId: t.toolId, id: x.id });
      } else if (prev) x.contentAt = x.contentAt || now;
    }));
    return tools;
  }

  // ---------- content changes flow to siblings (after a quiet moment) ----------
  const Propagate = {
    delay: 8000, pending: new Map(), suppress: new Set(), timer: null, chain: Promise.resolve(),
    note(list) {
      let any = false;
      list.forEach((c) => { if (this.suppress.has(c.id)) { this.suppress.delete(c.id); return; } this.pending.set(c.id, c); any = true; });
      if (any) this.arm();
    },
    arm(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run().catch(() => {}), ms == null ? this.delay : ms); },
    run() {
      clearTimeout(this.timer);
      const refs = [...this.pending.values()]; this.pending.clear();
      this.chain = this.chain.then(async () => {
        for (const r of refs) {
          try { const res = await propagate(r); if (res && (res.updated || res.kicked)) toast(res.msg); } catch (e) { toast(`Couldn't update copies: ${e.message}`); }
        }
      });
      return this.chain;
    },
  };
  const Index = {
    queue: new Map(), gone: new Set(), timer: null, running: null,
    queueCourse(courseId, tools) { if (isTmp(courseId)) return; this.gone.delete(courseId); this.queue.set(courseId, describeTools(tools)); this.arm(); },
    queueDelete(courseId) { this.queue.delete(courseId); this.gone.add(courseId); this.arm(); },
    arm() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush().catch(() => {}), 1500); },
    async flush() {
      clearTimeout(this.timer);
      if (this.running) { try { await this.running; } catch (e) {} }
      if (!this.queue.size && !this.gone.size) return;
      const q = new Map(this.queue), g = new Set(this.gone);
      this.queue.clear(); this.gone.clear();
      const changes = [];
      this.running = (async () => {
        const idx = (await storage.loadFile(INDEX_FILE)) || {};
        idx.courses = idx.courses || {};
        q.forEach((tools, id) => { idx.courses[id] = { at: nowIso(), tools: stampTimes(tools, idx.courses[id], id, changes) }; });
        g.forEach((id) => { delete idx.courses[id]; });
        await storage.saveFile(INDEX_FILE, idx);
      })();
      try { await this.running; } finally { this.running = null; }
      if (changes.length) Propagate.note(changes);
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
      if (name === TPL_FILE && data && Array.isArray(data.items)) { try { Index.queueCourse(TPL, [{ type: "testbank", id: "mine", name: TPL_NAME, config: { tests: data.items } }]); } catch (e) {} }
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

  const cache = new Map();
  const invalidate = () => cache.clear();

  // ---------- reading everything ----------
  async function loadModel(opts) {
    opts = opts || {};
    if (opts.flush && window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush();
    const m = { courses: [], rows: [], fams: new Map(), legacy: [] };
    const idx = opts.rebuild ? { courses: {} } : await Index.load();
    let changedIdx = !!opts.rebuild;
    for (const c of CoursesModule.activeCourses()) {
      let tools;
      if (live(c.id)) {
        tools = stampTimes(describeTools(ScoringModule.tools), idx.courses[c.id]); // the open course is always read live
      } else if (idx.courses[c.id]) {
        tools = idx.courses[c.id].tools;
      } else {
        let data = null;
        try { data = await storage.loadFile(`scoring-${c.id}.json`); } catch (e) { data = null; }
        tools = describeTools((data && data.tools) || []);
        idx.courses[c.id] = { at: nowIso(), tools };
        changedIdx = true;
      }
      const course = { id: c.id, name: c.name, tools: tools.map((t) => ({ toolId: t.toolId, toolName: t.toolName })) };
      m.courses.push(course);
      tools.forEach((t) => t.tests.forEach((d) => {
        const row = { courseId: c.id, courseName: c.name, toolId: t.toolId, toolName: t.toolName, id: d.id, d };
        m.rows.push(row);
        if (d.fam) { if (!m.fams.has(d.fam)) m.fams.set(d.fam, []); m.fams.get(d.fam).push(row); }
      }));
    }
    if (changedIdx) { try { await storage.saveFile(INDEX_FILE, idx); } catch (e) {} }
    // Master templates (stored in sharedtests.json, in no course).
    let tdoc = null;
    try { tdoc = await storage.loadFile(TPL_FILE); } catch (e) { tdoc = null; }
    m.tdoc = tdoc || {};
    m.templates = [];
    ((tdoc && Array.isArray(tdoc.items)) ? tdoc.items : []).forEach((it) => {
      const d = describe(it); d.answers = 0; d.qr = false;
      const row = { courseId: TPL, courseName: TPL_NAME, toolId: "mine", toolName: TPL_NAME, id: d.id, d, tpl: true };
      m.rows.push(row); m.templates.push(row);
      if (d.fam) { if (!m.fams.has(d.fam)) m.fams.set(d.fam, []); m.fams.get(d.fam).push(row); }
    });
    // Old group lists (kept only so their items can be imported into courses).
    try {
      if (window.GroupShare) {
        const groups = await GroupShare.myGroups(true);
        for (const g of groups || []) {
          const d = await GroupShare.loadDoc(g.id, "tests");
          if (d && Array.isArray(d.items) && d.items.length) m.legacy.push({ key: g.id, label: `the old group list “${g.name}”`, items: d.items });
        }
      }
    } catch (e) { /* groups are optional */ }
    return m;
  }
  const sameRef = (a, b) => a.courseId === b.courseId && a.id === b.id;
  const siblingsOf = (model, row) => (row.d.fam ? (model.fams.get(row.d.fam) || []).filter((x) => !sameRef(x, row)) : []);

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
  function dialog(build) {
    return new Promise((resolve) => {
      const ov = mk("div"); ov.id = "qts-overlay";
      const box = mk("div"); box.id = "qts-box"; ov.appendChild(box);
      const done = (v) => { ov.remove(); resolve(v); };
      build(box, done);
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) done(null); });
      document.body.appendChild(ov);
    });
  }

  // ---------- reading / writing one item in any course ----------
  async function courseFile(courseId) { return await storage.loadFile(`scoring-${courseId}.json`); }
  /** The complete test object (questions, answers…) for a row. */
  async function tplLoad() { const d = await storage.loadFile(TPL_FILE); return d && typeof d === "object" ? d : {}; }
  async function tplSave(doc) {
    await storage.saveFile(TPL_FILE, { items: doc.items || [], sections: doc.sections || [] });
    if (window.SharedTestsModule) window.SharedTestsModule.loaded = false;
    invalidate();
  }
  async function fullOf(ref) {
    if (ref.courseId === TPL) return ((await tplLoad()).items || []).find((x) => x.id === ref.id) || null;
    if (live(ref.courseId)) return ScoringModule.findTest(ref.toolId, ref.id);
    const data = await courseFile(ref.courseId);
    const tool = ((data && data.tools) || []).find((t) => t.id === ref.toolId);
    return (tool && tool.config && (tool.config.tests || []).find((x) => x.id === ref.id)) || null;
  }
  /** Writes a change to one course test (open course: in memory + autosave; other course: that file). */
  async function editCourseTest(ref, fn) {
    if (ref.courseId === TPL) {
      const doc = await tplLoad();
      const t = (doc.items || []).find((x) => x.id === ref.id);
      if (!t) throw new Error("That item no longer exists.");
      const r = fn(t, false); await tplSave(doc); return r;
    }
    if (live(ref.courseId)) { const t = ScoringModule.findTest(ref.toolId, ref.id); if (!t) throw new Error("That item no longer exists."); const r = fn(t, true); flush(); invalidate(); return r; }
    const data = await courseFile(ref.courseId);
    const tool = ((data && data.tools) || []).find((x) => x.id === ref.toolId);
    const t = tool && tool.config && (tool.config.tests || []).find((x) => x.id === ref.id);
    if (!t) throw new Error("That item no longer exists.");
    const r = fn(t, false);
    await storage.saveFile(`scoring-${ref.courseId}.json`, data);
    invalidate();
    return r;
  }
  async function courseAdd(courseId, toolId, test) {
    if (courseId === TPL) {
      const doc = await tplLoad(); doc.items = doc.items || [];
      if (doc.items.length >= MAX_TPL) throw new Error(`The master templates list is at its limit of ${MAX_TPL}.`);
      doc.items.push(test); await tplSave(doc); return "mine";
    }
    if (live(courseId)) {
      let id = toolId;
      if (id === "__new") id = ScoringModule.addTool("testbank").id;
      const cfg = ScoringModule.getTestBankConfig(id);
      if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`That bank is at its limit of ${MAX_TESTS_PER_BANK}.`);
      cfg.tests.push(test); flush(); invalidate(); return id;
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
    return tool.id;
  }
  async function courseRemove(courseId, toolId, testId) {
    if (courseId === TPL) { const doc = await tplLoad(); doc.items = (doc.items || []).filter((x) => x.id !== testId); await tplSave(doc); return; }
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
  /** Regrades a quiz that lives in a course that is NOT open, using that course's own roster. */
  function detachedRegrade(test, students) {
    const rm = window.RosterModule;
    const oldStudents = rm.students, oldFind = ScoringModule.findTest;
    try {
      rm.students = students || [];
      ScoringModule.findTest = () => test;
      ScoringModule.regradeQuiz("x", test.id);
    } finally { rm.students = oldStudents; ScoringModule.findTest = oldFind; }
  }
  /** A new course test made from another: same questions and settings, no answers, scores or QR link. */
  function copyOf(test, name, fam) {
    const t = { id: rid("test"), name, maxPoints: Number(test.maxPoints) || 0, sourceFile: test.quiz ? "Quiz editor" : "Copied test", rows: [], scores: {}, unmatched: [], createdAt: nowIso(), contentAt: nowIso() };
    if (fam) t.fam = fam;
    if (test.quiz) t.quiz = { ...clone(test.quiz), token: null, submissions: [] };
    return t;
  }

  // ---------- applying content to a sibling ----------
  /** Replaces a sibling's questions and settings. Its name, students' answers, scores and QR link stay. */
  async function applyContent(target, content) {
    const probe = await fullOf(target);
    if (!probe) throw new Error("That item no longer exists.");
    if (probe.quiz && probe.quiz.token) throw new Error("its QR code is open — close it first (Test & Quiz Bank → QR Code → Close QR Code)");
    let students = null;
    if (!live(target.courseId) && probe.quiz && (probe.quiz.submissions || []).length) {
      const r = await storage.loadFile(`roster-${target.courseId}.json`);
      students = (r && r.students) || [];
    }
    Propagate.suppress.add(target.id);
    await editCourseTest(target, (t, isLive) => {
      t.quiz = { ...(t.quiz || {}), kind: content.kind, settings: clone(content.settings), sections: clone(content.sections) };
      if (!Array.isArray(t.quiz.submissions)) t.quiz.submissions = [];
      t.maxPoints = content.max; t.contentAt = nowIso();
      if (isLive) ScoringModule.regradeQuiz(target.toolId, t.id);
      else if (t.quiz.submissions.length) detachedRegrade(t, students);
    });
    setTimeout(() => Propagate.suppress.delete(target.id), 30000);
  }
  /** What an update will change, in words. */
  async function impactText(target, content) {
    const t = await fullOf(target);
    if (!t || !t.quiz) return "";
    const old = contentOf(t);
    const count = (c) => c.sections.reduce((a, sec) => a + (sec.questions || []).length, 0);
    const students = new Set((t.quiz.submissions || []).map((x) => x.sid)).size;
    let msg = `\n\nQuestions: ${count(old)} → ${count(content)}. Max score: ${old.max} → ${content.max}.`;
    if (students) msg += `\n${students} student(s) have answered it. Their answers are kept and regraded against the new questions (a new question counts as unanswered), so scores can change.`;
    return msg;
  }
  async function leaveFamily(ref) {
    await editCourseTest(ref, (t) => { if (t.fam) { t.famLeft = t.fam; delete t.fam; t.clone = true; delete t.master; } });
  }
  /** Pushes one item's questions/settings to its family. A parent (master template) pushes to every child; a child pushes to its
   *  sibling children and then ASKS before changing the parent. Items with students' answers are asked first ("no" takes them out of the family). */
  async function propagate(ref) {
    const src = await fullOf(ref);
    if (!src || !src.fam || !src.quiz) return null;
    const content = contentOf(src), hash = hashOf(src);
    const model = await loadModel({});
    const members = model.fams.get(src.fam) || [];
    const me = members.find((r) => sameRef(r, ref));
    const parent = members.find((r) => r.d.master && !sameRef(r, ref));
    const fromParent = !!src.master;
    const targets = members.filter((r) => !sameRef(r, ref) && r.d.kind !== "test" && r.d.hash !== hash && (fromParent || !r.d.master));
    let updated = 0, kicked = 0, parentDone = false; const skipped = [];
    for (const s of targets) {
      if (s.d.qr) { skipped.push(s); continue; }
      if (s.d.answers > 0) {
        const ok = confirm(`“${src.name}” (${me ? me.courseName : "another course"}) was changed.\n\n“${s.d.name}” in ${s.courseName} is in the same family and already has ${s.d.answers} student(s)' scoring data. Update it to match?${await impactText(s, content)}\n\nOK = update it.\nCancel = take it out of the family (it keeps its current questions; you can rejoin later).`);
        if (!ok) { await leaveFamily(s); kicked++; continue; }
      }
      try { await applyContent(s, content); updated++; } catch (e) { skipped.push(s); }
    }
    if (!fromParent && parent && parent.d.hash !== hash) {
      if (confirm(`“${src.name}” (${me ? me.courseName : "a course"}) was changed.\n\nAlso change its parent, the master template “${parent.d.name}”? That would update all of the template's other children too (asking first where students have answered).\n\nOK = change the parent.\nCancel = leave the parent as it is.`)) {
        await applyContent(parent, content);
        const r2 = await propagate({ courseId: TPL, toolId: "mine", id: parent.id });
        parentDone = true;
        if (r2) { updated += r2.updated; kicked += r2.kicked; }
      }
    }
    invalidate();
    const parts = [];
    if (updated) parts.push(`updated ${updated} ${updated === 1 ? "copy" : "copies"}`);
    if (parentDone) parts.push("parent template changed");
    if (kicked) parts.push(`${kicked} left the family`);
    if (skipped.length) parts.push(`${skipped.length} skipped (QR open)`);
    return { updated, kicked, skipped: skipped.length, msg: parts.length ? `“${src.name}”: ${parts.join(", ")}.` : "" };
  }

  // ---------- Copy to other courses ----------
  /** Makes sure an item has a family id (a template also becomes the family's parent). Returns the family id. */
  async function ensureFam(src, full) {
    const isTpl = src.courseId === TPL;
    if (full.fam && (!isTpl || full.master)) return full.fam;
    const fam = full.fam || rid("fam");
    await editCourseTest(src, (t) => { t.fam = fam; if (isTpl) t.master = true; });
    return fam;
  }
  async function copyDialog(src) {
    const model = await loadModel({});
    const full = await fullOf(src);
    if (!full) throw new Error("That item no longer exists.");
    const isTpl = src.courseId === TPL;
    const picked = await dialog((box, done) => {
      box.appendChild(mk("h3", "", `Copy “${full.name}”`));
      box.appendChild(mk("p", "hint", isTpl
        ? "A copy sent to a course becomes its child: this template is the parent, and the copy follows the template's changes. A clone kept in the master templates has no link."
        : "Copies sent to courses become a family: later changes to questions flow between them. A clone kept in the master templates has no link."));
      const boxes = [];
      const add = (value, text, extra) => {
        const l = mk("label", "qts-check"); const cb = mk("input"); cb.type = "checkbox"; cb.value = value;
        l.append(cb, mk("span", "", text)); if (extra) l.appendChild(mk("span", "hint", ` ${extra}`));
        boxes.push(cb); box.appendChild(l);
      };
      model.courses.forEach((c) => add(c.id, c.id === src.courseId ? `${c.name} (this course — adds a second copy)` : c.name, isTpl ? "child" : ""));
      box.appendChild(mk("hr"));
      add(TPL, `${TPL_NAME} — as a clone`, "(no link)");
      const msg = mk("p", "hint");
      box.appendChild(msg);
      const acts = mk("div", "qts-actions");
      const cancel = mk("button", "btn btn-ghost", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => done(null));
      const go = mk("button", "btn btn-primary", "Copy"); go.type = "button";
      go.addEventListener("click", () => { const ids = boxes.filter((b) => b.checked).map((b) => b.value); if (!ids.length) { msg.textContent = "Tick at least one place."; return; } done(ids); });
      acts.append(cancel, go); box.appendChild(acts);
    });
    if (!picked) return "";
    const errs = []; let n = 0;
    let fam = "";
    for (const cid of picked) {
      try {
        if (cid === TPL) {
          const c = copyOf(full, isTpl ? `${full.name} (copy)` : full.name, "");
          c.clone = true; await courseAdd(TPL, "mine", c);
        } else {
          if (!fam) fam = await ensureFam(src, full);
          const course = model.courses.find((x) => x.id === cid);
          const toolId = cid === src.courseId ? src.toolId : course && course.tools.length ? course.tools[0].toolId : "__new";
          await courseAdd(cid, toolId, copyOf(full, cid === src.courseId ? `${full.name} (copy)` : full.name, fam));
        }
        n++;
      } catch (e) { errs.push(`${cid === TPL ? TPL_NAME : (model.courses.find((c) => c.id === cid) || {}).name || cid}: ${e.message}`); }
    }
    invalidate();
    return `Copied “${full.name}” to ${n} place${n === 1 ? "" : "s"}.${errs.length ? ` Couldn't copy to: ${errs.join("; ")}` : ""}`;
  }

  /** Copies an item from any course (or the master templates) into one specific Test & Quiz Bank (the one you are looking at). */
  async function copyInto(src, courseId, toolId) {
    const full = await fullOf(src);
    if (!full) throw new Error("That item no longer exists.");
    const fam = await ensureFam(src, full);
    await courseAdd(courseId, toolId, copyOf(full, full.name, fam));
    invalidate();
    return `Copied “${full.name}” into this course.`;
  }

  // ---------- rejoining a family ----------
  async function rejoin(row) {
    const model = await loadModel({});
    const fam = row.d.famLeft;
    const sibs = model.rows.filter((r) => r.d.fam === fam && !sameRef(r, row));
    const setBack = () => editCourseTest(row, (t) => { t.fam = fam; delete t.famLeft; });
    if (!sibs.length) { await editCourseTest(row, (t) => { delete t.famLeft; }); return "That family has no other copies left, so there's nothing to rejoin."; }
    const pick = await dialog((box, done) => {
      box.appendChild(mk("h3", "", `Rejoin the family — “${row.d.name}”`));
      box.appendChild(mk("p", "hint", "Choose which way the questions go. Names, students' answers, scores and QR links never change."));
      const sel = mk("select");
      sibs.forEach((s, i) => { const o = mk("option", "", `${s.courseName} — “${s.d.name}”${s.d.hash === row.d.hash ? " (same questions)" : ""}`); o.value = String(i); sel.appendChild(o); });
      box.append(mk("label", "", "Compare with / take from"), sel);
      const acts = mk("div", "qts-actions");
      const cancel = mk("button", "btn btn-ghost", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => done(null));
      const push = mk("button", "btn btn-primary", "Push mine to the others"); push.type = "button"; push.addEventListener("click", () => done({ how: "push" }));
      const pull = mk("button", "btn btn-primary", "Change mine to match the others"); pull.type = "button"; pull.addEventListener("click", () => done({ how: "pull", from: sibs[Number(sel.value)] }));
      acts.append(cancel, push, pull); box.appendChild(acts);
    });
    if (!pick) return "";
    if (pick.how === "pull") {
      const content = contentOf(await fullOf(pick.from));
      if (!content) throw new Error("That copy has no questions to take.");
      if (row.d.hash !== pick.from.d.hash) {
        if (!confirm(`Change “${row.d.name}” to match “${pick.from.d.name}” in ${pick.from.courseName}?${await impactText(row, content)}`)) return "";
        await applyContent(row, content);
      }
      await setBack();
      return `“${row.d.name}” rejoined the family and now matches ${pick.from.courseName}.`;
    }
    await setBack();
    const r = await propagate(row);
    return `“${row.d.name}” rejoined the family.${r && r.msg ? ` ${r.msg}` : ""}`;
  }

  // ---------- Family Ties grid ----------
  /** The grid listing an item's siblings with per-sibling actions. onChange(msg) is called after any change. */
  function buildTies(ref, onChange) {
    const wrap = mk("div", "qts-ties qts-root");
    wrap.appendChild(mk("p", "hint", "Loading family…"));
    const done = (msg) => { invalidate(); if (onChange) onChange(msg); };
    const act = (fn) => async () => { try { const m = await fn(); done(m); } catch (e) { toast(`Couldn't do that: ${e.message}`); } };
    loadModel({}).then((model) => {
      wrap.textContent = "";
      const me = model.rows.find((r) => sameRef(r, ref));
      if (!me || !me.d.fam) { wrap.appendChild(mk("p", "hint", "This item isn't in a family. Use “Copy to other courses…” to make one.")); return; }
      const members = model.fams.get(me.d.fam) || [];
      wrap.appendChild(mk("div", "qts-ties-title", `Family Ties — ${members.length} ${members.length === 1 ? "item" : "items"}`));
      wrap.appendChild(mk("div", "qts-ties-hint", "Same family = same questions and settings, kept in step automatically. Names, students' answers, scores and QR links stay with each course."));
      const tb = mk("table", "source-grid qts-grid");
      const hr = mk("tr"); ["Where", "Name", "Role", "Qs", "Max", "Answers", "Compared with this", ""].forEach((x) => { const th = mk("th", "nosort", x); hr.appendChild(th); });
      const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
      const body = mk("tbody"); tb.appendChild(body);
      members.forEach((r) => {
        const isMe = sameRef(r, me);
        const tr = mk("tr", isMe ? "qts-me" : "");
        const hasParent = members.some((x) => x.d.master);
        tr.append(mk("td", "", r.tpl ? TPL_NAME : `${r.courseName} › ${r.toolName}`), mk("td", "qts-name", r.d.name || "(untitled)"), mk("td", "", r.d.master ? "Parent" : hasParent ? "Child" : "Sibling"),
          mk("td", "qts-n", r.d.questions == null ? "—" : String(r.d.questions)), mk("td", "qts-n", r.d.max == null || !r.d.max ? "—" : String(r.d.max)), mk("td", "qts-n", String(r.d.answers || 0)),
          mk("td", "", isMe ? "this one" : !me.d.hash ? "—" : r.d.hash === me.d.hash ? "✓ same" : "⟳ differs"));
        const td = mk("td");
        if (isMe) {
          td.appendChild(menuButton("Menu", () => [{ label: "Leave this family", onClick: act(async () => { if (!confirm(`Take “${r.d.name}” out of its family? It keeps its questions and scores, and stops syncing. You can rejoin later.`)) return ""; await leaveFamily(r); return `“${r.d.name}” left the family.`; }) }]));
        } else {
          td.appendChild(menuButton("Menu", () => [
            { label: "Send this one's questions to it", onClick: act(async () => {
              const content = contentOf(await fullOf(me)); if (!content) throw new Error("This item has no questions to send.");
              if (r.d.qr) throw new Error("its QR code is open — close it first");
              if (!confirm(`Replace the questions and settings of “${r.d.name}” (${r.courseName}) with this one's?${await impactText(r, content)}`)) return "";
              await applyContent(r, content); return `Sent to ${r.courseName}.`;
            }) },
            { label: "Take its questions for this one", onClick: act(async () => {
              const content = contentOf(await fullOf(r)); if (!content) throw new Error("That item has no questions to take.");
              if (me.d.qr) throw new Error("this quiz's QR code is open — close it first");
              if (!confirm(`Replace this one's questions and settings with those from ${r.courseName}?${await impactText(me, content)}`)) return "";
              await applyContent(me, content); return `Updated from ${r.courseName}.`;
            }) },
            "-",
            { label: "Remove it from the family", onClick: act(async () => { if (!confirm(`Take “${r.d.name}” (${r.courseName}) out of the family? It keeps its questions and scores, and stops syncing.`)) return ""; await leaveFamily(r); return `“${r.d.name}” left the family.`; }) },
          ]));
        }
        tr.appendChild(td); body.appendChild(tr);
      });
      const sc = mk("div", "qts-wrap"); sc.appendChild(tb); wrap.appendChild(sc);
    }).catch((e) => { wrap.textContent = `Couldn't load: ${e.message}`; });
    return wrap;
  }

  // ---------- exports ----------
  function exportMenuItems(row, say) {
    const d = row.d;
    let labels;
    if (d.kind === "test") labels = [["CSV: Scores", "csv"], ["Excel: Scores", "xlsx"]];
    else if (!window.QuizExport) labels = [];
    else {
      const stub = { name: "x", quiz: { kind: d.kind === "answers" ? "answers" : d.kind === "survey" ? "survey" : d.kind === "formative" ? "formative" : "standard", settings: {}, sections: [], submissions: [] } };
      labels = window.QuizExport.items(stub, false).map((it) => [it.label, null]);
    }
    return labels.map(([label, fmt]) => ({
      label,
      onClick: async () => {
        try {
          say("Preparing export…");
          const test = await fullOf(row);
          if (!test) throw new Error("That item no longer exists.");
          if (!test.quiz) {
            const rows = [["Student", "School ID", "Score", "Max score"]];
            (test.rows || []).forEach((r) => rows.push([r.name || "", r.schoolId || "", r.score === undefined ? "" : r.score, Number(test.maxPoints) || ""]));
            QuizExport.download(`${test.name || "test"} - scores`, rows, fmt);
          } else {
            const hit = window.QuizExport.items(test, false).find((x) => x.label === label);
            if (hit) hit.onClick();
          }
          say("");
        } catch (e) { say(`Couldn't export: ${e.message}`); }
      },
    }));
  }

  // ---------- one view of the bank (tab, and inside each Test & Quiz Bank) ----------
  // ctx (optional, inside a Test & Quiz Bank): { toolId, rerender }
  let pendingMsg = "";
  const tiesOpen = new Set(); // item ids whose Family Ties grid is open under the Test & Quiz Bank list
  const gridTies = new Set(); // same, for the QTS Bank grid
  const COLS = [
    ["name", "Name"], ["course", "Course"], ["type", "Type"], ["fam", "Family"], ["q", "Qs"], ["max", "Max"],
    ["answers", "Answers"], ["made", "Made"], ["scoresAt", "Scores collected"], ["status", "Status"],
  ];
  const statusOf = (d) => (d.qr ? "QR open" : d.answers > 0 ? (d.kind === "test" ? "Has scores" : "Has answers") : "No answers yet");
  function makeView(host, ctx) {
    ctx = ctx || {};
    let model = null, busy = false, statusEl = null;
    const F = { q: "", course: "", type: "", fam: "", status: "", made: "", scores: "" };
    let sort = [{ key: "course", dir: 1 }]; // up to two: main sort, then a sub-sort within it
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
    const run = (fn) => async () => { try { const m = await fn(); if (m !== undefined && m !== "") await changed(m); else if (m === "") say(""); } catch (e) { say(`Couldn't do that: ${e.message}`); } };

    const sinceOk = (iso, key) => {
      if (!key) return true;
      if (key === "never") return !iso;
      if (!iso) return false;
      const days = key === "year" ? (Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 864e5 : Number(key);
      return Date.now() - new Date(iso).getTime() <= days * 864e5;
    };
    function visibleRows() {
      const q = F.q.toLowerCase();
      const rows = model.rows.filter((r) => {
        if (r.tpl) return false;
        const d = r.d;
        if (q && !String(d.name).toLowerCase().includes(q) && !r.courseName.toLowerCase().includes(q)) return false;
        if (F.course && r.courseId !== F.course) return false;
        if (F.type && d.kind !== F.type) return false;
        const size = d.fam ? (model.fams.get(d.fam) || []).length : 0;
        const differs = d.fam && d.hash && (model.fams.get(d.fam) || []).some((x) => x.d.hash !== d.hash);
        if (F.fam === "in" && !(d.fam && size > 1)) return false;
        if (F.fam === "none" && (d.fam || !(d.clone || d.famLeft))) return false;
        if (F.fam === "differs" && !differs) return false;
        if (F.fam === "left" && !d.famLeft) return false;
        if (F.status && statusOf(d) !== F.status) return false;
        if (F.made && !sinceOk(d.made, F.made)) return false;
        if (F.scores && !sinceOk(d.scoresAt, F.scores)) return false;
        return true;
      });
      const val = (r, k) => {
        const d = r.d;
        switch (k) {
          case "name": return String(d.name).toLowerCase();
          case "course": return r.courseName.toLowerCase();
          case "type": return d.kind;
          case "fam": return d.fam ? (model.fams.get(d.fam) || []).length : 0;
          case "q": return d.questions == null ? -1 : d.questions;
          case "max": return d.max == null ? -1 : d.max;
          case "answers": return d.answers || 0;
          case "made": return d.made || "";
          case "scoresAt": return d.scoresAt || "";
          default: return statusOf(d);
        }
      };
      rows.sort((a, b) => { for (const s of sort) { const x = val(a, s.key), y = val(b, s.key); if (x !== y) return (x < y ? -1 : 1) * s.dir; } return String(a.d.name).localeCompare(String(b.d.name)); });
      return rows;
    }

    function famCell(r) {
      const d = r.d;
      const td = mk("td", "qts-n");
      if (d.fam) {
        const mem = model.fams.get(d.fam) || [];
        const parent = mem.find((x) => x.d.master);
        const diff = d.hash && mem.some((x) => x.d.hash !== d.hash);
        const a = mk("span", "qts-link", `${d.master ? `Parent (${mem.length - 1})` : parent ? `Child of “${parent.d.name}”` : `Sibling (${mem.length})`}${diff ? " ⚠" : ""}`);
        a.title = diff ? "Some family members have different questions. Click to open Family Ties." : "Click to open Family Ties.";
        a.addEventListener("click", () => toggleTies(r));
        td.appendChild(a);
      } else if (d.clone || d.famLeft) { td.textContent = "Clone"; td.title = d.famLeft ? "Left its family. Menu → Rejoin family…" : "A copy with no parent."; }
      else td.textContent = "—";
      return td;
    }
    function toggleTies(r) { if (gridTies.has(r.id)) gridTies.delete(r.id); else gridTies.add(r.id); render(); }

    function menuFor(r) {
      const d = r.d;
      const items = [];
      if (inTool && r.courseId !== ScoringModule.currentCourseId) {
        items.push({ label: "Copy into this course", onClick: run(async () => copyInto(r, ScoringModule.currentCourseId, ctx.toolId)) });
      }
      items.push({ label: r.tpl ? "Copy…" : "Copy to other courses…", onClick: run(() => copyDialog(r)) });
      if (r.tpl) items.push({ label: "Edit questions…", onClick: run(() => openTplEditor(r)) });
      if (d.fam) items.push({ label: gridTies.has(r.id) ? "Hide Family Ties" : "Family Ties", onClick: () => toggleTies(r) });
      else if (d.famLeft) items.push({ label: "Rejoin family…", onClick: run(() => rejoin(r)) });
      items.push("-",
        { label: "Rename…", onClick: run(async () => {
          const v = prompt("New name:", d.name); if (v === null || !v.trim()) return "";
          await editCourseTest(r, (t) => { t.name = v.trim(); }); return "Renamed.";
        }) },
        { label: "Delete…", onClick: run(async () => {
          if (d.qr) throw new Error("close its QR code first (Test & Quiz Bank → QR Code → Close QR Code)");
          if (!confirm(`Delete “${d.name}” from ${r.courseName}?${r.tpl ? "\nIts children in courses are not affected." : ""}${d.answers ? `\n\nIt has ${d.answers} student(s)' answers/scores, which will be lost.` : ""}${d.fam ? "\nIts siblings in other courses are not affected." : ""}`)) return "";
          await courseRemove(r.courseId, r.toolId, r.id); return "Deleted.";
        }) });
      const ex = exportMenuItems(r, say);
      if (ex.length) items.push("-", ...ex);
      return items;
    }

    function selectFilter(label, key, options) {
      const l = mk("label", "", label); const s = mk("select");
      options.forEach(([v, t]) => { const o = mk("option", "", t); o.value = v; s.appendChild(o); });
      s.value = F[key];
      s.addEventListener("change", () => { F[key] = s.value; render(); });
      l.appendChild(s); return l;
    }

    function render(msg) {
      host.textContent = "";
      const head = mk("div", "qts-head");
      if (!inTool) head.appendChild(mk("h3", "", "QTS Bank"));
      const re = mk("button", "btn btn-ghost btn-small", "Refresh"); re.type = "button"; re.addEventListener("click", () => refresh("", true));
      const rb = mk("button", "btn btn-ghost btn-small", "Rebuild index"); rb.type = "button";
      rb.title = "Re-reads every course once. Use it if the list looks out of date (for example after changes made on another device).";
      rb.addEventListener("click", () => { if (confirm("Re-read every course to rebuild the QTS index? This reads all your courses' scoring data once.")) refresh("", true, true); });
      head.append(re, rb);
      host.appendChild(head);
      statusEl = mk("p", "result", msg || ""); host.appendChild(statusEl);
      if (!model) return;

      (model.legacy || []).forEach((lib) => {
        const p = mk("p", "hint"); p.style.cssText = "border:1px solid var(--line);border-radius:6px;padding:6px 8px;";
        p.appendChild(document.createTextNode(`${lib.label} still holds ${lib.items.length} item${lib.items.length === 1 ? "" : "s"}. Tests, quizzes and surveys now live only in courses — import them into a course. `));
        const b = mk("button", "btn btn-ghost btn-small", "Import into a course…"); b.type = "button"; b.addEventListener("click", run(() => importLegacy(lib, model)));
        p.appendChild(b); host.appendChild(p);
      });

      // ----- QTS Master Templates -----
      host.appendChild(mk("h4", "qts-h", TPL_NAME));
      host.appendChild(mk("p", "hint", "Often-used Qs, Ts and Ss that live in no course. Copy one to a course and it becomes that copy's parent: changes to the template flow to its children. A copy kept here is a clone, with no link."));
      {
        const tb = mk("table", "source-grid qts-grid");
        const hr = mk("tr"); ["Name", "Type", "Qs", "Max", "Link", "Made", ""].forEach((x) => hr.appendChild(mk("th", "nosort", x)));
        const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
        const body = mk("tbody"); tb.appendChild(body);
        const trs = [...model.templates].sort((a, b) => String(a.d.name).localeCompare(String(b.d.name)));
        if (!trs.length) { const tr = mk("tr"); const td = mk("td", "hint", "No master templates yet. Open a quiz's menu → “Copy to other courses…” → tick “QTS Master Templates — as a clone”."); td.colSpan = 7; tr.appendChild(td); body.appendChild(tr); }
        trs.forEach((r) => {
          const d = r.d; const tr = mk("tr");
          const link = famCell(r); if (!d.fam && !d.clone) link.textContent = "—";
          tr.append(mk("td", "qts-name", d.name || "(untitled)"), mk("td", "", KIND_LABEL[d.kind] || "Quiz"),
            mk("td", "qts-n", d.questions == null ? "—" : String(d.questions)), mk("td", "qts-n", d.max == null || !d.max ? "—" : String(d.max)), link, mk("td", "qts-n", day(d.made) || "—"));
          const td = mk("td"); td.appendChild(menuButton("Menu", () => menuFor(r))); tr.appendChild(td); body.appendChild(tr);
          if (gridTies.has(r.id) && d.fam) {
            const dr = mk("tr"); const dt = mk("td", "qts-detail"); dt.colSpan = 7;
            dt.appendChild(buildTies({ courseId: r.courseId, toolId: r.toolId, id: r.id }, (m) => { changed(m); }));
            dr.appendChild(dt); body.appendChild(dr);
          }
        });
        const sc = mk("div", "qts-wrap"); sc.appendChild(tb); host.appendChild(sc);
      }
      host.appendChild(mk("h4", "qts-h", "Qs, Ts and Ss in your courses"));

      const courseOpts = [["", "All courses"], ...model.courses.map((c) => [c.id, c.name])];
      const filters = mk("div", "qts-filters");
      filters.append(
        selectFilter("Course", "course", courseOpts),
        selectFilter("Type", "type", [["", "All"], ["quiz", "Quiz"], ["test", "Test"], ["survey", "Research Survey"], ["formative", "Formative Survey"], ["answers", "Answer Collection"]]),
        selectFilter("Family", "fam", [["", "All"], ["in", "In a family"], ["none", "Clones (no parent)"], ["differs", "Out of sync"], ["left", "Left a family"]]),
        selectFilter("Status", "status", [["", "All"], ["QR open", "QR open"], ["Has answers", "Has answers"], ["Has scores", "Has scores"], ["No answers yet", "No answers yet"]]),
        selectFilter("Date made", "made", [["", "Any time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["year", "This year"]]),
        selectFilter("Scores collected", "scores", [["", "Any time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["never", "Never"]]),
      );
      host.appendChild(filters);

      const rows = visibleRows();
      const tb = mk("table", "source-grid qts-grid");
      const hr = mk("tr");
      COLS.forEach(([k, label]) => {
        const pos = sort.findIndex((x) => x.key === k);
        const th = mk("th", "", label + (pos < 0 ? " ⇅" : ` ${sort[pos].dir > 0 ? "▲" : "▼"}${sort.length > 1 ? pos + 1 : ""}`));
        th.title = "Click: sort ascending. Click again: descending. A third click turns it off. A second sorted column sorts within the first.";
        th.addEventListener("click", () => {
          if (pos < 0) { sort = sort.length >= 2 ? [sort[0], { key: k, dir: 1 }] : [...sort, { key: k, dir: 1 }]; }
          else if (sort[pos].dir > 0) sort[pos].dir = -1;
          else sort.splice(pos, 1);
          render();
        });
        hr.appendChild(th);
      });
      hr.appendChild(mk("th", "nosort", ""));
      const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
      const body = mk("tbody"); tb.appendChild(body);
      if (!rows.length) { const tr = mk("tr"); const td = mk("td", "hint", model.rows.some((r) => !r.tpl) ? "Nothing matches these filters." : "No tests, quizzes or surveys in your active courses yet."); td.colSpan = COLS.length + 1; tr.appendChild(td); body.appendChild(tr); }
      rows.forEach((r) => {
        const d = r.d;
        const tr = mk("tr");
        tr.append(mk("td", "qts-name", d.name || "(untitled)"), mk("td", "", r.courseName), mk("td", "", KIND_LABEL[d.kind] || "Quiz"), famCell(r),
          mk("td", "qts-n", d.questions == null ? "—" : String(d.questions)), mk("td", "qts-n", d.max == null || !d.max ? "—" : String(d.max)),
          mk("td", "qts-n", String(d.answers || 0)), mk("td", "qts-n", day(d.made) || "—"), mk("td", "qts-n", day(d.scoresAt) || "—"), mk("td", "qts-n", statusOf(d)));
        const td = mk("td"); td.appendChild(menuButton("Menu", () => menuFor(r))); tr.appendChild(td);
        body.appendChild(tr);
        if (gridTies.has(r.id) && d.fam) {
          const dr = mk("tr"); const dt = mk("td", "qts-detail"); dt.colSpan = COLS.length + 1;
          dt.appendChild(buildTies({ courseId: r.courseId, toolId: r.toolId, id: r.id }, (m) => { changed(m); }));
          dr.appendChild(dt); body.appendChild(dr);
        }
      });
      const sc = mk("div", "qts-wrap"); sc.appendChild(tb); host.appendChild(sc);
      host.appendChild(mk("p", "hint", `${rows.length} of ${model.rows.filter((r) => !r.tpl).length} shown. Menu → “Copy to other courses…” makes a family of copies; “Family Ties” shows where they are.`));
    }

    return { refresh, render };
  }

  // ---------- importing the old Independent / group lists ----------
  async function importLegacy(lib, model) {
    if (!model.courses.length) throw new Error("You have no active courses to import into.");
    const pick = await dialog((box, done) => {
      box.appendChild(mk("h3", "", "Import into a course"));
      box.appendChild(mk("p", "hint", `Choose the items from ${lib.label} and the course they go into (its first Test & Quiz Bank). Items that already have copies stay in the same family.`));
      const sel = mk("select"); model.courses.forEach((c) => { const o = mk("option", "", c.name); o.value = c.id; sel.appendChild(o); });
      box.append(mk("label", "", "Course"), sel);
      const cbs = lib.items.map((it) => { const l = mk("label", "qts-check"); const cb = mk("input"); cb.type = "checkbox"; cb.checked = true; l.append(cb, mk("span", "", it.name || "(untitled)")); box.appendChild(l); return cb; });
      const acts = mk("div", "qts-actions");
      const cancel = mk("button", "btn btn-ghost", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => done(null));
      const go = mk("button", "btn btn-primary", "Import"); go.type = "button";
      go.addEventListener("click", () => done({ course: sel.value, items: lib.items.filter((_, i) => cbs[i].checked) }));
      acts.append(cancel, go); box.appendChild(acts);
    });
    if (!pick || !pick.items.length) return "";
    const course = model.courses.find((c) => c.id === pick.course);
    let toolId = course.tools.length ? course.tools[0].toolId : "__new";
    let n = 0; const errs = [];
    for (const it of pick.items) {
      try { toolId = await courseAdd(pick.course, toolId, copyOf(it, it.name, it.quiz ? it.fam || "" : "")); n++; } catch (e) { errs.push(e.message); break; }
    }
    if (n && lib.key === "mine" && confirm(`Imported ${n}. Remove the imported items from the old Independent list?`)) {
      const d = (await storage.loadFile("sharedtests.json")) || {};
      const ids = new Set(pick.items.map((x) => x.id));
      d.items = (d.items || []).filter((x) => !ids.has(x.id));
      await storage.saveFile("sharedtests.json", { items: d.items, sections: d.sections || [] });
    }
    invalidate();
    return `Imported ${n} item${n === 1 ? "" : "s"} into ${course.name}.${errs.length ? ` ${errs[0]}` : ""}`;
  }

  // ---------- editing a master template's questions ----------
  // The template is loaded into a hidden course (like course templates are), edited in the normal Test & Quiz Bank editor, then written back.
  let tedit = null;
  const tbanner = mk("div"); tbanner.hidden = true;
  tbanner.style.cssText = "margin:0 0 16px;padding:12px 16px;border:2px solid #c2571a;border-radius:8px;background:color-mix(in srgb, #c2571a 14%, var(--card));";
  const tbText = mk("div"); tbText.style.fontWeight = "700";
  const tbHint = mk("div", "hint", "You're editing a master template (no students here). Saving updates it, and its changes flow to its children.");
  const tbBar = mk("div", "panel-toolbar-buttons"); tbBar.style.marginTop = "10px";
  const tbStatus = mk("p", "result"); tbStatus.style.margin = "8px 0 0";
  const tbBtn = (label, cls, fn) => { const b = mk("button", cls, label); b.type = "button"; b.addEventListener("click", fn); tbBar.appendChild(b); return b; };
  tbanner.append(tbText, tbHint, tbBar, tbStatus);
  if (typeof el !== "undefined" && el.courseDetailTitle) el.courseDetailTitle.parentElement.insertAdjacentElement("afterend", tbanner);
  async function saveTpl() {
    if (!tedit) return false;
    tbStatus.textContent = "Saving…";
    try {
      await ScoringModule.save();
      const data = await storage.loadFile(`scoring-${tedit.cid}.json`);
      const t = data && data.tools && data.tools[0] && data.tools[0].config.tests.find((x) => x.id === tedit.id);
      if (!t || !t.quiz) throw new Error("the edited copy couldn't be found");
      await editCourseTest({ courseId: TPL, toolId: "mine", id: tedit.id }, (it) => {
        it.quiz = { ...clone(t.quiz), token: null, submissions: [] };
        it.maxPoints = t.maxPoints; it.name = t.name; it.contentAt = nowIso();
      });
      tbStatus.textContent = "Saved ✓";
      return true;
    } catch (e) { tbStatus.textContent = `Couldn't save: ${e.message}`; return false; }
  }
  async function closeTpl(save) {
    if (!tedit) return;
    if (save && !(await saveTpl())) return;
    const { cid } = tedit; tedit = null;
    CoursesModule.courses = CoursesModule.courses.filter((c) => !c.editingTemplateId);
    tbanner.hidden = true; el.tabRosterBtn.style.display = "";
    await showCourses();
    ["roster", "seating", "attendance", "scoring", "reportcard"].forEach((p) => { try { Promise.resolve(storage.deleteFile(`${p}-${cid}.json`)).catch(() => {}); } catch (e) {} });
    invalidate();
  }
  tbBtn("Save to Template", "btn btn-primary btn-small", () => saveTpl());
  tbBtn("Save & Close", "btn btn-ghost btn-small", () => closeTpl(true));
  tbBtn("Close without saving", "btn btn-ghost btn-small", () => { if (confirm("Close without saving? Changes since your last save will be lost.")) closeTpl(false); });
  if (typeof el !== "undefined" && el.backToCoursesBtn) el.backToCoursesBtn.addEventListener("click", (e) => { if (!tedit) return; e.stopImmediatePropagation(); closeTpl(true); }, true);
  async function openTplEditor(row) {
    if (tedit) throw new Error("close the template you're editing first");
    const item = await fullOf({ courseId: TPL, id: row.id });
    if (!item || !item.quiz) throw new Error("only quizzes and surveys have questions to edit");
    if (!window.QuizBankUI) throw new Error("the quiz editor isn't available");
    if (window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush();
    const cid = `tmpledit-qts-${Date.now().toString(36)}`, toolId = "tpl-tool";
    const test = clone(item); test.quiz = { ...clone(item.quiz), token: null, submissions: [] };
    await storage.saveFile(`roster-${cid}.json`, { students: [] });
    await storage.saveFile(`scoring-${cid}.json`, { categories: [], records: {}, weights: {}, presentationMigrated: true, tools: [{ id: toolId, type: "testbank", name: "Test & Quiz Bank", config: { tests: [test] } }] });
    const course = { id: cid, name: `Master template: ${item.name}`, periodId: null, archived: false, templateId: null, editingTemplateId: "qts" };
    CoursesModule.courses.push(course);
    tedit = { cid, id: item.id };
    await openCourseDetail(course);
    tbText.textContent = `Editing master template “${item.name}”`; tbStatus.textContent = ""; tbanner.hidden = false;
    el.tabRosterBtn.style.display = "none";
    window.QuizBankUI.open(toolId, item.id);
    showTab("scoring");
    if (typeof renderScoring === "function") renderScoring();
    return "";
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

  // ---------- inside a Test & Quiz Bank + helpers for quizbank.js ----------
  window.QTSBank = {
    invalidate,
    hookStorage, // exposed for testing
    flushIndex: () => Index.flush(),
    propagateNow: () => Propagate.run(),
    setDelay(ms) { Propagate.delay = ms; },
    tiesOpen,
    /** "Copy to other courses…" for a test in the open course. Resolves to a message ("" if cancelled). */
    copyToCourses: (courseId, toolId, test) => copyDialog({ courseId, toolId, id: test.id }),
    /** The Family Ties grid for a test (async-filled element). */
    buildTies: (courseId, toolId, test, onChange) => buildTies({ courseId, toolId, id: test.id }, onChange),
    rejoin: (courseId, toolId, test) => rejoin({ courseId, toolId, id: test.id, courseName: "", d: describe(test) }),
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
