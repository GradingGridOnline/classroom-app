// Print dialog for quizzes / answer collections / surveys: window.QuizPrint.open(quiz, name).
// Quiz & surveys print one question sheet; an Answer Collection prints a test booklet and/or a matching marksheet.
(function () {
  const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FONTS = [
    ["Serif (Georgia / Times)", "Georgia, 'Times New Roman', 'Yu Mincho', serif"],
    ["Sans-serif (Arial)", "Arial, 'Helvetica Neue', 'Yu Gothic', sans-serif"],
    ["Verdana", "Verdana, Geneva, sans-serif"],
    ["Times New Roman", "'Times New Roman', Times, serif"],
    ["Monospace", "'Courier New', Courier, monospace"],
    ["Japanese Mincho (明朝)", "'Yu Mincho', 'Hiragino Mincho ProN', 'MS PMincho', serif"],
    ["Japanese Gothic (ゴシック)", "'Yu Gothic', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif"],
  ];
  const PAGES = { A4: [210, 297], Letter: [215.9, 279.4], B5: [176, 250] };
  const DEFAULTS = {
    font: 1, size: 11, lineHeight: 1.4, qGap: 14, optGap: 3, optLayout: "vertical", marker: "plain",
    answerSpace: "line", blankLines: 2, title: "", instructions: "", courseLine: false, nameLine: true, showPoints: true, showSections: true,
    separator: "none", pageBorder: false, pageSize: "A4", orientation: "portrait", margin: 18,
    perPage: 0, sectionBreak: false, keepTogether: true, pageNumbers: true,
    doBooklet: true, doMarksheet: true, msColumns: 2, msRowGap: 9, msBlank: 40,
  };
  const KEY = "ggo-quizprint";
  const load = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return Object.assign({}, DEFAULTS); } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };

  function flatten(quiz) {
    const out = []; let n = 0;
    (quiz.sections || []).forEach((sec, si) => {
      out.push({ section: sec, si });
      (window.quizSectionFlow ? quizSectionFlow(sec) : (sec.questions || []).map((q) => ({ q }))).forEach((it) => {
        if (it.note) out.push({ note: it.note });
        else out.push({ q: it.q, n: ++n });
      });
    });
    return out;
  }
  const label = (quiz, i) => (window.quizOptionLabel ? window.quizOptionLabel((quiz.settings || {}).labelStyle, i) : String.fromCharCode(65 + i));

  const paraBox = (q) => `<div class="blanklines">${Array(Math.max(1, Math.min(40, Number(q.lines) || 6))).fill('<div class="wl"></div>').join("")}</div>`;

  function questionHtml(quiz, q, n, o, booklet) {
    const choice = q.type === "mc" || q.type === "multi";
    const survey = window.isSurveyKind && isSurveyKind(quiz.kind);
    let h = `<div class="q"><div class="qh"><span class="qn">${n}.</span><span class="qt">${esc(q.text)}</span>`;
    if (o.showPoints && !survey && quiz.kind !== "answers" && q.points) h += `<span class="pts">(${esc(q.points)} pt${Number(q.points) === 1 ? "" : "s"})</span>`;
    h += "</div>";
    if (q.type === "multi") h += `<div class="hintline">Select all that apply.</div>`;
    if (choice) {
      h += `<ol class="opts ${o.optLayout}">`;
      (q.choices || []).forEach((c, i) => {
        const l = esc(label(quiz, i));
        const mk = o.marker === "paren" ? `(${l})` : o.marker === "box" ? `<span class="bx"></span>${l}` : o.marker === "bubble" ? `<span class="bb">${l}</span>` : `${l}.`;
        h += `<li><span class="lab">${mk}</span> ${quiz.kind === "answers" ? esc(c || "") : esc(c)}</li>`;
      });
      h += "</ol>";
    }
    if (q.type === "para") {
      if (!booklet) h += paraBox(q);
    } else if (!booklet && o.answerSpace === "line") {
      if (choice) h += `<div class="ans">${q.type === "multi" ? "Answers" : "Answer"}: <span class="ul" style="width:5em"></span></div>`;
      else h += `<div class="blanklines">${Array(Math.max(1, o.blankLines)).fill('<div class="wl"></div>').join("")}</div>`;
    } else if (!booklet && !choice && o.answerSpace !== "line") {
      h += `<div class="blanklines">${Array(Math.max(1, o.blankLines)).fill('<div class="wl"></div>').join("")}</div>`;
    }
    return h + "</div>";
  }

  function pagesHtml(quiz, o, booklet, title) {
    const items = flatten(quiz);
    const head = (t) => {
      let h = `<div class="doc-head"><h1>${esc(t)}</h1>`;
      if (o.courseLine && o.courseText) h += `<div class="courseline">${esc(o.courseText)}</div>`;
      if (o.nameLine) h += `<div class="idline"><span>Name: <span class="ul" style="width:11em"></span></span><span>Class: <span class="ul" style="width:5em"></span></span><span>Date: <span class="ul" style="width:6em"></span></span></div>`;
      if (o.instructions.trim()) h += `<div class="instr">${esc(o.instructions)}</div>`;
      return h + "</div>";
    };
    const blocks = [];
    items.forEach((it) => {
      if (it.section) {
        if (o.showSections && it.section.title) blocks.push({ html: `<h2>${esc(it.section.title)}</h2>`, heading: true, newPage: o.sectionBreak && it.si > 0 });
      } else if (it.note) blocks.push({ html: `<div class="note">${esc(it.note.text)}</div>` });
      else blocks.push({ html: questionHtml(quiz, it.q, it.n, o, booklet), q: true });
    });
    const pages = [];
    if (o.perPage > 0) {
      let cur = [], count = 0;
      const flush = () => { if (cur.length) pages.push(cur); cur = []; count = 0; };
      blocks.forEach((b) => {
        if (b.newPage) flush();
        if (b.q && count >= o.perPage) flush();
        cur.push(b.html);
        if (b.q) count++;
      });
      flush();
    } else {
      let cur = [];
      blocks.forEach((b) => {
        if (b.newPage && cur.length) { pages.push(cur); cur = []; }
        cur.push(b.html);
      });
      if (cur.length) pages.push(cur);
    }
    if (!pages.length) pages.push(["<p><i>No questions yet.</i></p>"]);
    return pages.map((p, i) => `<section class="sheet${o.perPage > 0 || i > 0 ? " fixed" : ""}">${i === 0 ? head(title) : `<div class="cont">${esc(title)} (continued)</div>`}${p.join("")}${o.perPage > 0 && o.pageNumbers ? `<div class="pn">${i + 1}</div>` : ""}</section>`).join("");
  }

  function marksheetHtml(quiz, o, title) {
    const items = flatten(quiz).filter((x) => x.q);
    let h = `<section class="sheet fixed ms"><div class="doc-head"><h1>${esc(title)} — Marksheet</h1>`;
    if (o.courseLine && o.courseText) h += `<div class="courseline">${esc(o.courseText)}</div>`;
    if (o.nameLine) h += `<div class="idline"><span>Name: <span class="ul" style="width:11em"></span></span><span>Class: <span class="ul" style="width:5em"></span></span><span>Date: <span class="ul" style="width:6em"></span></span></div>`;
    h += `<div class="instr">Mark your answers here, not on the test booklet.</div></div>`;
    const cols = Math.max(1, o.msColumns), per = Math.ceil(items.length / cols) || 1;
    h += `<div class="mscols">`;
    for (let c = 0; c < cols; c++) {
      h += `<div class="mscol">`;
      items.slice(c * per, (c + 1) * per).forEach(({ q, n }) => {
        h += `<div class="msrow"><span class="msn">${n}</span>`;
        if (q.type === "mc" || q.type === "multi") {
          (q.choices || []).forEach((c2, i) => { h += `<span class="bb${q.type === "multi" ? " sq" : ""}">${esc(label(quiz, i))}</span>`; });
        } else if (q.type === "para") h += `<div class="msbox" style="height:${Math.max(1, Math.min(40, Number(q.lines) || 6)) * 1.9}em"></div>`;
        else h += `<span class="ul" style="width:${o.msBlank}mm"></span>`;
        h += "</div>";
      });
      h += "</div>";
    }
    return h + "</div></section>";
  }

  function build(quiz, name, o) {
    const [pw, ph] = PAGES[o.pageSize] || PAGES.A4;
    const land = o.orientation === "landscape";
    const W = land ? ph : pw, H = land ? pw : ph;
    const answers = quiz.kind === "answers";
    const title = o.title.trim() || name || "Quiz";
    let body = "";
    if (answers) {
      if (o.doBooklet) body += pagesHtml(quiz, o, true, title);
      if (o.doMarksheet) body += marksheetHtml(quiz, o, title);
    } else body += pagesHtml(quiz, o, false, title);
    const sepCss = { none: "", line: ".q{border-bottom:1px solid #444;padding-bottom:6px}", dotted: ".q{border-bottom:1px dotted #444;padding-bottom:6px}", box: ".q{border:1px solid #444;padding:6px 9px;border-radius:3px}" }[o.separator] || "";
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:${W}mm ${H}mm;margin:${o.margin}mm;${o.perPage === 0 && o.pageNumbers ? "@bottom-center{content:counter(page);font-size:9pt}" : ""}}
*{box-sizing:border-box}
body{margin:0;font-family:${FONTS[o.font][1]};font-size:${o.size}pt;line-height:${o.lineHeight};color:#000}
h1{font-size:1.5em;margin:0 0 6px;text-align:center}h2{font-size:1.15em;margin:14px 0 8px;border-bottom:2px solid #000;padding-bottom:2px}
.doc-head{margin-bottom:12px}.idline{display:flex;justify-content:space-between;gap:12px;margin:8px 0}.instr{white-space:pre-wrap;font-style:italic;margin:6px 0}
.cont{font-size:.8em;color:#555;margin-bottom:8px}
.ul{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:baseline}
.q{margin:0 0 ${o.qGap}px;${o.keepTogether ? "break-inside:avoid;page-break-inside:avoid;" : ""}}
${sepCss}
.qh{display:flex;gap:.5em}.qn{font-weight:700;min-width:1.8em}.qt{white-space:pre-wrap;flex:1}.pts{font-size:.85em;color:#444;white-space:nowrap}
.hintline{font-size:.85em;font-style:italic;margin-left:2.3em}
ol.opts{list-style:none;margin:${o.optGap + 2}px 0 0 2.3em;padding:0}ol.opts li{margin:${o.optGap}px 0}
ol.opts.inline{display:flex;flex-wrap:wrap;gap:${o.optGap}px 1.6em}ol.opts.inline li{margin:0}
ol.opts.cols{display:grid;grid-template-columns:1fr 1fr;gap:${o.optGap}px 1.4em}ol.opts.cols li{margin:0}
.lab{font-weight:600;margin-right:.2em}.bx{display:inline-block;width:.8em;height:.8em;border:1.2px solid #000;margin-right:.35em;vertical-align:-1px}
.bb{display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;height:1.6em;border:1.2px solid #000;border-radius:50%;font-size:.85em;padding:0 .25em}.bb.sq{border-radius:3px}
.ans{margin:8px 0 0 2.3em}.blanklines{margin:6px 0 0 2.3em}.wl{border-bottom:1px solid #000;height:1.9em}
.mscols{display:grid;grid-template-columns:repeat(${o.msColumns},1fr);gap:0 12mm;align-items:start}.courseline{text-align:center;margin:0 0 6px;font-size:.95em}.note{white-space:pre-wrap;font-style:italic;margin:0 0 ${o.qGap}px;padding:4px 8px;border-left:3px solid #000}.sheet.ms{display:block !important}.msbox{flex:1;border:1.2px solid #000;border-radius:3px}.msrow{display:flex;align-items:center;gap:6px;margin-bottom:${o.msRowGap}px;break-inside:avoid}.msn{min-width:2em;font-weight:700;text-align:right}
.pn{text-align:center;font-size:.85em;margin-top:auto;padding-top:8px}
${o.pageBorder ? ".sheet{border:1.5px solid #000;padding:6mm !important}" : ""}
@media screen{body{background:#cfcfcf;padding:10px}.sheet{background:#fff;width:${W}mm;min-height:${H}mm;margin:0 auto 12px;padding:${o.margin}mm;box-shadow:0 1px 6px rgba(0,0,0,.4);display:flex;flex-direction:column}${o.pageBorder ? ".sheet{padding:calc(" + o.margin + "mm + 6mm) !important}" : ""}}
@media print{.sheet{display:flex;flex-direction:column;${o.perPage > 0 || true ? `min-height:${H - 2 * o.margin - 2}mm;` : ""}}.sheet.fixed,.sheet+.sheet{break-before:page;page-break-before:always}.sheet:first-child{break-before:auto;page-break-before:auto}}
</style></head><body>${body}</body></html>`;
  }

  function open(quiz, name) {
    const o = load();
    // The current course and its day / period, for the optional heading line.
    const course = window.CoursesModule && window.RosterModule ? CoursesModule.find(RosterModule.currentCourseId) : null;
    o.courseText = course ? [course.name, CoursesModule.scheduleLine(course)].filter(Boolean).join(" — ") : "";
    const answers = quiz.kind === "answers";
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card,#fff);color:var(--ink,#111);width:min(1200px,96vw);height:92vh;border-radius:10px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.5);";
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line,#ccc);";
    bar.innerHTML = `<b>Print ${esc(name || "")} — ${answers ? "Answer Collection (test booklet + marksheet)" : window.isSurveyKind && isSurveyKind(quiz.kind) ? "Survey" : "Quiz"}</b>`;
    const btns = document.createElement("div"); btns.style.cssText = "display:flex;gap:8px;";
    const printBtn = document.createElement("button"); printBtn.className = "btn btn-primary"; printBtn.textContent = "Print";
    const closeBtn = document.createElement("button"); closeBtn.className = "btn btn-ghost"; closeBtn.textContent = "Close";
    btns.append(printBtn, closeBtn); bar.appendChild(btns);
    const main = document.createElement("div"); main.style.cssText = "flex:1;display:flex;min-height:0;";
    const side = document.createElement("div"); side.style.cssText = "width:320px;overflow:auto;padding:10px 14px;border-right:1px solid var(--line,#ccc);font-size:13px;";
    const frame = document.createElement("iframe"); frame.style.cssText = "flex:1;border:0;background:#cfcfcf;";
    main.append(side, frame); box.append(bar, main); ov.appendChild(box); document.body.appendChild(ov);

    const refresh = () => { save(o); frame.srcdoc = build(quiz, name, o); };
    const group = (t) => { const g = document.createElement("div"); g.innerHTML = `<h4 style="margin:12px 0 4px;border-bottom:1px solid var(--line,#ccc)">${t}</h4>`; side.appendChild(g); };
    const row = (text, input) => { const l = document.createElement("label"); l.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0;"; const s = document.createElement("span"); s.textContent = text; l.append(s, input); side.appendChild(l); return l; };
    const sel = (key, opts, num) => { const s = document.createElement("select"); opts.forEach(([v, t]) => { const op = document.createElement("option"); op.value = v; op.textContent = t; if (String(o[key]) === String(v)) op.selected = true; s.appendChild(op); }); s.addEventListener("change", () => { o[key] = num ? Number(s.value) : s.value; refresh(); }); return s; };
    const chk = (key) => { const c = document.createElement("input"); c.type = "checkbox"; c.checked = !!o[key]; c.addEventListener("change", () => { o[key] = c.checked; refresh(); }); return c; };
    const txt = (key, area) => { const t = document.createElement(area ? "textarea" : "input"); if (!area) t.type = "text"; if (area) t.rows = 3; t.style.width = "170px"; t.value = o[key]; t.addEventListener("input", () => { o[key] = t.value; clearTimeout(t._t); t._t = setTimeout(refresh, 250); }); return t; };
    const numSel = (key, list) => sel(key, list.map((v) => [v, String(v)]), true);

    group("Contents");
    if (answers) { row("Test booklet", chk("doBooklet")); row("Marksheet", chk("doMarksheet")); }
    row("Title", txt("title")); row("Instructions", txt("instructions", true));
    if (o.courseText) row("Course & day/period line", chk("courseLine"));
    row("Name / class / date line", chk("nameLine"));
    row("Section headings", chk("showSections"));
    if (!answers) row("Show points", chk("showPoints"));
    group("Font");
    row("Typeface", sel("font", FONTS.map((f, i) => [i, f[0]]), true));
    row("Size (pt)", numSel("size", [8, 9, 10, 11, 12, 13, 14, 16, 18]));
    group("Layout & spacing");
    row("Line height", sel("lineHeight", [[1.15, "Tight"], [1.4, "Normal"], [1.7, "Loose"], [2, "Double"]], true));
    row("Between questions", sel("qGap", [[4, "Very small"], [14, "Normal"], [26, "Large"], [40, "Extra large"]], true));
    row("Between options", sel("optGap", [[1, "Tight"], [3, "Normal"], [8, "Loose"]], true));
    row("Option layout", sel("optLayout", [["vertical", "One per line"], ["inline", "Across the line"], ["cols", "Two columns"]]));
    row("Option labels", sel("marker", [["plain", "A."], ["paren", "(A)"], ["box", "☐ A"], ["bubble", "Ⓐ circled"]]));
    if (!answers) {
      row("Answer space", sel("answerSpace", [["line", "Answer line / writing lines"], ["none", "None (circle the option)"]]));
      row("Writing lines (blanks)", numSel("blankLines", [1, 2, 3, 4, 6]));
    } else {
      group("Marksheet");
      row("Columns", numSel("msColumns", [1, 2, 3, 4]));
      row("Row spacing", sel("msRowGap", [[4, "Tight"], [9, "Normal"], [16, "Loose"]], true));
      row("Blank width (mm)", numSel("msBlank", [25, 40, 60, 80]));
    }
    group("Pagination");
    row("Paper", sel("pageSize", Object.keys(PAGES).map((k) => [k, k])));
    row("Orientation", sel("orientation", [["portrait", "Portrait"], ["landscape", "Landscape"]]));
    row("Margins (mm)", numSel("margin", [10, 15, 18, 25]));
    row("Questions per page", sel("perPage", [[0, "Automatic"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [8, "8"], [10, "10"]], true));
    row("New page per section", chk("sectionBreak"));
    row("Keep each question whole", chk("keepTogether"));
    row("Page numbers", chk("pageNumbers"));
    group("Borders & separators");
    row("Between questions", sel("separator", [["none", "None"], ["line", "Line"], ["dotted", "Dotted line"], ["box", "Box around each"]]));
    row("Border around page", chk("pageBorder"));

    const close = () => ov.remove();
    closeBtn.addEventListener("click", close);
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    printBtn.addEventListener("click", () => { frame.contentWindow.focus(); frame.contentWindow.print(); });
    refresh();
  }

  window.QuizPrint = { open, build };
})();
