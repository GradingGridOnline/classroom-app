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
    const want = JSON.stringify(PeriodsModule.periods);
    await PeriodsModule.save();
    await CoursesModule.save(); // a removed period also clears that course's period
    const back = await storage.loadFile("periods.json"); // read it back to be sure
    if (JSON.stringify((back && back.periods) || []) !== want) {
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
    const stale = bk && Array.isArray(bk.periods) && bk.periods.length && (bk.synced === false || this.periods.length === 0);
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
