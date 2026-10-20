// ===== Class periods: save immediately, and say so if it didn't work =====
// Load AFTER app.js. Every change in Global Settings → Class Periods is now written
// to your account right away (not left to the background autosave, which can be off
// or waiting), then read back to confirm it really stuck. If anything goes wrong, the
// message next to "Save Periods" says exactly what.

(function () {
  // ----- Periods now live INSIDE courses.json (the same file as your course list) -----
  // courses.json is the file that has always saved reliably, so the period list is stored there
  // too. periods.json is still written as a spare copy, and is read only if courses.json has no
  // periods yet (so periods saved the old way carry over automatically).
  let known = null; // the period list as last read from / written to the server
  const P = SupabaseProvider.prototype;
  const rawLoad = P.loadFile;
  const rawSave = P.saveFile;
  P.loadFile = async function (name) {
    if (name === "courses.json") {
      const d = await rawLoad.call(this, name);
      if (d && Array.isArray(d.periods)) known = d.periods;
      return d;
    }
    if (name === "periods.json") {
      const d = await rawLoad.call(this, "courses.json");
      if (d && Array.isArray(d.periods)) { known = d.periods; return { periods: d.periods }; }
      const old = await rawLoad.call(this, name); // not moved yet: use the old file
      if (old && Array.isArray(old.periods)) known = old.periods;
      return old;
    }
    return rawLoad.call(this, name);
  };
  P.saveFile = async function (name, data) {
    if (name === "courses.json") {
      const d = Object.assign({}, data);
      if (!Array.isArray(d.periods) && known) d.periods = known;
      return rawSave.call(this, name, d);
    }
    if (name === "periods.json") {
      known = data.periods;
      const cur = (await rawLoad.call(this, "courses.json")) || { courses: [], sortMode: "manual" };
      await rawSave.call(this, "courses.json", Object.assign({}, cur, { periods: data.periods }));
      return rawSave.call(this, name, data); // spare copy
    }
    return rawSave.call(this, name, data);
  };

  let chain = Promise.resolve();

  // A copy of the period list is kept in this browser too, so a period you set can never be
  // lost if the server copy fails to save or comes back empty. { periods, synced }
  const bkKey = () => "ggo-periods-bk:" + ((storage && storage.session && storage.session.user && storage.session.user.id) || "x");
  const readBk = () => { try { return JSON.parse(localStorage.getItem(bkKey())); } catch (e) { return null; } };
  const writeBk = (synced) => { try { localStorage.setItem(bkKey(), JSON.stringify({ periods: PeriodsModule.periods, synced })); } catch (e) {} };

  async function persist() {
    // The database may return fields in a different order, so compare with sorted fields.
    const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((a, key) => { a[key] = x[key]; return a; }, {}) : x));
    const want = canon(PeriodsModule.periods);
    await PeriodsModule.save();
    await CoursesModule.save(); // a removed period also clears that course's period
    const back = await storage.loadFile("periods.json"); // read it back to be sure
    if (canon((back && back.periods) || []) !== want) {
      throw new Error("the saved copy doesn't match — please try again");
    }
  }

  window.savePeriodsThen = function (after) {
    el.periodsStatus.style.color = "";
    if (!storage || !storage.isSignedIn()) {
      el.periodsStatus.textContent = "Not signed in — periods can't be saved. Sign in first.";
      el.periodsStatus.style.color = "#d3302f";
      if (after) after();
      return;
    }
    el.periodsStatus.textContent = "Saving…";
    writeBk(false);
    chain = chain
      .then(persist)
      .then(() => { writeBk(true); el.periodsStatus.textContent = "Saved ✓"; })
      .catch((err) => {
        el.periodsStatus.textContent = `Couldn't save periods: ${err.message}`;
        el.periodsStatus.style.color = "#d3302f";
      });
    if (after) after(); // the screen updates at once; the save finishes in the background
  };

  // Whenever periods are loaded: if the server copy is empty or older than this browser's copy, restore and re-save.
  const origLoad = PeriodsModule.load;
  PeriodsModule.load = async function (...args) {
    const r = await origLoad.apply(this, args);
    const bk = readBk();
    const same = bk && Array.isArray(bk.periods) && JSON.stringify(bk.periods.map((p) => [p.id, p.name, p.startTime, p.endTime])) === JSON.stringify(this.periods.map((p) => [p.id, p.name, p.startTime, p.endTime]));
    const stale = bk && Array.isArray(bk.periods) && bk.periods.length && !same && (bk.synced === false || this.periods.length === 0);
    if (stale) {
      this.periods = bk.periods;
      window.savePeriodsThen(() => { renderPeriodsList(); renderCourseList(); });
      setTimeout(() => { el.periodsStatus.textContent = "Your periods were restored from this browser's backup and saved again ✓"; }, 1500);
    } else {
      writeBk(true);
      el.periodsStatus.textContent = this.periods.length ? `${this.periods.length} period(s) loaded from your account.` : "";
    }
    return this.periods;
  };

  // The app may already have loaded the periods before this file finished loading: check once more now.
  if (storage && storage.isSignedIn && storage.isSignedIn()) {
    chain = chain
      .then(() => PeriodsModule.load())
      .then(() => { renderPeriodsList(); renderCourseList(); })
      .catch(() => {});
  }

  // ----- Start / end times as plain typed boxes -----
  // The browser's built-in time picker can send a wrong time while you are still typing
  // (for example a default of 12:30). These boxes take the time exactly as you type it —
  // "9:00", "9am", "10:30 am", "0900", "21:15" — and tidy it up when you click away.
  function parseTime(text) {
    const t = String(text || "").trim().toLowerCase().replace(/\./g, ":");
    if (!t) return "";
    const m = t.match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|p)?m?$/);
    if (!m) return null;
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (min > 59) return null;
    if (m[3]) {
      if (h < 1 || h > 12) return null;
      if (m[3] === "p" && h < 12) h += 12;
      if (m[3] === "a" && h === 12) h = 0;
    } else if (h > 23) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  function showTime(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }

  window.renderPeriodsList = function () {
    el.periodsTbody.innerHTML = "";
    if (PeriodsModule.periods.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "hint";
      td.textContent = 'No periods yet — click "+ Add Period" below.';
      tr.appendChild(td);
      el.periodsTbody.appendChild(tr);
      return;
    }
    PeriodsModule.periods.forEach((period) => {
      const tr = document.createElement("tr");
      const cell = (node) => { const td = document.createElement("td"); td.appendChild(node); tr.appendChild(td); };

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = period.name;
      nameInput.addEventListener("change", () => {
        PeriodsModule.update(period.id, { name: nameInput.value });
        window.savePeriodsThen(renderCourseList);
      });
      cell(nameInput);

      ["startTime", "endTime"].forEach((field) => {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = field === "startTime" ? "e.g. 9:00 AM" : "e.g. 10:30 AM";
        input.style.width = "9em";
        input.value = showTime(period[field]);
        input.addEventListener("change", () => {
          const v = parseTime(input.value);
          if (v === null) {
            input.value = showTime(period[field]);
            el.periodsStatus.textContent = "Couldn't read that time — try something like 9:00 AM or 14:30.";
            el.periodsStatus.style.color = "#d3302f";
            return;
          }
          PeriodsModule.update(period.id, { [field]: v });
          input.value = showTime(v);
          window.savePeriodsThen(renderCourseList);
        });
        cell(input);
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost btn-small";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove this period";
      removeBtn.addEventListener("click", () => {
        PeriodsModule.remove(period.id);
        CoursesModule.courses.forEach((c) => { if (c.periodId === period.id) c.periodId = null; });
        window.savePeriodsThen(() => { renderPeriodsList(); renderCourseList(); });
      });
      cell(removeBtn);
      el.periodsTbody.appendChild(tr);
    });
  };
  renderPeriodsList();

  // Opening Settings: show what is actually stored (not a stale copy), so what you see is what's saved.
  const origOpen = window.openSettings;
  el.settingsBtn.addEventListener("click", () => {
    if (!storage || !storage.isSignedIn() || el.settingsSection.hidden) return;
    chain = chain
      .then(() => PeriodsModule.load())
      .then(() => { renderPeriodsList(); renderCourseList(); })
      .catch(() => {});
  });
})();
