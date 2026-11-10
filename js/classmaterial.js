// ===== Class Material (stage 1: the basic structure) =====
// A "Class Material" tab per course. Each item is a real Google file (Slides / Docs / Sheets) created in the
// teacher's own Google Drive, inside "GradingGrid Class Material / <course name>". GradingGrid keeps only a tiny
// index per course (title, kind, Drive file id, dates) in classmaterial-<courseId>.json, so storage use stays minimal.
// Uses the existing drive.file permission: the app can only see files it created itself.
// Later stages (templates, course data, calendar, QR codes…) build on `items[].source` and the Drive helpers here.
(function () {
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const btn = (label, cls, fn) => { const b = mk("button", cls || "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", fn); return b; };
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;

  const KINDS = {
    slides: { label: "Slideshow", plural: "Slideshows", icon: "🖼️", mime: "application/vnd.google-apps.presentation", url: (id) => `https://docs.google.com/presentation/d/${id}/edit` },
    doc: { label: "Document", plural: "Documents", icon: "📄", mime: "application/vnd.google-apps.document", url: (id) => `https://docs.google.com/document/d/${id}/edit` },
    sheet: { label: "Spreadsheet", plural: "Spreadsheets", icon: "📊", mime: "application/vnd.google-apps.spreadsheet", url: (id) => `https://docs.google.com/spreadsheets/d/${id}/edit` },
  };
  const ROOT_FOLDER = "GradingGrid Class Material";
  const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

  // ---------- data (one small file per course) ----------
  const CM = {
    items: [], calendar: null, textbook: null, courseId: null,
    file: (id) => `classmaterial-${id}.json`,
    async load(courseId) {
      this.courseId = courseId;
      const d = await storage.loadFile(this.file(courseId));
      this.items = d && Array.isArray(d.items) ? d.items : [];
      this.calendar = d && d.calendar && typeof d.calendar === "object" ? d.calendar : null;
      this.textbook = d && d.textbook && d.textbook.fileId ? d.textbook : null;
    },
    async save() { if (this.courseId) await storage.saveFile(this.file(this.courseId), { items: this.items, calendar: this.calendar, textbook: this.textbook }); },
    newId: () => `cm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  // ---------- Google access (token on demand; remembered only in memory) ----------
  const G = {
    token: null, exp: 0, email: (() => { try { return localStorage.getItem("ggo-cm-google") || ""; } catch (e) { return ""; } })(), _flight: null,
    connected() { return !!this.token && Date.now() < this.exp; },
    async gis() {
      const t0 = Date.now();
      while (!(window.google && google.accounts && google.accounts.oauth2)) {
        if (Date.now() - t0 > 8000) throw new Error("Google's sign-in library didn't load. Check your connection and reload.");
        await new Promise((r) => setTimeout(r, 100));
      }
    },
    /** Must be called from a click so the Google window isn't blocked. */
    async connect() {
      if (this.connected()) return this.token;
      if (this._flight) return this._flight;
      this._flight = (async () => {
        await this.gis();
        return new Promise((resolve, reject) => {
          const client = google.accounts.oauth2.initTokenClient({
            client_id: APP_CONFIG.google.clientId, scope: SCOPE,
            callback: (r) => {
              if (r.error) return reject(new Error(r.error_description || r.error));
              this.token = r.access_token; this.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000;
              this.whoami().finally(() => resolve(this.token));
            },
            error_callback: (e) => reject(new Error(e && e.type === "popup_failed_to_open" ? "The Google window was blocked. Allow pop-ups for this site and try again." : (e && e.type) || "Google sign-in was cancelled.")),
          });
          const o = { prompt: this.email ? "" : "consent" }; if (this.email) o.hint = this.email;
          client.requestAccessToken(o);
        });
      })();
      try { return await this._flight; } finally { this._flight = null; }
    },
    async whoami() {
      try {
        const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + this.token } });
        const j = await r.json(); if (j.email) { this.email = j.email; try { localStorage.setItem("ggo-cm-google", j.email); } catch (e) {} }
      } catch (e) {}
    },
    disconnect() {
      if (this.token && window.google && google.accounts) { try { google.accounts.oauth2.revoke(this.token, () => {}); } catch (e) {} }
      this.token = null; this.exp = 0; this.email = ""; try { localStorage.removeItem("ggo-cm-google"); } catch (e) {}
    },
    /** Any Google REST call with the signed-in token. Errors carry Google's own message. */
    async call(url, opt = {}) {
      await this.connect();
      const res = await fetch(url, {
        method: opt.method || "GET", headers: Object.assign({ Authorization: "Bearer " + this.token }, opt.body ? { "Content-Type": "application/json" } : {}),
        body: opt.body ? JSON.stringify(opt.body) : undefined,
      });
      if (res.status === 401) { this.token = null; this.exp = 0; if (!opt._retry) return this.call(url, Object.assign({}, opt, { _retry: true })); }
      if (!res.ok) {
        let m = ""; try { m = (await res.json()).error.message || ""; } catch (e) {}
        const e = new Error(res.status === 404 ? "not-found" : /has not been used|is disabled/i.test(m) ? "The Google Slides API isn't switched on yet. In Google Cloud Console, open this project's APIs & Services and enable \"Google Slides API\" (one time)." : `Google said ${res.status}${m ? ": " + m : ""}`);
        e.status = res.status; throw e;
      }
      return res.status === 204 ? null : res.json();
    },
    /** fetch() with the Google token, for non-JSON calls (file upload / download). */
    async authed(url, init = {}) {
      await this.connect();
      return fetch(url, Object.assign({}, init, { headers: Object.assign({ Authorization: "Bearer " + this.token }, init.headers || {}) }));
    },
    api(path, opt) { return this.call("https://www.googleapis.com/drive/v3" + path, opt); },
    async folder(name, parent) {
      const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${name.replace(/['\\]/g, "\\$&")}'` + (parent ? ` and '${parent}' in parents` : "");
      const found = await this.api(`/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
      if (found.files && found.files[0]) return found.files[0].id;
      const made = await this.api("/files?fields=id", { method: "POST", body: { name, mimeType: "application/vnd.google-apps.folder", parents: parent ? [parent] : undefined } });
      return made.id;
    },
  };

  // ---------- operations ----------
  const courseTitle = () => { const c = window.CoursesModule && CoursesModule.find ? CoursesModule.find(CM.courseId) : null; return (c && c.name) || "Course"; };
  async function courseFolder() { const root = await G.folder(ROOT_FOLDER); return G.folder(courseTitle(), root); }
  const FIELDS = "id,name,modifiedTime,trashed";
  async function createItem(kind, title) {
    const parent = await courseFolder();
    const f = await G.api(`/files?fields=${FIELDS}`, { method: "POST", body: { name: title, mimeType: KINDS[kind].mime, parents: [parent] } });
    const now = new Date().toISOString();
    const it = { id: CM.newId(), kind, title: f.name, fileId: f.id, createdAt: now, updatedAt: f.modifiedTime || now, source: null };
    CM.items.unshift(it); await CM.save(); return it;
  }
  async function duplicateItem(it) {
    const parent = await courseFolder();
    const f = await G.api(`/files/${it.fileId}/copy?fields=${FIELDS}`, { method: "POST", body: { name: `${it.title} (copy)`, parents: [parent] } });
    const now = new Date().toISOString();
    CM.items.unshift({ id: CM.newId(), kind: it.kind, title: f.name, fileId: f.id, createdAt: now, updatedAt: f.modifiedTime || now, source: it.source || null });
    await CM.save();
  }
  async function renameItem(it, title) {
    await G.api(`/files/${it.fileId}?fields=${FIELDS}`, { method: "PATCH", body: { name: title } });
    it.title = title; await CM.save();
  }
  async function trashItem(it) {
    try { await G.api(`/files/${it.fileId}`, { method: "PATCH", body: { trashed: true } }); } catch (e) { if (e.status !== 404) throw e; }
    CM.items = CM.items.filter((x) => x !== it); await CM.save();
  }
  /** Re-reads names / modified times from Drive; marks files that were deleted there. */
  async function refreshAll() {
    for (const it of CM.items) {
      try { const f = await G.api(`/files/${it.fileId}?fields=${FIELDS}`); it.title = f.name; it.updatedAt = f.modifiedTime || it.updatedAt; it.missing = !!f.trashed; }
      catch (e) { if (e.status === 404) it.missing = true; else throw e; }
    }
    await CM.save();
  }

  // ---------- screen ----------
  const css = mk("style");
  css.textContent = `
#classmaterial-panel .cm-row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:0 0 10px; }
#classmaterial-panel .cm-google { font-size:.88rem; color:var(--ink-soft,#666); }
#classmaterial-panel .cm-newmenu { display:flex; gap:6px; flex-wrap:wrap; }
#classmaterial-panel .cm-list { display:grid; gap:8px; margin:0; padding:0; list-style:none; }
#classmaterial-panel .cm-item { display:grid; grid-template-columns:auto 1fr auto; gap:6px 12px; align-items:center; background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:10px 14px; }
#classmaterial-panel .cm-ico { font-size:1.7rem; }
#classmaterial-panel .cm-title { font-family:var(--font-heading); font-weight:700; font-size:1.08rem; color:var(--ink); text-decoration:none; }
#classmaterial-panel .cm-title:hover { text-decoration:underline; }
#classmaterial-panel .cm-meta { font-size:.8rem; color:var(--ink-soft,#777); }
#classmaterial-panel .cm-item.gone { opacity:.6; }
#classmaterial-panel a.btn { text-decoration:none; }
#classmaterial-panel .cm-acts { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
#classmaterial-panel .cm-soon { margin-top:18px; padding:10px 14px; border:1px dashed var(--line); border-radius:10px; color:var(--ink-soft,#777); font-size:.88rem; }
@media (max-width:640px){ #classmaterial-panel .cm-item { grid-template-columns:auto 1fr; } #classmaterial-panel .cm-acts { grid-column:1 / -1; justify-content:flex-start; } }
`;
  document.head.appendChild(css);

  const tabBtn = mk("button", "tab-btn", "Class Material"); tabBtn.id = "tab-classmaterial-btn";
  (document.getElementById("tab-journal-btn") || reportBtn).after(tabBtn);
  const panel = mk("div", "tab-panel"); panel.id = "classmaterial-panel"; panel.hidden = true;
  (document.getElementById("journal-panel") || reportPanel).after(panel);

  let filter = "all", query = "", busy = "", note = "", loadedFor = null;
  const fmt = (iso) => { try { return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; } };
  const say = (t) => { note = t || ""; const n = panel.querySelector(".cm-note"); if (n) n.textContent = note; };
  async function run(label, fn) {
    if (busy) return; busy = label; say(label + "…");
    try { await fn(); say(""); } catch (e) { say(e.message === "not-found" ? "That file is no longer in your Drive." : e.message); }
    busy = ""; render();
  }

  let view = "materials";
  function render() {
    panel.innerHTML = "";
    if (!CM.courseId) { panel.appendChild(mk("p", "hint", "Open a course to see its class material.")); return; }
    const views = Object.assign({ materials: { label: "Materials" } }, API.views);
    const seg = mk("div", "cm-row");
    Object.entries(views).forEach(([k, v]) => { const b = btn(v.label, `btn btn-small ${view === k ? "btn-primary" : "btn-ghost"}`, () => { view = k; render(); }); b.setAttribute("aria-pressed", String(view === k)); seg.appendChild(b); });
    if (Object.keys(views).length > 1) panel.appendChild(seg);
    const host = mk("div"); panel.appendChild(host);
    if (view !== "materials" && views[view]) { views[view].render(host); return; }
    renderMaterials(host);
  }
  function renderMaterials(host) {
    const top = mk("div", "cm-row");
    const nm = mk("div", "cm-newmenu");
    Object.entries(KINDS).forEach(([k, v]) => nm.appendChild(btn(`+ New ${v.label.toLowerCase()}`, "btn btn-ghost", () => {
      if (k === "slides" && API.newSlideshow) return API.newSlideshow();
      const t = prompt(`Name for the new ${v.label.toLowerCase()}:`, `${courseTitle()} – ${v.label}`);
      if (t && t.trim()) run(`Creating ${v.label.toLowerCase()}`, () => createItem(k, t.trim()));
    })));
    top.appendChild(nm);
    const g = mk("span", "cm-google", G.connected() || G.email ? `Google: ${G.email || "connected"}` : "Google not connected yet — it connects when you create something.");
    top.appendChild(g);
    if (G.email || G.connected()) top.appendChild(btn("Disconnect", "btn btn-ghost btn-small", () => { G.disconnect(); render(); }));
    top.appendChild(mk("span", "result cm-note", note));
    host.appendChild(top);

    const bar = mk("div", "cm-row");
    [["all", "All"], ...Object.entries(KINDS).map(([k, v]) => [k, v.plural])].forEach(([k, l]) => {
      const n = k === "all" ? CM.items.length : CM.items.filter((i) => i.kind === k).length;
      const b = btn(`${l} (${n})`, `btn btn-small ${filter === k ? "btn-primary" : "btn-ghost"}`, () => { filter = k; render(); }); b.setAttribute("aria-pressed", String(filter === k)); bar.appendChild(b);
    });
    const q = mk("input"); q.type = "search"; q.placeholder = "Search titles…"; q.value = query;
    q.addEventListener("input", () => { query = q.value; drawList(); }); bar.appendChild(q);
    bar.appendChild(btn("↻ Refresh from Drive", "btn btn-ghost btn-small", () => run("Refreshing", refreshAll)));
    host.appendChild(bar);

    const holder = mk("div"); host.appendChild(holder);
    function drawList() {
      holder.innerHTML = "";
      const list = CM.items.filter((i) => (filter === "all" || i.kind === filter) && (!query.trim() || i.title.toLowerCase().includes(query.trim().toLowerCase())))
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      if (!list.length) { holder.appendChild(mk("p", "hint", CM.items.length ? "Nothing matches." : "Nothing here yet. Create a slideshow, document or spreadsheet above — it's made in your own Google Drive.")); return; }
      const ul = mk("ul", "cm-list");
      list.forEach((it) => {
        const K = KINDS[it.kind] || KINDS.doc, li = mk("li", "cm-item" + (it.missing ? " gone" : ""));
        li.appendChild(mk("span", "cm-ico", K.icon));
        const mid = mk("div");
        const a = mk("a", "cm-title", it.title); a.href = K.url(it.fileId); a.target = "_blank"; a.rel = "noopener"; mid.appendChild(a);
        mid.appendChild(mk("div", "cm-meta", `${K.label}${API.itemMeta ? API.itemMeta(it) : ""} · edited ${fmt(it.updatedAt)}${it.missing ? " · missing from Drive" : ""}`));
        li.appendChild(mid);
        const acts = mk("div", "cm-acts");
        const open = mk("a", "btn btn-ghost btn-small", it.kind === "slides" ? "Open / Present" : "Open"); open.href = K.url(it.fileId); open.target = "_blank"; open.rel = "noopener"; acts.appendChild(open);
        if (API.itemActions) API.itemActions(it, acts);
        acts.appendChild(btn("Rename", "btn btn-ghost btn-small", () => { const t = prompt("New name:", it.title); if (t && t.trim() && t.trim() !== it.title) run("Renaming", () => renameItem(it, t.trim())); }));
        acts.appendChild(btn("Duplicate", "btn btn-ghost btn-small", () => run("Duplicating", () => duplicateItem(it))));
        acts.appendChild(btn("Remove from list", "btn btn-ghost btn-small", () => { if (confirm("Remove from this list? The file stays in your Google Drive.")) { CM.items = CM.items.filter((x) => x !== it); CM.save().then(render); } }));
        acts.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm(`Move "${it.title}" to the Google Drive trash?`)) run("Deleting", () => trashItem(it)); }));
        li.appendChild(acts); ul.appendChild(li);
      });
      holder.appendChild(ul);
    }
    drawList();
    host.appendChild(mk("div", "cm-soon", "Coming next: more slide types, adding course data (seating chart, journal, quizzes), and automatic QR codes."));
  }

  async function ensureLoaded() {
    const cid = (window.AttendanceModule && AttendanceModule.currentCourseId) || (window.ScoringModule && ScoringModule.currentCourseId);
    if (!cid) { CM.courseId = null; return; }
    if (loadedFor === cid && CM.courseId === cid) return;
    try { say("Loading…"); await CM.load(cid); loadedFor = cid; say(""); } catch (e) { CM.items = []; CM.courseId = cid; say(`Couldn't load: ${e.message}`); }
  }

  const origShowTab = window.showTab;
  window.showTab = function (tab) {
    origShowTab.apply(this, arguments);
    const on = tab === "classmaterial";
    panel.hidden = !on; tabBtn.classList.toggle("tab-btn-active", on);
    if (on) ensureLoaded().then(render);
  };
  tabBtn.addEventListener("click", () => window.showTab("classmaterial"));
  // Other files (classmaterial-slides.js) plug in through this object.
  const API = { views: {}, newSlideshow: null, itemMeta: null, itemActions: null };
  Object.assign(API, { render, run, say, ensureLoaded, G, CM, KINDS, mk, btn, courseTitle, createItem, fmt });
  window.ClassMaterial = API;
})();
