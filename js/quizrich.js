// Tiny rich-text helper for quiz question text and instructions: bold, italic, underline, ALL CAPS,
// small caps, colour, and "Normal" (clear formatting). Stored as a restricted HTML string (q.rich /
// note.rich) next to the plain text (q.text / note.text), and cleaned by the same whitelist wherever
// it is shown: QuizRich.clean(html) -> safe html string.
(function () {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;

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
    return doc.body.textContent || "";
  }

  /** The html to show for something with { text, rich }: the cleaned rich version if present, otherwise the escaped text. */
  function show(item) {
    const r = item && item.rich ? clean(item.rich) : "";
    return r || esc((item && item.text) || "").replace(/\n/g, "<br>");
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
    box.innerHTML = opts.rich ? clean(opts.rich) : esc(opts.text || "").replace(/\n/g, "<br>");
    if (!document.getElementById("qrich-style")) {
      const st = document.createElement("style");
      st.id = "qrich-style";
      st.textContent = '[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);opacity:.5}.qrich-btn{padding:1px 8px !important;min-width:2em}span[data-ck]{display:inline-block;width:1.05em;height:1.05em;border:2px solid currentColor;border-radius:999px;vertical-align:-.15em;margin-right:.4em;cursor:pointer;box-sizing:border-box;opacity:.85}span[data-ck="1"]{background:#3ddc84;border-color:#3ddc84;opacity:1;box-shadow:0 0 8px 2px rgba(61,220,132,.75)}';
      document.head.appendChild(st);
    }
    const emit = () => {
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
    if (opts.lists) {
      const fixCk = () => box.querySelectorAll("span[data-ck]").forEach((c) => { c.contentEditable = "false"; });
      fixCk();
      const idx = (n) => Array.prototype.indexOf.call(n.parentNode.childNodes, n);
      /** Where the caret's line starts (after the last line break before the caret) and whether it begins with a bullet / check box. */
      const caretLine = () => {
        const s = selInside(); if (!s) return null;
        const r = s.getRangeAt(0).cloneRange(); r.collapse(true);
        let start = { node: box, off: 0 };
        const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let n;
        while ((n = tw.nextNode())) {
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
        const descend = (c) => { while (c && c.nodeType === 1 && c.tagName !== "BR" && !c.hasAttribute("data-ck")) c = c.firstChild; return c && !(c.nodeType === 1 && c.tagName === "BR") ? c : null; };
        if (start.node.nodeType === 3) {
          if (start.off < start.node.data.length) { target = start.node; toff = start.off; }
          else { let x = start.node; while (x && x !== box && !x.nextSibling) x = x.parentNode; target = x && x !== box ? descend(x.nextSibling) : null; }
        } else target = descend(start.node.childNodes[start.off]);
        let kind = "", el = null;
        if (target && target.nodeType === 1) { kind = "c"; el = target; }
        else if (target && target.nodeType === 3 && target.data.startsWith("• ", toff)) kind = "b";
        const rs = document.createRange(); rs.setStart(start.node, start.off); rs.setEnd(r.startContainer, r.startOffset);
        return { start, kind, el, target, toff, atStart: rs.toString() === "" && !rs.cloneContents().querySelector("span[data-ck]") };
      };
      const place = (L, kind) => {
        const frag = document.createDocumentFragment();
        let lastNode;
        if (kind === "b") { lastNode = document.createTextNode("• "); frag.appendChild(lastNode); }
        else { const c = document.createElement("span"); c.dataset.ck = "0"; c.contentEditable = "false"; lastNode = document.createTextNode(" "); frag.append(c, lastNode); }
        const rg = document.createRange();
        rg.setStart(L.start.node, L.start.off); rg.collapse(true); rg.insertNode(frag);
        if (L.atStart) { const sel = getSelection(); const nr = document.createRange(); nr.setStartAfter(lastNode); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); }
      };
      const unmark = (L) => { if (L.kind === "b") L.target.deleteData(L.toff, 2); else if (L.kind === "c") L.el.remove(); };
      const lineText = (L) => {
        const rr = document.createRange(); rr.setStart(L.start.node, L.start.off); rr.setEnd(box, box.childNodes.length);
        const w = document.createTreeWalker(rr.cloneContents(), 5); let t = "", x;
        while ((x = w.nextNode())) { if (x.nodeType === 3) t += x.data; else if (x.tagName === "BR") t += "\n"; }
        return t.split("\n")[0].replace(/^• /, "").trim();
      };
      const toggleLine = (kind) => {
        box.focus(); let L = caretLine(); if (!L) return;
        if (L.kind === kind) { unmark(L); return; }
        if (L.kind) { unmark(L); L = caretLine(); }
        place(L, kind);
      };
      lineToggle = toggleLine;
      mk("• List", "Bullet point on this line (Ctrl/Cmd+Shift+L; again to remove)", () => toggleLine("b"));
      mk("☐ Item", "Check-list box on this line (Ctrl/Cmd+Shift+9; again to remove)", () => toggleLine("c"));
      box.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const L = caretLine(); const k = L ? L.kind : "";
        if (k && lineText(L) === "") { unmark(L); emit(); return; }
        document.execCommand("insertLineBreak");
        if (k) { const L2 = caretLine(); if (L2) place(L2, k); }
        emit();
      });
      box.addEventListener("click", (e) => {
        const c = e.target.closest && e.target.closest("span[data-ck]");
        if (c && box.contains(c)) { c.dataset.ck = c.dataset.ck === "1" ? "0" : "1"; emit(); }
      });
    }
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

  /** Ids of the questions that END a unit (an instructions box starts the next unit, which has questions): a thin line is drawn below them. */
  function dividers(sec) {
    const items = flow(sec), out = new Set();
    let lastQ = -1;
    items.forEach((it, i) => { if (it.q) lastQ = i; });
    let prev = null;
    items.forEach((it, i) => {
      if (it.q) prev = it.q;
      else if (it.note && it.note.kind === "instructions" && prev && i < lastQ) out.add(prev.id);
    });
    return out;
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
  window.QuizRich = { clean, plain, show, editor, esc, flow, topItems, regroup, move, canMove, dividers, toggleCheck, bindChecks };
})();
