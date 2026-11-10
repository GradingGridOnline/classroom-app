// ===== Class Material: the Materials Bank =====
// Sits under a course's slideshow list. A "family" is a set of connected slideshows (usually the same deck used in
// different courses). Each copy keeps its own lessons, seating, calendar and picture; what the bank can do is
//   • make a copy of a slideshow in another course (a Google Drive copy, then its pre-made slides are rebuilt with
//     that course's own data), and
//   • push the pre-made slide *settings* (style, cover, slide order, options) from one connected slideshow to others.
// Hand-made slides can't be copied between existing decks (Google's API has no slide-to-slide copy), so they travel
// only when you make a copy of the whole slideshow.
// Stored in one small file: classmaterial-bank.json  { families: [{ id, name, members: [{ courseId, itemId }] }] }.
(function () {
  const CMX = window.ClassMaterial; if (!CMX || !CMX.buildBasic) return;
  const { mk, btn, G, CM } = CMX;
  const FILE = "classmaterial-bank.json";
  const uid = () => `fam-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const Bank = {
    families: [], loaded: false,
    async load() { const d = await storage.loadFile(FILE); this.families = d && Array.isArray(d.families) ? d.families : []; this.loaded = true; },
    async save() { await storage.saveFile(FILE, { families: this.families }); },
    familyOf(courseId, itemId) { return this.families.find((f) => f.members.some((m) => m.courseId === courseId && m.itemId === itemId)); },
  };
  const courseName = (cid) => { const c = window.CoursesModule && CoursesModule.find ? CoursesModule.find(cid) : null; return (c && c.name) || "Course"; };

  /** Runs fn with another course loaded as the "current" Class Material course, then switches back. */
  async function inCourse(cid, fn) {
    if (cid === CM.courseId) return fn();
    const prev = CM.courseId; await CM.save(); await CM.load(cid);
    try { return await fn(); } finally { await CM.load(prev); }
  }
  /** Reads a member's slideshow item (from the open course, or straight from that course's file). */
  async function itemOf(m, cache) {
    if (m.courseId === CM.courseId) return CM.items.find((x) => x.id === m.itemId) || null;
    if (!cache[m.courseId]) { try { const d = await storage.loadFile(`classmaterial-${m.courseId}.json`); cache[m.courseId] = d && Array.isArray(d.items) ? d.items : []; } catch (e) { cache[m.courseId] = []; } }
    return cache[m.courseId].find((x) => x.id === m.itemId) || null;
  }

  // ---------- what differs from the master ----------
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function differences(a, b) { // a = copy's options, b = master's options
    const d = [];
    if (a.style !== b.style) d.push("style");
    if (a.style === "modern" && b.style === "modern" && a.fonts !== b.fonts) d.push("fonts");
    if (a.title.variant !== b.title.variant) d.push("cover template");
    if (a.title.showCourse !== b.title.showCourse || a.title.showLesson !== b.title.showLesson) d.push("cover text");
    if (!same(a.order, b.order)) d.push("slides / order");
    if (!same(a.goals, b.goals)) d.push("goals slide");
    if (!same(a.seating, b.seating)) d.push("seating options");
    if (!same(a.calendar, b.calendar)) d.push("calendar options");
    return d;
  }

  // ---------- operations ----------
  async function copyToCourse(srcItem, srcCourseId, family, targetCourseId, name) {
    const opts = clone(CMX.getOpts(srcItem));
    return inCourse(targetCourseId, async () => {
      const parent = await CMX.courseFolder();
      const f = await G.api(`/files/${srcItem.fileId}/copy?fields=id,name,modifiedTime`, { method: "POST", body: { name, parents: [parent] } });
      // a Drive copy keeps slide order, so map the generated slides across by position
      const [a, b] = await Promise.all([G.call(`${CMX.SLIDES}${srcItem.fileId}?fields=slides.objectId`), G.call(`${CMX.SLIDES}${f.id}?fields=slides.objectId`)]);
      const ia = (a.slides || []).map((x) => x.objectId), ib = (b.slides || []).map((x) => x.objectId), map = {};
      ia.forEach((id, i) => { if (ib[i]) map[id] = ib[i]; });
      const sSrc = srcItem.source || {}, now = new Date().toISOString();
      const item = {
        id: CM.newId(), kind: "slides", title: f.name, fileId: f.id, createdAt: now, updatedAt: f.modifiedTime || now, lessonId: null,
        source: { template: "basic", slideIds: (sSrc.slideIds || []).map((x) => map[x]).filter(Boolean), byType: Object.fromEntries(Object.entries(sSrc.byType || {}).map(([k, v]) => [k, map[v]]).filter(([, v]) => v)), options: opts },
      };
      CM.items.unshift(item); await CM.save();
      await CMX.buildBasic(item, opts); // redraws title / goals / seating / calendar with THIS course's data
      family.members.push({ courseId: targetCourseId, itemId: item.id }); await Bank.save();
    });
  }
  const GROUPS = {
    look: { label: "Style and fonts", apply: (t, s) => { t.style = s.style; t.fonts = s.fonts; if (!(CMX.COVERS[t.title.variant] || CMX.MODERN_COVERS[t.title.variant]) || (t.style === "modern") !== (!!CMX.MODERN_COVERS[t.title.variant])) t.title.variant = s.title.variant; } },
    cover: { label: "Cover slide settings (keeps each copy’s own subtitle)", apply: (t, s) => { const sub = t.title.subtitle; t.title = Object.assign({}, s.title, { subtitle: sub }); } },
    order: { label: "Which slides are included, and their order", apply: (t, s) => { t.order = clone(s.order); } },
    slideOptions: { label: "Goals, seating and calendar options", apply: (t, s) => { t.goals = clone(s.goals); t.seating = clone(s.seating); t.calendar = clone(s.calendar); } },
  };
  async function pushSettings(from, targets, groups) {
    const src = clone(CMX.getOpts(from.item));
    let done = 0;
    for (const t of targets) {
      await inCourse(t.m.courseId, async () => {
        const item = CM.items.find((x) => x.id === t.m.itemId); if (!item || !(item.source && item.source.template === "basic")) return;
        const o = clone(CMX.getOpts(item));
        groups.forEach((g) => GROUPS[g].apply(o, src));
        await CMX.buildBasic(item, o); done++;
      });
    }
    return done;
  }

  // ---------- dialogs ----------
  const css = mk("style");
  css.textContent = `
#cm-bank { margin-top:22px; padding:14px 16px; border:2px solid var(--line); border-radius:12px; background:var(--card); color:var(--ink); }
#cm-bank h3 { margin:0 0 4px; font-family:var(--font-heading); }
#cm-bank .fam { border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:10px 0; background:var(--paper); }
#cm-bank .fam-h { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; margin-bottom:6px; }
#cm-bank .fam-h b { font-family:var(--font-heading); font-size:1.05rem; }
#cm-bank .mem { display:grid; grid-template-columns:1fr auto; gap:4px 10px; align-items:center; padding:7px 0; border-top:1px dashed var(--line); }
#cm-bank .mem .ds { font-size:.8rem; color:var(--ink-soft,#777); }
#cm-bank .badge { font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; background:var(--green); color:#fff; border-radius:4px; padding:1px 6px; margin-left:6px; }
#cm-bank .diff { color:#9a5b00; }
#cm-dlg { position:fixed; inset:0; z-index:20004; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#cm-dlg > div { background:var(--card,#fff); color:var(--ink,#222); width:min(560px,100%); max-height:90vh; overflow:auto; border-radius:10px; border:2px solid var(--green); padding:16px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5); display:grid; gap:10px; }
#cm-dlg h3 { margin:0; } #cm-dlg label { display:flex; gap:8px; align-items:flex-start; font-size:.92rem; } #cm-dlg select, #cm-dlg input[type=text] { font:inherit; padding:7px; width:100%; }
`;
  document.head.appendChild(css);
  function dialog(title, build, okLabel, onOk) {
    const ov = mk("div"); ov.id = "cm-dlg"; const box = mk("div"); ov.appendChild(box); box.appendChild(mk("h3", "", title));
    const get = build(box); const acts = mk("div"); acts.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
    const close = () => ov.remove();
    acts.append(btn("Cancel", "btn btn-ghost", close), btn(okLabel, "btn btn-primary", () => { const v = get(); if (v === false) return; close(); onOk(v); }));
    box.appendChild(acts); document.body.appendChild(ov);
  }
  const checkRow = (box, text, on) => { const l = mk("label"); const c = mk("input"); c.type = "checkbox"; c.checked = on !== false; l.append(c, text); box.appendChild(l); return c; };

  function pushDialog(fam, from, members) {
    const others = members.filter((x) => x.m !== from.m && x.item && x.item.source && x.item.source.template === "basic");
    if (!others.length) { CMX.say("There are no other Basic slideshows connected to this one yet."); return; }
    dialog(`Push settings from “${from.item.title}”`, (box) => {
      box.appendChild(mk("p", "hint", "Choose what to copy, and which connected slideshows receive it. Each one keeps its own lessons, seating, calendar, textbook picture and any slides you added."));
      const g = Object.entries(GROUPS).map(([k, v]) => [k, checkRow(box, v.label)]);
      box.appendChild(mk("div", "cs-h", "Send to"));
      const t = others.map((o) => [o, checkRow(box, `${courseName(o.m.courseId)} — ${o.item.title}`)]);
      box.appendChild(mk("p", "hint", "Heads up: the pre-made slides (cover, goals, seating, calendar) are rebuilt in each, so edits made directly on those slides are replaced. Hand-made slides are left alone, and can’t be pushed — use “Copy to another course” to carry them in a whole new copy."));
      return () => { const gs = g.filter(([, c]) => c.checked).map(([k]) => k), ts = t.filter(([, c]) => c.checked).map(([o]) => o); if (!gs.length || !ts.length) return false; return { gs, ts }; };
    }, "Push", (v) => CMX.run("Pushing settings", async () => { const n = await pushSettings(from, v.ts, v.gs); CMX.say(`Updated ${n} slideshow${n === 1 ? "" : "s"}.`); }));
  }
  function copyDialog(fam, from) {
    const courses = (window.CoursesModule && CoursesModule.courses || []).filter((c) => !c.archived);
    dialog(`Copy “${from.item.title}” to another course`, (box) => {
      box.appendChild(mk("p", "hint", "Makes a full copy in that course’s Drive folder (including any slides you added), then redraws the pre-made slides with that course’s lessons, seating and calendar. The copy stays connected."));
      const sel = mk("select"); courses.forEach((c) => { const o = mk("option", "", c.name); o.value = c.id; sel.appendChild(o); });
      const nm = mk("input"); nm.type = "text"; nm.value = from.item.title;
      sel.addEventListener("change", () => { nm.value = `${courseName(sel.value)} – ${from.item.title.replace(/^.*? – /, "")}`; });
      box.append(mk("label", "", "Course"), sel, mk("label", "", "Name of the copy"), nm);
      return () => (nm.value.trim() && sel.value ? { cid: sel.value, name: nm.value.trim() } : false);
    }, "Make copy", (v) => CMX.run("Copying slideshow", () => copyToCourse(from.item, from.m.courseId, fam, v.cid, v.name)));
  }

  // ---------- the box ----------
  async function renderBank(holder) {
    holder.innerHTML = "";
    holder.appendChild(mk("h3", "", "Materials Bank"));
    holder.appendChild(mk("p", "hint", "Keep copies of a slideshow connected across your courses. Add a slideshow with its “Bank…” button, copy it to another course, and push pre-made slide settings between connected copies."));
    if (!Bank.loaded) { try { await Bank.load(); } catch (e) { holder.appendChild(mk("p", "hint", "Couldn't load the bank: " + e.message)); return; } }
    const cache = {}; let pruned = false;
    if (!Bank.families.length) { holder.appendChild(mk("p", "hint", "Nothing in the bank yet.")); return; }
    for (const fam of Bank.families) {
      const members = [];
      for (const m of fam.members) { const item = await itemOf(m, cache); if (item) members.push({ m, item }); }
      if (members.length !== fam.members.length) { fam.members = members.map((x) => x.m); pruned = true; }
      if (!members.length) continue;
      const card = mk("div", "fam"), head = mk("div", "fam-h"); head.appendChild(mk("b", "", fam.name));
      const ha = mk("div"); ha.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
      ha.append(
        btn("Copy to another course…", "btn btn-ghost btn-small", () => copyDialog(fam, members[0])),
        btn("Rename", "btn btn-ghost btn-small", () => { const n = prompt("Name for this group of slideshows:", fam.name); if (n && n.trim()) { fam.name = n.trim(); Bank.save().then(CMX.render); } }),
        btn("Remove from bank", "btn btn-ghost btn-small", () => { if (confirm("Remove this group from the bank? The slideshows themselves are not deleted.")) { Bank.families = Bank.families.filter((x) => x !== fam); Bank.save().then(CMX.render); } }));
      head.appendChild(ha); card.appendChild(head);
      const master = members[0];
      members.forEach((x, i) => {
        const row = mk("div", "mem"), left = mk("div");
        const t = mk("div"); t.append(document.createTextNode(`${courseName(x.m.courseId)} — ${x.item.title}`)); if (i === 0) t.appendChild(mk("span", "badge", "Master")); left.appendChild(t);
        let ds = "Master copy";
        if (i > 0) { const d = x.item.source && x.item.source.template === "basic" && master.item.source ? differences(CMX.getOpts(x.item), CMX.getOpts(master.item)) : null; ds = d ? (d.length ? "Differs from master: " + d.join(", ") : "Same settings as master") : "Not a Basic slideshow"; }
        const dl = mk("div", "ds" + (i > 0 && /Differs/.test(ds) ? " diff" : ""), ds); left.appendChild(dl); row.appendChild(left);
        const acts = mk("div"); acts.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end";
        const open = mk("a", "btn btn-ghost btn-small", "Open"); open.href = `https://docs.google.com/presentation/d/${x.item.fileId}/edit`; open.target = "_blank"; open.rel = "noopener";
        acts.append(open, btn("Push settings…", "btn btn-ghost btn-small", () => pushDialog(fam, x, members)),
          btn("Disconnect", "btn btn-ghost btn-small", () => { if (confirm("Disconnect this slideshow from the group? It stays in its course.")) { fam.members = fam.members.filter((m) => m !== x.m); if (!fam.members.length) Bank.families = Bank.families.filter((f) => f !== fam); Bank.save().then(CMX.render); } }));
        row.appendChild(acts); card.appendChild(row);
      });
      holder.appendChild(card);
    }
    if (pruned) Bank.save().catch(() => {});
  }
  CMX.afterMaterials = (host) => { const h = mk("div"); h.id = "cm-bank"; host.appendChild(h); renderBank(h); };

  // ---------- "Bank…" button on each slideshow in the list ----------
  const prevActions = CMX.itemActions;
  CMX.itemActions = (it, acts) => {
    if (prevActions) prevActions(it, acts);
    if (it.kind !== "slides") return;
    const fam = Bank.familyOf(CM.courseId, it.id);
    acts.appendChild(btn(fam ? "In bank ✓" : "Bank…", "btn btn-ghost btn-small", () => {
      if (fam) { CMX.say(`In the bank as “${fam.name}”. Manage it in the Materials Bank below.`); return; }
      const go = async () => { if (!Bank.loaded) await Bank.load(); bankDialog(it); };
      go().catch((e) => CMX.say(e.message));
    }));
  };
  function bankDialog(it) {
    const fams = Bank.families;
    dialog(`Add “${it.title}” to the Materials Bank`, (box) => {
      const mode = mk("select"), famSel = mk("select");
      [["new", "Start a new group (this becomes the master)"], ...(fams.length ? [["join", "Connect to an existing group"]] : [])].forEach(([v, t]) => { const o = mk("option", "", t); o.value = v; mode.appendChild(o); });
      fams.forEach((f) => { const o = mk("option", "", f.name); o.value = f.id; famSel.appendChild(o); });
      const nm = mk("input"); nm.type = "text"; nm.value = it.title;
      const sync = () => { famSel.style.display = mode.value === "join" ? "" : "none"; nm.style.display = mode.value === "new" ? "" : "none"; }; mode.addEventListener("change", sync); sync();
      box.append(mode, famSel, nm);
      return () => ({ mode: mode.value, fam: famSel.value, name: nm.value.trim() });
    }, "Add", async (v) => {
      try {
        if (v.mode === "join") { const f = Bank.families.find((x) => x.id === v.fam); if (f) f.members.push({ courseId: CM.courseId, itemId: it.id }); }
        else Bank.families.push({ id: uid(), name: v.name || it.title, members: [{ courseId: CM.courseId, itemId: it.id }] });
        await Bank.save(); CMX.render();
      } catch (e) { CMX.say(e.message); }
    });
  }
})();
