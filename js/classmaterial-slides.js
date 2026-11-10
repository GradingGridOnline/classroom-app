// ===== Class Material, stage 2: lesson calendar + the "Basic" slideshow with custom slide types =====
// Plugs into ClassMaterial (classmaterial.js). The lesson calendar is kept per course inside
// classmaterial-<courseId>.json (CM.calendar). A slideshow can be tied to one lesson; the generated slides
// (Title, Today's goals, Calendar) are built through the Google Slides API and can be rebuilt from the calendar.
// Slide types live in SLIDE_TYPES: add an entry there to add a type.
(function () {
  const CMX = window.ClassMaterial; if (!CMX) return;
  const { mk, btn, G, CM } = CMX;
  const SLIDES = "https://slides.googleapis.com/v1/presentations/";
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ---------- calendar data ----------
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const uid = () => `ls-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  function cal() {
    if (!CM.calendar) {
      const c = window.CoursesModule && CoursesModule.find ? CoursesModule.find(CM.courseId) : null;
      CM.calendar = { start: "", end: "", weekdays: c && c.weekday >= 0 && c.weekday !== null ? [c.weekday] : [], skip: [], lessons: [] };
    }
    return CM.calendar;
  }
  /** Week number counted from the week (Mon–Sun) that contains the term start. */
  function weekOf(dateStr) {
    const c = cal(), d = parse(dateStr), first = c.lessons.map((l) => l.date).filter(Boolean).sort()[0], s = parse(c.start) || parse(first); if (!s || !d) return "";
    const mon = new Date(s); mon.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return Math.floor((d - mon) / 604800000) + 1;
  }
  const sortLessons = () => {
    const L = cal().lessons, linked = L.some((l) => l.sessionId);
    L.sort(linked ? (a, b) => (a.sessionId ? a.sn : 1e6) - (b.sessionId ? b.sn : 1e6) || (a.date || "9999").localeCompare(b.date || "9999") : (a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    L.forEach((l, i) => { l.n = l.sessionId ? l.sn : i + 1; });
  };
  const linked = () => cal().lessons.some((l) => l.sessionId);
  /** Makes the calendar follow the Attendance module: one lesson per attendance class meeting. Content you wrote is kept. */
  async function syncAttendance() {
    let sessions = null;
    if (window.AttendanceModule && AttendanceModule.currentCourseId === CM.courseId && Array.isArray(AttendanceModule.sessions)) sessions = AttendanceModule.sessions;
    else { try { const d = await storage.loadFile(`attendance-${CM.courseId}.json`); if (d && Array.isArray(d.sessions)) sessions = d.sessions; } catch (e) {} }
    if (!sessions || !sessions.length) return false;
    const c = cal(), before = JSON.stringify(c.lessons);
    const bySession = new Map(c.lessons.filter((l) => l.sessionId).map((l) => [l.sessionId, l]));
    const loose = c.lessons.filter((l) => !l.sessionId), used = new Set();
    const out = sessions.slice().sort((a, b) => (a.number || 0) - (b.number || 0)).map((ss, i) => {
      let l = bySession.get(ss.id);
      if (!l) { // first time: adopt a lesson already planned for that date (or at that position), so nothing written is lost
        l = loose.find((x) => !used.has(x) && ss.date && x.date === ss.date);
        if (!l && loose[i] && !used.has(loose[i])) l = loose[i];
        if (l) used.add(l);
      }
      if (!l) l = { id: uid(), title: "", goals: "", materials: "", homework: "" };
      l.sessionId = ss.id; l.sn = ss.number || i + 1; l.dateFromAttendance = !!ss.date; if (ss.date) l.date = ss.date; else if (l.date === undefined) l.date = "";
      return l;
    });
    const keep = loose.filter((x) => !used.has(x) && (x.title || x.goals || x.materials || x.homework)); // planned lessons with no matching class stay at the end
    c.lessons = [...out, ...keep]; sortLessons();
    return JSON.stringify(c.lessons) !== before;
  }
  const lessonById = (id) => cal().lessons.find((l) => l.id === id);
  function dayLabel(l) { const d = parse(l.date); return d ? `${DAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}` : "no date"; }
  const lessonLabel = (l) => (parse(l.date) ? `Lesson ${l.n} · ${weekOf(l.date) ? `Week ${weekOf(l.date)} · ` : ""}${dayLabel(l)}` : `Lesson ${l.n}`);
  /** Makes a lesson for every meeting date in the term (keeps what you already wrote for dates that still exist). */
  function generate() {
    const c = cal(), s = parse(c.start), e = parse(c.end);
    if (!s || !e || e < s) throw new Error("Set the term start and end dates first.");
    if (!c.weekdays.length) throw new Error("Tick at least one meeting weekday.");
    if ((e - s) / 86400000 > 400) throw new Error("A term can be at most about 13 months.");
    const have = new Map(c.lessons.map((l) => [l.date, l])), out = [];
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const k = ymd(d); if (!c.weekdays.includes(d.getDay()) || c.skip.includes(k)) continue;
      out.push(have.get(k) || { id: uid(), n: 0, date: k, title: "", goals: "", materials: "", homework: "" });
    }
    const extra = c.lessons.filter((l) => !out.includes(l) && l.date && !(c.weekdays.includes(parse(l.date).getDay())) && (l.title || l.goals)); // manual lessons with content survive
    c.lessons = [...out, ...extra]; sortLessons();
  }
  let saveT = null;
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => CM.save().catch((e) => CMX.say(e.message)), 700); };

  // ---------- the calendar screen ----------
  let syncing = false;
  function renderCalendar(host) {
    const c = cal();
    if (!syncing) { syncing = true; syncAttendance().then((changed) => { syncing = false; if (changed) { saveSoon(); CMX.render(); } }, () => { syncing = false; }); }
    host.appendChild(mk("p", "hint", linked() ? "This calendar follows the Attendance module: one lesson for each class meeting there. Change the number of classes or the dates in Attendance; plan each lesson here." : "Plan each lesson here. Slideshows tied to a lesson show it highlighted on their Calendar slide."));
    const setup = mk("div", "cm-row cm-setup");
    const field = (label, el) => { const l = mk(el.tagName === "DIV" ? "div" : "label", "", label); l.style.cssText = "display:flex;flex-direction:column;font-size:.78rem;gap:2px"; l.appendChild(el); setup.appendChild(l); return el; };
    const date = (k) => { const i = mk("input"); i.type = "date"; i.value = c[k]; i.addEventListener("change", () => { c[k] = i.value; saveSoon(); }); return i; };
    field("Term starts", date("start")); field("Term ends", date("end"));
    const wd = mk("div"); wd.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    DAYS.forEach((n, i) => { const l = mk("label", "", ""); const cb = mk("input"); cb.type = "checkbox"; cb.checked = c.weekdays.includes(i); l.append(cb, " " + n); cb.addEventListener("change", () => { c.weekdays = DAYS.map((_, k) => k).filter((k) => (k === i ? cb.checked : c.weekdays.includes(k))); saveSoon(); }); wd.appendChild(l); });
    field("Meets on", wd);
    const sk = mk("textarea"); sk.rows = 2; sk.placeholder = "e.g. 2026-11-03, 2026-12-29"; sk.value = c.skip.join(", ");
    sk.addEventListener("change", () => { c.skip = sk.value.split(/[\s,;]+/).filter((x) => parse(x)); saveSoon(); });
    field("No class on (dates)", sk);
    setup.appendChild(btn("Make lessons from these dates", "btn btn-primary btn-small", () => {
      try { if (c.lessons.length && !confirm("Rebuild the lesson list from these dates? Lessons you wrote on dates that still meet are kept.")) return; generate(); saveSoon(); CMX.render(); } catch (e) { CMX.say(e.message); }
    }));
    if (!linked()) host.appendChild(setup);
    host.appendChild(mk("span", "result cm-note", ""));

    const list = mk("div"); host.appendChild(list);
    const draw = () => {
      list.innerHTML = "";
      if (!c.lessons.length) { list.appendChild(mk("p", "hint", "No lessons yet. Fill in the term dates above and press “Make lessons”, or add one by hand.")); }
      const today = ymd(new Date());
      c.lessons.forEach((l) => {
        const row = mk("div", "cm-lesson" + (l.date === today ? " today" : ""));
        row.appendChild(mk("div", "cm-ln", `Lesson ${l.n}`));
        const wk = mk("div", "cm-lw", weekOf(l.date) ? `Week ${weekOf(l.date)}` : "");
        const d = mk("input"); d.type = "date"; d.value = l.date || ""; if (l.sessionId && l.dateFromAttendance) { d.disabled = true; d.title = "Set in Attendance"; }
        d.addEventListener("change", () => { l.date = d.value; sortLessons(); saveSoon(); CMX.render(); });
        const left = mk("div"); left.append(wk, d); row.appendChild(left);
        const t = (k, ph, tag) => { const i = mk(tag || "input"); if (tag) i.rows = 3; i.placeholder = ph; i.value = l[k]; i.addEventListener("input", () => { l[k] = i.value; saveSoon(); }); return i; };
        const mid = mk("div"); mid.append(t("title", "Lesson title / topic"), t("goals", "Goals — one per line", "textarea")); row.appendChild(mid);
        const right = mk("div"); right.append(t("materials", "Materials"), t("homework", "Homework")); row.appendChild(right);
        if (!l.sessionId) row.appendChild(btn("✕", "btn btn-ghost btn-small", () => { if (confirm(`Delete Lesson ${l.n}? Slideshows tied to it become unlinked.`)) { c.lessons = c.lessons.filter((x) => x !== l); CM.items.forEach((it) => { if (it.lessonId === l.id) it.lessonId = null; }); sortLessons(); saveSoon(); CMX.render(); } }));
        list.appendChild(row);
      });
      if (!linked()) list.appendChild(btn("+ Add a lesson", "btn btn-ghost btn-small", () => { c.lessons.push({ id: uid(), n: 0, date: "", title: "", goals: "", materials: "", homework: "" }); sortLessons(); saveSoon(); CMX.render(); }));
    };
    draw();
  }
  const css = mk("style");
  css.textContent = `
#classmaterial-panel .cm-lesson { display:grid; grid-template-columns:70px 150px 1fr 1fr auto; gap:8px 12px; align-items:start; background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:8px; }
#classmaterial-panel .cm-lesson.today { border-color:var(--green); box-shadow:0 0 0 2px color-mix(in srgb, var(--green) 25%, transparent); }
#classmaterial-panel .cm-lesson input, #classmaterial-panel .cm-lesson textarea { width:100%; margin:0 0 4px; font:inherit; }
#classmaterial-panel .cm-lesson input, #classmaterial-panel .cm-lesson textarea, #classmaterial-panel .cm-setup input, #classmaterial-panel .cm-setup textarea { padding:6px 8px; border:1px solid var(--line); border-radius:6px; background:var(--paper); color:var(--ink); box-sizing:border-box; }
#classmaterial-panel .cm-ln { font-family:var(--font-heading); font-weight:700; }
#classmaterial-panel .cm-lw { font-size:.8rem; color:var(--ink-soft,#777); }
#cm-modal { position:fixed; inset:0; z-index:20003; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#cm-modal > div { background:var(--card,#fff); color:var(--ink,#222); width:min(460px,100%); border-radius:10px; border:2px solid var(--green); padding:16px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5); display:grid; gap:10px; }
#cm-modal h3 { margin:0; } #cm-modal label { display:flex; flex-direction:column; font-size:.85rem; gap:3px; } #cm-modal input, #cm-modal select { font:inherit; padding:7px; }
@media (max-width:760px){ #classmaterial-panel .cm-lesson { grid-template-columns:1fr; } }
`;
  document.head.appendChild(css);
  CMX.views.calendar = { label: "Lesson calendar", render: renderCalendar };

  // ---------- Slides API building blocks ----------
  const PAL = { dark: "#2f5233", cream: "#f6f5f1", ink: "#2b2a28", soft: "#6b6560", amber: "#ffe08a", line: "#cfc9b8", white: "#ffffff" };
  const rgb = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
  const sid = (() => { let n = 0; const run = Math.random().toString(36).slice(2, 7); return (tag) => `gg_${run}_${tag}${++n}`; })();
  function Builder() {
    const r = [];
    const pt = (v) => ({ magnitude: v, unit: "PT" });
    const props = (page, x, y, w, h) => ({ pageObjectId: page, size: { width: pt(w), height: pt(h) }, transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: "PT" } });
    const style = (id, o, extra) => {
      const st = { fontSize: pt(o.size || 16), bold: !!o.bold, fontFamily: o.font || "Arial", foregroundColor: { opaqueColor: { rgbColor: rgb(o.color || PAL.ink) } } };
      r.push({ updateTextStyle: Object.assign({ objectId: id, textRange: { type: "ALL" }, style: st, fields: "fontSize,bold,fontFamily,foregroundColor" }, extra || {}) });
    };
    return {
      r, pt,
      slide(id, index, bg) {
        r.push({ createSlide: { objectId: id, insertionIndex: index, slideLayoutReference: { predefinedLayout: "BLANK" } } });
        r.push({ updatePageProperties: { objectId: id, pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: rgb(bg) } } } }, fields: "pageBackgroundFill.solidFill.color" } });
      },
      text(page, x, y, w, h, str, o = {}) {
        if (!str) return; const id = sid("t");
        r.push({ createShape: { objectId: id, shapeType: "TEXT_BOX", elementProperties: props(page, x, y, w, h) } });
        r.push({ insertText: { objectId: id, insertionIndex: 0, text: str } });
        style(id, o);
        if (o.align) r.push({ updateParagraphStyle: { objectId: id, textRange: { type: "ALL" }, style: { alignment: o.align }, fields: "alignment" } });
        if (o.bullets) r.push({ createParagraphBullets: { objectId: id, textRange: { type: "ALL" }, bulletPreset: "BULLET_DISC_CIRCLE_SQUARE" } });
      },
      rect(page, x, y, w, h, fill) {
        const id = sid("r");
        r.push({ createShape: { objectId: id, shapeType: "RECTANGLE", elementProperties: props(page, x, y, w, h) } });
        r.push({ updateShapeProperties: { objectId: id, shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: rgb(fill) } } }, outline: { propertyState: "NOT_RENDERED" } }, fields: "shapeBackgroundFill.solidFill.color,outline.propertyState" } });
      },
      image(page, url, x, y, w, h) {
        r.push({ createImage: { objectId: sid("i"), url, elementProperties: props(page, x, y, w, h) } });
      },
      desk(page, x, y, w, h, fill, str, size, bold) {
        const id = sid("d");
        r.push({ createShape: { objectId: id, shapeType: "RECTANGLE", elementProperties: props(page, x, y, w, h) } });
        r.push({ updateShapeProperties: { objectId: id, shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: rgb(fill) } } }, outline: { outlineFill: { solidFill: { color: { rgbColor: rgb("#8a8472") } } }, weight: pt(0.75) }, contentAlignment: "MIDDLE" }, fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight,contentAlignment" } });
        if (str) {
          r.push({ insertText: { objectId: id, insertionIndex: 0, text: str } });
          style(id, { size: size || 10, bold: !!bold, color: PAL.ink });
          r.push({ updateParagraphStyle: { objectId: id, textRange: { type: "ALL" }, style: { alignment: "CENTER" }, fields: "alignment" } });
        }
      },
      table(page, x, y, widths, rows, hiRow, H, fs, hiColor) {
        const id = sid("tb"), W = widths.reduce((a, b) => a + b, 0);
        r.push({ createTable: { objectId: id, elementProperties: props(page, x, y, W, H || rows.length * 22), rows: rows.length, columns: widths.length } });
        widths.forEach((w, ci) => r.push({ updateTableColumnProperties: { objectId: id, columnIndices: [ci], tableColumnProperties: { columnWidth: pt(w) }, fields: "columnWidth" } }));
        rows.forEach((row, ri) => {
          const head = ri === 0, hi = ri === hiRow;
          const fill = head ? PAL.dark : hi ? (hiColor || PAL.amber) : ri % 2 ? PAL.white : PAL.cream;
          r.push({ updateTableCellProperties: { objectId: id, tableRange: { location: { rowIndex: ri, columnIndex: 0 }, rowSpan: 1, columnSpan: widths.length }, tableCellProperties: { tableCellBackgroundFill: { solidFill: { color: { rgbColor: rgb(fill) } } }, contentAlignment: "MIDDLE" }, fields: "tableCellBackgroundFill.solidFill.color,contentAlignment" } });
          row.forEach((cell, ci) => {
            if (!cell) return; const loc = { rowIndex: ri, columnIndex: ci };
            r.push({ insertText: { objectId: id, cellLocation: loc, insertionIndex: 0, text: cell } });
            style(id, { size: head ? (fs || 10) + 1 : fs || 10, bold: head || hi, color: head ? PAL.cream : PAL.ink }, { cellLocation: loc });
          });
        });
      },
    };
  }

  // ---------- slide types ("Basic" slideshow = Title + Today's goals + Calendar) ----------
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  /** Cover slide templates. To add one: add an entry here (bg + draw) and a preview in COVER_PREVIEW. */
  const COVERS = {
    classic: { label: "Classic", bg: PAL.dark, draw(b, page, c) {
      b.rect(page, 0, 300, 720, 105, "#223d26");
      b.text(page, 50, 120, 620, 90, c.title, { size: 40, bold: true, font: "Georgia", color: PAL.cream });
      b.text(page, 50, 215, 620, 30, c.sub, { size: 18, color: "#e6d9a8" });
      b.text(page, 50, 322, 620, 40, c.course, { size: 22, font: "Georgia", color: PAL.cream });
    } },
    band: { label: "Top band", bg: PAL.cream, draw(b, page, c) {
      b.rect(page, 0, 0, 720, 92, PAL.dark);
      b.text(page, 40, 30, 640, 36, c.course, { size: 22, font: "Georgia", color: PAL.cream });
      b.text(page, 40, 140, 640, 110, c.title, { size: 42, bold: true, font: "Georgia", color: PAL.dark });
      b.rect(page, 40, 262, 120, 4, "#e0a526");
      b.text(page, 40, 280, 640, 30, c.sub, { size: 18, color: PAL.soft });
    } },
    centered: { label: "Centered", bg: "#223d26", draw(b, page, c) {
      b.text(page, 40, 110, 640, 110, c.title, { size: 44, bold: true, font: "Georgia", color: PAL.cream, align: "CENTER" });
      b.rect(page, 300, 236, 120, 4, "#e0a526");
      b.text(page, 40, 256, 640, 30, c.sub, { size: 18, color: "#e6d9a8", align: "CENTER" });
      b.text(page, 40, 330, 640, 34, c.course, { size: 20, font: "Georgia", color: PAL.cream, align: "CENTER" });
    } },
    sidebar: { label: "Side bar", bg: PAL.cream, draw(b, page, c) {
      b.rect(page, 0, 0, 200, 405, PAL.dark);
      if (c.n) { b.text(page, 10, 110, 180, 24, "LESSON", { size: 14, bold: true, color: "#e6d9a8", align: "CENTER" }); b.text(page, 10, 136, 180, 120, c.n, { size: 90, bold: true, font: "Georgia", color: PAL.cream, align: "CENTER" }); }
      b.text(page, 230, 120, 450, 120, c.title, { size: 36, bold: true, font: "Georgia", color: PAL.dark });
      b.text(page, 230, 250, 450, 30, c.sub, { size: 16, color: PAL.soft });
      b.text(page, 230, 330, 450, 34, c.course, { size: 18, font: "Georgia", color: PAL.soft });
    } },
  };
  COVERS.textbook = { label: "Textbook picture", bg: PAL.cream, draw(b, page, c) {
    b.rect(page, 450, 0, 270, 405, "#e9e4d3");
    b.text(page, 40, 44, 380, 30, c.course, { size: 18, font: "Georgia", color: PAL.soft });
    b.text(page, 40, 120, 390, 140, c.title, { size: 38, bold: true, font: "Georgia", color: PAL.dark });
    b.rect(page, 40, 272, 100, 4, "#e0a526");
    b.text(page, 40, 290, 390, 60, c.sub, { size: 16, color: PAL.soft });
    if (c.image) {
      const W = 230, H = 330, sc = Math.min(W / c.image.w, H / c.image.h), w = c.image.w * sc, h = c.image.h * sc, x = 585 - w / 2, y = 202 - h / 2;
      b.rect(page, x + 5, y + 5, w, h, "#c9c2ab"); // soft shadow
      b.image(page, c.image.url, x, y, w, h);
    }
  } };
  const SLIDE_TYPES = {
    title(b, page, ctx) {
      const o = ctx.opts.title, v = COVERS[o.variant] || COVERS.classic, l = ctx.lesson;
      v.draw(b, page, {
        title: l && l.title ? l.title : ctx.title,
        sub: [o.showLesson && l ? lessonLabel(l) : "", o.subtitle || ""].filter(Boolean).join("   ·   "),
        course: o.showCourse ? ctx.course : "", n: l ? String(l.n) : "", image: ctx.image || null,
      });
    },
    goals(b, page, ctx) {
      const l = ctx.lesson; if (!l) return false;
      b.text(page, 40, 28, 640, 50, "Today’s goals", { size: 32, bold: true, font: "Georgia", color: PAL.dark });
      const goals = (l.goals || "").split("\n").map((x) => x.trim()).filter(Boolean);
      b.text(page, 50, 95, 620, goals.length ? 180 : 40, goals.length ? goals.join("\n") : (l.title || ""), { size: 22, bullets: !!goals.length });
      if (l.materials && ctx.opts.goals.materials) { b.rect(page, 40, 295, 300, 90, PAL.white); b.text(page, 50, 300, 280, 80, "Materials\n" + l.materials, { size: 13, color: PAL.soft }); }
      if (l.homework && ctx.opts.goals.homework) { b.rect(page, 380, 295, 300, 90, PAL.white); b.text(page, 390, 300, 280, 80, "Homework\n" + l.homework, { size: 13, color: PAL.soft }); }
    },
    calendar(b, page, ctx) {
      const L = cal().lessons; if (!L.length) return false;
      const MAX = 14; let from = 0;
      const cur = ctx.lesson ? L.findIndex((x) => x.id === ctx.lesson.id) : -1;
      if (L.length > MAX) from = Math.max(0, Math.min(L.length - MAX, (cur < 0 ? 0 : cur) - 4));
      const part = L.slice(from, from + MAX);
      const rows = [["#", "Week · Date", "Class calendar — what we do"]].concat(part.map((l) => [String(l.n), parse(l.date) ? `${weekOf(l.date) ? `Wk ${weekOf(l.date)} · ` : ""}${dayLabel(l)}` : "", clip([l.title, ctx.opts.calendar.goals ? (l.goals || "").split("\n").map((x) => x.trim()).filter(Boolean).join(" · ") : ""].filter(Boolean).join(" — "), 90)]));
      b.table(page, 0, 0, [48, 150, 522], rows, cur < 0 ? -1 : cur - from + 1, 405, 13, (HILITES[ctx.opts.calendar.highlight] || HILITES.amber).hex);
    },
  };
  /** Reads the course's current seating chart + roster straight from storage, so every rebuild is up to date. */
  async function loadSeating() {
    try {
      const [sd, rd] = await Promise.all([storage.loadFile(`seating-${CM.courseId}.json`), storage.loadFile(`roster-${CM.courseId}.json`)]);
      if (!sd) return null;
      const keys = Object.keys(sd.active || {}).filter((k) => sd.active[k]);
      if (!keys.length) return null;
      return { keys, seats: sd.seats || {}, groups: sd.groups || {}, students: (rd && rd.students) || [] };
    } catch (e) { return null; }
  }
  const hsl = (h, sat, l) => { sat /= 100; l /= 100; const a = sat * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); }; return `#${f(0)}${f(8)}${f(4)}`; };
  const seatingSlide = (withGroups) => function (b, page, ctx) {
    const S = ctx.seating; if (!S) return false;
    if (withGroups && !S.keys.some((k) => S.groups[k])) return false; // no groups set up: skip this slide
    const pos = S.keys.map((k) => k.split("-").map(Number)), r0 = Math.min(...pos.map((p) => p[0])), r1 = Math.max(...pos.map((p) => p[0])), c0 = Math.min(...pos.map((p) => p[1])), c1 = Math.max(...pos.map((p) => p[1]));
    const rows = r1 - r0 + 1, cols = c1 - c0 + 1, AW = 660, AH = withGroups ? 290 : 310, cw = Math.min(110, AW / cols), ch = Math.min(60, AH / rows);
    const ox = 30 + (AW - cw * cols) / 2, oy = (withGroups ? 76 : 68) + (AH - ch * rows) / 2, size = Math.max(7, Math.min(13, Math.floor(cw / 7.5)));
    const byId = new Map(S.students.map((st) => [st.id, st]));
    b.text(page, 40, 14, 640, 40, withGroups ? "Seating chart — groups" : "Seating chart", { size: 28, bold: true, font: "Georgia", color: PAL.dark });
    if (ctx.lesson) b.text(page, 360, 22, 320, 28, lessonLabel(ctx.lesson), { size: 13, color: PAL.soft, align: "END" });
    S.keys.forEach((k, i) => {
      const [r, c] = k.split("-").map(Number), st = byId.get(S.seats[k]), g = S.groups[k];
      const full = st ? String(st.name || "") : "", nm = st ? (ctx.opts.seating.names === "first" ? full.split(/\s+/)[0] : clip(full, 20)) : "";
      b.desk(page, ox + (c1 - c) * cw + 2, oy + (r1 - r) * ch + 2, // turned 180° so it reads from the students' side of the room
         cw - 4, ch - 4, withGroups && g ? hsl(Math.round((g * 137.508) % 360), 70, 78) : PAL.white, nm, size, false);
    });
    if (withGroups) {
      const gs = [...new Set(S.keys.map((k) => S.groups[k]).filter(Boolean))].sort((a, z) => a - z);
      gs.forEach((g, i) => b.desk(page, 40 + i * 62, 52, 56, 18, hsl(Math.round((g * 137.508) % 360), 70, 78), `Group ${g}`, 9, true));
    }
  };
  SLIDE_TYPES.seating = seatingSlide(false);
  SLIDE_TYPES.seatingGroups = seatingSlide(true);
  const TYPE_LABELS = { title: "Cover slide", goals: "Today’s goals", seating: "Seating chart", seatingGroups: "Seating chart — groups", calendar: "Class calendar" };
  const HILITES = { amber: { label: "Amber", hex: PAL.amber }, green: { label: "Green", hex: "#bfe3bd" }, blue: { label: "Blue", hex: "#b9d7f2" }, pink: { label: "Pink", hex: "#f6c6d8" } };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const defaultOpts = () => ({
    order: ["title", "goals", "seating", "seatingGroups", "calendar"].map((t) => ({ type: t, on: true })),
    title: { variant: "classic", showCourse: true, showLesson: true, subtitle: "" },
    goals: { materials: true, homework: true },
    seating: { names: "full" },
    calendar: { goals: true, highlight: "amber" },
  });
  /** Options saved with a slideshow, filled in with defaults for anything missing (so adding options later is safe). */
  function getOpts(it) {
    const d = defaultOpts(), o = (it && it.source && it.source.options) || {}, out = clone(d);
    ["title", "goals", "seating", "calendar"].forEach((k) => Object.assign(out[k], o[k] || {}));
    if (Array.isArray(o.order)) { const seen = new Set(); out.order = o.order.filter((x) => TYPE_LABELS[x.type] && !seen.has(x.type) && seen.add(x.type)); d.order.forEach((x) => { if (!seen.has(x.type)) out.order.push(x); }); }
    return out;
  }
  const bgFor = (type, opts) => (type === "title" ? (COVERS[opts.title.variant] || COVERS.classic).bg : PAL.cream);

  /** (Re)builds the generated slides of a Basic slideshow. First time: replaces the blank starter slide. Later: replaces the generated slides only. */
  async function buildBasic(it, opts) {
    opts = opts || getOpts(it);
    try { if (await syncAttendance()) await CM.save(); } catch (e) {}
    const pres = await G.call(`${SLIDES}${it.fileId}?fields=slides.objectId`);
    const oldIds = it.source && it.source.slideIds ? it.source.slideIds : (pres.slides || []).map((s) => s.objectId);
    const ctx = { title: it.title, course: CMX.courseTitle(), lesson: it.lessonId ? lessonById(it.lessonId) : null, seating: await loadSeating(), opts };
    let warn = "";
    const wantsImage = opts.order.some((x) => x.on && x.type === "title") && opts.title.variant === "textbook" && CM.textbook;
    const b = Builder(), made = [], byType = {}; let idx = 0;
    const url = wantsImage ? `https://drive.google.com/uc?export=download&id=${CM.textbook.fileId}` : "";
    if (wantsImage) ctx.image = { url, w: CM.textbook.w || 3, h: CM.textbook.h || 4 };
    opts.order.filter((x) => x.on).map((x) => x.type).forEach((type) => {
      const probe = Builder(), pid = sid("p");
      probe.slide(pid, idx, bgFor(type, opts));
      if (SLIDE_TYPES[type](probe, pid, ctx) === false) return;
      b.r.push(...probe.r); made.push(pid); byType[type] = pid; idx++;
    });
    oldIds.forEach((id) => b.r.push({ deleteObject: { objectId: id } }));
    const send = (reqs) => G.call(`${SLIDES}${it.fileId}:batchUpdate`, { method: "POST", body: { requests: reqs } });
    if (wantsImage) {
      await withSharedImage(CM.textbook, async (ok, msg) => {
        if (ok) return send(b.r);
        warn = msg; // rebuild the same slides without the picture
        ctx.image = null; const nb = Builder(); let k = 0, m2 = [], bt2 = {};
        opts.order.filter((x) => x.on).map((x) => x.type).forEach((type) => { const pr = Builder(), pid = sid("p"); pr.slide(pid, k, bgFor(type, opts)); if (SLIDE_TYPES[type](pr, pid, ctx) === false) return; nb.r.push(...pr.r); m2.push(pid); bt2[type] = pid; k++; });
        oldIds.forEach((id) => nb.r.push({ deleteObject: { objectId: id } })); made.length = 0; made.push(...m2); Object.keys(byType).forEach((k2) => delete byType[k2]); Object.assign(byType, bt2);
        return send(nb.r);
      });
    } else await send(b.r);
    if (warn) CMX.say(warn);
    it.source = { template: "basic", slideIds: made, byType, options: opts };
    it.updatedAt = new Date().toISOString();
    await CM.save();
  }

  /** Rebuilds just one generated slide (e.g. the seating chart) in place, leaving everything else alone. */
  async function refreshType(it, type) {
    const old = it.source && it.source.byType && it.source.byType[type]; if (!old) return false;
    const pres = await G.call(`${SLIDES}${it.fileId}?fields=slides.objectId`);
    const ids = (pres.slides || []).map((x) => x.objectId), at = ids.indexOf(old);
    if (at < 0) return false; // the teacher deleted it — leave the deck alone
    const ctx = { title: it.title, course: CMX.courseTitle(), lesson: it.lessonId ? lessonById(it.lessonId) : null, seating: await loadSeating(), opts: getOpts(it) };
    const b = Builder(), pid = sid("p"); b.slide(pid, at, bgFor(type, ctx.opts));
    if (SLIDE_TYPES[type](b, pid, ctx) === false) return false;
    b.r.push({ deleteObject: { objectId: old } });
    await G.call(`${SLIDES}${it.fileId}:batchUpdate`, { method: "POST", body: { requests: b.r } });
    it.source.byType[type] = pid; it.source.slideIds = it.source.slideIds.map((x) => (x === old ? pid : x));
    await CM.save(); return true;
  }
  /** Present: refresh the seating chart first so it matches today's real chart, then start the slideshow. */
  async function present(it) {
    const w = window.open("", "_blank"); // opened inside the click so the browser allows it
    const url = `https://docs.google.com/presentation/d/${it.fileId}/present`;
    try {
      const bt = (it.source && it.source.byType) || {};
      if (bt.seating || bt.seatingGroups) { CMX.say("Refreshing the seating chart…"); for (const t of ["seating", "seatingGroups"]) if (bt[t]) await refreshType(it, t); CMX.say(""); }
    }
    catch (e) { CMX.say("Couldn't refresh the seating chart (" + e.message + ") — presenting as it was."); }
    if (w) w.location = url; else window.open(url, "_blank");
  }

  // ---------- picture library (a folder in your Google Drive) + the course's textbook picture ----------
  const IMG_FOLDER = "Images";
  const imgFolder = async () => G.folder(IMG_FOLDER, await G.folder("GradingGrid Class Material"));
  const Pics = {
    cache: new Map(),
    async list() {
      const f = await imgFolder();
      const q = `'${f}' in parents and trashed=false and mimeType contains 'image/'`;
      const r = await G.api(`/files?q=${encodeURIComponent(q)}&fields=files(id,name,appProperties)&orderBy=name&pageSize=100`);
      return r.files || [];
    },
    async url(id) { // thumbnail as a blob, fetched with the token (the file itself stays private)
      if (this.cache.has(id)) return this.cache.get(id);
      const res = await G.authed(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`); if (!res.ok) throw new Error("Couldn't load a picture.");
      const u = URL.createObjectURL(await res.blob()); this.cache.set(id, u); return u;
    },
    async upload(file) {
      if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) throw new Error("Please choose a PNG, JPG, GIF or WebP picture.");
      if (file.size > 8 * 1024 * 1024) throw new Error("That picture is over 8 MB. Please use a smaller one.");
      const dim = await new Promise((ok) => { const i = new Image(), u = URL.createObjectURL(file); i.onload = () => { ok({ w: i.naturalWidth, h: i.naturalHeight }); URL.revokeObjectURL(u); }; i.onerror = () => ok({ w: 3, h: 4 }); i.src = u; });
      const parent = await imgFolder(), bd = "ggo" + Date.now();
      const meta = JSON.stringify({ name: file.name, parents: [parent], appProperties: { w: String(dim.w), h: String(dim.h) } });
      const body = new Blob([`--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${bd}\r\nContent-Type: ${file.type}\r\n\r\n`, file, `\r\n--${bd}--`]);
      const res = await G.authed("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,appProperties", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${bd}` }, body });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      return res.json();
    },
    async remove(id) { await G.api(`/files/${id}`, { method: "PATCH", body: { trashed: true } }); this.cache.delete(id); },
  };
  /** Grid of the library's pictures. onPick(file) is called when one is chosen. */
  function imageGrid(host, onPick) {
    host.innerHTML = "";
    const bar = mk("div", "cm-row"), note = mk("span", "result", ""), grid = mk("div"); grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px";
    const up = mk("input"); up.type = "file"; up.accept = "image/png,image/jpeg,image/gif,image/webp"; up.style.display = "none";
    const say = (t, bad) => { note.textContent = t || ""; note.style.color = bad ? "#b3261e" : ""; };
    const load = async () => {
      say("Loading pictures…"); grid.innerHTML = "";
      try {
        const files = await Pics.list(); say(files.length ? "" : "No pictures yet. Upload a textbook cover to get started.");
        files.forEach((f) => {
          const card = mk("div"); card.style.cssText = "border:1.5px solid var(--line);border-radius:8px;padding:6px;text-align:center;background:var(--card)";
          if (CM.textbook && CM.textbook.fileId === f.id) card.style.borderColor = "var(--green)";
          const im = mk("img"); im.style.cssText = "width:100%;height:120px;object-fit:contain;background:var(--paper);border-radius:4px"; im.alt = f.name; Pics.url(f.id).then((u) => { im.src = u; }, () => {});
          card.append(im, mk("div", "cm-meta", f.name));
          const row = mk("div"); row.style.cssText = "display:flex;gap:4px;justify-content:center;margin-top:4px";
          row.append(btn(CM.textbook && CM.textbook.fileId === f.id ? "✓ In use" : "Use for this course", "btn btn-small " + (CM.textbook && CM.textbook.fileId === f.id ? "btn-primary" : "btn-ghost"), async () => {
            CM.textbook = { fileId: f.id, name: f.name, w: Number((f.appProperties || {}).w) || 3, h: Number((f.appProperties || {}).h) || 4 };
            await CM.save(); if (onPick) onPick(CM.textbook); load();
          }), btn("🗑", "btn btn-ghost btn-small", async () => {
            if (!confirm(`Move "${f.name}" to the Google Drive trash?`)) return;
            try { await Pics.remove(f.id); if (CM.textbook && CM.textbook.fileId === f.id) { CM.textbook = null; await CM.save(); } load(); } catch (e) { say(e.message, true); }
          }));
          card.appendChild(row); grid.appendChild(card);
        });
      } catch (e) { say(e.message, true); }
    };
    bar.append(btn("⬆ Upload a picture", "btn btn-primary btn-small", () => up.click()), up, note);
    up.addEventListener("change", async () => { const f = up.files[0]; up.value = ""; if (!f) return; say("Uploading…"); try { await Pics.upload(f); await load(); } catch (e) { say(e.message, true); } });
    host.append(bar, grid);
    if (G.connected()) load(); else { say(""); bar.appendChild(btn("Show my pictures", "btn btn-ghost btn-small", () => load())); }
  }
  CMX.views.images = { label: "Pictures", render(host) {
    host.appendChild(mk("p", "hint", `Pictures live in your Google Drive (GradingGrid Class Material › ${IMG_FOLDER}). Choose one as this course’s textbook picture for the “Textbook picture” cover.`));
    const cur = mk("p", "", CM.textbook ? `Textbook picture for this course: ${CM.textbook.name}` : "No textbook picture chosen for this course yet."); cur.style.fontWeight = "600"; host.appendChild(cur);
    const g = mk("div"); host.appendChild(g); imageGrid(g, (t) => { cur.textContent = `Textbook picture for this course: ${t.name}`; });
  } };

  /** Lets Google's servers fetch the picture for a few seconds (Slides can only pull public URLs), then locks it again. */
  async function withSharedImage(image, fn) {
    let shared = false;
    try { await G.call(`https://www.googleapis.com/drive/v3/files/${image.fileId}/permissions`, { method: "POST", body: { role: "reader", type: "anyone" } }); shared = true; }
    catch (e) { return fn(false, "Your Google account doesn’t allow the textbook picture to be placed (link sharing is blocked). The slide was made without it."); }
    try { return await fn(true); }
    finally { try { await G.call(`https://www.googleapis.com/drive/v3/files/${image.fileId}/permissions/anyoneWithLink`, { method: "DELETE" }); } catch (e) {} }
  }

  // ---------- creating + linking ----------
  function modal(title, fields, okLabel, onOk) {
    const ov = mk("div"); ov.id = "cm-modal"; const box = mk("div"); ov.appendChild(box); box.appendChild(mk("h3", "", title));
    const els = {};
    fields.forEach((f) => {
      const l = mk("label", "", f.label); let el;
      if (f.options) { el = mk("select"); f.options.forEach(([v, t]) => { const o = mk("option", "", t); o.value = v; el.appendChild(o); }); } else { el = mk("input"); }
      el.value = f.value || ""; l.appendChild(el); box.appendChild(l); els[f.key] = el;
    });
    const acts = mk("div"); acts.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
    const close = () => ov.remove();
    acts.append(btn("Cancel", "btn btn-ghost", close), btn(okLabel, "btn btn-primary", () => { const v = {}; Object.keys(els).forEach((k) => { v[k] = els[k].value; }); close(); onOk(v); }));
    box.appendChild(acts); document.body.appendChild(ov); const first = box.querySelector("input,select"); if (first) first.focus();
  }
  const lessonOptions = () => [["", "No lesson"], ...cal().lessons.map((l) => [l.id, `${lessonLabel(l)}${l.title ? " — " + l.title : ""}`])];

  // ---------- the big slideshow setup window (new slideshow, or "Setup…" on an existing Basic one) ----------
  const COVER_PREVIEW = {
    // tiny CSS pictures of each cover: [bg, [x%, y%, w%, h%, color]...]
    classic: ["#2f5233", [[0, 74, 100, 26, "#223d26"], [8, 28, 70, 12, "#f6f5f1"], [8, 46, 40, 5, "#e6d9a8"]]],
    band: ["#f6f5f1", [[0, 0, 100, 23, "#2f5233"], [8, 38, 70, 12, "#2f5233"], [8, 60, 22, 3, "#e0a526"]]],
    centered: ["#223d26", [[15, 30, 70, 12, "#f6f5f1"], [40, 52, 20, 3, "#e0a526"], [30, 78, 40, 6, "#f6f5f1"]]],
    textbook: ["#f6f5f1", [[8, 35, 45, 11, "#2f5233"], [8, 58, 18, 3, "#e0a526"], [62, 0, 38, 100, "#e9e4d3"], [70, 16, 22, 68, "#2f5233"]]],
    sidebar: ["#f6f5f1", [[0, 0, 28, 100, "#2f5233"], [6, 30, 16, 24, "#f6f5f1"], [36, 32, 54, 11, "#2f5233"], [36, 55, 30, 4, "#8a8472"]]],
  };
  const css2 = mk("style");
  css2.textContent = `
#cm-setup { position:fixed; inset:0; z-index:20003; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:2vh 2vw; }
#cm-setup .cs-win { background:var(--card,#fff); color:var(--ink,#222); width:min(1100px,96vw); height:min(760px,94vh); border-radius:12px; border:2px solid var(--green); box-shadow:0 16px 50px rgba(0,0,0,.55); display:grid; grid-template-rows:auto 1fr auto; overflow:hidden; }
#cm-setup .cs-head { padding:14px 20px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; }
#cm-setup .cs-head h2 { margin:0; font-family:var(--font-heading); }
#cm-setup .cs-body { display:grid; grid-template-columns:minmax(260px,340px) 1fr; min-height:0; }
#cm-setup .cs-left { border-right:1px solid var(--line); padding:14px 16px; overflow:auto; display:grid; gap:10px; align-content:start; }
#cm-setup .cs-right { padding:16px 20px; overflow:auto; }
#cm-setup label.f { display:flex; flex-direction:column; gap:3px; font-size:.82rem; }
#cm-setup input[type=text], #cm-setup select { font:inherit; padding:7px 8px; border:1px solid var(--line); border-radius:6px; background:var(--paper); color:var(--ink); }
#cm-setup .cs-h { font-size:.74rem; text-transform:uppercase; letter-spacing:.07em; color:var(--ink-soft,#777); margin:6px 0 0; }
#cm-setup .cs-slide { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1.5px solid var(--line); border-radius:8px; cursor:pointer; }
#cm-setup .cs-slide.sel { border-color:var(--green); background:color-mix(in srgb, var(--green) 10%, transparent); }
#cm-setup .cs-slide .nm { flex:1; font-weight:600; }
#cm-setup .cs-slide.off .nm { opacity:.5; text-decoration:line-through; }
#cm-setup .cs-covers { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:12px; margin:8px 0 14px; }
#cm-setup .cs-cover { border:2px solid var(--line); border-radius:8px; padding:6px; cursor:pointer; text-align:center; font-size:.85rem; background:transparent; color:inherit; font:inherit; }
#cm-setup .cs-cover.sel { border-color:var(--green); box-shadow:0 0 0 2px color-mix(in srgb, var(--green) 30%, transparent); }
#cm-setup .cs-thumb { position:relative; width:100%; aspect-ratio:16/9; border-radius:4px; overflow:hidden; border:1px solid rgba(0,0,0,.15); margin-bottom:5px; }
#cm-setup .cs-thumb i { position:absolute; display:block; border-radius:1px; }
#cm-setup .cs-foot { padding:12px 20px; border-top:1px solid var(--line); display:flex; gap:10px; justify-content:flex-end; align-items:center; }
#cm-setup .cs-opt { display:flex; gap:8px; align-items:center; margin:6px 0; }
@media (max-width:760px){ #cm-setup .cs-body { grid-template-columns:1fr; } #cm-setup .cs-left { border-right:0; border-bottom:1px solid var(--line); max-height:42vh; } }
`;
  document.head.appendChild(css2);

  function setupDialog(it) {
    sortLessons();
    const O = it ? getOpts(it) : defaultOpts();
    const st = { name: it ? it.title : `${CMX.courseTitle()} – Slideshow`, lesson: it ? it.lessonId || "" : "", tpl: it && !(it.source && it.source.template === "basic") ? "blank" : "basic", sel: "title" };
    const ov = mk("div"); ov.id = "cm-setup";
    const win = mk("div", "cs-win"); ov.appendChild(win);
    const close = () => ov.remove();
    const head = mk("div", "cs-head"); head.append(mk("h2", "", it ? "Slideshow setup" : "New slideshow"), btn("✕", "btn btn-ghost btn-small", close)); win.appendChild(head);
    const body = mk("div", "cs-body"); win.appendChild(body);
    const left = mk("div", "cs-left"), right = mk("div", "cs-right"); body.append(left, right);
    const foot = mk("div", "cs-foot"); win.appendChild(foot);

    const f = (label, el) => { const l = mk("label", "f", label); l.appendChild(el); return l; };
    const opt = (v, t) => Object.assign(mk("option"), { value: v, textContent: t });
    const check = (label, obj, key, on) => { const l = mk("label", "cs-opt"); const c = mk("input"); c.type = "checkbox"; c.checked = !!obj[key]; c.addEventListener("change", () => { obj[key] = c.checked; if (on) on(); }); l.append(c, " " + label); return l; };

    function drawLeft() {
      left.innerHTML = "";
      const nm = mk("input"); nm.type = "text"; nm.value = st.name; nm.addEventListener("input", () => { st.name = nm.value; });
      left.appendChild(f("Name", nm));
      const ls = mk("select"); lessonOptions().forEach(([v, t]) => ls.appendChild(opt(v, t))); ls.value = st.lesson; ls.addEventListener("change", () => { st.lesson = ls.value; });
      left.appendChild(f("For which lesson?", ls));
      if (!it) {
        const tp = mk("select"); tp.append(opt("basic", "Basic (set up slides below)"), opt("blank", "Blank (empty slideshow)")); tp.value = st.tpl;
        tp.addEventListener("change", () => { st.tpl = tp.value; draw(); }); left.appendChild(f("Start from", tp));
      }
      if (st.tpl !== "basic") return;
      left.appendChild(mk("div", "cs-h", "Slides — click one to set it up"));
      O.order.forEach((x, i) => {
        const row = mk("div", `cs-slide${st.sel === x.type ? " sel" : ""}${x.on ? "" : " off"}`);
        const c = mk("input"); c.type = "checkbox"; c.checked = x.on; c.title = "Include this slide";
        c.addEventListener("click", (e) => e.stopPropagation()); c.addEventListener("change", () => { x.on = c.checked; drawLeft(); });
        const mv = (d) => (e) => { e.stopPropagation(); const j = i + d; if (j < 0 || j >= O.order.length) return; [O.order[i], O.order[j]] = [O.order[j], O.order[i]]; drawLeft(); };
        row.append(c, mk("span", "nm", `${i + 1}. ${TYPE_LABELS[x.type]}`), btn("↑", "btn btn-ghost btn-small", mv(-1)), btn("↓", "btn btn-ghost btn-small", mv(1)));
        row.addEventListener("click", () => { st.sel = x.type; drawLeft(); drawRight(); });
        left.appendChild(row);
      });
    }

    function drawRight() {
      right.innerHTML = "";
      if (st.tpl !== "basic") { right.appendChild(mk("p", "hint", "A blank slideshow is created in your Drive. Choose “Basic” to build the title, goals, seating and calendar slides.")); return; }
      right.appendChild(mk("h3", "", TYPE_LABELS[st.sel]));
      if (st.sel === "title") {
        right.appendChild(mk("div", "cs-h", "Cover style"));
        const grid = mk("div", "cs-covers");
        Object.entries(COVERS).forEach(([k, v]) => {
          const card = mk("button", "cs-cover" + (O.title.variant === k ? " sel" : "")); card.type = "button";
          const th = mk("div", "cs-thumb"), pv = COVER_PREVIEW[k]; th.style.background = pv[0];
          pv[1].forEach(([x, y, w, h, col]) => { const i = mk("i"); i.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%;background:${col}`; th.appendChild(i); });
          card.append(th, document.createTextNode(v.label)); card.addEventListener("click", () => { O.title.variant = k; drawRight(); });
          grid.appendChild(card);
        });
        right.appendChild(grid);
        if (O.title.variant === "textbook") {
          const box = mk("div"); box.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:10px;margin:0 0 12px";
          const cur = mk("div", "", CM.textbook ? `Picture for this course: ${CM.textbook.name}` : "No picture chosen for this course yet."); cur.style.fontWeight = "600";
          const holder = mk("div"); holder.style.marginTop = "8px";
          box.append(cur, btn(CM.textbook ? "Change picture…" : "Choose or upload a picture…", "btn btn-ghost btn-small", () => { imageGrid(holder, (t) => { cur.textContent = `Picture for this course: ${t.name}`; }); }));
          box.appendChild(holder); right.appendChild(box);
        }
        right.appendChild(check("Show the course name", O.title, "showCourse"));
        right.appendChild(check("Show the lesson / week / date line", O.title, "showLesson"));
        const sub = mk("input"); sub.type = "text"; sub.value = O.title.subtitle; sub.placeholder = "e.g. Unit 3 — Describing people"; sub.addEventListener("input", () => { O.title.subtitle = sub.value; });
        right.appendChild(f("Extra subtitle (optional)", sub));
        right.appendChild(mk("p", "hint", "More cover styles and options will be added here."));
      } else if (st.sel === "goals") {
        right.appendChild(mk("p", "hint", "Shows the lesson’s goals as bullets. Skipped when no lesson is chosen."));
        right.appendChild(check("Show materials", O.goals, "materials")); right.appendChild(check("Show homework", O.goals, "homework"));
      } else if (st.sel === "seating" || st.sel === "seatingGroups") {
        right.appendChild(mk("p", "hint", st.sel === "seatingGroups" ? "Same chart with each group in its own color. Skipped when no groups are set up." : "The real seating chart, shown from the students’ side of the room. Refreshed whenever you press Present."));
        const ns = mk("select"); ns.append(opt("full", "Full name"), opt("first", "First name only")); ns.value = O.seating.names; ns.addEventListener("change", () => { O.seating.names = ns.value; });
        right.appendChild(f("Names on desks (both seating slides)", ns));
      } else if (st.sel === "calendar") {
        right.appendChild(mk("p", "hint", "A full-page table of the class calendar. The lesson this slideshow is for is highlighted."));
        right.appendChild(check("Include each lesson’s goals next to its title", O.calendar, "goals"));
        const hs = mk("select"); Object.entries(HILITES).forEach(([k, v]) => hs.appendChild(opt(k, v.label))); hs.value = O.calendar.highlight; hs.addEventListener("change", () => { O.calendar.highlight = hs.value; });
        right.appendChild(f("Highlight color", hs));
      }
    }
    const draw = () => { drawLeft(); drawRight(); }; draw();

    foot.appendChild(mk("span", "hint", it ? "Saving rebuilds the generated slides; edits you made to them are replaced." : ""));
    foot.appendChild(btn("Cancel", "btn btn-ghost", close));
    foot.appendChild(btn(it ? "Save & rebuild" : "Create slideshow", "btn btn-primary", () => {
      const title = st.name.trim(); if (!title) return;
      close();
      if (!it) {
        CMX.run("Creating slideshow", async () => {
          const n = await CMX.createItem("slides", title); n.lessonId = st.lesson || null; await CM.save();
          if (st.tpl === "basic") await buildBasic(n, O);
        });
      } else {
        CMX.run("Rebuilding slides", async () => {
          if (title !== it.title) { await G.api(`/files/${it.fileId}?fields=id`, { method: "PATCH", body: { name: title } }); it.title = title; }
          it.lessonId = st.lesson || null; await CM.save();
          if (st.tpl === "basic") await buildBasic(it, O);
        });
      }
    }));
    document.body.appendChild(ov);
  }
  CMX.newSlideshow = () => setupDialog(null);
  CMX.itemMeta = (it) => { const l = it.lessonId ? lessonById(it.lessonId) : null; return l ? ` · ${lessonLabel(l)}` : ""; };
  CMX.itemActions = (it, acts) => {
    if (it.kind !== "slides") return;
    acts.appendChild(btn("▶ Present", "btn btn-primary btn-small", () => present(it)));
    if (it.source && it.source.template === "basic") acts.appendChild(btn("Setup…", "btn btn-ghost btn-small", () => setupDialog(it)));
    acts.appendChild(btn("Lesson…", "btn btn-ghost btn-small", () => {
      sortLessons();
      modal("Tie this slideshow to a lesson", [{ key: "lesson", label: "Lesson", options: lessonOptions(), value: it.lessonId || "" }], "Save", (v) => {
        it.lessonId = v.lesson || null;
        if (it.source && it.source.template === "basic" && confirm("Rebuild the generated slides for this lesson now? (Changes you made to those generated slides are replaced.)")) CMX.run("Rebuilding slides", () => buildBasic(it));
        else CM.save().then(CMX.render);
      });
    }));
    if (it.source && it.source.template === "basic") acts.appendChild(btn("Update from calendar", "btn btn-ghost btn-small", () => {
      if (confirm("Rebuild the generated slides (title, goals, calendar) from the current calendar? Edits you made to those slides are replaced; slides you added are kept.")) CMX.run("Updating slides", () => buildBasic(it));
    }));
  };
})();
