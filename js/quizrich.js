// Tiny rich-text helper for quiz question text and instructions: bold, italic, underline, ALL CAPS,
// small caps, colour, and "Normal" (clear formatting). Stored as a restricted HTML string (q.rich /
// note.rich) next to the plain text (q.text / note.text), and cleaned by the same whitelist wherever
// it is shown: QuizRich.clean(html) -> safe html string.
(function () {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;

  // ----- list markers (dots, numbers, roman numerals, triangles, letters) and question references -----
  const BL = { dot: 1, tri: 1, num: 1, romU: 1, romL: 1, letU: 1, letL: 1 };
  const BL_MENU = [["dot", "•  Dots"], ["num", "1.  Numbers"], ["romU", "I.  Roman numerals (capital)"], ["romL", "i.  Roman numerals (small)"], ["tri", "▸  Triangles"], ["letU", "A.  Letters (capital)"], ["letL", "a.  Letters (small)"]];
  const romanOf = (n) => { let r = ""; [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]].forEach(([v, t]) => { while (n >= v) { r += t; n -= v; } }); return r; };
  const lettersOf = (n) => { let r = ""; while (n > 0) { n--; r = String.fromCharCode(97 + (n % 26)) + r; n = Math.floor(n / 26); } return r; };
  const markLabel = (k, n) => k === "dot" ? "•" : k === "tri" ? "▸" : k === "num" ? n + "." : k === "romU" ? romanOf(n) + "." : k === "romL" ? romanOf(n).toLowerCase() + "." : k === "letU" ? lettersOf(n).toUpperCase() + "." : lettersOf(n) + ".";
  let REFS = {};
  /** Question numbers by question id for what is about to be shown ("Q42"); a reference to a question shows its current number. */
  function refsFromQuiz(quiz) {
    const m = {}; let n = 0;
    ((quiz && quiz.sections) || []).forEach((sec) => flow(sec).forEach((it) => { if (it.q) { n++; m[it.q.id] = "Q" + n; } }));
    REFS = m; return m;
  }
  /** Writes the numbers/letters of list markers (consecutive marked lines of one kind count up) and the question numbers of references. */
  function decorate(root) {
    const doc = root.ownerDocument || document;
    const w = doc.createTreeWalker(root, 5);
    let last = null, brs = 0, n = 0, run = 0, started = false, x;
    while ((x = w.nextNode())) {
      if (x.nodeType === 3) { if (!(x.parentNode && x.parentNode.closest && x.parentNode.closest("span[data-bl],span[data-qref]"))) brs += (x.data.match(/\n/g) || []).length; continue; }
      if (x.tagName === "BR") { if (!(x.parentNode && x.parentNode.tagName === "DIV" && x.parentNode.lastChild === x)) brs++; continue; } // a <br> that only holds an empty line open is not a line break
      if (x.tagName === "DIV") { if (started) brs++; started = true; continue; }
      if (x.hasAttribute("data-bl")) {
        const k = x.getAttribute("data-bl");
        if (last === k && brs === 1) n++; else { n = 1; run++; }
        last = k; brs = 0;
        x.setAttribute("data-run", run);
        x.textContent = markLabel(k, n);
      } else if (x.hasAttribute("data-qref")) {
        const r = REFS[x.getAttribute("data-qref")];
        x.textContent = `(${r || "Q?"})`;
      }
    }
  }
  /** For display (student form, print): a line whose marker has a margin becomes a block that wraps under the first word. */
  function hangLines(body) {
    if (!body.querySelector("span[data-hang]")) return;
    const doc = body.ownerDocument, kids = Array.from(body.childNodes), lines = [[]];
    kids.forEach((k) => { if (k.nodeType === 1 && k.tagName === "BR") lines.push([]); else lines[lines.length - 1].push(k); });
    body.textContent = "";
    lines.forEach((ln, i) => {
      const first = ln.find((k) => !(k.nodeType === 3 && !k.data.trim()));
      if (first && first.nodeType === 1 && first.hasAttribute && first.hasAttribute("data-hang")) {
        const d = doc.createElement("div"); d.setAttribute("style", "padding-left:1.8em;text-indent:-1.8em");
        first.setAttribute("style", "display:inline-block;width:1.8em;min-width:0;text-align:left;text-indent:0;vertical-align:top;");
        ln.forEach((k) => d.appendChild(k));
        const nx = first.nextSibling; if (nx && nx.nodeType === 3 && nx.data.startsWith(" ")) nx.data = nx.data.slice(1);
        body.appendChild(d);
      } else { ln.forEach((k) => body.appendChild(k)); if (i < lines.length - 1) { const nextHang = lines[i + 1].find((k) => !(k.nodeType === 3 && !k.data.trim())); if (!(nextHang && nextHang.nodeType === 1 && nextHang.hasAttribute && nextHang.hasAttribute("data-hang"))) body.appendChild(doc.createElement("br")); } }
      if (first && first.nodeType === 1 && first.hasAttribute && first.hasAttribute("data-hang") && i < lines.length - 1) { /* the block ends the line: no <br> */ }
    });
  }
  const labelize = (html) => { if (!/data-(bl|qref)=/.test(html)) return html; const d = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html"); decorate(d.body); hangLines(d.body); return d.body.innerHTML; };

  /** Turns any HTML into the safe subset: <b> <i> <u> <br> and <span style="color/text-transform/font-variant">. */
  function clean(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString("<body>" + String(html) + "</body>", "text/html");
    const walk = (node) => {
      let out = "";
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) { out += esc(n.nodeValue).replace(/\n/g, "<br>"); return; }
        if (n.nodeType !== 1) return;
        const tag = n.tagName.toLowerCase();
        let inner = walk(n);
        if (tag === "br") { out += "<br>"; return; }
        if (tag === "span" && n.hasAttribute("data-ck")) { out += `<span data-ck="${n.getAttribute("data-ck") === "1" ? 1 : 0}"></span>`; return; } // a checklist box (journal)
        if (tag === "span" && n.hasAttribute("data-bl")) { const k = n.getAttribute("data-bl"); if (BL[k]) out += `<span data-bl="${k}"${n.hasAttribute("data-hang") ? ' data-hang="1"' : ""}></span>`; return; } // a list marker (data-hang: text wraps under the first word)
        if (tag === "span" && n.hasAttribute("data-qref")) { const id = (n.getAttribute("data-qref") || "").replace(/[^\w-]/g, ""); if (id) out += `<span data-qref="${id}"></span>`; return; } // a question reference
        if (tag === "div" || tag === "p") { out += (out && !/<br>$/.test(out) ? "<br>" : "") + inner; return; }
        if (tag === "script" || tag === "style") return;
        const st = n.style || {};
        const css = [];
        let color = tag === "font" ? n.getAttribute("color") : st.color;
        if (color && COLOR.test(color.trim())) css.push("color:" + color.trim());
        if (st.textTransform === "uppercase") css.push("text-transform:uppercase");
        if (st.fontVariant === "small-caps" || st.fontVariantCaps === "small-caps") css.push("font-variant:small-caps");
        if (css.length) inner = `<span style="${css.join(";")}">${inner}</span>`;
        const bold = tag === "b" || tag === "strong" || st.fontWeight === "bold" || Number(st.fontWeight) >= 600;
        const ital = tag === "i" || tag === "em" || st.fontStyle === "italic";
        const under = tag === "u" || /underline/.test(st.textDecoration || st.textDecorationLine || "");
        if (under) inner = `<u>${inner}</u>`;
        if (ital) inner = `<i>${inner}</i>`;
        if (bold) inner = `<b>${inner}</b>`;
        out += inner;
      });
      return out;
    };
    let res = walk(doc.body);
    for (let prev = ""; prev !== res; ) { prev = res; res = res.replace(/<(b|i|u)><\/\1>/g, "").replace(/<span style="[^"]*"><\/span>/g, ""); } // drop emptied formatting
    return res.replace(/(<br>)+$/, "");
  }

  /** Plain text of an html string (line breaks kept). */
  function plain(html) {
    const doc = new DOMParser().parseFromString("<body>" + String(html || "").replace(/<span data-ck="1"><\/span>/g, "☑ ").replace(/<span data-ck="0"><\/span>/g, "☐ ").replace(/<br\s*\/?>/gi, "\n") + "</body>", "text/html");
    decorate(doc.body);
    return doc.body.textContent || "";
  }

  /** The html to show for something with { text, rich }: the cleaned rich version if present, otherwise the escaped text. */
  function show(item) {
    const r = item && item.rich ? clean(item.rich) : "";
    return r ? labelize(r) : esc((item && item.text) || "").replace(/\n/g, "<br>");
  }

  /** A small editor: toolbar + editable box. onChange(plainText, richHtmlOrEmpty). */
  function editor(opts) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "flex:1;min-width:14em;";
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;margin-bottom:3px;align-items:center;";
    const box = document.createElement("div");
    box.contentEditable = "true";
    box.setAttribute("role", "textbox");
    box.dataset.placeholder = opts.placeholder || "";
    box.style.cssText = "min-height:2.2em;padding:6px 8px;border:1px solid var(--line,#aaa);border-radius:6px;background:var(--card,#fff);color:var(--ink,#111);white-space:pre-wrap;overflow-wrap:anywhere;";
    const lineMode = !!opts.bullets && !opts.lists; // one <div> per line, so a list item with a margin can wrap under its first word
    const toLines = (html) => {
      const t = document.createElement("div"); t.innerHTML = html; const lines = [[]];
      Array.from(t.childNodes).forEach((k) => { if (k.nodeType === 1 && k.tagName === "BR") lines.push([]); else lines[lines.length - 1].push(k); });
      if (lines.length === 1 && !lines[0].length) return "";
      const out = document.createElement("div");
      lines.forEach((ln) => { const d = document.createElement("div"); if (ln.length) ln.forEach((k) => d.appendChild(k)); else d.appendChild(document.createElement("br")); out.appendChild(d); });
      return out.innerHTML;
    };
    const baseHtml = opts.rich ? clean(opts.rich) : esc(opts.text || "").replace(/\n/g, "<br>");
    box.innerHTML = lineMode ? toLines(baseHtml) : baseHtml;
    if (!document.getElementById("qrich-style2")) {
      const st2 = document.createElement("style"); st2.id = "qrich-style2";
      st2.textContent = "span[data-bl]{display:inline-block;min-width:1.5em;text-align:right;font-weight:600;user-select:none}span[data-bl][data-hang]{width:1.8em;min-width:0;text-align:left;text-indent:0}span[data-qref]{display:inline-block;padding:0 6px;border:1px solid var(--line,#999);border-radius:10px;background:var(--chip,rgba(120,150,255,.18));font-size:.92em;font-weight:600;white-space:nowrap;user-select:none}";
      document.head.appendChild(st2);
    }
    /** Line mode: every top-level piece lives in a line <div> (loose text typed into the empty box is wrapped; the caret is kept). */
    const ensureLines = (force) => {
      if (!lineMode) return;
      if (force && !box.firstChild) { const d = document.createElement("div"); d.appendChild(document.createElement("br")); box.appendChild(d); const sel = getSelection(), nr = document.createRange(); nr.setStart(d, 0); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); return; }
      const sel = getSelection(); const had = sel && sel.rangeCount && box.contains(sel.getRangeAt(0).startContainer);
      const keep = had ? { n: sel.getRangeAt(0).startContainer, o: sel.getRangeAt(0).startOffset } : null;
      let cur = null;
      Array.from(box.childNodes).forEach((k) => {
        if (k.nodeType === 1 && k.tagName === "DIV") { cur = null; return; }
        if (!cur) { cur = document.createElement("div"); box.insertBefore(cur, k); }
        cur.appendChild(k);
      });
      if (keep && cur) { try { const nr = document.createRange(); nr.setStart(keep.n, keep.o); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); } catch (e) {} }
    };
    const hangStyle = () => {
      if (!lineMode) return;
      const cs = getComputedStyle(box); // wrapped lines start where the first word starts: marker width + the space after it
      const cx = (hangStyle.cv || (hangStyle.cv = document.createElement("canvas"))).getContext("2d"); cx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const sp = cx.measureText(" ").width || 4, pad = `calc(1.8em + ${sp.toFixed(2)}px)`;
      Array.from(box.children).forEach((ln) => {
        const first = Array.from(ln.childNodes).find((k) => !(k.nodeType === 3 && !k.data.trim()));
        if (first && first.nodeType === 1 && first.hasAttribute && first.hasAttribute("data-hang")) { ln.style.paddingLeft = pad; ln.style.textIndent = `calc(-1.8em - ${sp.toFixed(2)}px)`; }
        else { ln.style.paddingLeft = ""; ln.style.textIndent = ""; }
      });
    };
    const fixMarks = () => { ensureLines(); if (lineMode && !box.textContent && !box.querySelector("span")) box.innerHTML = ""; decorate(box); hangStyle(); box.querySelectorAll("span[data-bl],span[data-qref]").forEach((c) => { c.contentEditable = "false"; }); };
    fixMarks();
    if (!document.getElementById("qrich-style")) {
      const st = document.createElement("style");
      st.id = "qrich-style";
      st.textContent = '[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);opacity:.5}.qrich-btn{padding:1px 8px !important;min-width:2em}span[data-ck]{display:inline-block;width:1.05em;height:1.05em;border:2px solid currentColor;border-radius:999px;vertical-align:-.15em;margin-right:.4em;cursor:pointer;box-sizing:border-box;opacity:.85}span[data-ck="1"]{background:#3ddc84;border-color:#3ddc84;opacity:1;box-shadow:0 0 8px 2px rgba(61,220,132,.75)}';
      document.head.appendChild(st);
    }
    const emit = () => {
      fixMarks();
      const c = clean(box.innerHTML);
      const p = plain(c);
      const formatted = /<(b|i|u|span)[ >]/.test(c);
      opts.onChange(p, formatted ? c : "");
    };
    const selInside = () => {
      const s = getSelection();
      return s && s.rangeCount && box.contains(s.getRangeAt(0).commonAncestorContainer) ? s : null;
    };
    const wrapSel = (css) => {
      const s = selInside(); if (!s || s.isCollapsed) return;
      const r = s.getRangeAt(0);
      const span = document.createElement("span");
      span.style.cssText = css;
      span.appendChild(r.extractContents());
      r.insertNode(span);
      s.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(span); s.addRange(nr);
      emit();
    };
    const normal = () => {
      const s = selInside(); if (!s || s.isCollapsed) return;
      document.execCommand("removeFormat"); // bold / italic / underline
      const r = s.getRangeAt(0);
      Array.from(box.querySelectorAll("span")).forEach((sp) => { // colour, caps, small caps
        if (!r.intersectsNode(sp)) return;
        while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
        sp.remove();
      });
      emit();
    };
    const mk = (label, title, fn, style) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-ghost btn-small qrich-btn"; b.title = title; b.innerHTML = label;
      if (style) b.style.cssText += style;
      b.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection in the box
      b.addEventListener("click", () => { box.focus(); fn(); emit(); });
      bar.appendChild(b);
      return b;
    };
    mk("<b>B</b>", "Bold (Ctrl+B)", () => document.execCommand("bold"));
    mk("<i>I</i>", "Italic (Ctrl+I)", () => document.execCommand("italic"));
    mk("<u>U</u>", "Underline (Ctrl+U)", () => document.execCommand("underline"));
    mk("AA", "ALL CAPS (Ctrl/Cmd+Shift+A)", () => wrapSel("text-transform:uppercase"));
    mk('<span style="font-variant:small-caps">Aa</span>', "Small caps (Ctrl/Cmd+Shift+K)", () => wrapSel("font-variant:small-caps"));
    mk("Normal", "Clear formatting from the selected text (Ctrl/Cmd+Space or \\)", normal);
    const color = document.createElement("input");
    color.type = "color"; color.value = "#c0392b"; color.title = "Text colour (select text first)";
    color.style.cssText = "width:2.2em;height:1.9em;padding:0;border:1px solid var(--line,#aaa);background:none;cursor:pointer;";
    color.addEventListener("mousedown", () => { const s = getSelection(); if (s && s.rangeCount && box.contains(s.getRangeAt(0).commonAncestorContainer)) color._r = s.getRangeAt(0).cloneRange(); });
    color.addEventListener("input", () => {
      const s = getSelection();
      if (color._r) { s.removeAllRanges(); s.addRange(color._r); }
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, color.value);
      document.execCommand("styleWithCSS", false, false);
      emit();
    });
    bar.appendChild(color);
    let lineToggle = null;
    if (opts.lists || opts.bullets) {
      const fixCk = () => box.querySelectorAll("span[data-ck]").forEach((c) => { c.contentEditable = "false"; });
      fixCk();
      const idx = (n) => Array.prototype.indexOf.call(n.parentNode.childNodes, n);
      /** Where the caret's line starts (after the last line break before the caret) and whether it begins with a bullet / check box. */
      const caretLine = () => {
        ensureLines(true);
        const s = selInside(); if (!s) return null;
        const r = s.getRangeAt(0).cloneRange(); r.collapse(true);
        let start = { node: box, off: 0 };
        let lineEl = null;
        if (lineMode) { lineEl = r.startContainer; while (lineEl && lineEl.parentNode !== box) lineEl = lineEl.parentNode; if (!lineEl) return null; start = { node: lineEl, off: 0 }; }
        const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let n;
        while (!lineMode && (n = tw.nextNode())) {
          if (n.nodeType === 1) {
            if (n.tagName === "BR") { if (r.comparePoint(n.parentNode, idx(n) + 1) <= 0) start = { node: n.parentNode, off: idx(n) + 1 }; else break; }
            continue;
          }
          const upto = n === r.startContainer ? r.startOffset : (r.comparePoint(n, n.data.length) <= 0 ? n.data.length : -1);
          if (upto < 0) break;
          const k = upto > 0 ? n.data.lastIndexOf("\n", upto - 1) : -1;
          if (k >= 0) start = { node: n, off: k + 1 };
          if (n === r.startContainer) break;
        }
        let target = null, toff = 0;
        const descend = (c) => { while (c && c.nodeType === 1 && c.tagName !== "BR" && !c.hasAttribute("data-ck") && !c.hasAttribute("data-bl")) c = c.firstChild; return c && !(c.nodeType === 1 && c.tagName === "BR") ? c : null; };
        if (start.node.nodeType === 3) {
          if (start.off < start.node.data.length) { target = start.node; toff = start.off; }
          else { let x = start.node; while (x && x !== box && !x.nextSibling) x = x.parentNode; target = x && x !== box ? descend(x.nextSibling) : null; }
        } else target = descend(start.node.childNodes[start.off]);
        let kind = "", el = null;
        if (target && target.nodeType === 1) { kind = target.hasAttribute("data-bl") ? "m" : "c"; el = target; }
        else if (target && target.nodeType === 3 && target.data.startsWith("• ", toff)) kind = "b";
        const rs = document.createRange(); rs.setStart(start.node, start.off); rs.setEnd(r.startContainer, r.startOffset);
        return { start, lineEl, kind, el, target, toff, atStart: rs.toString() === "" && !rs.cloneContents().querySelector("span[data-ck]") };
      };
      const place = (L, kind, style, hang) => {
        const frag = document.createDocumentFragment();
        let lastNode;
        if (kind === "m") { const m = document.createElement("span"); m.setAttribute("data-bl", style); if (hang) m.setAttribute("data-hang", "1"); m.contentEditable = "false"; lastNode = document.createTextNode(" "); frag.append(m, lastNode); }
        else if (kind === "b") { lastNode = document.createTextNode("• "); frag.appendChild(lastNode); }
        else { const c = document.createElement("span"); c.dataset.ck = "0"; c.contentEditable = "false"; lastNode = document.createTextNode(" "); frag.append(c, lastNode); }
        const rg = document.createRange();
        rg.setStart(L.start.node, L.start.off); rg.collapse(true); rg.insertNode(frag);
        if (L.atStart) { const sel = getSelection(); const nr = document.createRange(); nr.setStartAfter(lastNode); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); }
      };
      const unmark = (L) => {
        if (L.kind === "b") L.target.deleteData(L.toff, 2);
        else if (L.kind === "c") L.el.remove();
        else if (L.kind === "m") { const nx = L.el.nextSibling; if (nx && nx.nodeType === 3 && nx.data.startsWith(" ")) nx.deleteData(0, 1); L.el.remove(); }
      };
      const lineText = (L) => {
        const rr = document.createRange(); rr.setStart(L.start.node, L.start.off); if (L.lineEl) rr.setEnd(L.lineEl, L.lineEl.childNodes.length); else rr.setEnd(box, box.childNodes.length);
        const w = document.createTreeWalker(rr.cloneContents(), 5); let t = "", x;
        while ((x = w.nextNode())) { if (x.nodeType === 3) { const pe = x.parentNode; if (!(pe && pe.nodeType === 1 && (pe.hasAttribute("data-bl") || pe.hasAttribute("data-ck")))) t += x.data; } else if (x.tagName === "BR") t += "\n"; }
        return t.split("\n")[0].replace(/^• /, "").trim();
      };
      const toggleLine = (kind) => {
        box.focus(); let L = caretLine(); if (!L) return;
        if (L.kind === kind) { unmark(L); return; }
        if (L.kind) { unmark(L); L = caretLine(); }
        place(L, kind);
      };
      lineToggle = toggleLine;
      const setBullet = (style) => {
        box.focus(); let L = caretLine(); if (!L) return;
        if (L.kind === "m" && L.el.getAttribute("data-bl") === style) { unmark(L); return; }
        if (L.kind) { unmark(L); L = caretLine(); }
        place(L, "m", style, hangMode);
      };
      let hangMode = false; // new markers get a margin (text wraps under the first word) when on
      const setHang = (on) => {
        hangMode = on; box.focus(); const L = caretLine();
        if (L && L.kind === "m") box.querySelectorAll(`span[data-bl][data-run="${L.el.getAttribute("data-run")}"]`).forEach((m) => { if (on) m.setAttribute("data-hang", "1"); else m.removeAttribute("data-hang"); });
      };
      if (opts.lists) {
        mk("• List", "Bullet point on this line (Ctrl/Cmd+Shift+L; again to remove)", () => toggleLine("b"));
        mk("☐ Item", "Check-list box on this line (Ctrl/Cmd+Shift+9; again to remove)", () => toggleLine("c"));
      } else {
        const lb = mk("List ▾", "Put a list marker on this line: dots, numbers, roman numerals, triangles or letters (choose the same one again to remove it)", () => {
          const old = document.getElementById("qrich-listmenu"); if (old) { old.remove(); return; }
          const pop = document.createElement("div"); pop.id = "qrich-listmenu";
          pop.style.cssText = "position:fixed;z-index:9500;display:flex;flex-direction:column;gap:3px;padding:6px;background:var(--card,#fff);color:var(--ink,#111);border:1px solid var(--line,#999);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.35);white-space:pre;";
          BL_MENU.forEach(([k, lab]) => {
            const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-ghost btn-small"; b.style.textAlign = "left"; b.textContent = lab;
            b.addEventListener("mousedown", (e) => e.preventDefault());
            b.addEventListener("click", () => { pop.remove(); setBullet(k); emit(); });
            pop.appendChild(b);
          });
          const hb = document.createElement("button"); hb.type = "button"; hb.className = "btn btn-ghost btn-small"; hb.style.textAlign = "left";
          const curL = caretLine(); const curHang = curL && curL.kind === "m" ? curL.el.hasAttribute("data-hang") : hangMode;
          hb.textContent = (curHang ? "☑" : "☐") + "  Margin (wrapped text lines up under the first word)";
          hb.addEventListener("mousedown", (e) => e.preventDefault());
          hb.addEventListener("click", () => { pop.remove(); setHang(!curHang); emit(); });
          pop.append(document.createElement("hr"), hb);
          document.body.appendChild(pop);
          const r = lb.getBoundingClientRect();
          pop.style.left = Math.max(4, Math.min(innerWidth - pop.offsetWidth - 4, r.left)) + "px";
          pop.style.top = Math.min(innerHeight - pop.offsetHeight - 4, r.bottom + 4) + "px";
          const off = (e) => { if (!pop.contains(e.target) && e.target !== lb) { pop.remove(); document.removeEventListener("mousedown", off, true); } };
          document.addEventListener("mousedown", off, true);
        });
      }
      box.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || (e.shiftKey && !lineMode) || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const L = caretLine(); const k = L ? L.kind : ""; const mst = k === "m" ? L.el.getAttribute("data-bl") : ""; const mh = k === "m" && L.el.hasAttribute("data-hang");
        if (k && lineText(L) === "") { unmark(L); emit(); return; }
        if (lineMode) { try { document.execCommand("defaultParagraphSeparator", false, "div"); } catch (er) {} document.execCommand("insertParagraph"); ensureLines(); }
        else document.execCommand("insertLineBreak");
        if (k) { const L2 = caretLine(); if (L2) place(L2, k, mst, mh); }
        emit();
      });
      box.addEventListener("click", (e) => {
        const c = e.target.closest && e.target.closest("span[data-ck]");
        if (c && box.contains(c)) { c.dataset.ck = c.dataset.ck === "1" ? "0" : "1"; emit(); }
      });
    }
    // typing #42# turns into a reference to question 42 (same as dragging its Q-pill)
    const tryRef = () => {
      const sel = getSelection(); if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
      const nd = sel.getRangeAt(0).startContainer; if (nd.nodeType !== 3 || !box.contains(nd)) return;
      const off = sel.getRangeAt(0).startOffset; const upto = nd.data.slice(0, off);
      const m = /[#＃]([0-9０-９]{1,3})[#＃]$/.exec(upto); if (!m) return; // also full-width ＃４２＃ (Japanese input)
      const num = Number(m[1].normalize("NFKC"));
      const id = Object.keys(REFS).find((k) => REFS[k] === "Q" + num); if (!id) return; // no such question: leave the text alone
      const rest = nd.splitText(off); const hit = nd.splitText(off - m[0].length); // nd = before, hit = "#42#", rest = after
      const sp = document.createElement("span"); sp.setAttribute("data-qref", id); sp.contentEditable = "false";
      hit.parentNode.replaceChild(sp, hit);
      const nr = document.createRange(); nr.setStart(rest, 0); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr);
      emit();
    };
    box.addEventListener("input", (e) => { if (!e.isComposing) tryRef(); });
    box.addEventListener("compositionend", () => setTimeout(tryRef, 0));
    box.addEventListener("keyup", () => tryRef()); // a safety net for browsers that skip the input event
    // drag a question's Q-pill into the box: a reference that follows that question's number
    const refAt = (e) => {
      let r = null;
      if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
      else if (document.caretPositionFromPoint) { const cp = document.caretPositionFromPoint(e.clientX, e.clientY); if (cp) { r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); r.collapse(true); } }
      return r && box.contains(r.startContainer) ? r : null;
    };
    box.addEventListener("dragover", (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("application/x-qref")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    box.addEventListener("drop", (e) => {
      const id = e.dataTransfer && e.dataTransfer.getData("application/x-qref"); if (!id) return;
      e.preventDefault();
      let r = refAt(e); if (!r) { r = document.createRange(); r.selectNodeContents(box); r.collapse(false); }
      const host = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode;
      const inMark = host && host.closest && host.closest("span[data-bl],span[data-qref]");
      if (inMark) { r.setStartAfter(inMark); r.collapse(true); }
      const sp = document.createElement("span"); sp.setAttribute("data-qref", String(id).replace(/[^\w-]/g, "")); sp.contentEditable = "false";
      r.insertNode(sp);
      const sel = getSelection(); const nr = document.createRange(); nr.setStartAfter(sp); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr);
      emit();
    });
    // keyboard shortcuts (Word / Google Docs style; Alt+Shift+A/S/N/L/K also work): Ctrl/Cmd+Enter = opts.onSubmit
    box.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey && ["b", "i", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault(); document.execCommand({ b: "bold", i: "italic", u: "underline" }[e.key.toLowerCase()]); emit(); return;
      }
      if (mod && e.key === "Enter" && opts.onSubmit) { e.preventDefault(); emit(); opts.onSubmit(); return; }
      // Word / Google Docs style, Ctrl on Windows & Linux, Cmd on Mac
      if (mod && !e.altKey) {
        const w = e.shiftKey
          ? { KeyA: () => wrapSel("text-transform:uppercase"), KeyK: () => wrapSel("font-variant:small-caps"), KeyL: () => lineToggle && lineToggle("b"), Digit9: () => lineToggle && lineToggle("c") }[e.code]
          : (e.code === "Space" ? normal : (e.key === "\\" ? normal : null));
        if (w) { e.preventDefault(); w(); emit(); return; }
      }
      if (e.altKey && e.shiftKey && !mod) {
        const k = { KeyA: () => wrapSel("text-transform:uppercase"), KeyS: () => wrapSel("font-variant:small-caps"), KeyN: normal, KeyL: () => lineToggle && lineToggle("b"), KeyK: () => lineToggle && lineToggle("c") }[e.code];
        if (k) { e.preventDefault(); k(); emit(); }
      }
    });
    box.addEventListener("input", emit);
    box.addEventListener("paste", (e) => { // paste as plain text
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
    });
    wrap.append(bar, box);
    return wrap;
  }

  /** A section's contents in reading order: [{ q } | { note }]. Notes sit "start", "end", or before/after a question; a Paragraph (kind "passage") that has questions attached (q.group = its id) comes right before its first question (and their notes). */
  function flow(sec) {
    const notes = sec.notes || [], qs = sec.questions || [], ids = new Set(qs.map((x) => x.id));
    const grouped = new Set(qs.map((x) => x.group).filter(Boolean));
    const passages = new Map(notes.filter((x) => x.kind === "passage").map((x) => [x.id, x]));
    const placed = (x) => !(x.kind === "passage" && grouped.has(x.id)); // those are placed by their questions
    const out = [], shown = new Set();
    notes.filter((x) => placed(x) && x.at === "start").forEach((note) => out.push({ note }));
    qs.forEach((q) => {
      if (q.group && passages.has(q.group) && !shown.has(q.group)) { shown.add(q.group); out.push({ note: passages.get(q.group) }); }
      notes.filter((x) => placed(x) && x.at === "before" && x.q === q.id).forEach((note) => out.push({ note }));
      out.push({ q });
      notes.filter((x) => placed(x) && x.at === "after" && x.q === q.id).forEach((note) => out.push({ note }));
    });
    notes.filter((x) => placed(x) && (x.at === "end" || ((x.at === "before" || x.at === "after") && !ids.has(x.q)))).forEach((note) => out.push({ note }));
    return out;
  }

  /** Ids of the questions the teacher gave a thin line below (off by default). */
  function dividers(sec) {
    const out = new Set();
    (sec.questions || []).forEach((q) => { if (q.dividerAfter) out.add(q.id); });
    return out;
  }

  /** Questions cannot stand alone: any questions that come before the section's first Instructions box get an (empty) one. Returns true if it added it. */
  function ensureUnits(sec) {
    const items = flow(sec);
    const firstQ = items.findIndex((it) => it.q);
    if (firstQ < 0) return false;
    const firstInstr = items.findIndex((it) => it.note && it.note.kind === "instructions");
    if (firstInstr >= 0 && firstInstr < firstQ) return false;
    sec.notes = sec.notes || [];
    sec.notes.unshift({ id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: "", kind: "instructions", at: "start", q: "" });
    return true;
  }

  /** Top-level reading order with each Paragraph and its questions as ONE item: [{ note } | { q } | { group: passageNote, items: [...] }]. */
  function topItems(sec) {
    const items = flow(sec), out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.note && it.note.kind === "passage" && (sec.questions || []).some((x) => x.group === it.note.id)) {
        let left = sec.questions.filter((x) => x.group === it.note.id).length;
        const g = { group: it.note, items: [] };
        while (left > 0 && ++i < items.length) { g.items.push(items[i]); if (items[i].q) left--; }
        out.push(g);
      } else out.push(it);
    }
    return out;
  }

  /** Makes every Paragraph's questions sit side by side (at the position of its first one). */
  function regroup(sec) {
    const qs = sec.questions || [], seen = new Set(), out = [];
    qs.forEach((q) => {
      if (!q.group) { out.push(q); return; }
      if (seen.has(q.group)) return;
      seen.add(q.group);
      qs.filter((x) => x.group === q.group).forEach((x) => out.push(x));
    });
    sec.questions = out;
  }

  /** Re-anchors a note so it sits at top-level position k of the reading order (k counted without the note itself). */
  function placeNote(sec, note, k) {
    sec.notes = sec.notes.filter((x) => x !== note);
    const rest = topItems(sec);
    const next = rest[k];
    if (!next) { note.at = "end"; note.q = ""; sec.notes.push(note); return; }
    if (next.note) { // same anchor as the note that will follow it, and just before it in the list
      note.at = next.note.at; note.q = next.note.q;
      sec.notes.splice(sec.notes.indexOf(next.note), 0, note);
      return;
    }
    const q = next.q || (next.group && sec.questions.find((x) => x.group === next.group.id));
    note.at = "before"; note.q = q ? q.id : "";
    const same = sec.notes.filter((x) => x.at === "before" && x.q === note.q);
    const after = same.length ? sec.notes.indexOf(same[same.length - 1]) + 1 : sec.notes.length;
    sec.notes.splice(after, 0, note);
  }

  /** Moves one thing up (-1) or down (+1): { q } a question, { note } a note / paragraph box. Returns true if it moved. */
  function move(sec, what, dir) {
    regroup(sec);
    const qs = sec.questions;
    if (what.q) {
      const q = what.q;
      if (q.group) { // inside its Paragraph: only past its own siblings
        const mates = qs.filter((x) => x.group === q.group), i = mates.indexOf(q), j = i + dir;
        if (j < 0 || j >= mates.length) return false;
        const a = qs.indexOf(mates[i]), b = qs.indexOf(mates[j]);
        qs[a] = mates[j]; qs[b] = q;
        return true;
      }
      const blocks = []; const seen = new Set();
      qs.forEach((x) => { if (!x.group) blocks.push([x]); else if (!seen.has(x.group)) { seen.add(x.group); blocks.push(qs.filter((y) => y.group === x.group)); } });
      const i = blocks.findIndex((b) => b[0] === q), j = i + dir;
      if (j < 0 || j >= blocks.length) return false;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      sec.questions = [].concat(...blocks);
      return true;
    }
    const note = what.note;
    if (note.kind === "passage" && qs.some((x) => x.group === note.id)) { // the whole Paragraph unit
      const blocks = []; const seen = new Set();
      qs.forEach((x) => { if (!x.group) blocks.push([x]); else if (!seen.has(x.group)) { seen.add(x.group); blocks.push(qs.filter((y) => y.group === x.group)); } });
      const i = blocks.findIndex((b) => b[0].group === note.id), j = i + dir;
      if (j < 0 || j >= blocks.length) return false;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      sec.questions = [].concat(...blocks);
      return true;
    }
    const top = topItems(sec), pos = top.findIndex((x) => x.note === note);
    const k = pos + dir;
    if (pos < 0 || k < 0 || k > top.length - 1) return false;
    placeNote(sec, note, k);
    return true;
  }

  /** Can this question / note move up (-1) or down (+1)? */
  function canMove(sec, what, dir) {
    const copy = JSON.parse(JSON.stringify({ questions: sec.questions, notes: sec.notes }));
    const idOf = (x) => x.id;
    const t = { questions: copy.questions, notes: copy.notes };
    const w = what.q ? { q: t.questions.find((x) => x.id === what.q.id) } : { note: t.notes.find((x) => x.id === what.note.id) };
    return move(t, w, dir);
  }

  /** Flips the idx-th check-list box of a stored rich string. */
  function toggleCheck(rich, idx) {
    const doc = new DOMParser().parseFromString("<body>" + String(rich || "") + "</body>", "text/html");
    const c = doc.body.querySelectorAll("span[data-ck]")[idx];
    if (!c) return rich;
    c.setAttribute("data-ck", c.getAttribute("data-ck") === "1" ? "0" : "1");
    return clean(doc.body.innerHTML);
  }
  /** Makes the check-list boxes shown inside `el` clickable. getRich() = the stored string; onChange(newRich). */
  function bindChecks(el, getRich, onChange) {
    el.addEventListener("click", (ev) => {
      const c = ev.target.closest && ev.target.closest("span[data-ck]");
      if (!c || !el.contains(c)) return;
      onChange(toggleCheck(getRich(), Array.prototype.indexOf.call(el.querySelectorAll("span[data-ck]"), c)));
    });
  }
  window.QuizRich = { refsFromQuiz, labelize, clean, plain, show, editor, esc, flow, topItems, regroup, move, canMove, dividers, ensureUnits, toggleCheck, bindChecks };
})();
