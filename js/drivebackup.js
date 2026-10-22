// ===== Backup to Google Drive (manual) =====
// Settings → "Google Drive backup": tick the box and click "Connect Google Drive". Once both are done, a
// "Backup to Google Drive" button appears in the top bar (between ⓘ and Admin). Clicking it opens a small
// dialog with your Google account already filled in; "Back up now" saves one dated backup file (the same
// data as "Export everything") into a visible Drive folder. Nothing runs automatically.
// Load AFTER app.js.

(function () {
  const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
  const DEFAULT_FOLDER = "GradingGrid Backups";
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const signedIn = () => typeof storage !== "undefined" && storage && storage.isSignedIn();
  const key = () => `ggo-drive-backup:${signedIn() ? storage.session.user.id : "none"}`;

  let state = { enabled: false, email: "", folder: DEFAULT_FOLDER };
  const load = () => {
    try { state = { enabled: false, email: "", folder: DEFAULT_FOLDER, ...(JSON.parse(localStorage.getItem(key())) || {}) }; }
    catch (e) { state = { enabled: false, email: "", folder: DEFAULT_FOLDER }; }
  };
  const save = () => { try { localStorage.setItem(key(), JSON.stringify(state)); } catch (e) {} };

  // ----- Google access (own small token client; the account is passed as a hint so it's pre-selected) -----
  let tokenClient = null, token = null, tokenExp = 0, pendingReject = null;
  async function gisReady() {
    const t0 = Date.now();
    while (!(window.google && google.accounts && google.accounts.oauth2)) {
      if (Date.now() - t0 > 8000) throw new Error("Google's sign-in library didn't load. Check your connection and reload.");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  function getToken(interactive) {
    if (token && Date.now() < tokenExp) return Promise.resolve(token);
    return new Promise(async (resolve, reject) => {
      try { await gisReady(); } catch (e) { return reject(e); }
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: APP_CONFIG.google.clientId, scope: SCOPE, callback: () => {},
          error_callback: (err) => { if (pendingReject) pendingReject(new Error(err && err.type === "popup_failed_to_open" ? "The Google pop-up was blocked. Allow pop-ups for this site and try again." : err && err.type === "popup_closed" ? "The Google window was closed before finishing." : "Google sign-in failed.")); },
        });
      }
      pendingReject = reject;
      tokenClient.callback = (r) => {
        pendingReject = null;
        if (r.error) return reject(new Error(r.error_description || r.error));
        token = r.access_token; tokenExp = Date.now() + ((Number(r.expires_in) || 3600) - 60) * 1000;
        resolve(token);
      };
      const opts = { prompt: interactive ? "consent" : "" };
      if (state.email) opts.hint = state.email;
      try { tokenClient.requestAccessToken(opts); } catch (e) { reject(e); }
    });
  }
  async function emailOf(t) {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) return "";
    return (await r.json()).email || "";
  }

  // ----- the backup itself -----
  async function collect(onProgress) {
    const names = await storage.listFiles();
    const files = {};
    let n = 0;
    for (const name of names) { files[name] = await storage.loadFile(name); onProgress(++n, names.length); }
    return { app: "GradingGridOnline", exportedAt: new Date().toISOString(), files };
  }
  async function ensureFolder(t, name) {
    const q = `name = '${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const f = await fetch(`https://www.googleapis.com/drive/v3/files?fields=files(id)&q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${t}` } });
    if (!f.ok) throw new Error(`Google Drive said: ${f.status} ${f.statusText}`);
    const found = (await f.json()).files || [];
    if (found.length) return found[0].id;
    const c = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
    });
    if (!c.ok) throw new Error(`Couldn't create the Drive folder: ${c.status} ${c.statusText}`);
    return (await c.json()).id;
  }
  async function upload(t, folderId, fileName, text) {
    const boundary = "ggo" + Math.random().toString(36).slice(2);
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: fileName, parents: [folderId], mimeType: "application/json" })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
    const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
      method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
    });
    if (!r.ok) throw new Error(`Upload failed: ${r.status} ${r.statusText}`);
    return r.json();
  }

  // ----- CSS -----
  const css = mk("style");
  css.textContent = `
div.settings-wrap > #backup-btn { order:3; margin:0; }
div.settings-wrap > #admin-btn { order:4; }
#dbk-overlay { position:fixed; inset:0; z-index:20003; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#dbk-box { background:var(--card,#fff); color:var(--ink,#222); width:min(480px,100%); border-radius:10px; border:2px solid var(--green); padding:16px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5); }
#dbk-box h3 { margin:0 0 8px; }
#dbk-box .dbk-row { margin:8px 0; }
#dbk-box .dbk-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }
`;
  document.head.appendChild(css);

  // ----- the dialog -----
  function openDialog() {
    const ov = mk("div"); ov.id = "dbk-overlay";
    const box = mk("div"); box.id = "dbk-box"; ov.appendChild(box);
    box.appendChild(mk("h3", "", "Backup to Google Drive"));
    const acct = mk("p", "dbk-row"); acct.append(mk("b", "", "Google account: "), document.createTextNode(state.email || "(not connected)")); box.appendChild(acct);
    const fold = mk("p", "dbk-row"); fold.append(mk("b", "", "Drive folder: "), document.createTextNode(state.folder || DEFAULT_FOLDER)); box.appendChild(fold);
    box.appendChild(mk("p", "hint", "Saves one dated file with all your courses, rosters, seating charts, attendance and scores. To restore, download the file from Drive and use “Restore from backup file” in Settings."));
    const msg = mk("p", "result"); box.appendChild(msg);
    const acts = mk("div", "dbk-actions");
    const close = mk("button", "btn btn-ghost", "Close"); close.type = "button"; close.addEventListener("click", () => ov.remove());
    const go = mk("button", "btn btn-primary", "Back up now"); go.type = "button";
    go.addEventListener("click", async () => {
      go.disabled = true; msg.textContent = "Connecting to Google…";
      try {
        let t;
        try { t = await getToken(false); } catch (e) { t = await getToken(true); }
        msg.textContent = "Collecting your data…";
        const backup = await collect((n, total) => { msg.textContent = `Collecting ${n} / ${total}…`; });
        msg.textContent = "Uploading to Google Drive…";
        const folderId = await ensureFolder(t, state.folder || DEFAULT_FOLDER);
        const d = new Date(); const p = (x) => String(x).padStart(2, "0");
        const fileName = `GradingGridOnline-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
        await upload(t, folderId, fileName, JSON.stringify(backup));
        msg.textContent = `Backed up ${Object.keys(backup.files).length} file(s) to “${state.folder || DEFAULT_FOLDER}” as ${fileName} ✓`;
      } catch (e) { msg.textContent = `Backup failed: ${e.message}`; }
      go.disabled = false;
    });
    acts.append(close, go); box.appendChild(acts);
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  // ----- the top-bar button -----
  let btn = null;
  function placeButton() {
    if (!btn) {
      btn = mk("button", "btn btn-ghost btn-small", "Backup to Google Drive");
      btn.id = "backup-btn"; btn.type = "button"; btn.hidden = true;
      btn.addEventListener("click", openDialog);
    }
    if (!document.body.contains(btn)) {
      const anchor = document.getElementById("admin-btn") || document.getElementById("settings-btn");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor); else return;
    }
    btn.hidden = !(signedIn() && state.enabled && state.email);
  }

  // ----- the Settings block -----
  let block = null, refresh = () => {};
  function buildSettings() {
    const anchor = document.getElementById("data-status");
    const host = anchor && anchor.closest(".settings-block");
    if (!host || (block && document.body.contains(block))) return;
    block = mk("div", "settings-block");
    block.appendChild(mk("h3", "", "Google Drive backup"));
    block.appendChild(mk("p", "hint", "Adds a “Backup to Google Drive” button to the top bar. You click it whenever you want a backup — nothing happens automatically."));
    const l = mk("label"); const cb = mk("input"); cb.type = "checkbox"; l.append(cb, document.createTextNode(" Show the Backup to Google Drive button")); block.appendChild(l);
    const acct = mk("p"); block.appendChild(acct);
    const fRow = mk("p"); fRow.appendChild(document.createTextNode("Drive folder name: "));
    const fi = mk("input"); fi.type = "text"; fi.style.width = "220px"; fRow.appendChild(fi); block.appendChild(fRow);
    const acts = mk("div", "periods-actions");
    const connect = mk("button", "btn btn-ghost btn-small", "Connect Google Drive"); connect.type = "button";
    const disc = mk("button", "btn btn-ghost btn-small", "Disconnect"); disc.type = "button";
    const st = mk("span", "status");
    acts.append(connect, disc, st); block.appendChild(acts);
    host.parentNode.insertBefore(block, host.nextSibling);

    refresh = () => {
      cb.checked = state.enabled; fi.value = state.folder || DEFAULT_FOLDER;
      acct.textContent = state.email ? `Connected as ${state.email}` : "Not connected yet — click “Connect Google Drive”.";
      connect.textContent = state.email ? "Switch Google account" : "Connect Google Drive";
      disc.hidden = !state.email;
      placeButton();
    };
    cb.addEventListener("change", () => { state.enabled = cb.checked; save(); refresh(); st.textContent = state.enabled && !state.email ? "Now click “Connect Google Drive”." : ""; });
    fi.addEventListener("change", () => { state.folder = fi.value.trim() || DEFAULT_FOLDER; save(); refresh(); });
    connect.addEventListener("click", async () => {
      st.textContent = "Opening Google sign-in…";
      try {
        token = null;
        const keep = state.email; state.email = ""; // let Google show the account chooser
        let t; try { t = await getToken(true); } catch (e) { state.email = keep; throw e; }
        state.email = (await emailOf(t)) || keep;
        if (!state.email) throw new Error("Couldn't read your Google account's email.");
        state.enabled = true; save(); refresh(); st.textContent = "Connected ✓";
      } catch (e) { st.textContent = `Couldn't connect: ${e.message}`; }
    });
    disc.addEventListener("click", () => {
      if (token && window.google && google.accounts) { try { google.accounts.oauth2.revoke(token, () => {}); } catch (e) {} }
      token = null; state.email = ""; save(); refresh(); st.textContent = "Disconnected.";
    });
    refresh();
  }

  let lastUser;
  function tick() {
    const id = signedIn() ? storage.session.user.id : null;
    if (id !== lastUser) { lastUser = id; token = null; load(); refresh(); }
    buildSettings();
    placeButton();
  }
  setInterval(tick, 1000);
  tick();
})();
