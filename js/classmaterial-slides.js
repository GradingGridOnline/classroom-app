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
    const c = cal(), s = parse(c.start), d = parse(dateStr); if (!s || !d) return "";
    const mon = new Date(s); mon.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return Math.floor((d - mon) / 604800000) + 1;
  }
  const sortLessons = () => { const L = cal().lessons; L.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")); L.forEach((l, i) => { l.n = i + 1; }); };
  const lessonById = (id) => cal().lessons.find((l) => l.id === id);
  function dayLabel(l) { const d = parse(l.date); return d ? `${DAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}` : "no date"; }
  const lessonLabel = (l) => `Lesson ${l.n} · Week ${weekOf(l.date) || "?"} · ${dayLabel(l)}`;
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
  function renderCalendar(host) {
    const c = cal();
    host.appendChild(mk("p", "hint", "Plan each lesson here. Slideshows tied to a lesson show it highlighted on their Calendar slide."));
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
    host.appendChild(setup);
    host.appendChild(mk("span", "result cm-note", ""));

    const list = mk("div"); host.appendChild(list);
    const draw = () => {
      list.innerHTML = "";
      if (!c.lessons.length) { list.appendChild(mk("p", "hint", "No lessons yet. Fill in the term dates above and press “Make lessons”, or add one by hand.")); }
      const today = ymd(new Date());
      c.lessons.forEach((l) => {
        const row = mk("div", "cm-lesson" + (l.date === today ? " today" : ""));
        row.appendChild(mk("div", "cm-ln", `Lesson ${l.n}`));
        const wk = mk("div", "cm-lw", `Week ${weekOf(l.date) || "?"}`);
        const d = mk("input"); d.type = "date"; d.value = l.date;
        d.addEventListener("change", () => { l.date = d.value; sortLessons(); saveSoon(); CMX.render(); });
        const left = mk("div"); left.append(wk, d); row.appendChild(left);
        const t = (k, ph, tag) => { const i = mk(tag || "input"); if (tag) i.rows = 3; i.placeholder = ph; i.value = l[k]; i.addEventListener("input", () => { l[k] = i.value; saveSoon(); }); return i; };
        const mid = mk("div"); mid.append(t("title", "Lesson title / topic"), t("goals", "Goals — one per line", "textarea")); row.appendChild(mid);
        const right = mk("div"); right.append(t("materials", "Materials"), t("homework", "Homework")); row.appendChild(right);
        row.appendChild(btn("✕", "btn btn-ghost btn-small", () => { if (confirm(`Delete Lesson ${l.n}? Slideshows tied to it become unlinked.`)) { c.lessons = c.lessons.filter((x) => x !== l); CM.items.forEach((it) => { if (it.lessonId === l.id) it.lessonId = null; }); sortLessons(); saveSoon(); CMX.render(); } }));
        list.appendChild(row);
      });
      list.appendChild(btn("+ Add a lesson", "btn btn-ghost btn-small", () => { c.lessons.push({ id: uid(), n: 0, date: "", title: "", goals: "", materials: "", homework: "" }); sortLessons(); saveSoon(); CMX.render(); }));
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
      table(page, x, y, widths, rows, hiRow) {
        const id = sid("tb"), W = widths.reduce((a, b) => a + b, 0);
        r.push({ createTable: { objectId: id, elementProperties: props(page, x, y, W, rows.length * 22), rows: rows.length, columns: widths.length } });
        widths.forEach((w, ci) => r.push({ updateTableColumnProperties: { objectId: id, columnIndices: [ci], tableColumnProperties: { columnWidth: pt(w) }, fields: "columnWidth" } }));
        rows.forEach((row, ri) => {
          const head = ri === 0, hi = ri === hiRow;
          const fill = head ? PAL.dark : hi ? PAL.amber : ri % 2 ? PAL.white : PAL.cream;
          r.push({ updateTableCellProperties: { objectId: id, tableRange: { location: { rowIndex: ri, columnIndex: 0 }, rowSpan: 1, columnSpan: widths.length }, tableCellProperties: { tableCellBackgroundFill: { solidFill: { color: { rgbColor: rgb(fill) } } } }, fields: "tableCellBackgroundFill.solidFill.color" } });
          row.forEach((cell, ci) => {
            if (!cell) return; const loc = { rowIndex: ri, columnIndex: ci };
            r.push({ insertText: { objectId: id, cellLocation: loc, insertionIndex: 0, text: cell } });
            style(id, { size: 10, bold: head || hi, color: head ? PAL.cream : PAL.ink }, { cellLocation: loc });
          });
        });
      },
    };
  }

  // ---------- slide types ("Basic" slideshow = Title + Today's goals + Calendar) ----------
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const SLIDE_TYPES = {
    title(b, page, ctx) {
      b.rect(page, 0, 300, 720, 105, "#223d26");
      b.text(page, 50, 120, 620, 90, ctx.lesson && ctx.lesson.title ? ctx.lesson.title : ctx.title, { size: 40, bold: true, font: "Georgia", color: PAL.cream });
      b.text(page, 50, 215, 620, 30, ctx.lesson ? lessonLabel(ctx.lesson) : "", { size: 18, color: "#e6d9a8" });
      b.text(page, 50, 322, 620, 40, ctx.course, { size: 22, font: "Georgia", color: PAL.cream });
    },
    goals(b, page, ctx) {
      const l = ctx.lesson; if (!l) return false;
      b.text(page, 40, 28, 640, 50, "Today’s goals", { size: 32, bold: true, font: "Georgia", color: PAL.dark });
      const goals = (l.goals || "").split("\n").map((x) => x.trim()).filter(Boolean);
      b.text(page, 50, 95, 620, goals.length ? 180 : 40, goals.length ? goals.join("\n") : (l.title || ""), { size: 22, bullets: !!goals.length });
      if (l.materials) { b.rect(page, 40, 295, 300, 90, PAL.white); b.text(page, 50, 300, 280, 80, "Materials\n" + l.materials, { size: 13, color: PAL.soft }); }
      if (l.homework) { b.rect(page, 380, 295, 300, 90, PAL.white); b.text(page, 390, 300, 280, 80, "Homework\n" + l.homework, { size: 13, color: PAL.soft }); }
    },
    calendar(b, page, ctx) {
      const L = cal().lessons; if (!L.length) return false;
      b.text(page, 40, 14, 640, 40, "Class calendar", { size: 28, bold: true, font: "Georgia", color: PAL.dark });
      const MAX = 14; let from = 0;
      const cur = ctx.lesson ? L.findIndex((x) => x.id === ctx.lesson.id) : -1;
      if (L.length > MAX) from = Math.max(0, Math.min(L.length - MAX, (cur < 0 ? 0 : cur) - 4));
      const part = L.slice(from, from + MAX);
      const rows = [["#", "Week · Date", "What we do"]].concat(part.map((l) => [String(l.n), `Wk ${weekOf(l.date) || "?"} · ${dayLabel(l)}`, clip([l.title, (l.goals || "").split("\n").map((x) => x.trim()).filter(Boolean).join(" · ")].filter(Boolean).join(" — "), 95)]));
      b.table(page, 30, 58, [36, 112, 512], rows, cur < 0 ? -1 : cur - from + 1);
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
  SLIDE_TYPES.seating = function (b, page, ctx) {
    const S = ctx.seating; if (!S) return false;
    const pos = S.keys.map((k) => k.split("-").map(Number)), r0 = Math.min(...pos.map((p) => p[0])), r1 = Math.max(...pos.map((p) => p[0])), c0 = Math.min(...pos.map((p) => p[1])), c1 = Math.max(...pos.map((p) => p[1]));
    const rows = r1 - r0 + 1, cols = c1 - c0 + 1, AW = 660, AH = 300, cw = Math.min(110, AW / cols), ch = Math.min(60, AH / rows);
    const ox = 30 + (AW - cw * cols) / 2, oy = 70 + (AH - ch * rows) / 2, size = Math.max(7, Math.min(13, Math.floor(cw / 7.5)));
    const byId = new Map(S.students.map((st) => [st.id, st]));
    b.text(page, 40, 14, 640, 40, "Seating chart", { size: 28, bold: true, font: "Georgia", color: PAL.dark });
    if (ctx.lesson) b.text(page, 360, 22, 320, 28, lessonLabel(ctx.lesson), { size: 13, color: PAL.soft, align: "END" });
    S.keys.forEach((k, i) => {
      const [r, c] = k.split("-").map(Number), st = byId.get(S.seats[k]), g = S.groups[k];
      const nm = st ? clip(st.name || "", 20) : "";
      b.desk(page, ox + (c - c0) * cw + 2, oy + (r - r0) * ch + 2, cw - 4, ch - 4, g ? hsl(Math.round((g * 137.508) % 360), 70, 78) : PAL.white, nm, size, false);
    });
  };
  const BASIC = ["title", "goals", "seating", "calendar"];

  /** (Re)builds the generated slides of a Basic slideshow. First time: replaces the blank starter slide. Later: replaces the generated slides only. */
  async function buildBasic(it) {
    const pres = await G.call(`${SLIDES}${it.fileId}?fields=slides.objectId`);
    const oldIds = it.source && it.source.slideIds ? it.source.slideIds : (pres.slides || []).map((s) => s.objectId);
    const ctx = { title: it.title, course: CMX.courseTitle(), lesson: it.lessonId ? lessonById(it.lessonId) : null, seating: await loadSeating() };
    const b = Builder(), made = [], byType = {}; let idx = 0;
    BASIC.forEach((type) => {
      const probe = Builder(), pid = sid("p");
      const dark = type === "title";
      probe.slide(pid, idx, dark ? PAL.dark : PAL.cream);
      if (SLIDE_TYPES[type](probe, pid, ctx) === false) return;
      b.r.push(...probe.r); made.push(pid); byType[type] = pid; idx++;
    });
    oldIds.forEach((id) => b.r.push({ deleteObject: { objectId: id } }));
    await G.call(`${SLIDES}${it.fileId}:batchUpdate`, { method: "POST", body: { requests: b.r } });
    it.source = { template: "basic", slideIds: made, byType };
    it.updatedAt = new Date().toISOString();
    await CM.save();
  }

  /** Rebuilds just one generated slide (e.g. the seating chart) in place, leaving everything else alone. */
  async function refreshType(it, type) {
    const old = it.source && it.source.byType && it.source.byType[type]; if (!old) return false;
    const pres = await G.call(`${SLIDES}${it.fileId}?fields=slides.objectId`);
    const ids = (pres.slides || []).map((x) => x.objectId), at = ids.indexOf(old);
    if (at < 0) return false; // the teacher deleted it — leave the deck alone
    const ctx = { title: it.title, course: CMX.courseTitle(), lesson: it.lessonId ? lessonById(it.lessonId) : null, seating: await loadSeating() };
    const b = Builder(), pid = sid("p"); b.slide(pid, at, PAL.cream);
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
    try { if (it.source && it.source.byType && it.source.byType.seating) { CMX.say("Refreshing the seating chart…"); await refreshType(it, "seating"); CMX.say(""); } }
    catch (e) { CMX.say("Couldn't refresh the seating chart (" + e.message + ") — presenting as it was."); }
    if (w) w.location = url; else window.open(url, "_blank");
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

  CMX.newSlideshow = () => {
    sortLessons();
    modal("New slideshow", [
      { key: "title", label: "Name", value: `${CMX.courseTitle()} – Slideshow` },
      { key: "tpl", label: "Start from", options: [["basic", "Basic (title, today’s goals, calendar)"], ["blank", "Blank"]], value: "basic" },
      { key: "lesson", label: "For which lesson?", options: lessonOptions() },
    ], "Create", (v) => {
      if (!v.title.trim()) return;
      CMX.run("Creating slideshow", async () => {
        const it = await CMX.createItem("slides", v.title.trim());
        it.lessonId = v.lesson || null;
        await CM.save();
        if (v.tpl === "basic") await buildBasic(it);
      });
    });
  };
  CMX.itemMeta = (it) => { const l = it.lessonId ? lessonById(it.lessonId) : null; return l ? ` · ${lessonLabel(l)}` : ""; };
  CMX.itemActions = (it, acts) => {
    if (it.kind !== "slides") return;
    acts.appendChild(btn("▶ Present", "btn btn-primary btn-small", () => present(it)));
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
