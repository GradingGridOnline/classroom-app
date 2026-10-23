// ===== QR form styles (color + font templates) =====
// A "Style ▾" drop-down next to each QR form's buttons (Test & Quiz Bank, Presentation Calc). Pick a ready-made
// style or make your own; your own styles are saved once (qrstyles.json) and are available for every QR form in
// every course. A style is copied onto the form when you pick it (re-pick it after editing a style), and it travels
// inside the QR link, so students' phones show the form in those colors and that font.
// Load AFTER app.js.

(function () {
  const FONTS = [
    ["g", "Classic (serif headings)"], ["a", "Clean sans-serif"], ["b", "Serif"], ["c", "Rounded / friendly"],
    ["d", "Typewriter"], ["e", "Wide and open"], ["f", "Casual handwriting"],
  ];
  const STACKS = {
    g: ['-apple-system,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",sans-serif', 'Georgia,"Times New Roman","Hiragino Mincho ProN","Noto Serif JP",serif'],
    a: ['-apple-system,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",sans-serif'],
    b: ['Georgia,"Times New Roman","Hiragino Mincho ProN","Noto Serif JP",serif'],
    c: ['"Trebuchet MS","Hiragino Maru Gothic ProN","Segoe UI",Roboto,sans-serif'],
    d: ['"Courier New",ui-monospace,Menlo,Consolas,monospace'],
    e: ['Verdana,"Gill Sans","Century Gothic","Hiragino Sans",sans-serif'],
    f: ['"Comic Sans MS","Chalkboard SE","Marker Felt","Hiragino Maru Gothic ProN",cursive'],
  };
  const SIZES = [[0, "Small"], [1, "Normal"], [2, "Large"]];
  const COLORS = [["bg", "Page background"], ["card", "Form background"], ["ink", "Text"], ["accent", "Buttons & choices"], ["head", "Headings"], ["line", "Borders"]];
  const BUILTIN = [
    { id: "b-default", name: "Default (green)", bg: "#f6f5f1", card: "#ffffff", ink: "#2b2a28", accent: "#2f5233", head: "#223d26", line: "#ddd8cd", font: "g", size: 1 },
    { id: "b-ocean", name: "Ocean", bg: "#e8f1f8", card: "#ffffff", ink: "#16293b", accent: "#1f6fa8", head: "#12466e", line: "#c4d6e5", font: "a", size: 1 },
    { id: "b-sunset", name: "Sunset", bg: "#fbf0e6", card: "#fffaf5", ink: "#3a2418", accent: "#c2571a", head: "#8a3a0c", line: "#ecd3bd", font: "c", size: 1 },
    { id: "b-night", name: "Night", bg: "#14181f", card: "#1e242d", ink: "#f1f4f8", accent: "#4da3ff", head: "#cfe4ff", line: "#36404d", font: "a", size: 1 },
    { id: "b-classic", name: "Classic paper", bg: "#f3ecd9", card: "#fbf7ea", ink: "#2d2618", accent: "#6b4a1e", head: "#4a3210", line: "#d8cba6", font: "b", size: 1 },
    { id: "b-large", name: "Large print", bg: "#ffffff", card: "#ffffff", ink: "#000000", accent: "#0b3d91", head: "#000000", line: "#8a8a8a", font: "a", size: 2 },
  ];
  const MAX_USER = 40;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hex = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);

  let user = [], loaded = false, loading = null;
  const QRStyles = (window.QRStyles = {
    builtin: BUILTIN,
    all() { return [...BUILTIN, ...user]; },
    find(id) { return this.all().find((t) => t.id === id) || null; },
    ensureLoaded() {
      if (loaded) return Promise.resolve();
      if (!loading) {
        loading = (async () => {
          try {
            const d = await storage.loadFile("qrstyles.json");
            user = d && Array.isArray(d.templates) ? d.templates.filter((t) => t && t.id && t.name) : [];
            loaded = true;
          } finally { loading = null; }
        })();
      }
      return loading;
    },
    async saveUser() { await storage.saveFile("qrstyles.json", { templates: user }); },
    /** The compact code carried in the link. */
    encode(t) {
      return [t.bg, t.card, t.ink, t.accent, t.head, t.line].map((c) => hex(c, "#000000").slice(1)).join("-") + "-" + (STACKS[t.font] ? t.font : "g") + ([0, 1, 2].includes(Number(t.size)) ? Number(t.size) : 1);
    },
    /** What a form remembers about its style: { id, name, code } or null for the default look. */
    stamp(t) { return !t || t.id === "b-default" ? null : { id: t.id, name: t.name, code: this.encode(t) }; },
    /** Text to add to a form link. */
    query(style) { return style && style.code ? `&s=${style.code}` : ""; },
  });

  // ----- CSS -----
  const css = mk("style");
  css.textContent = `
.qs-menu { position:fixed; z-index:20010; background:var(--card,#fff); color:var(--ink,#222); border:1px solid var(--line,#ccc); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.25); padding:4px; min-width:200px; max-height:70vh; overflow:auto; }
.qs-menu button { display:flex; align-items:center; gap:8px; width:100%; text-align:left; border:0; background:transparent; color:inherit; font:inherit; font-size:.9rem; padding:6px 8px; border-radius:5px; cursor:pointer; }
.qs-menu button:hover { background:color-mix(in srgb, var(--green,#3d5a40) 16%, transparent); }
.qs-menu hr { border:0; border-top:1px solid var(--line,#ccc); margin:4px 0; }
.qs-swatch { display:inline-block; width:14px; height:14px; border-radius:3px; border:1px solid rgba(0,0,0,.3); flex:none; }
#qs-overlay { position:fixed; inset:0; z-index:20011; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#qs-box { background:var(--card,#fff); color:var(--ink,#222); width:min(760px,100%); max-height:100%; overflow:auto; border-radius:10px; border:2px solid var(--green,#3d5a40); padding:14px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5); }
#qs-box h3 { margin:0 0 8px; }
#qs-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media (max-width:640px) { #qs-grid { grid-template-columns:1fr; } }
#qs-box label { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:5px 0; }
#qs-box input[type=color] { width:44px; height:28px; padding:0; border:1px solid var(--line,#ccc); background:transparent; }
.qs-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; }
`;
  document.head.appendChild(css);

  // ----- preview -----
  function preview(host, t) {
    const [bodyFont, headFont] = STACKS[t.font] || STACKS.a;
    const k = [0.9, 1, 1.2][Number(t.size)] || 1;
    host.style.cssText = `background:${t.bg};color:${t.ink};font-family:${bodyFont};font-size:${(15 * k).toFixed(1)}px;padding:12px;border-radius:8px;border:1px solid ${t.line};`;
    host.textContent = "";
    const card = mk("div"); card.style.cssText = `background:${t.card};border:1px solid ${t.line};border-radius:8px;padding:12px;`;
    const h = mk("div", "", "Quiz title"); h.style.cssText = `font-family:${headFont || bodyFont};font-weight:700;font-size:1.25em;color:${t.head};margin-bottom:4px`;
    const q = mk("div", "", "1. Which answer is correct?"); q.style.cssText = "font-weight:600;margin:6px 0";
    const on = (sel) => `display:block;width:100%;text-align:left;padding:7px 10px;margin:4px 0;border-radius:7px;font:inherit;border:1.5px solid ${sel ? t.accent : t.line};background:${sel ? t.accent : t.card};color:${sel ? onAccent(t.accent) : t.ink};`;
    const a = mk("div", "", "A  First choice"); a.style.cssText = on(true);
    const b = mk("div", "", "B  Second choice"); b.style.cssText = on(false);
    const s = mk("div", "", "Submit"); s.style.cssText = `text-align:center;font-weight:600;padding:8px;border-radius:7px;margin-top:8px;background:${t.accent};color:${onAccent(t.accent)}`;
    card.append(h, q, a, b, s); host.appendChild(card);
  }
  function onAccent(c) {
    const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.45 ? "#111111" : "#ffffff";
  }

  // ----- the editor dialog: resolves with the saved/applied template, or null -----
  function editor(base, isNew) {
    return new Promise((resolve) => {
      const t = { ...base };
      if (isNew) { t.id = `qs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; t.name = `${base.name} (mine)`.replace(/ \(mine\) \(mine\)$/, " (mine)"); }
      const ov = mk("div"); ov.id = "qs-overlay";
      const box = mk("div"); box.id = "qs-box"; ov.appendChild(box);
      box.appendChild(mk("h3", "", isNew ? "New QR form style" : "Edit QR form style"));
      const grid = mk("div"); grid.id = "qs-grid"; box.appendChild(grid);
      const left = mk("div"), right = mk("div"); grid.append(left, right);
      const nl = mk("label"); nl.appendChild(document.createTextNode("Name")); const ni = mk("input"); ni.type = "text"; ni.value = t.name; ni.style.width = "60%"; nl.appendChild(ni); left.appendChild(nl);
      ni.addEventListener("input", () => { t.name = ni.value; });
      const pv = mk("div");
      const upd = () => preview(pv, t);
      COLORS.forEach(([k, label]) => {
        const l = mk("label"); l.appendChild(document.createTextNode(label));
        const c = mk("input"); c.type = "color"; c.value = hex(t[k], "#000000");
        c.addEventListener("input", () => { t[k] = c.value; upd(); });
        l.appendChild(c); left.appendChild(l);
      });
      const fl = mk("label"); fl.appendChild(document.createTextNode("Font"));
      const fs = mk("select"); FONTS.forEach(([v, n]) => { const o = mk("option", "", n); o.value = v; fs.appendChild(o); }); fs.value = t.font;
      fs.addEventListener("change", () => { t.font = fs.value; upd(); }); fl.appendChild(fs); left.appendChild(fl);
      const zl = mk("label"); zl.appendChild(document.createTextNode("Text size"));
      const zs = mk("select"); SIZES.forEach(([v, n]) => { const o = mk("option", "", n); o.value = String(v); zs.appendChild(o); }); zs.value = String(t.size);
      zs.addEventListener("change", () => { t.size = Number(zs.value); upd(); }); zl.appendChild(zs); left.appendChild(zl);
      right.appendChild(mk("p", "hint", "Preview (what students see):")); right.appendChild(pv);
      upd();
      const msg = mk("p", "result"); box.appendChild(msg);
      const acts = mk("div", "qs-actions");
      const done = (v) => { ov.remove(); resolve(v); };
      const cancel = mk("button", "btn btn-ghost", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => done(null));
      acts.appendChild(cancel);
      if (!isNew && !t.builtin) {
        const del = mk("button", "btn btn-ghost", "Delete style"); del.type = "button";
        del.addEventListener("click", async () => {
          if (!confirm(`Delete the style "${t.name}"? Forms already using it keep their look.`)) return;
          try { user = user.filter((x) => x.id !== t.id); await QRStyles.saveUser(); done({ deleted: t.id }); } catch (e) { msg.textContent = `Couldn't delete: ${e.message}`; }
        });
        acts.appendChild(del);
      }
      const save = mk("button", "btn btn-primary", isNew ? "Save and use" : "Save"); save.type = "button";
      save.addEventListener("click", async () => {
        t.name = (ni.value || "").trim();
        if (!t.name) { msg.textContent = "Give the style a name."; return; }
        if (isNew && user.length >= MAX_USER) { msg.textContent = `You've reached the limit of ${MAX_USER} styles.`; return; }
        try {
          const clean = { id: t.id, name: t.name, bg: t.bg, card: t.card, ink: t.ink, accent: t.accent, head: t.head, line: t.line, font: t.font, size: Number(t.size) };
          const i = user.findIndex((x) => x.id === t.id);
          if (i >= 0) user[i] = clean; else user.push(clean);
          await QRStyles.saveUser();
          done(clean);
        } catch (e) { msg.textContent = `Couldn't save: ${e.message}`; }
      });
      acts.appendChild(save); box.appendChild(acts);
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) done(null); });
      document.body.appendChild(ov);
    });
  }

  // ----- the "Style ▾" drop-down -----
  let open = null;
  const closeMenu = () => { if (open) { open.remove(); open = null; } };
  document.addEventListener("click", (e) => { if (open && !open.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);

  /**
   * Builds the "Style ▾" button.
   *  get()   → the form's current style stamp ({id,name,code}) or null
   *  set(s)  → store a new stamp (or null) on the form; may be async
   *  say(t)  → show a status message
   */
  QRStyles.menuButton = function (get, set, say, cls) {
    const btn = mk("button", cls || "btn btn-ghost btn-small", "Style ▾");
    btn.type = "button"; btn.setAttribute("aria-haspopup", "true");
    btn.title = "Colors and font of the form students see";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (open) { closeMenu(); return; }
      try { await QRStyles.ensureLoaded(); } catch (err) { say(`Couldn't load your styles: ${err.message}`); }
      const cur = get();
      const list = mk("div", "qs-menu"); open = list;
      const item = (label, fn, swatch, check) => {
        const b = mk("button"); b.type = "button";
        if (swatch) { const s = mk("span", "qs-swatch"); s.style.background = swatch; b.appendChild(s); }
        b.appendChild(document.createTextNode((check ? "✓ " : "") + label));
        b.addEventListener("click", (ev) => { ev.stopPropagation(); closeMenu(); fn(); });
        list.appendChild(b);
      };
      const apply = async (t) => { try { await set(QRStyles.stamp(t)); say(t && t.id !== "b-default" ? `Style “${t.name}” applied. Click Show QR Code to get the updated code.` : "Default style applied. Click Show QR Code to get the updated code."); } catch (err) { say(`Couldn't apply the style: ${err.message}`); } };
      const curId = cur ? cur.id : "b-default";
      BUILTIN.forEach((t) => item(t.name, () => apply(t), t.accent, t.id === curId));
      if (user.length) list.appendChild(mk("hr"));
      user.forEach((t) => item(t.name, () => apply(t), t.accent, t.id === curId));
      list.appendChild(mk("hr"));
      item("New style…", async () => {
        const base = QRStyles.find(curId) || BUILTIN[0];
        const r = await editor(base, true);
        if (r && r.id) await apply(r);
      });
      const curT = QRStyles.find(curId);
      if (curT && !BUILTIN.includes(curT)) item(`Edit “${curT.name}”…`, async () => {
        const r = await editor(curT, false);
        if (r && r.id) await apply(r); else if (r && r.deleted) { await set(null); say("Style deleted; this form is back to the default look."); }
      });
      document.body.appendChild(list);
      const r = btn.getBoundingClientRect();
      const below = r.bottom + 4;
      list.style.top = `${below + list.offsetHeight > window.innerHeight ? Math.max(8, r.top - list.offsetHeight - 4) : below}px`;
      list.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - list.offsetWidth - 8))}px`;
    });
    return btn;
  };
})();
