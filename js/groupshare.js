// ===== Group-shared banks (Tests & Quizzes, Rubrics) =====
// Load AFTER app.js and BEFORE quizbank.js / sectionlist.js. Groups are made by the administrator
// (Admin button). Each group has one shared Tests & Quizzes list and one shared Rubric library, stored in
// Supabase (table group_shared) where only the group's members can read and change them.

(function () {
  const client = () => {
    if (typeof storage === "undefined" || !storage || !storage.client || !storage.isSignedIn()) throw new Error("Not signed in.");
    return storage.client;
  };
  const uid = () => storage.session.user.id;
  let cache = null, cacheAt = 0;

  window.GroupShare = {
    /** Groups the signed-in user belongs to: [{ id, name }]. Empty if there are none (or the group tables aren't installed). */
    async myGroups(force) {
      if (!force && cache && Date.now() - cacheAt < 60000) return cache;
      try {
        const { data, error } = await client().from("group_members").select("group_id, groups(id, name)").eq("user_id", uid());
        if (error) throw error;
        cache = (data || []).map((r) => r.groups).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
      } catch (e) {
        cache = [];
      }
      cacheAt = Date.now();
      return cache;
    },
    forget() { cache = null; },
    async loadDoc(groupId, kind) {
      const { data, error } = await client().from("group_shared").select("data").eq("group_id", groupId).eq("kind", kind).maybeSingle();
      if (error) throw new Error(`Couldn't load the group's list: ${error.message}`);
      return data ? data.data : null;
    },
    async saveDoc(groupId, kind, obj) {
      const { error } = await client().from("group_shared").upsert(
        { group_id: groupId, kind, data: obj, updated_at: new Date().toISOString(), updated_by: uid() },
        { onConflict: "group_id,kind" }
      );
      if (error) throw new Error(`Couldn't save the group's list: ${error.message}`);
    },
  };
})();

// ===== Group rubric libraries (a block under the Rubric Bank) =====
(function () {
  const orig = window.buildPresentationBankBlock;
  if (typeof orig !== "function") return;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (label, fn, cls) => { const b = mk("button", cls || "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", fn); return b; };
  let chosenGroup = null;

  window.buildPresentationBankBlock = function (tool, cfg, rerender, status) {
    const block = orig(tool, cfg, rerender, status);
    const wrap = mk("div", "rubric-bank-block");
    wrap.hidden = true;
    block.appendChild(wrap);
    window.GroupShare.myGroups().then((groups) => {
      if (!groups.length) return;
      wrap.hidden = false;
      wrap.appendChild(mk("h5", "", "Group Rubric Libraries (shared with the members of a group)"));
      const note = mk("p", "hint", "Copy a rubric into your own bank to use it, or share one of yours with the group. Changes here are seen by every member.");
      wrap.appendChild(note);
      const msg = mk("p", "result", "");
      const say = (t) => { msg.textContent = t; };
      const row = mk("p");
      const sel = mk("select");
      groups.forEach((g) => { const o = mk("option", "", g.name); o.value = g.id; sel.appendChild(o); });
      if (groups.some((g) => g.id === chosenGroup)) sel.value = chosenGroup; else chosenGroup = sel.value;
      row.appendChild(sel);
      wrap.appendChild(row);
      wrap.appendChild(msg);
      const body = mk("div");
      wrap.appendChild(body);
      let doc = { rubrics: [] };

      const persist = async () => { await window.GroupShare.saveDoc(sel.value, "rubrics", doc); };
      const draw = () => {
        body.textContent = "";
        const t = mk("table", "rubric-bank-grid");
        const head = mk("thead"); const hr = mk("tr");
        ["Rubric", "Section", ""].forEach((x) => hr.appendChild(mk("th", "", x)));
        head.appendChild(hr); t.appendChild(head);
        const tb = mk("tbody");
        if (!doc.rubrics.length) { const tr = mk("tr"); const td = mk("td", "hint", "Nothing in this group's library yet."); td.colSpan = 3; tr.appendChild(td); tb.appendChild(tr); }
        doc.rubrics.forEach((r) => {
          const tr = mk("tr");
          tr.appendChild(mk("td", "", r.text || "(untitled rubric)"));
          tr.appendChild(mk("td", "hint", r.sectionName || "—"));
          const act = mk("td");
          act.appendChild(btn("Copy to my bank", async () => {
            try {
              await RubricBankModule.ensureLoaded();
              if (RubricBankModule.rubrics.length >= MAX_SHARED_RUBRICS) throw new Error("Your Rubric Bank is full.");
              const mine = RubricBankModule.add();
              mine.text = r.text || "";
              if (r.sectionName) {
                let sec = (RubricBankModule.sections || []).find((x) => x.name === r.sectionName);
                if (!sec) { sec = { id: window.SectionedBank.newId("sec"), name: r.sectionName, collapsed: false }; RubricBankModule.sections.push(sec); }
                mine.section = sec.id;
              }
              await RubricBankModule.save();
              say("Copied to your Rubric Bank.");
              rerender();
            } catch (e) { say(`Couldn't do that: ${e.message}`); }
          }, "btn btn-primary btn-small"));
          act.appendChild(btn("×", async () => {
            if (!confirm("Remove this rubric from the group's library for everyone in the group?")) return;
            try { doc = (await window.GroupShare.loadDoc(sel.value, "rubrics")) || { rubrics: [] }; doc.rubrics = (doc.rubrics || []).filter((x) => x.id !== r.id); await persist(); say("Removed."); } catch (e) { say(`Couldn't do that: ${e.message}`); }
            draw();
          }));
          tr.appendChild(act); tb.appendChild(tr);
        });
        t.appendChild(tb); body.appendChild(t);

        // share one of my rubrics
        const sh = mk("p");
        const mineSel = mk("select");
        RubricBankModule.rubrics.forEach((r) => { const o = mk("option", "", r.text || "(untitled rubric)"); o.value = r.id; mineSel.appendChild(o); });
        sh.appendChild(mineSel);
        sh.appendChild(btn("Share to this group", async () => {
          const mine = RubricBankModule.find(mineSel.value);
          if (!mine) { say("Pick one of your rubrics first."); return; }
          try {
            doc = (await window.GroupShare.loadDoc(sel.value, "rubrics")) || { rubrics: [] };
            doc.rubrics = doc.rubrics || [];
            if (doc.rubrics.length >= MAX_SHARED_RUBRICS) throw new Error("The group's library is full.");
            const sec = (RubricBankModule.sections || []).find((x) => x.id === mine.section);
            doc.rubrics.push({ id: `grub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: mine.text || "", sectionName: sec ? sec.name : "" });
            await persist();
            say("Shared with the group.");
          } catch (e) { say(`Couldn't do that: ${e.message}`); }
          draw();
        }));
        body.appendChild(sh);
      };
      const load = async () => {
        body.textContent = ""; body.appendChild(mk("p", "hint", "Loading…"));
        try { doc = (await window.GroupShare.loadDoc(sel.value, "rubrics")) || { rubrics: [] }; doc.rubrics = doc.rubrics || []; draw(); }
        catch (e) { body.textContent = ""; body.appendChild(mk("p", "hint", e.message)); }
      };
      sel.addEventListener("change", () => { chosenGroup = sel.value; load(); });
      load();
    });
    return block;
  };
})();
