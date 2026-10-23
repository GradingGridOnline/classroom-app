// ===== Backup to Google Drive (manual button, no Google pop-ups when backing up) =====
// Settings → "Google Drive backup": click "Connect Google Drive" ONCE (Google asks permission once). After
// that, a "Backup to Google Drive" button appears in the top bar (between ⓘ and Admin). Clicking it opens a
// dialog showing your Google account; "Back up now" saves one dated file into a Drive folder. The backup
// is made by the Supabase function "drive-backup" using a long-lived key you granted once — nothing to sign in again.
// Load AFTER app.js.

(function () {
  const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
  const DEFAULT_FOLDER = "GradingGrid Backups";
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const signedIn = () => typeof storage !== "undefined" && storage && storage.isSignedIn();

  let state = { connected: false, email: "", folder: DEFAULT_FOLDER, enabled: false, last_backup_at: null };

  async function call(body) {
    const { data, error } = await storage.client.functions.invoke("drive-backup", { body });
    if (error) {
      let m = error.message || "The backup function failed.";
      try { if (error.context && error.context.json) { const j = await error.context.json(); if (j && j.error) m = j.error; } } catch (e) {}
      if (/not found|404|Failed to send/i.test(m)) m = "The drive-backup function isn't deployed yet (see the setup steps), or couldn't be reached.";
      throw new Error(m);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  async function refreshState() {
    try {
      const s = await call({ action: "status" });
      state = { connected: !!s.connected, email: s.email || "", folder: s.folder || DEFAULT_FOLDER, enabled: !!s.enabled, last_backup_at: s.last_backup_at || null };
    } catch (e) {
      state = { connected: false, email: "", folder: DEFAULT_FOLDER, enabled: false, last_backup_at: null };
    }
    placeButton(); refresh();
  }

  async function gisReady() {
    const t0 = Date.now();
    while (!(window.google && google.accounts && google.accounts.oauth2)) {
      if (Date.now() - t0 > 8000) throw new Error("Google's sign-in library didn't load. Check your connection and reload.");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  /** One-time Google permission window → an authorization code that the function exchanges for the long-lived key. */
  function getCode() {
    return new Promise(async (resolve, reject) => {
      try { await gisReady(); } catch (e) { return reject(e); }
      const client = google.accounts.oauth2.initCodeClient({
        client_id: APP_CONFIG.google.clientId, scope: SCOPE, ux_mode: "popup", select_account: true,
        callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r.code)),
        error_callback: (err) => reject(new Error(err && err.type === "popup_failed_to_open" ? "The Google pop-up was blocked. Allow pop-ups for this site and try again." : err && err.type === "popup_closed" ? "The Google window was closed before finishing." : "Google sign-in failed.")),
      });
      client.requestCode();
    });
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
    const fold = mk("p", "dbk-row"); fold.append(mk("b", "", "Drive folder: "), document.createTextNode(state.folder)); box.appendChild(fold);
    if (state.last_backup_at) { const l = mk("p", "dbk-row"); l.append(mk("b", "", "Last backup: "), document.createTextNode(new Date(state.last_backup_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))); box.appendChild(l); }
    box.appendChild(mk("p", "hint", "Saves one dated file with all your courses, rosters, seating charts, attendance and scores. To restore, download the file from Drive and use “Restore from backup file” in Settings."));
    const msg = mk("p", "result"); box.appendChild(msg);
    const acts = mk("div", "dbk-actions");
    const close = mk("button", "btn btn-ghost", "Close"); close.type = "button"; close.addEventListener("click", () => ov.remove());
    const go = mk("button", "btn btn-primary", "Back up now"); go.type = "button";
    go.addEventListener("click", async () => {
      go.disabled = true; msg.textContent = "Backing up to Google Drive…";
      try {
        const r = await call({ action: "backup", tzOffsetMinutes: -new Date().getTimezoneOffset() });
        msg.textContent = `Backed up ${r.count} file(s) to “${r.folder}” as ${r.fileName} ✓`;
        state.last_backup_at = new Date().toISOString();
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
    btn.hidden = !(signedIn() && state.connected && state.enabled);
  }

  // ----- the Settings block -----
  let block = null, refresh = () => {};
  function buildSettings() {
    const anchor = document.getElementById("data-status");
    const host = anchor && anchor.closest(".settings-block");
    if (!host || (block && document.body.contains(block))) return;
    block = mk("div", "settings-block");
    block.appendChild(mk("h3", "", "Google Drive backup"));
    block.appendChild(mk("p", "hint", "Click “Connect Google Drive” once and give permission. A “Backup to Google Drive” button then appears in the top bar; you click it whenever you want a backup. Nothing happens automatically, and you won't be asked to sign in to Google again."));
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
      cb.checked = state.enabled; cb.disabled = !state.connected; fi.value = state.folder; fi.disabled = !state.connected;
      acct.textContent = state.connected ? `Connected as ${state.email}` : "Not connected yet — click “Connect Google Drive”.";
      connect.textContent = state.connected ? "Switch Google account" : "Connect Google Drive";
      disc.hidden = !state.connected;
    };
    cb.addEventListener("change", async () => {
      try { await call({ action: "setOptions", enabled: cb.checked }); state.enabled = cb.checked; st.textContent = ""; } catch (e) { cb.checked = state.enabled; st.textContent = `Couldn't save: ${e.message}`; }
      placeButton();
    });
    fi.addEventListener("change", async () => {
      const v = fi.value.trim() || DEFAULT_FOLDER;
      try { await call({ action: "setOptions", folder: v }); state.folder = v; st.textContent = "Saved ✓"; } catch (e) { st.textContent = `Couldn't save: ${e.message}`; }
      refresh();
    });
    connect.addEventListener("click", async () => {
      st.textContent = "Opening Google…";
      try {
        const code = await getCode();
        st.textContent = "Connecting…";
        const s = await call({ action: "connect", code });
        state = { ...state, connected: true, email: s.email || "", folder: s.folder || DEFAULT_FOLDER, enabled: true };
        refresh(); placeButton(); st.textContent = "Connected ✓";
      } catch (e) { st.textContent = `Couldn't connect: ${e.message}`; }
    });
    disc.addEventListener("click", async () => {
      if (!confirm("Disconnect Google Drive? The backup button will disappear. Backup files already in your Drive stay there.")) return;
      try { await call({ action: "disconnect" }); state = { connected: false, email: "", folder: state.folder, enabled: false, last_backup_at: null }; refresh(); placeButton(); st.textContent = "Disconnected."; }
      catch (e) { st.textContent = `Couldn't disconnect: ${e.message}`; }
    });
    refresh();
  }

  let lastUser;
  function tick() {
    const id = signedIn() ? storage.session.user.id : null;
    if (id !== lastUser) {
      lastUser = id;
      state = { connected: false, email: "", folder: DEFAULT_FOLDER, enabled: false, last_backup_at: null };
      refresh(); placeButton();
      if (id) refreshState();
    }
    buildSettings();
    placeButton();
  }
  setInterval(tick, 1000);
  tick();
})();
