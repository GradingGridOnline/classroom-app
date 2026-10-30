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
    const doc = new DOMParser().parseFromString("<body>" + String(html || "").replace(/<br\s*\/?>/gi, "\n") + "</body>", "text/html");
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
      st.textContent = '[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);opacity:.5}.qrich-btn{padding:1px 8px !important;min-width:2em}';
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
    mk("<b>B</b>", "Bold", () => document.execCommand("bold"));
    mk("<i>I</i>", "Italic", () => document.execCommand("italic"));
    mk("<u>U</u>", "Underline", () => document.execCommand("underline"));
    mk("AA", "ALL CAPS", () => wrapSel("text-transform:uppercase"));
    mk('<span style="font-variant:small-caps">Aa</span>', "Small caps", () => wrapSel("font-variant:small-caps"));
    mk("Normal", "Clear formatting from the selected text", normal);
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
    box.addEventListener("input", emit);
    box.addEventListener("paste", (e) => { // paste as plain text
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
    });
    wrap.append(bar, box);
    return wrap;
  }

  /** A section's contents in reading order: [{ q } | { note }]. Notes sit "start", "end", or before/after a question; a Paragraph (kind "passage") that has questions attached (q.group = its id) comes right before its first question. */
  function flow(sec) {
    const notes = sec.notes || [], qs = sec.questions || [], ids = new Set(qs.map((x) => x.id));
    const grouped = new Set(qs.map((x) => x.group).filter(Boolean));
    const passages = new Map(notes.filter((x) => x.kind === "passage").map((x) => [x.id, x]));
    const placed = (x) => !(x.kind === "passage" && grouped.has(x.id)); // those are placed by their questions
    const out = [], shown = new Set();
    notes.filter((x) => placed(x) && x.at === "start").forEach((note) => out.push({ note }));
    qs.forEach((q) => {
      notes.filter((x) => placed(x) && x.at === "before" && x.q === q.id).forEach((note) => out.push({ note }));
      if (q.group && passages.has(q.group) && !shown.has(q.group)) { shown.add(q.group); out.push({ note: passages.get(q.group) }); }
      out.push({ q });
      notes.filter((x) => placed(x) && x.at === "after" && x.q === q.id).forEach((note) => out.push({ note }));
    });
    notes.filter((x) => placed(x) && (x.at === "end" || ((x.at === "before" || x.at === "after") && !ids.has(x.q)))).forEach((note) => out.push({ note }));
    return out;
  }

  window.QuizRich = { clean, plain, show, editor, esc, flow };
})();
