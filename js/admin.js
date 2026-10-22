// ===== Administrator screen + approval gate =====
// Shows an "Admin" button (next to ⓘ and ⚙) only for administrators. Users tab: invite, last sign-in,
// approve, disable/enable, reset password, make/remove admin, delete. Groups tab: create groups and add members.
// Powerful actions go through the Supabase Edge Function "admin" (it re-checks that you are an admin).

(function () {
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (label, fn, cls) => { const b = mk("button", cls || "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", fn); return b; };
  const db = () => storage.client;
  const myId = () => storage.session.user.id;
  const here = () => window.location.origin + window.location.pathname;

  let me = null; // { is_admin, approved } for the signed-in user, or null
  let adminBtn = null, overlay = null, content = null, tab = "users";

  const css = mk("style");
  css.textContent = `
#admin-btn { margin-right:8px; vertical-align:middle; }
#admin-overlay { position:fixed; inset:0; z-index:20001; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#admin-overlay[hidden] { display:none; }
#admin-box { background:var(--card,#fff); color:var(--ink,#222); width:min(1100px,100%); height:min(780px,100%); border-radius:10px; border:2px solid var(--green); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,.5); }
#admin-box header { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--hdr-bg,#3d5a40); color:#fff; }
#admin-box header h2 { margin:0; font-size:1.1rem; flex:1; color:inherit; }
#admin-box header .btn { color:#fff; border-color:rgba(255,255,255,.6); background:transparent; }
#admin-tabs { display:flex; gap:6px; padding:8px 14px 0; border-bottom:1px solid var(--line); }
#admin-tabs button { border:0; border-bottom:3px solid transparent; background:transparent; color:inherit; font:inherit; padding:6px 12px; cursor:pointer; }
#admin-tabs button.on { border-bottom-color:var(--green); font-weight:700; }
#admin-content { flex:1; overflow:auto; padding:12px 16px 24px; }
#admin-content table { border-collapse:collapse; width:100%; }
#admin-content th, #admin-content td { text-align:left; padding:5px 8px; border-bottom:1px solid var(--line); vertical-align:middle; }
#admin-content .badge { display:inline-block; font-size:.72rem; padding:1px 7px; border-radius:9px; background:color-mix(in srgb, var(--green) 25%, transparent); margin-right:4px; }
#admin-content .badge.warn { background:#f3c969; color:#442; }
#admin-content .badge.off { background:#d98a8a; color:#300; }
#admin-content .acts { display:flex; flex-wrap:wrap; gap:4px; }
#admin-content .gcard { border:1px solid var(--line); border-radius:8px; padding:10px 12px; margin:10px 0; }
#admin-content .chip { display:inline-flex; align-items:center; gap:4px; padding:2px 4px 2px 9px; margin:2px 4px 2px 0; border-radius:12px; background:color-mix(in srgb, var(--green) 18%, transparent); font-size:.88rem; }
#admin-content .chip button { border:0; background:transparent; cursor:pointer; color:inherit; font-size:1rem; line-height:1; }
#admin-gate { position:fixed; inset:0; z-index:30000; background:var(--bg,#f5f5f0); color:var(--ink,#222); display:flex; align-items:center; justify-content:center; text-align:center; padding:24px; }
`;
  document.head.appendChild(css);

  // ----- talking to the Edge Function -----
  async function call(body) {
    const { data, error } = await db().functions.invoke("admin", { body: { ...body, redirectTo: here() } });
    if (error) {
      let m = error.message || "The admin function failed.";
      try { if (error.context && error.context.json) { const j = await error.context.json(); if (j && j.error) m = j.error; } } catch (e) {}
      if (/not found|404|Failed to send/i.test(m)) m = "The admin function isn't deployed yet (see the setup steps), or couldn't be reached.";
      throw new Error(m);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  // ----- who am I? -----
  async function loadMe() {
    try {
      const { data, error } = await db().from("profiles").select("is_admin, approved").eq("user_id", myId()).maybeSingle();
      if (error) throw error;
      me = data ? { is_admin: !!data.is_admin, approved: !!data.approved || !!data.is_admin } : { is_admin: false, approved: true };
    } catch (e) {
      me = { is_admin: false, approved: true }; // setup SQL not run yet → behave as before
    }
    apply();
  }

  function apply() {
    if (adminBtn) adminBtn.hidden = !(me && me.is_admin);
    const gate = document.getElementById("admin-gate");
    const blocked = me && !me.approved && !me.is_admin;
    if (blocked && !gate) {
      const g = mk("div"); g.id = "admin-gate";
      const inner = mk("div");
      inner.appendChild(mk("h2", "", "Waiting for approval"));
      inner.appendChild(mk("p", "", "Your account has been created, but the administrator hasn't approved it yet. Please check back later."));
      inner.appendChild(btn("Check again", () => { loadMe(); }, "btn btn-primary"));
      inner.appendChild(document.createTextNode(" "));
      inner.appendChild(btn("Sign out", async () => { await storage.signOut(); location.reload(); }, "btn btn-ghost"));
      g.appendChild(inner);
      document.body.appendChild(g);
    } else if (!blocked && gate) gate.remove();
  }

  // ----- the Admin screen -----
  function build() {
    overlay = mk("div"); overlay.id = "admin-overlay"; overlay.hidden = true;
    const box = mk("div"); box.id = "admin-box";
    const head = mk("header");
    head.appendChild(mk("h2", "", "Administrator"));
    head.appendChild(btn("Close", () => { overlay.hidden = true; }, "btn btn-ghost btn-small"));
    const tabs = mk("div"); tabs.id = "admin-tabs";
    [["users", "Users"], ["groups", "Groups"]].forEach(([k, label]) => {
      const b = btn(label, () => { tab = k; render(); }); b.dataset.tab = k; tabs.appendChild(b);
    });
    content = mk("div"); content.id = "admin-content";
    box.append(head, tabs, content);
    overlay.appendChild(box);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) overlay.hidden = true; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay && !overlay.hidden) overlay.hidden = true; });
    document.body.appendChild(overlay);
  }

  function render() {
    overlay.querySelectorAll("#admin-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    content.textContent = "";
    if (tab === "users") renderUsers(); else renderGroups();
  }

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "never");

  async function renderUsers() {
    const status = mk("p", "result", "");
    const say = (t) => { status.textContent = t; };
    const inv = mk("p");
    const email = mk("input"); email.type = "email"; email.placeholder = "email address to invite"; email.style.width = "260px";
    inv.append(email, document.createTextNode(" "), btn("Send invitation", async () => {
      try { say("Sending…"); await call({ action: "invite", email: email.value }); say(`Invitation sent to ${email.value}.`); email.value = ""; renderUsers_refresh(); }
      catch (e) { say(`Couldn't do that: ${e.message}`); }
    }, "btn btn-primary btn-small"));
    content.append(inv, status, mk("p", "hint", "Loading users…"));
    const holder = mk("div");
    async function renderUsers_refresh() {
      let users;
      try { users = (await call({ action: "list" })).users; }
      catch (e) { holder.textContent = ""; holder.appendChild(mk("p", "hint", `Couldn't load users: ${e.message}`)); return; }
      holder.textContent = "";
      users.sort((a, b) => Number(a.approved) - Number(b.approved) || (a.email || "").localeCompare(b.email || ""));
      const t = mk("table"); const hd = mk("tr");
      ["Email", "Status", "Joined", "Last sign-in", ""].forEach((x) => hd.appendChild(mk("th", "", x)));
      t.appendChild(hd);
      users.forEach((u) => {
        const tr = mk("tr");
        tr.appendChild(mk("td", "", u.email || "(no email)"));
        const st = mk("td");
        if (u.is_admin) st.appendChild(mk("span", "badge", "Admin"));
        if (!u.approved) st.appendChild(mk("span", "badge warn", "Pending approval"));
        if (u.disabled) st.appendChild(mk("span", "badge off", "Disabled"));
        if (!u.confirmed) st.appendChild(mk("span", "badge warn", "Email not confirmed"));
        tr.appendChild(st);
        tr.appendChild(mk("td", "", fmt(u.created_at)));
        tr.appendChild(mk("td", "", fmt(u.last_sign_in_at)));
        const acts = mk("td"); const row = mk("div", "acts");
        const run = (label, body, confirmMsg, cls) => row.appendChild(btn(label, async () => {
          if (confirmMsg && !confirm(confirmMsg)) return;
          try { say("Working…"); await call(body); say("Done."); await renderUsers_refresh(); }
          catch (e) { say(`Couldn't do that: ${e.message}`); }
        }, cls));
        const self = u.id === myId();
        if (!u.approved) run("Approve", { action: "approve", user_id: u.id, approved: true }, null, "btn btn-primary btn-small");
        if (u.approved && !u.is_admin && !self) run("Un-approve", { action: "approve", user_id: u.id, approved: false });
        run("Reset password", { action: "reset", email: u.email }, `Send a password-reset email to ${u.email}?`);
        if (!self) {
          run(u.disabled ? "Enable" : "Disable", { action: "setDisabled", user_id: u.id, disabled: !u.disabled }, u.disabled ? null : `Disable ${u.email}? They won't be able to sign in until you enable them again.`);
          run(u.is_admin ? "Remove admin" : "Make admin", { action: "setAdmin", user_id: u.id, is_admin: !u.is_admin }, u.is_admin ? null : `Make ${u.email} an administrator?`);
          run("Delete", { action: "delete", user_id: u.id }, `Permanently delete ${u.email} AND all of their saved data? This cannot be undone.`);
        }
        acts.appendChild(row); tr.appendChild(acts); t.appendChild(tr);
      });
      holder.appendChild(t);
      holder.appendChild(mk("p", "hint", "Your own row can't be disabled, deleted or demoted. You see account details only — never other people's rosters or scores."));
    }
    content.lastChild.replaceWith(holder);
    renderUsers_refresh();
  }

  async function renderGroups() {
    const status = mk("p", "result", "");
    const say = (t) => { status.textContent = t; };
    content.appendChild(mk("p", "hint", "A group's members can share a Tests & Quizzes list and a Rubric library (they appear on the Scoring pages). A person can be in several groups."));
    const newRow = mk("p");
    const nm = mk("input"); nm.type = "text"; nm.placeholder = "new group name";
    newRow.append(nm, document.createTextNode(" "), btn("Create group", async () => {
      const name = nm.value.trim(); if (!name) return say("Type a group name.");
      const { error } = await db().from("groups").insert({ name });
      if (error) return say(`Couldn't do that: ${error.message}`);
      nm.value = ""; window.GroupShare && window.GroupShare.forget(); load();
    }, "btn btn-primary btn-small"));
    content.append(newRow, status);
    const holder = mk("div"); content.appendChild(holder);

    async function load() {
      holder.textContent = "";
      const [g, m, p] = await Promise.all([
        db().from("groups").select("id,name").order("name"),
        db().from("group_members").select("group_id,user_id"),
        db().from("profiles").select("user_id,email").order("email"),
      ]);
      const err = g.error || m.error || p.error;
      if (err) { holder.appendChild(mk("p", "hint", `Couldn't load groups: ${err.message} (has the setup SQL been run?)`)); return; }
      const emailOf = new Map(p.data.map((x) => [x.user_id, x.email]));
      if (!g.data.length) holder.appendChild(mk("p", "hint", "No groups yet."));
      g.data.forEach((grp) => {
        const card = mk("div", "gcard");
        const top = mk("p");
        const rn = mk("input"); rn.type = "text"; rn.value = grp.name;
        rn.addEventListener("change", async () => {
          const v = rn.value.trim(); if (!v) { rn.value = grp.name; return; }
          const { error } = await db().from("groups").update({ name: v }).eq("id", grp.id);
          say(error ? `Couldn't do that: ${error.message}` : "Renamed."); window.GroupShare && window.GroupShare.forget();
        });
        top.append(rn, document.createTextNode(" "), btn("Delete group", async () => {
          if (!confirm(`Delete the group "${grp.name}" and everything it shares? Members' own data is not affected.`)) return;
          const { error } = await db().from("groups").delete().eq("id", grp.id);
          if (error) return say(`Couldn't do that: ${error.message}`);
          window.GroupShare && window.GroupShare.forget(); load();
        }));
        card.appendChild(top);
        const members = m.data.filter((x) => x.group_id === grp.id);
        const chips = mk("div");
        if (!members.length) chips.appendChild(mk("span", "hint", "No members yet."));
        members.forEach((mem) => {
          const c = mk("span", "chip", emailOf.get(mem.user_id) || mem.user_id);
          c.appendChild(btn("×", async () => {
            const { error } = await db().from("group_members").delete().eq("group_id", grp.id).eq("user_id", mem.user_id);
            if (error) return say(`Couldn't do that: ${error.message}`);
            window.GroupShare && window.GroupShare.forget(); load();
          }, ""));
          chips.appendChild(c);
        });
        card.appendChild(chips);
        const inGroup = new Set(members.map((x) => x.user_id));
        const free = p.data.filter((x) => !inGroup.has(x.user_id));
        if (free.length) {
          const add = mk("p");
          const sel = mk("select");
          free.forEach((x) => { const o = mk("option", "", x.email || x.user_id); o.value = x.user_id; sel.appendChild(o); });
          add.append(sel, document.createTextNode(" "), btn("Add to group", async () => {
            const { error } = await db().from("group_members").insert({ group_id: grp.id, user_id: sel.value });
            if (error) return say(`Couldn't do that: ${error.message}`);
            window.GroupShare && window.GroupShare.forget(); load();
          }, "btn btn-primary btn-small"));
          card.appendChild(add);
        }
        holder.appendChild(card);
      });
    }
    load();
  }

  // ----- the button + session watching -----
  function ensureButton() {
    if (adminBtn && document.body.contains(adminBtn)) return;
    adminBtn = mk("button", "btn btn-ghost btn-small", "Admin");
    adminBtn.id = "admin-btn"; adminBtn.type = "button"; adminBtn.hidden = true;
    adminBtn.title = "Administrator controls";
    adminBtn.addEventListener("click", () => { if (!overlay) build(); overlay.hidden = false; render(); });
    const help = document.getElementById("help-btn") || document.getElementById("settings-btn");
    if (help && help.parentNode) help.parentNode.insertBefore(adminBtn, help); else document.body.appendChild(adminBtn);
  }

  let lastUser = undefined;
  function tick() {
    ensureButton();
    const id = typeof storage !== "undefined" && storage && storage.isSignedIn() ? storage.session.user.id : null;
    if (id === lastUser) return;
    lastUser = id;
    if (!id) { me = null; apply(); if (overlay) overlay.hidden = true; if (window.GroupShare) window.GroupShare.forget(); return; }
    loadMe();
  }
  setInterval(tick, 1000);
  tick();
})();
