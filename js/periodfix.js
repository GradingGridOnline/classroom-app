// ===== Class periods: save immediately, and say so if it didn't work =====
// Load AFTER app.js. Every change in Global Settings → Class Periods is now written
// to your account right away (not left to the background autosave, which can be off
// or waiting), then read back to confirm it really stuck. If anything goes wrong, the
// message next to "Save Periods" says exactly what.

(function () {
  let chain = Promise.resolve();

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
    chain = chain
      .then(persist)
      .then(() => { el.periodsStatus.textContent = "Saved ✓"; })
      .catch((err) => {
        el.periodsStatus.textContent = `Couldn't save periods: ${err.message}`;
        el.periodsStatus.style.color = "#d3302f";
      });
    if (after) after(); // the screen updates at once; the save finishes in the background
  };

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
