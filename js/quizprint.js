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
    perPage: 0, cols: 1, adjust: true, breaks: [], glue: [], sectionBreak: false, keepTogether: true, pageNumbers: true,
    doBooklet: true, doMarksheet: true, msColumns: 2, msRowGap: 9, msBlank: 40, msSections: true,
    cover: false, coverTitle: true, coverCourse: true, coverName: true, coverDate: true, coverQs: true, coverPts: true, coverTime: true, coverPages: true, coverText: "Do not turn this page until you are told to.", coverBack: false,
  };
  const KEY = "ggo-quizprint";
  const load = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return Object.assign({}, DEFAULTS); } };
  const save = (o) => { try { const c = Object.assign({}, o); delete c.breaks; delete c.glue; delete c.courseText; localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
  const pbKey = (name) => "ggo-qpb:" + (name || "");
  const loadPb = (name) => { try { const v = JSON.parse(localStorage.getItem(pbKey(name)) || "{}"); return { brk: v.brk || [], glue: v.glue || [] }; } catch (e) { return { brk: [], glue: [] }; } };
  const savePb = (name, o) => { try { localStorage.setItem(pbKey(name), JSON.stringify({ brk: o.breaks, glue: o.glue })); } catch (e) {} };

  function flatten(quiz) {
    const out = []; let n = 0;
    if (window.QuizRich && QuizRich.refsFromQuiz) QuizRich.refsFromQuiz(quiz);
    (quiz.sections || []).forEach((sec, si) => {
      out.push({ section: sec, si });
      const dv = window.QuizRich && QuizRich.dividers ? QuizRich.dividers(sec) : new Set();
      let inUnit = false, prev = null; // a unit = an Instructions box and the questions after it; its last question ends it (marksheet line)
      (window.quizSectionFlow ? quizSectionFlow(sec) : (sec.questions || []).map((q) => ({ q }))).forEach((it) => {
        if (it.note) {
          if (it.note.kind === "instructions") { if (prev && inUnit) prev.ue = true; inUnit = true; }
          if (!(it.note.kind === "instructions" && (it.note.hide || !String(it.note.text || "").trim()))) out.push({ note: it.note });
        } else { prev = { q: it.q, n: ++n, div: dv.has(it.q.id) }; out.push(prev); }
      });
      if (prev && inUnit) prev.ue = true;
    });
    return out;
  }
  const label = (quiz, i) => (window.quizOptionLabel ? window.quizOptionLabel((quiz.settings || {}).labelStyle, i) : String.fromCharCode(65 + i));

  const paraBox = (q) => `<div class="blanklines">${Array(Math.max(1, Math.min(40, Number(q.lines) || 6))).fill('<div class="wl"></div>').join("")}</div>`;

  function questionHtml(quiz, q, n, o, booklet) {
    const choice = q.type === "mc" || q.type === "multi";
    const survey = window.isSurveyKind && isSurveyKind(quiz.kind);
    let h = `<div class="q"><div class="qh"><span class="qn">${n}.</span><span class="qt">${window.QuizRich ? QuizRich.show(q) : esc(q.text)}</span>`;
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
      if (o.instructions.trim()) h += `<div class="note instructions"><div class="itl">Instructions</div><div>${esc(o.instructions)}</div></div>`;
      return h + "</div>";
    };
    const blocks = [];
    let idx = 0;
    items.forEach((it) => {
      idx++;
      if (it.section) {
        if (o.showSections && it.section.title) blocks.push({ t: "h2", k: "s:" + (it.section.id || it.si), html: `<h2>${esc(it.section.title)}</h2>`, keep: true, nb: o.sectionBreak && it.si > 0 });
      } else if (it.note) {
        const kind = it.note.kind || "instructions", body = window.QuizRich ? QuizRich.show(it.note) : esc(it.note.text);
        blocks.push({ t: "note", k: "n:" + (it.note.id || "i" + idx), keep: kind !== "text", html: kind === "instructions" ? `<div class="note instructions"><div class="itl">Instructions</div><div>${body}</div></div>` : `<div class="note ${esc(kind)}${it.note.border && kind === "text" ? " bordered" : ""}">${body}</div>` });
      }
      else blocks.push({ t: "q", k: "q:" + (it.q.id || "i" + idx), html: questionHtml(quiz, it.q, it.n, o, booklet) + (it.div ? '<div class="udiv"></div>' : "") });
    });
    if (!blocks.length) blocks.push({ t: "note", k: "empty", html: "<p><i>No questions yet.</i></p>" });
    blocks.unshift({ t: "head", k: "head", html: head(title), keep: true });
    // Page breaks are decided in the page itself (see the script in build()): this is only the ordered list of items.
    return `<div id="src" style="display:none" data-title="${esc(title)}" data-per="${o.perPage}" data-cols="${o.cols}" data-pn="${o.pageNumbers ? 1 : 0}" data-adj="${o.adjust ? 1 : 0}" data-brk="${esc(JSON.stringify(o.breaks || []))}" data-glue="${esc(JSON.stringify(o.glue || []))}">${blocks.map((b) => `<div class="blk" data-t="${b.t}" data-k="${esc(b.k)}"${b.keep ? ' data-keep="1"' : ""}${b.nb ? ' data-nb="1"' : ""}>${b.html}</div>`).join("")}</div><i id="slot"></i>`;
  }

  function marksheetHtml(quiz, o, title) {
    const all = flatten(quiz), items = all.filter((x) => x.q);
    let h = `<div class="page ms"><div class="pg"><div class="doc-head"><h1>${esc(title)} — Marksheet</h1>`;
    if (o.courseLine && o.courseText) h += `<div class="courseline">${esc(o.courseText)}</div>`;
    if (o.nameLine) h += `<div class="idline"><span>Name: <span class="ul" style="width:11em"></span></span><span>Class: <span class="ul" style="width:5em"></span></span><span>Date: <span class="ul" style="width:6em"></span></span></div>`;
    h += `<div class="instr">Mark your answers here, not on the test booklet.</div></div>`;
    const cols = Math.max(1, o.msColumns), per = Math.ceil(items.length / cols) || 1;
    h += `<div class="mscols">`;
    const headAt = new Map(); // section title -> shown at the top of the column of that section's first question
    if (o.msSections) { let pendingHead = null, qi = 0; all.forEach((it) => { if (it.section) pendingHead = it.section.title ? it.section : null; else if (it.q) { if (pendingHead) { headAt.set(it.q.id, pendingHead.title); pendingHead = null; } qi++; } }); }
    for (let c = 0; c < cols; c++) {
      h += `<div class="mscol">`;
      items.slice(c * per, (c + 1) * per).forEach(({ q, n, ue }) => {
        if (headAt.has(q.id)) h += `<div class="mshead">${esc(headAt.get(q.id))}</div>`;
        h += `<div class="msrow${ue ? " ue" : ""}"><span class="msn">${n}</span>`;
        if (q.type === "mc" || q.type === "multi") {
          (q.choices || []).forEach((c2, i) => { h += `<span class="bb${q.type === "multi" ? " sq" : ""}">${esc(label(quiz, i))}</span>`; });
        } else if (q.type === "para") h += `<div class="msbox" style="height:${Math.max(1, Math.min(40, Number(q.lines) || 6)) * 1.9}em"></div>`;
        else h += `<span class="ul" style="width:${o.msBlank}mm"></span>`;
        h += "</div>";
      });
      h += "</div>";
    }
    return h + "</div></div></div>";
  }

  /** A cover page that sits on top of the questions (so nobody sees them before the others do). */
  function coverHtml(quiz, o, title, pageCount) {
    const survey = window.isSurveyKind && isSurveyKind(quiz.kind);
    const nq = (quiz.sections || []).reduce((a, sec) => a + (sec.questions || []).length, 0);
    let pts = 0; try { pts = window.ScoringModule && ScoringModule.quizTotal ? ScoringModule.quizTotal(quiz) : 0; } catch (e) {}
    const facts = [];
    if (o.coverQs && nq) facts.push(["Number of questions", nq]);
    if (o.coverPts && !survey && quiz.kind !== "answers" && pts) facts.push(["Total points", pts]);
    if (o.coverTime && quiz.settings && Number(quiz.settings.timeLimit) > 0) facts.push(["Time allowed", `${quiz.settings.timeLimit} minutes`]);
    if (o.coverPages) facts.push(["Pages after this one", "\u2026"]);
    let h = `<div class="page cover"><div class="pg"><div class="cv">`;
    if (o.coverTitle) h += `<h1 class="cvt">${esc(title)}</h1>`;
    if (o.coverCourse && o.courseText) h += `<div class="cvc">${esc(o.courseText)}</div>`;
    if (o.coverDate) h += `<div class="cvd">Date: <span class="ul" style="width:9em"></span></div>`;
    if (o.coverName) h += `<div class="cvn"><div>Name: <span class="ul" style="width:16em"></span></div><div>Student ID: <span class="ul" style="width:10em"></span></div></div>`;
    if (facts.length) h += `<table class="cvf">${facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td${k === "Pages after this one" ? " data-pages" : ""}>${esc(v)}</td></tr>`).join("")}</table>`;
    if (String(o.coverText || "").trim()) h += `<div class="cvx">${esc(o.coverText)}</div>`;
    return h + `</div></div></div>` + (o.coverBack ? `<div class="page cover"><div class="pg"><div class="cv"></div></div></div>` : "");
  }

  function build(quiz, name, o) {
    const [pw, ph] = PAGES[o.pageSize] || PAGES.A4;
    const land = o.orientation === "landscape";
    const W = land ? ph : pw, H = land ? pw : ph;
    const answers = quiz.kind === "answers";
    const title = o.title.trim() || name || "Quiz";
    let body = "";
    const ms = answers && o.doMarksheet ? marksheetHtml(quiz, o, title) : "";
    if (!answers || o.doBooklet) body += pagesHtml(quiz, o, answers, title); else body += "<i id=\"slot\"></i>";
    if (o.cover && (!answers || o.doBooklet)) body = coverHtml(quiz, o, title) + body; // the cover comes first
    body += ms; // an Answer Collection's marksheet follows the booklet
    // text, lines and boxes of one item stay together on one page (flex containers can't break pages cleanly, so print uses block layout)
    const sepCss = { none: "", line: ".q{border-bottom:1px solid #444;padding-bottom:6px}", dotted: ".q{border-bottom:1px dotted #444;padding-bottom:6px}", box: ".q{border:1px solid #444;padding:6px 9px;border-radius:3px}" }[o.separator] || "";
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:${W}mm ${H}mm;margin:${o.margin}mm}
*{box-sizing:border-box}
body{margin:0;font-family:${FONTS[o.font][1]};font-size:${o.size}pt;line-height:${o.lineHeight};color:#000}
h1{font-size:1.5em;margin:0 0 6px;text-align:center}h2{font-size:1.15em;margin:14px 0 8px;border-bottom:2px solid #000;padding-bottom:2px}
.doc-head{margin-bottom:12px}.idline{display:flex;justify-content:space-between;gap:12px;margin:8px 0}.instr{white-space:pre-wrap;font-style:italic;margin:6px 0}
.cont{font-size:.8em;color:#555;margin-bottom:8px}
.ul{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:baseline}
.q{margin:0 0 ${o.qGap}px;break-inside:avoid}
${sepCss}
.qh{display:flex;gap:.5em}.qn{font-weight:700;min-width:1.8em}.qt{white-space:pre-wrap;flex:1}.pts{font-size:.85em;color:#444;white-space:nowrap}
.hintline{font-size:.85em;font-style:italic;margin-left:2.3em}
ol.opts{list-style:none;margin:${o.optGap + 2}px 0 0 2.3em;padding:0}ol.opts li{margin:${o.optGap}px 0}
ol.opts.inline{display:flex;flex-wrap:wrap;gap:${o.optGap}px 1.6em}ol.opts.inline li{margin:0}
ol.opts.cols{display:grid;grid-template-columns:1fr 1fr;gap:${o.optGap}px 1.4em}ol.opts.cols li{margin:0}
.lab{font-weight:600;margin-right:.2em}.bx{display:inline-block;width:.8em;height:.8em;border:1.2px solid #000;margin-right:.35em;vertical-align:-1px}
.bb{display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;height:1.6em;border:1.2px solid #000;border-radius:50%;font-size:.85em;padding:0 .25em}.bb.sq{border-radius:3px}
.ans{margin:8px 0 0 2.3em}.blanklines{margin:6px 0 0 2.3em}.wl{border-bottom:1px solid #000;height:1.9em}
.mscols{display:grid;grid-template-columns:repeat(${o.msColumns},1fr);gap:0 12mm;align-items:start}.courseline{text-align:center;margin:0 0 6px;font-size:.95em}span[data-bl]{display:inline-block;min-width:1.5em;text-align:right;font-weight:600}span[data-qref]{font-weight:700}.note.bordered{border:1.2px solid #000;padding:2mm 3mm}.udiv{border-top:1px solid #000;margin:8px 0 6px}.note.instructions{font-style:normal;text-align:left;border:1px solid #000;padding:5px 10px}.note.instructions .itl{font-weight:700;font-style:italic;text-align:left;margin-bottom:2px}.note.text{font-style:normal;border-left:0;padding:0}.note.passage{font-style:normal;border:1px solid #000;border-left-width:3px;padding:6px 10px}.note{white-space:pre-wrap;font-style:italic;margin:0 0 ${o.qGap}px;padding:4px 8px;border-left:3px solid #000}.msbox{flex:1;border:1.2px solid #000;border-radius:3px}.msrow{display:flex;align-items:center;gap:6px;margin-bottom:${o.msRowGap}px;break-inside:avoid}.msn{min-width:2em;font-weight:700;text-align:right}
.cover .cv{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:9mm;text-align:center;padding-top:25mm}.cvt{font-size:2.2em;margin:0}.cvc{font-size:1.2em}.cvd,.cvn{font-size:1.1em;text-align:left}.cvn div{margin:6mm 0}table.cvf{border-collapse:collapse;font-size:1.1em}table.cvf th{text-align:left;padding:2px 14px 2px 0;font-weight:600}table.cvf td{padding:2px 0}.cvx{font-size:1.3em;font-weight:700;border:2px solid #000;padding:6mm 10mm;margin-top:10mm}
.note,.doc-head,.cont,.hintline,.ans,.blanklines,.msbox,ol.opts li{break-inside:avoid;page-break-inside:avoid}h2{break-after:avoid;page-break-after:avoid}.qh{break-after:avoid}
.mshead{font-weight:700;border-bottom:1px solid #000;margin:8px 0 5px;break-after:avoid}.msrow{break-inside:avoid}
.msrow.ue{border-bottom:1px solid #000;padding-bottom:5px}
.pn{flex:none;height:6mm;text-align:center;font-size:.85em;padding-top:1mm}
${o.pageBorder ? ".pg{border:1.5px solid #000;padding:6mm}" : ""}
.pg{width:${W - 2 * o.margin}mm;height:${H - 2 * o.margin - 1}mm;display:flex;flex-direction:column;overflow:hidden}.page.ms .pg{height:auto;min-height:${H - 2 * o.margin - 1}mm;overflow:visible}
.body{flex:1;min-height:0;overflow:hidden}.blk{position:relative}.run{column-count:${o.cols};column-gap:8mm;column-fill:balance}.run .blk{break-inside:avoid}
.ctl{display:none;position:absolute;right:0;top:0;gap:4px;z-index:5;font:11px Arial,sans-serif}.ctl button{font:inherit;padding:1px 6px;border:1px solid #2563eb;border-radius:4px;background:#fff;color:#2563eb;cursor:pointer}.ctl button.on{background:#2563eb;color:#fff}.blk:hover>.ctl{display:flex}.blk.hl{outline:1px dashed #2563eb;outline-offset:2px}
.blk.fb::before{content:"\\2913 page break";position:absolute;left:0;top:-1.1em;font:10px Arial,sans-serif;color:#2563eb}
@media screen{body{background:#cfcfcf;padding:10px}.page{background:#fff;width:${W}mm;margin:0 auto 14px;padding:${o.margin}mm;box-shadow:0 1px 6px rgba(0,0,0,.4)}.plabel{width:${W}mm;margin:0 auto 3px;font:12px Arial,sans-serif;color:#333}}
@media print{.page{break-after:auto}.page~.page{break-before:page;page-break-before:always}.plabel,.ctl{display:none !important}.blk.fb::before{display:none}}
</style></head><body><div id="all">${body}</div><script>
// Pages are laid out here (not left to the browser): items are added one at a time and moved to the next page whole when they would not fit,
// so the preview shows exactly what prints and no item is ever cut. Items marked data-keep stay with the item after them.
(function(){
  function el(t,c){var e=document.createElement(t);e.className=c;return e;}
  function run(){
    var S=document.getElementById("src"),slot=document.getElementById("slot"),all=document.getElementById("all");
    [].slice.call(all.querySelectorAll("[data-built],.plabel")).forEach(function(e){e.remove();});
    var D=S.dataset,per=+D.per||0,cols=+D.cols||1,pn=D.pn==="1",adj=D.adj==="1",brk=JSON.parse(D.brk||"[]"),glue=JSON.parse(D.glue||"[]");
    var blocks=[].slice.call(S.children),groups=[],cur=null;
    blocks.forEach(function(b,i){
      var k=b.dataset.k,forced=brk.indexOf(k)>=0||b.dataset.nb==="1",glued=glue.indexOf(k)>=0,pk=i>0&&blocks[i-1].dataset.keep==="1";
      if(!cur||forced||!(pk||glued)){cur=[];cur.forced=forced;groups.push(cur);}
      cur.push(b);
    });
    var pages=[],page,body;
    function newPage(){
      page=el("div","page");page.setAttribute("data-built","1");var pg=el("div","pg");body=el("div","body");pg.appendChild(body);
      if(pn){var n=el("div","pn");pg.appendChild(n);}
      page.appendChild(pg);slot.parentNode.insertBefore(page,slot);pages.push(page);
      if(pages.length>1){var c=el("div","cont");c.textContent=D.title+" (continued)";body.appendChild(c);}
    }
    var has=function(){return !!body.querySelector(".blk");};
    var qn=function(){return body.querySelectorAll('.blk[data-t="q"]').length;};
    var fits=function(){return body.scrollHeight<=body.clientHeight+1;};
    function put(b){
      var n=b.cloneNode(true),isq=b.dataset.t==="q",k=b.dataset.k;
      if(adj&&b.dataset.t!=="head"){
        var c=el("span","ctl");
        c.innerHTML='<button data-a="brk" class="'+(brk.indexOf(k)>=0?"on":"")+'">New page here</button><button data-a="glue" class="'+(glue.indexOf(k)>=0?"on":"")+'">Keep with previous</button>';
        n.appendChild(c);
        if(brk.indexOf(k)>=0)n.classList.add("fb");
      }
      var last=body.lastElementChild;
      if(cols>1&&isq){
        if(last&&last.classList.contains("run")){last.appendChild(n);return function(){n.remove();};}
        var r=el("div","run");r.appendChild(n);body.appendChild(r);return function(){r.remove();};
      }
      body.appendChild(n);return function(){n.remove();};
    }
    function place(list){
      var had=has(),u=list.map(put);
      if(fits())return;
      u.forEach(function(f){f();});
      if(had){newPage();u=list.map(put);if(fits())return;u.forEach(function(f){f();});}
      if(list.length>1){list.forEach(function(b){place([b]);});return;}
      put(list[0]);
    }
    groups.forEach(function(g){
      var gq=g.filter(function(b){return b.dataset.t==="q";}).length;
      if(!page||(g.forced&&has())||(per>0&&qn()>0&&gq>0&&qn()+gq>per))newPage();
      place(g);
    });
    var N=pages.length;
    pages.forEach(function(p,i){var n=p.querySelector(".pn");if(n)n.textContent=i+1;});
    [].slice.call(document.querySelectorAll("[data-pages]")).forEach(function(e){e.textContent=N;});
    var ps=[].slice.call(all.querySelectorAll(".page")),done=0;
    ps.forEach(function(p){
      var l=el("div","plabel");l.textContent=p.classList.contains("cover")?"Cover page":p.classList.contains("ms")?"Marksheet":"Page "+(++done)+" of "+N;
      p.parentNode.insertBefore(l,p);
    });
  }
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest(".ctl button");if(!b)return;
    var blk=b.closest(".blk");parent.postMessage({ggoPb:1,k:blk.dataset.k,a:b.dataset.a},"*");
  });
  run();
  window.addEventListener("load",function(){if(document.fonts&&document.fonts.ready)document.fonts.ready.then(run);});
})();
<\/script></body></html>`;
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

    const pb = loadPb(name); o.breaks = pb.brk; o.glue = pb.glue;
    let keepY = 0;
    const refresh = () => { save(o); try { keepY = frame.contentWindow.scrollY || keepY; } catch (e) {} frame.srcdoc = build(quiz, name, o); };
    frame.addEventListener("load", () => { try { frame.contentWindow.scrollTo(0, keepY); } catch (e) {} });
    const onMsg = (e) => {
      const d = e.data; if (!d || !d.ggoPb || e.source !== frame.contentWindow) return;
      const list = d.a === "glue" ? o.glue : o.breaks, i = list.indexOf(d.k);
      if (i >= 0) list.splice(i, 1); else list.push(d.k);
      savePb(name, o); refresh();
    };
    window.addEventListener("message", onMsg);
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
    group("Cover page");
    row("Add a cover page", chk("cover"));
    row("Title", chk("coverTitle")); row("Course & day/period", chk("coverCourse")); row("Name / ID lines", chk("coverName")); row("Date line", chk("coverDate"));
    row("Number of questions", chk("coverQs")); if (!answers) row("Total points", chk("coverPts")); row("Time allowed", chk("coverTime")); row("Number of pages", chk("coverPages"));
    row("Message", txt("coverText", true));
    row("Blank back (double-sided)", chk("coverBack"));
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
      row("Section titles", chk("msSections"));
    }
    group("Pagination");
    row("Paper", sel("pageSize", Object.keys(PAGES).map((k) => [k, k])));
    row("Orientation", sel("orientation", [["portrait", "Portrait"], ["landscape", "Landscape"]]));
    row("Margins (mm)", numSel("margin", [10, 15, 18, 25]));
    row("Questions per page", sel("perPage", [[0, "Automatic"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [8, "8"], [10, "10"]], true));
    row("New page per section", chk("sectionBreak"));
    row("Questions in columns", sel("cols", [[1, "1 column"], [2, "2 columns"], [3, "3 columns"]], true));
    row("Adjust page breaks (hover an item)", chk("adjust"));
    const rb = document.createElement("button"); rb.className = "btn btn-ghost"; rb.textContent = "Clear my page breaks"; rb.addEventListener("click", () => { o.breaks = []; o.glue = []; savePb(name, o); refresh(); });
    row("", rb);
    row("Page numbers", chk("pageNumbers"));
    group("Borders & separators");
    row("Between questions", sel("separator", [["none", "None"], ["line", "Line"], ["dotted", "Dotted line"], ["box", "Box around each"]]));
    row("Border around page", chk("pageBorder"));

    const close = () => { window.removeEventListener("message", onMsg); ov.remove(); };
    closeBtn.addEventListener("click", close);
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    printBtn.addEventListener("click", () => { frame.contentWindow.focus(); frame.contentWindow.print(); });
    refresh();
  }

  window.QuizPrint = { open, build };
})();
