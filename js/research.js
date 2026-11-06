// ===== Research Tools (owner side) =====
// Lives at the bottom of the courses page. Currently one tool kind:
// "Study Item Coding Tool" (kind = 'coding'). Data model and security are
// in sql/research-tools.sql.
const ResearchTools = {
  tool: null,      // the tool being edited (null = list view)
  tab: "data",
  _saveT: null,
  _coding: null,

  db() { return storage && storage.client; },
  root() { return document.getElementById("research-tools-body"); },
  esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },
  link(tool) { return new URL("researcher.html?t=" + tool.token, location.href).href; },
  uid() { return "c" + Math.random().toString(36).slice(2, 8); },

  init() {
    const sec = document.getElementById("research-tools-section");
    if (!sec) return;
    const cs = document.getElementById("course-section");
    const go = () => { if (cs && !cs.hidden && !this._shown) { this._shown = true; this.showList(); } if (cs && cs.hidden) this._shown = false; };
    if (cs) new MutationObserver(go).observe(cs, { attributes: true, attributeFilter: ["hidden"] });
    go();
  },

  msg(t, bad) { const m = document.getElementById("rt-msg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "#b3261e" : ""; } },

  // ---------- list ----------
  async showList() {
    this.tool = null;
    const r = this.root(); if (!r) return;
    if (!this.db()) { r.innerHTML = `<p class="hint">Sign in to use Research Tools.</p>`; return; }
    r.innerHTML = `<p class="hint">Loading…</p>`;
    const { data, error } = await this.db().from("rt_tools").select("id,title,kind,token,config,item_count,created_at").order("created_at", { ascending: false });
    if (error) {
      r.innerHTML = `<p class="hint">Research Tools aren't set up yet. Run <code>sql/research-tools.sql</code> once in the Supabase SQL Editor. (${this.esc(error.message)})</p>`;
      return;
    }
    r.innerHTML = `<p class="hint">Give other researchers their own login to a tool, and collect their work.</p>
      <ul class="course-list">${(data || []).map((t) => `<li class="course-item"><a href="#" data-id="${t.id}" class="rt-open"><strong>${this.esc(t.title)}</strong></a>
        <span class="hint">Study Item Coding Tool · ${t.item_count} items</span></li>`).join("") || `<li class="course-item"><span class="hint">No tools yet.</span></li>`}</ul>
      <div class="add-course-row"><input id="rt-new-title" type="text" placeholder="New tool name (e.g. Interview Study – Round 1)"><button id="rt-new" class="btn btn-primary" type="button">+ New Study Item Coding Tool</button></div>
      <p id="rt-msg" class="result"></p>`;
    const byId = Object.fromEntries((data || []).map((t) => [t.id, t]));
    r.querySelectorAll(".rt-open").forEach((a) => a.onclick = (e) => { e.preventDefault(); this.open(byId[a.dataset.id]); });
    r.querySelector("#rt-new").onclick = async () => {
      const title = r.querySelector("#rt-new-title").value.trim() || "Untitled coding tool";
      const config = { participantCol: "", responseCol: "", contextCols: [], columns: [], shownCols: [], codes: [], mode: "simple", multi: false, allowNote: true, instructions: "" };
      const { data: row, error: er } = await this.db().from("rt_tools").insert({ title, kind: "coding", config }).select().single();
      if (er) return this.msg(er.message, true);
      this.open(row);
    };
  },

  open(tool, tab) { this.tool = tool; this.tab = tab || "data"; this.render(); },

  // ---------- tool view ----------
  render() {
    const t = this.tool, r = this.root();
    const tabs = [["data", "1. Data"], ["codes", "2. Codes"], ["people", "3. Researchers"], ["results", "4. Progress & export"], ["try", "Code it yourself"]];
    r.innerHTML = `<button id="rt-back" class="btn btn-ghost btn-small" type="button">← All tools</button>
      <div class="section-header"><h3 style="margin:8px 0"><input id="rt-title" type="text" value="${this.esc(t.title)}" style="font:inherit;font-weight:700;border:0;border-bottom:1px dashed var(--line);background:transparent;color:inherit;min-width:260px"></h3>
        <button id="rt-del" class="btn btn-ghost btn-small" type="button">Delete tool</button></div>
      <div class="panel-toolbar-buttons" style="margin-bottom:10px">${tabs.map(([k, l]) => `<button class="btn btn-small ${k === this.tab ? "btn-primary" : "btn-ghost"}" data-tab="${k}" type="button">${l}</button>`).join("")}</div>
      <div id="rt-pane"></div><p id="rt-msg" class="result"></p>`;
    r.querySelector("#rt-back").onclick = () => this.showList();
    r.querySelector("#rt-title").onchange = (e) => { t.title = e.target.value.trim() || t.title; this.db().from("rt_tools").update({ title: t.title }).eq("id", t.id).then(() => this.msg("Saved.")); };
    r.querySelector("#rt-del").onclick = async () => {
      if (!confirm(`Delete "${t.title}" with all its data, researcher logins and codings? This can't be undone.`)) return;
      const { error } = await this.db().from("rt_tools").delete().eq("id", t.id);
      if (error) return this.msg(error.message, true);
      this.showList();
    };
    r.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { this.tab = b.dataset.tab; this.render(); });
    ({ data: this.paneData, codes: this.paneCodes, people: this.panePeople, results: this.paneResults, try: this.paneTry })[this.tab].call(this, r.querySelector("#rt-pane"));
  },

  saveConfig() {
    const t = this.tool, c = t.config;
    c.shownCols = [...new Set([c.participantCol, ...(c.targets || []).flatMap((x) => x.cols), ...(c.contextCols || [])].filter(Boolean))];
    clearTimeout(this._saveT);
    this._saveT = setTimeout(async () => {
      const { error } = await this.db().from("rt_tools").update({ config: c }).eq("id", t.id);
      this.msg(error ? error.message : "Saved.", !!error);
    }, 500);
  },

  // ---------- Data ----------
  paneData(p) {
    const t = this.tool, c = t.config, cols = c.columns || [];
    p.innerHTML = `<p class="hint">Upload a CSV or Excel file. One row per item to code (e.g. one participant's response). First row = column names.
      ${t.item_count ? `<br><strong>${t.item_count} items are loaded.</strong> Uploading again replaces them and clears all codings.` : ""}</p>
      <input id="rt-file" type="file" accept=".csv,.xlsx,.xls,.tsv">
      ${cols.length ? `<div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;margin-top:14px;align-items:center;max-width:640px">
        <label>Participant column</label><select id="rt-pc"><option value="">(none)</option>${cols.map((x) => `<option ${x === c.participantCol ? "selected" : ""}>${this.esc(x)}</option>`).join("")}</select>
        <label>Items to code<br><span class="hint">Each item is one or more columns shown together as a single block (e.g. Japanese + English). The researcher codes each item separately.</span></label><div id="rt-targets"></div>
        <label>Also show researchers</label><div>${cols.map((x) => `<label style="margin-right:12px;white-space:nowrap"><input type="checkbox" class="rt-cx" value="${this.esc(x)}" ${(c.contextCols || []).includes(x) ? "checked" : ""}> ${this.esc(x)}</label>`).join("")}</div></div>
        <p class="hint">Researchers only ever receive these columns — nothing else in your file leaves your account.</p>` : ""}`;
    const sel = (id, key) => { const e = p.querySelector(id); if (e) e.onchange = () => { c[key] = e.value; this.saveConfig(); }; };
    sel("#rt-pc", "participantCol");
    if (cols.length) this.drawTargets(p.querySelector("#rt-targets"));
    p.querySelectorAll(".rt-cx").forEach((cb) => cb.onchange = () => { c.contextCols = [...p.querySelectorAll(".rt-cx:checked")].map((x) => x.value); this.saveConfig(); });
    p.querySelector("#rt-file").onchange = (e) => this.upload(e.target.files[0]);
  },

  drawTargets(box) {
    const c = this.tool.config, cols = c.columns || [];
    if (!c.targets) { c.targets = [{ id: "t0", label: "", cols: [c.responseCol, c.responseCol2].filter(Boolean) }]; }
    const draw = () => {
      box.innerHTML = c.targets.map((t, i) => `<div style="border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:8px">
        <div style="display:flex;gap:6px;margin-bottom:6px"><input data-ti="${i}" class="rt-tl" value="${this.esc(t.label)}" placeholder="Item name (e.g. Class reflection)" style="flex:1">
          ${c.targets.length > 1 ? `<button class="btn btn-ghost btn-small" data-trm="${i}" type="button">✕</button>` : ""}</div>
        <div>${cols.map((x) => `<label style="margin-right:12px;white-space:nowrap"><input type="checkbox" data-ti="${i}" class="rt-tc" value="${this.esc(x)}" ${t.cols.includes(x) ? "checked" : ""}> ${this.esc(x)}</label>`).join("")}</div></div>`).join("") +
        `<button class="btn btn-ghost btn-small" id="rt-addt" type="button">+ Add another item to code</button>`;
      box.querySelectorAll(".rt-tl").forEach((e) => e.oninput = () => { c.targets[+e.dataset.ti].label = e.value; this.saveConfig(); });
      box.querySelectorAll(".rt-tc").forEach((e) => e.onchange = () => {
        const t = c.targets[+e.dataset.ti];
        const on = [...box.querySelectorAll(`.rt-tc[data-ti="${e.dataset.ti}"]:checked`)].map((q) => q.value);
        t.cols = cols.filter((x) => on.includes(x));
        this.saveConfig();
      });
      box.querySelectorAll("[data-trm]").forEach((b) => b.onclick = () => {
        const i = +b.dataset.trm;
        if (i === 0 && !confirm("Removing the first item makes the next one the first, which can mix up codings already saved. Continue?")) return;
        c.targets.splice(i, 1); this.saveConfig(); draw();
      });
      box.querySelector("#rt-addt").onclick = () => { c.targets.push({ id: this.uid(), label: "", cols: [] }); this.saveConfig(); draw(); };
    };
    draw(); this.saveConfig();
  },

  async upload(file) {
    if (!file) return;
    const t = this.tool;
    if (t.item_count && !confirm("Replace the current data? All existing codings will be deleted.")) return;
    try {
      if (typeof XLSX === "undefined") throw new Error("Spreadsheet reader not loaded.");
      this.msg("Reading file…");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
      if (!rows.length) throw new Error("No rows found.");
      const columns = Object.keys(rows[0]);
      if (rows.length > 20000) throw new Error("Please keep files under 20,000 rows.");
      const db = this.db();
      let e = (await db.from("rt_codings").delete().eq("tool_id", t.id)).error || (await db.from("rt_items").delete().eq("tool_id", t.id)).error;
      if (e) throw e;
      for (let i = 0; i < rows.length; i += 500) {
        this.msg(`Uploading ${Math.min(i + 500, rows.length)} of ${rows.length}…`);
        const batch = rows.slice(i, i + 500).map((d, k) => ({ tool_id: t.id, idx: i + k, data: d }));
        const { error } = await db.from("rt_items").insert(batch);
        if (error) throw error;
      }
      const c = t.config;
      c.columns = columns;
      const guess = (re) => columns.find((x) => re.test(x)) || "";
      c.participantCol = guess(/particip|^id$|subject|name/i);
      c.targets = [{ id: "t0", label: "", cols: [guess(/respon|answer|text|comment/i)].filter(Boolean) }];
      delete c.responseCol; delete c.responseCol2;
      c.contextCols = [];
      t.item_count = rows.length;
      c.shownCols = [...new Set([c.participantCol, ...c.targets.flatMap((x) => x.cols)].filter(Boolean))];
      const { error } = await db.from("rt_tools").update({ config: c, item_count: rows.length }).eq("id", t.id);
      if (error) throw error;
      this.msg(`Loaded ${rows.length} items. Check the column choices below.`);
      this.paneData(document.getElementById("rt-pane"));
    } catch (err) { this.msg("Upload failed: " + (err.message || err), true); }
  },

  // ---------- Codes ----------
  paneCodes(p) {
    const c = this.tool.config; c.codes = c.codes || []; c.mode = c.mode || (c.multi ? "complex" : "simple");
    const cx = () => c.mode === "complex";
    const draw = () => {
      const dims = [...new Set(c.codes.map((x) => x.dimension).filter(Boolean))];
      p.innerHTML = `<div style="display:grid;gap:8px;max-width:700px;margin-bottom:12px">
          <label><strong>Coding style</strong><br>
            <label style="font-weight:400"><input type="radio" name="rt-mode" value="simple" ${cx() ? "" : "checked"}> Simple — the researcher picks one code per item</label><br>
            <label style="font-weight:400"><input type="radio" name="rt-mode" value="complex" ${cx() ? "checked" : ""}> Complex — codes belong to a type (dimension); the researcher adds any codes from any type that apply</label></label>
          <label><input type="checkbox" id="rt-note" ${c.allowNote ? "checked" : ""}> Allow a note per item</label>
          <label>Instructions shown to researchers<br><textarea id="rt-instr" rows="3" style="width:100%">${this.esc(c.instructions || "")}</textarea></label></div>
        <p class="hint"><strong>Upload codes</strong> from a CSV or Excel file with columns <code>code</code>, <code>dimension</code>, <code>option_label</code>, <code>description</code>, and optionally <code>include_when</code>, <code>exclude_when</code>. Uploading replaces the list below. Or add codes by hand.</p>
        <input type="file" id="rt-cfile" accept=".csv,.xlsx,.xls,.tsv" style="margin-bottom:12px">
        <datalist id="rt-dims">${dims.map((d) => `<option value="${this.esc(d)}">`).join("")}</datalist>
        <div>${c.codes.map((x, i) => `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;align-items:center"><span style="width:1.4em">${i < 9 ? i + 1 : ""}</span>
          ${cx() ? `<input data-i="${i}" data-f="dimension" list="rt-dims" value="${this.esc(x.dimension || "")}" placeholder="Type / dimension" style="flex:1 1 140px">` : ""}
          <input data-i="${i}" data-f="label" value="${this.esc(x.label)}" placeholder="Code name" style="flex:1 1 160px">
          <input data-i="${i}" data-f="description" value="${this.esc(x.description || "")}" placeholder="Description (optional)" style="flex:2 1 220px">
          ${cx() ? `<input data-i="${i}" data-f="include" value="${this.esc(x.include || "")}" placeholder="Include when (optional)" style="flex:1 1 160px"><input data-i="${i}" data-f="exclude" value="${this.esc(x.exclude || "")}" placeholder="Exclude when (optional)" style="flex:1 1 160px">` : ""}
          <button class="btn btn-ghost btn-small" data-up="${i}" type="button">↑</button><button class="btn btn-ghost btn-small" data-rm="${i}" type="button">✕</button></div>`).join("")}</div>
        <button id="rt-addcode" class="btn btn-small btn-primary" type="button">+ Add code</button>`;
      p.querySelectorAll("[data-f]").forEach((i) => i.oninput = () => { c.codes[+i.dataset.i][i.dataset.f] = i.value; this.saveConfig(); });
      p.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { if (confirm("Remove this code? Existing codings keep its id but it will no longer be shown.")) { c.codes.splice(+b.dataset.rm, 1); this.saveConfig(); draw(); } });
      p.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [c.codes[i - 1], c.codes[i]] = [c.codes[i], c.codes[i - 1]]; this.saveConfig(); draw(); } });
      p.querySelector("#rt-addcode").onclick = () => { c.codes.push({ id: this.uid(), dimension: c.codes.length ? c.codes[c.codes.length - 1].dimension || "" : "", label: "", description: "" }); this.saveConfig(); draw(); };
      p.querySelectorAll("[name=rt-mode]").forEach((r) => r.onchange = () => { c.mode = r.value; c.multi = r.value === "complex"; this.saveConfig(); draw(); });
      p.querySelector("#rt-note").onchange = (e) => { c.allowNote = e.target.checked; this.saveConfig(); };
      p.querySelector("#rt-instr").oninput = (e) => { c.instructions = e.target.value; this.saveConfig(); };
      p.querySelector("#rt-cfile").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
          const get = (r, names) => { for (const k of Object.keys(r)) if (names.includes(k.trim().toLowerCase())) return String(r[k]).trim(); return ""; };
          const out = rows.map((r) => ({
            id: get(r, ["code", "id", "code_id"]), dimension: get(r, ["dimension", "type", "category", "code_type"]),
            label: get(r, ["option_label", "label", "name", "code_label"]), description: get(r, ["description", "definition"]),
            include: get(r, ["include_when", "include"]), exclude: get(r, ["exclude_when", "exclude"]),
          })).filter((x) => x.id || x.label);
          if (!out.length) throw new Error("No codes found. Expected columns like code, dimension, option_label.");
          const seen = new Set(); out.forEach((x) => { if (!x.id || seen.has(x.id)) x.id = this.uid(); seen.add(x.id); if (!x.label) x.label = x.id; });
          if (c.codes.length && !confirm(`Replace the ${c.codes.length} current codes with ${out.length} from the file?`)) return;
          c.codes = out;
          if (out.some((x) => x.dimension) && !cx() && confirm("This file has code types (dimensions). Switch to Complex coding?")) { c.mode = "complex"; c.multi = true; }
          this.saveConfig(); draw(); this.msg(`Loaded ${out.length} codes.`);
        } catch (err) { this.msg("Code upload failed: " + (err.message || err), true); }
      };
    };
    draw();
  },

  // ---------- Researchers ----------
  async panePeople(p) {
    const t = this.tool;
    p.innerHTML = `<p class="hint">Each researcher gets their own username and password for this link, and their codings are kept separately. The password is shown only once — use Reset if it's lost.</p>
      <div class="add-course-row"><input id="rt-label" type="text" placeholder="Researcher name (for your reference)"><button id="rt-gen" class="btn btn-primary" type="button">Generate login</button></div>
      <div id="rt-fresh"></div><div id="rt-people"></div>`;
    const load = async () => {
      const { data, error } = await this.db().from("rt_access").select("id,username,label,revoked,locked_until,created_at,last_login").eq("tool_id", t.id).order("created_at");
      if (error) return this.msg(error.message, true);
      const box = p.querySelector("#rt-people");
      box.innerHTML = `<table class="data-table" style="width:100%;margin-top:12px"><thead><tr><th>Researcher</th><th>Username</th><th>Last login</th><th></th></tr></thead><tbody>${(data || []).map((a) => `<tr>
        <td>${this.esc(a.label || "")}${a.revoked ? ' <em>(revoked)</em>' : ""}</td><td><code>${this.esc(a.username)}</code></td>
        <td>${a.last_login ? new Date(a.last_login).toLocaleString() : "never"}</td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-small" data-reset="${a.id}" data-u="${this.esc(a.username)}" type="button">Reset password</button>
          <button class="btn btn-ghost btn-small" data-rev="${a.id}" data-on="${a.revoked ? 1 : 0}" type="button">${a.revoked ? "Restore" : "Revoke"}</button>
          <button class="btn btn-ghost btn-small" data-del="${a.id}" type="button">Delete</button></td></tr>`).join("") || `<tr><td colspan="4" class="hint">No researcher logins yet.</td></tr>`}</tbody></table>`;
      box.querySelectorAll("[data-reset]").forEach((b) => b.onclick = async () => {
        const { data: pw, error: er } = await this.db().rpc("rt_reset_access", { p_access: b.dataset.reset });
        if (er) return this.msg(er.message, true);
        this.showCred(p.querySelector("#rt-fresh"), b.dataset.u, pw);
      });
      box.querySelectorAll("[data-rev]").forEach((b) => b.onclick = async () => {
        await this.db().from("rt_access").update({ revoked: b.dataset.on !== "1" }).eq("id", b.dataset.rev); load();
      });
      box.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
        if (!confirm("Delete this login? Their codings are kept in the export.")) return;
        await this.db().from("rt_access").delete().eq("id", b.dataset.del); load();
      });
    };
    p.querySelector("#rt-gen").onclick = async () => {
      const { data, error } = await this.db().rpc("rt_create_access", { p_tool: t.id, p_label: p.querySelector("#rt-label").value.trim() });
      if (error) return this.msg(error.message, true);
      const row = Array.isArray(data) ? data[0] : data;
      p.querySelector("#rt-label").value = "";
      this.showCred(p.querySelector("#rt-fresh"), row.username, row.password);
      load();
    };
    load();
  },

  showCred(box, user, pass) {
    const text = `Link: ${this.link(this.tool)}\nUsername: ${user}\nPassword: ${pass}`;
    box.innerHTML = `<div style="border:2px solid var(--green);border-radius:10px;padding:12px;margin-top:12px;background:var(--card)">
      <strong>Give the researcher these — the password won't be shown again.</strong>
      <pre style="margin:8px 0;white-space:pre-wrap;user-select:all">${this.esc(text)}</pre>
      <button class="btn btn-small btn-primary" id="rt-copy" type="button">Copy</button></div>`;
    box.querySelector("#rt-copy").onclick = async (e) => { try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied ✓"; } catch (x) { e.target.textContent = "Select and copy manually"; } };
  },

  // ---------- Progress & export ----------
  async paneResults(p) {
    const t = this.tool, db = this.db();
    p.innerHTML = `<p class="hint">Loading…</p>`;
    const [{ data: acc }, codings] = await Promise.all([
      db.from("rt_access").select("id,label,username").eq("tool_id", t.id).order("created_at"),
      this.allCodings(),
    ]);
    const coders = [{ key: "owner", name: "You (owner)" }, ...(acc || []).map((a) => ({ key: a.id, name: a.label || a.username }))];
    const counts = {}; codings.forEach((c) => { if ((c.codes || []).length) counts[c.coder] = (counts[c.coder] || 0) + 1; });
    p.innerHTML = `<table class="data-table"><thead><tr><th>Coder</th><th>Coded</th></tr></thead><tbody>${coders.map((c) => `<tr><td>${this.esc(c.name)}</td><td>${counts[c.key] || 0} of ${t.item_count}</td></tr>`).join("")}</tbody></table>
      <p class="hint">Export has one row per item with all your original columns, then Code and Note columns for each coder.</p>
      <button class="btn btn-primary" id="rt-xcsv" type="button">Export CSV</button> <button class="btn btn-primary" id="rt-xxlsx" type="button">Export Excel</button>`;
    p.querySelector("#rt-xcsv").onclick = () => this.exportData("csv", coders, codings);
    p.querySelector("#rt-xxlsx").onclick = () => this.exportData("xlsx", coders, codings);
  },

  async allCodings() {
    const out = []; const db = this.db();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("rt_codings").select("coder,idx,codes,note").eq("tool_id", this.tool.id).range(from, from + 999);
      if (error) { this.msg(error.message, true); break; }
      out.push(...data); if (data.length < 1000) break;
    }
    return out;
  },

  async exportData(fmt, coders, codings) {
    const t = this.tool, db = this.db(), label = Object.fromEntries((t.config.codes || []).map((c) => [c.id, c.label || c.id]));
    const dimOf = Object.fromEntries((t.config.codes || []).map((c) => [c.id, c.dimension || ""]));
    const dimsOf = [...new Set((t.config.codes || []).map((c) => c.dimension).filter(Boolean))];
    const items = [];
    for (let from = 0; from < t.item_count; from += 1000) {
      const { data, error } = await db.from("rt_items").select("idx,data").eq("tool_id", t.id).order("idx").range(from, from + 999);
      if (error) return this.msg(error.message, true);
      items.push(...data);
    }
    const map = {}; codings.forEach((c) => { map[c.coder + ":" + c.idx] = c; });
    const T = CodingUI.targetsOf(t.config), multiT = T.length > 1;
    const rows = items.map((it) => {
      const row = { ...it.data };
      coders.forEach((cd) => {
        const c = map[cd.key + ":" + it.idx];
        const st = CodingUI.decode(t.config, c ? c.codes : [], c ? c.note : "");
        T.forEach((tg, k) => {
          const pre = cd.name + (multiT ? ` – ${tg.label || "Item " + (k + 1)}` : ""), cur = st[tg.id];
          row[`${pre} – Code`] = cur.codes.map((id) => label[id] || id).join("; ");
          if (t.config.mode === "complex") dimsOf.forEach((dm) => { row[`${pre} – ${dm}`] = cur.codes.filter((id) => dimOf[id] === dm).map((id) => label[id] || id).join("; "); });
          if (t.config.allowNote) row[`${pre} – Note`] = cur.note;
        });
      });
      return row;
    });
    const name = (t.title || "coding").replace(/[^\w\- ]+/g, "").trim() || "coding";
    const ws = XLSX.utils.json_to_sheet(rows);
    if (fmt === "csv") {
      const blob = new Blob(["﻿" + XLSX.utils.sheet_to_csv(ws)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".csv"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else {
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Coding"); XLSX.writeFile(wb, name + ".xlsx");
    }
  },

  // ---------- Code it yourself (mirror of the researcher page) ----------
  async paneTry(p) {
    const t = this.tool, db = this.db(), c = t.config;
    if (!t.item_count || !CodingUI.targetsOf(c).some((x) => x.cols.length) || !(c.codes || []).length) { p.innerHTML = `<p class="hint">Upload data, choose the response column and add at least one code first.</p>`; return; }
    p.innerHTML = `<div id="rt-ui"></div>`;
    const shown = new Set(c.shownCols || []);
    const adapter = {
      meta: { title: t.title, config: c, item_count: t.item_count, coded: 0 },
      extraButtons: [{ label: "← Back to editing", onClick: () => { this.tab = "data"; this.render(); } }],
      fetch: async (from, count) => {
        const [{ data: its, error }, { data: cs }] = await Promise.all([
          db.from("rt_items").select("idx,data").eq("tool_id", t.id).gte("idx", from).order("idx").limit(count),
          db.from("rt_codings").select("idx,codes,note").eq("tool_id", t.id).eq("coder", "owner").gte("idx", from).order("idx").limit(count),
        ]);
        if (error) throw error;
        const m = Object.fromEntries((cs || []).map((x) => [x.idx, x]));
        return its.map((i) => ({ idx: i.idx, data: Object.fromEntries(Object.entries(i.data).filter(([k]) => shown.has(k))), codes: (m[i.idx] || {}).codes || [], note: (m[i.idx] || {}).note || "" }));
      },
      save: async (idx, codes, note) => {
        const { error } = await db.from("rt_codings").upsert({ tool_id: t.id, coder: "owner", idx, codes, note, coded_at: new Date().toISOString() }, { onConflict: "tool_id,coder,idx" });
        if (error) throw error;
      },
    };
    const { count } = await db.from("rt_codings").select("idx", { count: "exact", head: true }).eq("tool_id", t.id).eq("coder", "owner");
    adapter.meta.coded = count || 0;
    CodingUI.mount(p.querySelector("#rt-ui"), adapter);
  },
};
document.addEventListener("DOMContentLoaded", () => ResearchTools.init());
