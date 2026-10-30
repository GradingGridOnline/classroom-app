// ===== App wiring =====

let storage = null;
let currentMapping = null; // set while the mapping panel is open

const el = {
  signInBtn: document.getElementById("sign-in-btn"),
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  signUpBtn: document.getElementById("sign-up-btn"),
  resetPwBtn: document.getElementById("reset-pw-btn"),
  signOutBtn: document.getElementById("sign-out-btn"),
  status: document.getElementById("auth-status"),

  courseSection: document.getElementById("course-section"),
  courseList: document.getElementById("course-list"),
  courseCount: document.getElementById("course-count"),
  newCourseName: document.getElementById("new-course-name"),
  addCourseBtn: document.getElementById("add-course-btn"), saveCoursesBtn: document.getElementById("save-courses-btn"),
  courseStatus: document.getElementById("course-status"),
  courseSortSelect: document.getElementById("course-sort-select"),
  archivedList: document.getElementById("archived-list"),
  archivedCount: document.getElementById("archived-count"),
  templateList: document.getElementById("template-list"),
  templateCount: document.getElementById("template-count"),

  courseDetailSection: document.getElementById("course-detail-section"),
  courseDetailTitle: document.getElementById("course-detail-title"),
  backToCoursesBtn: document.getElementById("back-to-courses-btn"),
  tabRosterBtn: document.getElementById("tab-roster-btn"),
  tabSeatingBtn: document.getElementById("tab-seating-btn"),
  tabAttendanceBtn: document.getElementById("tab-attendance-btn"),
  tabScoringBtn: document.getElementById("tab-scoring-btn"),
  tabReportCardBtn: document.getElementById("tab-reportcard-btn"),
  rosterPanel: document.getElementById("roster-panel"),
  seatingPanel: document.getElementById("seating-panel"),
  attendancePanel: document.getElementById("attendance-panel"),
  scoringPanel: document.getElementById("scoring-panel"),
  reportCardPanel: document.getElementById("reportcard-panel"),
  modeConsultationBtn: document.getElementById("mode-consultation-btn"),
  modePrintcardBtn: document.getElementById("mode-printcard-btn"),
  consultationView: document.getElementById("consultation-view"),
  printcardView: document.getElementById("printcard-view"),
  consultationStudentSelect: document.getElementById("consultation-student-select"),
  consultationDetail: document.getElementById("consultation-detail"),
  selectAllItemsBtn: document.getElementById("select-all-items-btn"),
  selectNoItemsBtn: document.getElementById("select-no-items-btn"),
  itemSelectionList: document.getElementById("item-selection-list"),
  printcardStudentSelect: document.getElementById("printcard-student-select"),
  printOneBtn: document.getElementById("print-one-btn"),
  printAllBtn: document.getElementById("print-all-btn"), savePrintcardBtn: document.getElementById("save-printcard-btn"),
  printcardStatus: document.getElementById("printcard-status"),
  printArea: document.getElementById("print-area"),

  rosterCount: document.getElementById("roster-count"),
  rosterFileInput: document.getElementById("roster-file-input"),
  uploadRosterBtn: document.getElementById("upload-roster-btn"),
  addStudentBtn: document.getElementById("add-student-btn"),
  saveRosterBtn: document.getElementById("save-roster-btn"),
  collectEmailBtn: document.getElementById("collect-email-btn"),
  syncEmailBtn: document.getElementById("sync-email-btn"),
  showEmailQrBtn: document.getElementById("show-email-qr-btn"),
  deleteEmailFormBtn: document.getElementById("delete-email-form-btn"),
  emailCollectStatus: document.getElementById("email-collect-status"),
  rosterTbody: document.getElementById("roster-tbody"),
  rosterStatus: document.getElementById("roster-status"),

  mappingPanel: document.getElementById("mapping-panel"),
  mappingHint: document.getElementById("mapping-hint"),
  mapName: document.getElementById("map-name"),
  mapClassNumber: document.getElementById("map-classnumber"),
  mapSchoolId: document.getElementById("map-schoolid"),
  mapPronunciation: document.getElementById("map-pronunciation"),
  mapEmail: document.getElementById("map-email"),
  mapEmailSuffix: document.getElementById("map-email-suffix"),
  confirmImportBtn: document.getElementById("confirm-import-btn"),
  cancelImportBtn: document.getElementById("cancel-import-btn"),

  gridRows: document.getElementById("grid-rows"),
  gridCols: document.getElementById("grid-cols"),
  applyGridSizeBtn: document.getElementById("apply-grid-size-btn"),
  autoFillBtn: document.getElementById("auto-fill-btn"),
  autoFillNumericalBtn: document.getElementById("auto-fill-numerical-btn"),
  trimEmptyBtn: document.getElementById("trim-empty-btn"),
  clearSeatingBtn: document.getElementById("clear-seating-btn"),
  popoutBtn: document.getElementById("popout-btn"),
  togglePopoutGroupsBtn: document.getElementById("toggle-popout-groups-btn"),
  printSeatingBtn: document.getElementById("print-seating-btn"),
  saveSeatingBtn: document.getElementById("save-seating-btn"),
  unseatedList: document.getElementById("unseated-list"),
  unseatedCount: document.getElementById("unseated-count"),
  seatingGrid: document.getElementById("seating-grid"),
  seatingStatus: document.getElementById("seating-status"),
  banksList: document.getElementById("banks-list"),
  groupListTbody: document.getElementById("group-list-tbody"),

  attendanceStatus: document.getElementById("attendance-status"),
  saveAttendanceBtn: document.getElementById("save-attendance-btn"),
  attendanceTable: document.getElementById("attendance-table"),
  toggleAttendanceSettingsBtn: document.getElementById("toggle-attendance-settings-btn"),
  attendanceSettingsBody: document.getElementById("attendance-settings-body"),

  scoringStatus: document.getElementById("scoring-status"),
  saveScoringBtn: document.getElementById("save-scoring-btn"),
  scoringTable: document.getElementById("scoring-table"),
  toggleScoringSettingsBtn: document.getElementById("toggle-scoring-settings-btn"),
  scoringSettingsBody: document.getElementById("scoring-settings-body"),
  scoringModeRow: document.getElementById("scoring-mode-row"),





  settingsBtn: document.getElementById("settings-btn"),
  settingsSection: document.getElementById("settings-section"),
  settingsBackBtn: document.getElementById("settings-back-btn"),
  savePeriodsBtn: document.getElementById("save-periods-btn"),
  periodsStatus: document.getElementById("periods-status"),
  themeList: document.getElementById("theme-list"),
  periodsTbody: document.getElementById("periods-tbody"),
  addPeriodBtn: document.getElementById("add-period-btn"),
};

let selectedStudentId = null; // currently-selected student in the "Unseated" list
let attendanceSettingsEditing = false;
let scoringSettingsEditing = false;
// Which item ids currently have their "Sources" panel expanded in the
// Main Scores header — UI state only, not persisted.
const itemScoreSourcesOpen = new Set();
let consultationDisplayMode = "percent"; // "percent" or "points" — Total Score in Student Consultation

// Per-tool "Edit Settings" state for Scoring tool tabs (Table, etc.) —
// keyed by tool id, not persisted (same as attendanceSettingsEditing/
// scoringSettingsEditing, just one map since there can be several tools).
const scoringToolSettingsEditing = new Map();

let initPromise = null;

async function main() {
  ThemeModule.initLocal();
  renderThemeList();

  storage = new SupabaseProvider(APP_CONFIG);
  try {
    initPromise = storage.init();
    await initPromise;
  } catch (err) {
    el.status.textContent = err.message;
  }
  renderAuth();

  if (storage.isSignedIn()) {
    await ThemeModule.syncFromDrive();
    renderThemeList();
  }
}

/** Called by the Supabase provider when someone arrives from a "reset password" email link. */
window.onPasswordRecovery = async () => {
  const pw = prompt("Choose a new password (at least 8 characters):");
  if (!pw) return;
  try {
    await storage.updatePassword(pw);
    el.status.textContent = "Password changed ✓";
  } catch (err) {
    alert(err.message);
  }
};

// ===== Settings / theme =====

let settingsReturn = null; // which view was open before Settings

function openSettings() {
  if (!el.settingsSection.hidden) return closeSettings();
  settingsReturn = !el.courseDetailSection.hidden ? "detail" : "courses";
  el.courseSection.hidden = true;
  el.courseDetailSection.hidden = true;
  el.settingsSection.hidden = false;
  el.periodsStatus.textContent = "";
  updateAuthUI();
  renderThemeList();
  renderPeriodsList();
  window.scrollTo(0, 0);
}

function closeSettings() {
  el.settingsSection.hidden = true;
  if (!storage || !storage.isSignedIn()) {
    updateAuthUI();
    return;
  }
  if (settingsReturn === "detail") el.courseDetailSection.hidden = false;
  else el.courseSection.hidden = false;
}

el.settingsBtn.addEventListener("click", openSettings);
el.settingsBackBtn.addEventListener("click", closeSettings);

function renderTextSizeList() {
  const list = document.getElementById("textsize-list");
  if (!list) return;
  list.innerHTML = "";
  TEXT_SIZES.forEach((size) => {
    const li = document.createElement("li");
    li.className = "theme-item";
    if (size.id === ThemeModule.textSize) li.classList.add("theme-item-active");
    const label = document.createElement("span");
    label.textContent = size.label;
    const check = document.createElement("span");
    check.className = "theme-check";
    check.textContent = size.id === ThemeModule.textSize ? "✓" : "";
    li.append(label, check);
    li.addEventListener("click", async () => {
      await ThemeModule.setTextSize(size.id);
      renderTextSizeList();
    });
    list.appendChild(li);
  });
}

function renderThemeList() {
  renderTextSizeList();
  el.themeList.innerHTML = "";
  THEMES.forEach((theme) => {
    const li = document.createElement("li");
    li.className = "theme-item";
    if (theme.id === ThemeModule.current) li.classList.add("theme-item-active");

    const label = document.createElement("span");
    label.textContent = theme.label;

    const check = document.createElement("span");
    check.className = "theme-check";
    check.textContent = theme.id === ThemeModule.current ? "✓" : "";

    li.append(label, check);
    li.addEventListener("click", async () => {
      await ThemeModule.set(theme.id);
      renderThemeList();
    });
    el.themeList.appendChild(li);
  });
}

// ===== Settings / periods =====

function savePeriodsThen(after) {
  el.periodsStatus.textContent = window.GGOAutosave && window.GGOAutosave.enabled()
    ? "Autosaving…"
    : "Unsaved changes — click Save Periods.";
  if (after) after();
}

el.savePeriodsBtn.addEventListener("click", async () => {
  el.periodsStatus.textContent = "Saving…";
  try {
    await PeriodsModule.save();
    await CoursesModule.save(); // in case removing a period cleared any course's period
    el.periodsStatus.textContent = "Saved ✓";
  } catch (err) {
    el.periodsStatus.textContent = `Couldn't save: ${err.message}`;
  }
});

/** A small popover under `anchor` to choose a course's day of the week and period. */
function openSchedulePicker(anchor, course) {
  document.querySelectorAll(".schedule-picker").forEach((n) => n.remove());
  const pop = document.createElement("div");
  pop.className = "schedule-picker";
  pop.style.cssText = "position:absolute;z-index:9000;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px 12px;box-shadow:0 4px 18px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:8px;min-width:230px;";
  const mk = (text, select) => { const l = document.createElement("label"); l.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:10px;"; const sp = document.createElement("span"); sp.textContent = text; l.append(sp, select); pop.appendChild(l); };
  const daySel = document.createElement("select");
  const none = document.createElement("option"); none.value = ""; none.textContent = "No day"; daySel.appendChild(none);
  CoursesModule.DAYS_FULL.forEach((n, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = n; if (course.weekday === i) o.selected = true; daySel.appendChild(o); });
  const perSel = document.createElement("select");
  const none2 = document.createElement("option"); none2.value = ""; none2.textContent = "No period"; perSel.appendChild(none2);
  PeriodsModule.periods.forEach((period) => { const o = document.createElement("option"); o.value = period.id; o.textContent = PeriodsModule.label(period.id); if (course.periodId === period.id) o.selected = true; perSel.appendChild(o); });
  mk("Day", daySel); mk("Period", perSel);
  const apply = () => {
    CoursesModule.setWeekday(course.id, daySel.value);
    CoursesModule.setPeriod(course.id, perSel.value);
    anchor.textContent = CoursesModule.scheduleName(course) || "Set day & period";
  };
  daySel.addEventListener("change", apply);
  perSel.addEventListener("change", apply);
  const done = document.createElement("button"); done.type = "button"; done.className = "btn btn-primary btn-small"; done.textContent = "Done";
  const close = () => { pop.remove(); document.removeEventListener("mousedown", outside, true); if (CoursesModule.sortMode === "period") renderCourseList(); };
  const outside = (ev) => { if (!pop.contains(ev.target) && ev.target !== anchor) close(); };
  done.addEventListener("click", close);
  pop.appendChild(done);
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${r.bottom + window.scrollY + 4}px`;
  setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
}

function renderPeriodsList() {
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

    const nameTd = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = period.name;
    nameInput.addEventListener("change", async () => {
      PeriodsModule.update(period.id, { name: nameInput.value });
      await savePeriodsThen(renderCourseList); // course dropdowns show period labels too
    });
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    const startTd = document.createElement("td");
    const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.value = period.startTime || "";
    startInput.addEventListener("change", async () => {
      PeriodsModule.update(period.id, { startTime: startInput.value });
      await savePeriodsThen(renderCourseList);
    });
    startTd.appendChild(startInput);
    tr.appendChild(startTd);

    const endTd = document.createElement("td");
    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.value = period.endTime || "";
    endInput.addEventListener("change", async () => {
      PeriodsModule.update(period.id, { endTime: endInput.value });
      await savePeriodsThen(renderCourseList);
    });
    endTd.appendChild(endInput);
    tr.appendChild(endTd);

    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost btn-small";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove this period";
    removeBtn.addEventListener("click", async () => {
      PeriodsModule.remove(period.id);
      // Any course pointing at the removed period falls back to "No period".
      CoursesModule.courses.forEach((c) => {
        if (c.periodId === period.id) c.periodId = null;
      });
      await savePeriodsThen(() => {
        renderPeriodsList();
        renderCourseList();
      });
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);

    el.periodsTbody.appendChild(tr);
  });
}

/** "Day of the week" display options (global): full / three-letter name, and a hyphen before the period. */
(function buildDayFormatSettings() {
  const block = el.addPeriodBtn.closest(".settings-block");
  if (!block) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:14px;padding-top:10px;border-top:1px solid var(--line);";
  wrap.innerHTML = '<h4 style="margin:0 0 6px">Day of the week</h4><p class="hint">How a course\'s day is written wherever its schedule appears (course list, printed seating chart, quiz printouts…).</p>';
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:center;";
  const styleSel = document.createElement("select");
  [["full", "Full name (Monday)"], ["short", "Three letters (Mon)"]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; styleSel.appendChild(o); });
  const hy = document.createElement("input"); hy.type = "checkbox";
  const hl = document.createElement("label"); hl.append(hy, document.createTextNode(" Hyphen between day and period (Mon-Period 2)"));
  const sample = document.createElement("span"); sample.className = "hint";
  const sync = () => {
    styleSel.value = CoursesModule.dayFormat.style; hy.checked = CoursesModule.dayFormat.hyphen;
    sample.textContent = "Example: " + CoursesModule.dayName(1) + (CoursesModule.dayFormat.hyphen ? "-" : " ") + "Period 2";
  };
  const change = async () => {
    CoursesModule.dayFormat = { style: styleSel.value, hyphen: hy.checked };
    sync();
    renderCourseList();
    try { await CoursesModule.save(); } catch (err) { alert(`Couldn't save: ${err.message}`); }
  };
  styleSel.addEventListener("change", change); hy.addEventListener("change", change);
  row.append(styleSel, hl, sample); wrap.appendChild(row); block.appendChild(wrap);
  window.syncDayFormatSettings = sync;
  sync();
})();

el.addPeriodBtn.addEventListener("click", async () => {
  try {
    PeriodsModule.add(`Period ${PeriodsModule.periods.length + 1}`, "", "");
    await savePeriodsThen(renderPeriodsList);
  } catch (err) {
    alert(err.message);
  }
});

/** Updates only the sign-in widgets (never changes which page is showing). */
function updateAuthUI() {
  const signedIn = !!storage && storage.isSignedIn();
  const settingsOpen = !el.settingsSection.hidden;
  el.loginForm.hidden = signedIn;
  el.signOutBtn.hidden = !signedIn;
  el.settingsSection.classList.toggle("signed-out", !signedIn);
  document.getElementById("signin-prompt").hidden = signedIn || settingsOpen;
  if (signedIn) el.status.textContent = `Signed in as ${storage.getUserName() || ""}`;
  else if (el.status.textContent.startsWith("Signed in as")) el.status.textContent = "";
}

/** Updates the widgets AND moves to the right page after signing in / out / on startup. */
function renderAuth() {
  updateAuthUI();
  const signedIn = !!storage && storage.isSignedIn();
  const settingsOpen = !el.settingsSection.hidden;

  if (signedIn) {
    // Get Google's sign-in ready in the background (no popup) so the email buttons can open it instantly.
    try { if (storage.getGoogle) Promise.resolve(storage.getGoogle()).catch(() => {}); } catch (e) { /* optional warm-up; never block sign-in */ }
    // Signing in from the Settings page: go on to the courses.
    if (settingsOpen) {
      el.settingsSection.hidden = true;
      settingsReturn = "courses";
    }
    el.courseSection.hidden = false;
    showCourses();
  } else {
    el.courseSection.hidden = true;
    el.courseDetailSection.hidden = true;
  }
}

document.getElementById("open-signin-btn").addEventListener("click", openSettings);

async function ensureAuthReady() {
  if (!storage.client) {
    initPromise = storage.init();
  }
  await initPromise;
}

el.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.status.textContent = "Signing in…";
  try {
    await ensureAuthReady();
    await storage.signIn(el.loginEmail.value.trim(), el.loginPassword.value);
    el.loginPassword.value = "";
    renderAuth();
    await ThemeModule.syncFromDrive();
    renderThemeList();
  } catch (err) {
    el.status.textContent = `Sign-in failed: ${err.message}`;
  }
});

el.signUpBtn.addEventListener("click", async () => {
  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value;
  if (!email || password.length < 8) {
    el.status.textContent = "Enter your email and a password of at least 8 characters, then click Create account.";
    return;
  }
  el.status.textContent = "Creating account…";
  try {
    await ensureAuthReady();
    const result = await storage.signUp(email, password);
    if (result.needsConfirmation) {
      el.status.textContent = "Account created. Check your email and click the confirmation link, then sign in here.";
    } else {
      el.loginPassword.value = "";
      renderAuth();
    }
  } catch (err) {
    el.status.textContent = `Couldn't create account: ${err.message}`;
  }
});

el.resetPwBtn.addEventListener("click", async () => {
  const email = el.loginEmail.value.trim();
  if (!email) {
    el.status.textContent = "Type your email above first, then click Forgot password.";
    return;
  }
  try {
    await ensureAuthReady();
    await storage.resetPassword(email);
    el.status.textContent = "If that email has an account, a reset link is on its way.";
  } catch (err) {
    el.status.textContent = `Couldn't send reset email: ${err.message}`;
  }
});

el.signOutBtn.addEventListener("click", async () => {
  if (window.GGOAutosave) await window.GGOAutosave.flush(); // don't lose a last-second edit
  await storage.signOut();
  renderAuth();
});

// ===== Courses =====

async function showCourses() {
  el.courseDetailSection.hidden = true;
  el.courseSection.hidden = false;
  el.courseStatus.textContent = "Loading courses…";
  try {
    await PeriodsModule.load();
    await CoursesModule.load();
    if (window.syncDayFormatSettings) window.syncDayFormatSettings();
    await TemplatesModule.load();
    renderCourseList();
    renderPeriodsList();
    el.courseStatus.textContent = "";
  } catch (err) {
    el.courseStatus.textContent = `Couldn't load courses: ${err.message}`;
  }
}

function makeSmallButton(label, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-ghost btn-small";
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

/** Runs one of the actions that writes to Google Drive right away (duplicate, create from template, save as template), showing progress in the course status line. */
async function runCourseAction(workingMessage, action, doneMessage) {
  el.courseStatus.textContent = workingMessage;
  try {
    await action();
    renderCourseList();
    el.courseStatus.textContent = doneMessage;
  } catch (err) {
    el.courseStatus.textContent = `Failed: ${err.message}`;
  }
}

function renderCourseList() {
  const active = CoursesModule.activeCourses();
  const archived = CoursesModule.archivedCourses();
  const manual = CoursesModule.sortMode === "manual";

  el.courseCount.textContent = `${CoursesModule.courses.length} / ${MAX_COURSES}`;

  // ----- Sort mode dropdown -----
  if (el.courseSortSelect.options.length === 0) {
    Object.entries(COURSE_SORT_MODES).forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      el.courseSortSelect.appendChild(opt);
    });
  }
  el.courseSortSelect.value = CoursesModule.sortMode;

  // ----- Active courses -----
  el.courseList.innerHTML = "";
  if (active.length === 0) {
    const li = document.createElement("li");
    li.className = "course-item hint";
    li.textContent = "No courses yet — add one below, or create one from a template.";
    el.courseList.appendChild(li);
  }
  active.forEach((course, index) => {
    const li = document.createElement("li");
    li.className = "course-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "course-name";
    nameSpan.textContent = course.name;
    nameSpan.addEventListener("click", () => openCourseDetail(course));
    li.appendChild(nameSpan);

    const scheduleBtn = document.createElement("button");
    scheduleBtn.type = "button";
    scheduleBtn.className = "course-period-select course-schedule-btn";
    scheduleBtn.textContent = CoursesModule.scheduleName(course) || "Set day & period";
    scheduleBtn.title = "Click to choose the day of the week and period";
    scheduleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSchedulePicker(scheduleBtn, course);
    });
    li.appendChild(scheduleBtn);
    li.appendChild(buildCourseTemplateSelect(course));

    if (manual) {
      const upBtn = makeSmallButton("↑", "Move up", () => {
        CoursesModule.move(course.id, -1);
        renderCourseList();
      });
      upBtn.disabled = index === 0;
      const downBtn = makeSmallButton("↓", "Move down", () => {
        CoursesModule.move(course.id, 1);
        renderCourseList();
      });
      downBtn.disabled = index === active.length - 1;
      li.append(upBtn, downBtn);
    }

    li.appendChild(
      makeSmallButton("Rename", "", () => {
        const newName = prompt("Rename course:", course.name);
        if (newName === null) return;
        try {
          CoursesModule.rename(course.id, newName);
          renderCourseList();
        } catch (err) {
          alert(err.message);
        }
      })
    );

    li.appendChild(
      makeSmallButton("Duplicate", "Copy this course and everything saved in it (saved to Google Drive right away)", () => {
        runCourseAction(
          "Duplicating…",
          () => CoursesModule.duplicate(course.id),
          "Course duplicated and saved ✓"
        );
      })
    );

    li.appendChild(
      makeSmallButton("Save as Template", "Save this course's structure (no students or scores) as a reusable template", () => {
        const name = prompt("Template name:", course.name);
        if (name === null) return;
        runCourseAction(
          "Saving template…",
          () => TemplatesModule.saveFromCourse(course.id, name),
          "Template saved ✓"
        );
      })
    );

    li.appendChild(
      makeSmallButton("Archive", "Move this course to Archived Courses", () => {
        CoursesModule.setArchived(course.id, true);
        renderCourseList();
      })
    );

    li.appendChild(
      makeSmallButton("Delete", "", () => {
        if (!confirm(`Delete "${course.name}"? This does not delete its saved roster.`)) return;
        CoursesModule.remove(course.id);
        renderCourseList();
      })
    );

    el.courseList.appendChild(li);
  });

  // ----- Archived courses -----
  el.archivedCount.textContent = String(archived.length);
  el.archivedList.innerHTML = "";
  if (archived.length === 0) {
    const li = document.createElement("li");
    li.className = "course-item hint";
    li.textContent = "Nothing archived. Use a course's Archive button to move it here.";
    el.archivedList.appendChild(li);
  }
  archived.forEach((course) => {
    const li = document.createElement("li");
    li.className = "course-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "course-name";
    nameSpan.textContent = course.name;
    nameSpan.addEventListener("click", () => openCourseDetail(course));
    li.appendChild(nameSpan);

    li.appendChild(
      makeSmallButton("Restore", "Move this course back to the main list", () => {
        CoursesModule.setArchived(course.id, false);
        renderCourseList();
      })
    );
    li.appendChild(
      makeSmallButton("Delete", "", () => {
        if (!confirm(`Delete "${course.name}"? This does not delete its saved roster.`)) return;
        CoursesModule.remove(course.id);
        renderCourseList();
      })
    );
    el.archivedList.appendChild(li);
  });

  renderTemplateList();
}

function renderTemplateList() {
  el.templateCount.textContent = String(TemplatesModule.templates.length);
  el.templateList.innerHTML = "";

  if (TemplatesModule.templates.length === 0) {
    const li = document.createElement("li");
    li.className = "course-item hint";
    li.textContent = 'No templates yet — use a course\'s "Save as Template" button.';
    el.templateList.appendChild(li);
    return;
  }

  TemplatesModule.templates.forEach((template) => {
    const li = document.createElement("li");
    li.className = "course-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "course-name";
    nameSpan.style.cursor = "default";
    nameSpan.textContent = template.name;
    if (template.sourceCourseName) {
      const from = document.createElement("span");
      from.className = "hint";
      from.textContent = ` — from ${template.sourceCourseName}`;
      nameSpan.appendChild(from);
    }
    li.appendChild(nameSpan);

    li.appendChild(
      makeSmallButton(
        template.linkable ? "Linking: On" : "Linking: Off",
        "Whether courses can be linked to this template (saved with Save Courses & Periods)",
        () => {
          template.linkable = !template.linkable;
          renderCourseList();
        }
      )
    );

    li.appendChild(
      makeSmallButton("Create Course", "Make a new course from this template (saved to Google Drive right away)", () => {
        const name = prompt("Name for the new course:", template.name);
        if (name === null) return;
        runCourseAction(
          "Creating course…",
          () => TemplatesModule.createCourse(template.id, name),
          "Course created and saved ✓"
        );
      })
    );

    li.appendChild(
      makeSmallButton("Rename", "", () => {
        const newName = prompt("Rename template:", template.name);
        if (newName === null) return;
        try {
          TemplatesModule.rename(template.id, newName);
          renderCourseList();
        } catch (err) {
          alert(err.message);
        }
      })
    );

    li.appendChild(
      makeSmallButton("Delete", "", () => {
        if (!confirm(`Delete the template "${template.name}"? Courses already made from it are not affected.`)) return;
        TemplatesModule.remove(template.id);
        CoursesModule.courses.forEach((c) => {
          if (c.templateId === template.id) c.templateId = null;
        });
        renderCourseList();
      })
    );

    el.templateList.appendChild(li);
  });
}

el.courseSortSelect.addEventListener("change", () => {
  CoursesModule.setSortMode(el.courseSortSelect.value);
  renderCourseList();
});

el.addCourseBtn.addEventListener("click", () => {
  try {
    CoursesModule.add(el.newCourseName.value);
    el.newCourseName.value = "";
    renderCourseList();
    el.courseStatus.textContent = "";
  } catch (err) {
    el.courseStatus.textContent = err.message;
  }
});

el.saveCoursesBtn.addEventListener("click", async () => {
  el.courseStatus.textContent = "Saving…";
  try {
    await CoursesModule.save();
    await PeriodsModule.save();
    await TemplatesModule.save();
    el.courseStatus.textContent = "Saved to Google Drive ✓";
  } catch (err) {
    el.courseStatus.textContent = `Save failed: ${err.message}`;
  }
});

el.newCourseName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.addCourseBtn.click();
});

// ===== Course detail (Roster + Seating Chart tabs) =====

async function openCourseDetail(course) {
  el.courseSection.hidden = true;
  el.courseDetailSection.hidden = false;
  el.courseDetailTitle.textContent = course.name;
  el.mappingPanel.hidden = true;
  selectedStudentId = null;

  showTab("roster");

  el.rosterStatus.textContent = "Loading roster…";
  el.seatingStatus.textContent = "Loading seating chart…";
  el.attendanceStatus.textContent = "Loading attendance…";
  el.scoringStatus.textContent = "Loading scoring…";

  try {
    await RosterModule.load(course.id);
    renderRoster();
    el.rosterStatus.textContent = "";
  } catch (err) {
    el.rosterStatus.textContent = `Couldn't load roster: ${err.message}`;
  }

  try {
    await SeatingModule.load(course.id);
    renderSeating();
    el.seatingStatus.textContent = "";
  } catch (err) {
    el.seatingStatus.textContent = `Couldn't load seating chart: ${err.message}`;
  }

  try {
    await AttendanceModule.load(course.id);
    renderAttendance();
    el.attendanceStatus.textContent = "";
  } catch (err) {
    el.attendanceStatus.textContent = `Couldn't load attendance: ${err.message}`;
  }

  try {
    await RubricBankModule.load();
    await ScoringModule.load(course.id);
    scoringMode = "entry"; // reset to Main Scores each time a course is opened
    renderScoringToolTabs(); // (re)builds tabs/views for this course's saved tools
    showScoringMode("entry");
    el.scoringStatus.textContent = "";
  } catch (err) {
    el.scoringStatus.textContent = `Couldn't load scoring: ${err.message}`;
  }

  try {
    await ReportCardModule.load(course.id);
    renderItemSelectionList();
    renderPrintcardStudentOptions();
    renderReportCardEmailSection();
    el.printcardStatus.textContent = "";
  } catch (err) {
    el.printcardStatus.textContent = `Couldn't load report card settings: ${err.message}`;
  }

  try {
    await EmailCollectModule.load(course.id);
    renderEmailCollectButtons();
    renderEmailSettings();
  } catch (err) {
    el.emailCollectStatus.textContent = `Couldn't load email collection state: ${err.message}`;
  }

  await syncLinkedTemplate(course);
}

el.backToCoursesBtn.addEventListener("click", showCourses);

function showTab(tab) {
  el.rosterPanel.hidden = tab !== "roster";
  el.seatingPanel.hidden = tab !== "seating";
  el.attendancePanel.hidden = tab !== "attendance";
  el.scoringPanel.hidden = tab !== "scoring";
  el.reportCardPanel.hidden = tab !== "reportcard";
  el.tabRosterBtn.classList.toggle("tab-btn-active", tab === "roster");
  el.tabSeatingBtn.classList.toggle("tab-btn-active", tab === "seating");
  el.tabAttendanceBtn.classList.toggle("tab-btn-active", tab === "attendance");
  el.tabScoringBtn.classList.toggle("tab-btn-active", tab === "scoring");
  el.tabReportCardBtn.classList.toggle("tab-btn-active", tab === "reportcard");

  if (tab === "seating") {
    selectedStudentId = null;
    renderSeating(); // roster may have changed since the tab was last shown
  } else if (tab === "attendance") {
    renderAttendance(); // roster may have changed since the tab was last shown
  } else if (tab === "scoring") {
    // roster/attendance may have changed since the tab was last shown —
    // re-render whichever Scoring sub-tab (entry, or a future tool) is showing.
    const renderFn = SCORING_MODE_RENDERERS[scoringMode];
    if (renderFn) renderFn();
  } else if (tab === "reportcard") {
    renderConsultationStudentOptions(); // roster may have changed since the tab was last shown
  }
}

el.tabRosterBtn.addEventListener("click", () => showTab("roster"));
el.tabSeatingBtn.addEventListener("click", () => showTab("seating"));
el.tabAttendanceBtn.addEventListener("click", () => showTab("attendance"));
el.tabScoringBtn.addEventListener("click", () => showTab("scoring"));
el.tabReportCardBtn.addEventListener("click", () => showTab("reportcard"));

function renderRoster() {
  el.rosterCount.textContent = `${RosterModule.students.length} / ${MAX_STUDENTS}`;
  el.rosterTbody.innerHTML = "";

  RosterModule.students.forEach((student) => {
    const tr = document.createElement("tr");
    tr.appendChild(makeClassNumberCell(student));
    tr.appendChild(makeEditableCell(student, "name"));
    tr.appendChild(makeEditableCell(student, "pronunciation"));
    tr.appendChild(makeEditableCell(student, "schoolId"));
    tr.appendChild(makeEditableCell(student, "email"));

    const actionTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-ghost btn-small";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      RosterModule.removeStudent(student.id);
      renderRoster();
    });
    actionTd.appendChild(removeBtn);
    tr.appendChild(actionTd);

    tr.appendChild(makeSpecialNeedsCell(student));
    tr.appendChild(makeNotesCell(student));

    el.rosterTbody.appendChild(tr);
  });
}

/** Special Needs: a checkbox (used by the "Students with Special Needs" section of the printed seating chart). */
function makeSpecialNeedsCell(student) {
  const td = document.createElement("td");
  td.style.textAlign = "center";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!student.specialNeeds;
  cb.title = "Special needs";
  cb.addEventListener("change", () => RosterModule.updateStudent(student.id, { specialNeeds: cb.checked }));
  td.appendChild(cb);
  return td;
}

/** Notes: a wide one-line box that grows into a big text area while it has focus, then shrinks back to showing just the first line. */
function makeNotesCell(student) {
  const td = document.createElement("td");
  td.className = "roster-notes-cell";
  const area = document.createElement("textarea");
  area.className = "roster-notes-input";
  area.rows = 1;
  area.spellcheck = true;
  area.placeholder = "Notes";
  area.value = student.notes || "";
  area.addEventListener("input", () => {
    RosterModule.updateStudent(student.id, { notes: area.value });
    area.style.height = "auto";
    area.style.height = Math.max(area.scrollHeight, 160) + "px"; // keeps growing with long notes
  });
  area.addEventListener("focus", () => {
    area.style.height = Math.max(area.scrollHeight, 160) + "px";
  });
  area.addEventListener("blur", () => {
    area.style.height = ""; // back to the one-line size (the CSS shows the first line)
    area.scrollTop = 0;
  });
  td.appendChild(area);
  return td;
}

function makeEditableCell(student, field) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "text";
  input.value = student[field];
  input.addEventListener("input", () => {
    RosterModule.updateStudent(student.id, { [field]: input.value });
  });
  td.appendChild(input);
  return td;
}

/** Class Number gets its own cell: numeric, 1-100, and validated for uniqueness on commit (not on every keystroke). */
function makeClassNumberCell(student) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.className = "class-number-input";
  input.value = student.classNumber || "";
  input.addEventListener("change", () => {
    const n = Number(input.value);
    if (!n || n < 1 || n > MAX_STUDENTS) {
      alert(`Class Number must be between 1 and ${MAX_STUDENTS}.`);
      input.value = student.classNumber || "";
      return;
    }
    if (RosterModule.isClassNumberTaken(n, student.id)) {
      alert(`Class Number ${n} is already used by another student in this course.`);
      input.value = student.classNumber || "";
      return;
    }
    RosterModule.updateStudent(student.id, { classNumber: n });
  });
  td.appendChild(input);
  return td;
}

el.addStudentBtn.addEventListener("click", () => {
  try {
    RosterModule.addStudent();
    renderRoster();
  } catch (err) {
    alert(err.message);
  }
});

el.saveRosterBtn.addEventListener("click", async () => {
  el.rosterStatus.textContent = "Saving…";
  try {
    await RosterModule.save();
    el.rosterStatus.textContent = "Saved to Google Drive ✓";
  } catch (err) {
    el.rosterStatus.textContent = `Save failed: ${err.message}`;
  }
});

// ===== CSV / Excel import =====

el.uploadRosterBtn.addEventListener("click", () => el.rosterFileInput.click());

el.rosterFileInput.addEventListener("change", async () => {
  const file = el.rosterFileInput.files[0];
  el.rosterFileInput.value = ""; // allow re-choosing the same file later
  if (!file) return;

  el.rosterStatus.textContent = "Reading file…";
  try {
    const { headers, rowCount } = await RosterImport.parseFile(file);
    el.rosterStatus.textContent = "";
    openMappingPanel(headers, rowCount);
  } catch (err) {
    el.rosterStatus.textContent = `Couldn't read that file: ${err.message}`;
  }
});

function openMappingPanel(headers, rowCount) {
  el.mappingHint.textContent = `Found ${rowCount} student row${rowCount === 1 ? "" : "s"}. Confirm which column is which below.`;

  const fillSelect = (select, includeNone) => {
    select.innerHTML = "";
    if (includeNone) {
      const opt = document.createElement("option");
      opt.value = "-1";
      opt.textContent = "(not in this file)";
      select.appendChild(opt);
    }
    headers.forEach((header, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = header || `Column ${idx + 1}`;
      select.appendChild(opt);
    });
  };

  fillSelect(el.mapName, false);
  fillSelect(el.mapClassNumber, true);
  fillSelect(el.mapSchoolId, true);
  fillSelect(el.mapPronunciation, true);
  fillSelect(el.mapEmail, true);

  const guess = RosterImport.guessMapping();
  el.mapName.value = String(guess.name);
  el.mapClassNumber.value = String(guess.classNumber);
  el.mapSchoolId.value = String(guess.schoolId);
  el.mapPronunciation.value = String(guess.pronunciation);
  el.mapEmail.value = String(guess.email);
  el.mapEmailSuffix.value = "";

  // Optional extra columns to keep (later usable to match students by when collecting emails).
  const extraList = document.getElementById("map-extra-list");
  extraList.innerHTML = "";
  headers.forEach((header, idx) => {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = String(idx);
    label.appendChild(box);
    label.appendChild(document.createTextNode(header || `Column ${idx + 1}`));
    extraList.appendChild(label);
  });

  el.mappingPanel.hidden = false;
}

el.cancelImportBtn.addEventListener("click", () => {
  el.mappingPanel.hidden = true;
});

el.confirmImportBtn.addEventListener("click", () => {
  const mapping = {
    name: Number(el.mapName.value),
    classNumber: Number(el.mapClassNumber.value),
    schoolId: Number(el.mapSchoolId.value),
    pronunciation: Number(el.mapPronunciation.value),
    email: Number(el.mapEmail.value),
    emailSuffix: el.mapEmailSuffix.value,
    extraCols: Array.from(document.querySelectorAll("#map-extra-list input:checked")).map((box) => Number(box.value)),
  };

  if (RosterModule.students.length > 0) {
    const proceed = confirm(
      `This replaces the current roster (${RosterModule.students.length} students) with the imported file. Continue?`
    );
    if (!proceed) return;
  }

  try {
    const students = RosterImport.buildStudents(mapping);
    RosterModule.replaceAll(students);
    el.mappingPanel.hidden = true;
    renderRoster();
    el.rosterStatus.textContent =
      window.GGOAutosave && window.GGOAutosave.enabled()
        ? `Imported ${students.length} students — saving automatically.`
        : `Imported ${students.length} students — click "Save Roster" to store them.`;
  } catch (err) {
    el.rosterStatus.textContent = err.message;
  }
});

// ===== Seating chart =====

function populateGridSizeSelects() {
  [el.gridRows, el.gridCols].forEach((select) => {
    if (select.options.length > 0) return; // already populated
    for (let n = 1; n <= MAX_GRID_SIZE; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      select.appendChild(opt);
    }
  });
}

function renderSeating() {
  populateGridSizeSelects();
  el.gridRows.value = String(SeatingModule.rows);
  el.gridCols.value = String(SeatingModule.cols);
  el.togglePopoutGroupsBtn.textContent = SeatingModule.showGroupsInPopout
    ? "Hide Group Colors in Pop-Out"
    : "Show Group Colors in Pop-Out";

  const seatedIds = SeatingModule.seatedStudentIds();
  const unseated = RosterModule.students.filter((s) => !seatedIds.has(s.id) && !s.excludeFromSeating);

  // ----- Unseated list: class #, name, pronunciation, school ID -----
  el.unseatedCount.textContent = String(unseated.length);
  el.unseatedList.innerHTML = "";
  unseated.forEach((student) => {
    const li = document.createElement("li");
    li.className = "unseated-item";
    if (student.id === selectedStudentId) li.classList.add("unseated-item-selected");

    if (student.classNumber) {
      const numEl = document.createElement("span");
      numEl.className = "unseated-classnumber";
      numEl.textContent = `#${student.classNumber}`;
      li.appendChild(numEl);
    }

    const nameEl = document.createElement("span");
    nameEl.className = "unseated-name";
    nameEl.textContent = student.name || "(unnamed)";
    li.appendChild(nameEl);

    if (student.pronunciation) {
      const pronEl = document.createElement("span");
      pronEl.className = "unseated-pronunciation";
      pronEl.textContent = `(${student.pronunciation})`;
      li.appendChild(pronEl);
    }

    if (student.schoolId) {
      const idEl = document.createElement("span");
      idEl.className = "unseated-id";
      idEl.textContent = student.schoolId;
      li.appendChild(idEl);
    }

    li.addEventListener("click", () => {
      selectedStudentId = selectedStudentId === student.id ? null : student.id;
      renderSeating();
    });
    el.unseatedList.appendChild(li);
  });

  if (unseated.length === 0) {
    // The column stays put even when nobody is waiting to be seated.
    const empty = document.createElement("li");
    empty.className = "unseated-empty";
    empty.textContent = RosterModule.students.length === 0 ? "No students on the roster yet" : "Everyone is seated";
    el.unseatedList.appendChild(empty);
  }

  // ----- Grid -----
  el.seatingGrid.innerHTML = "";
  el.seatingGrid.style.gridTemplateColumns = `repeat(${SeatingModule.cols}, 1fr)`;

  for (let r = 0; r < SeatingModule.rows; r++) {
    for (let c = 0; c < SeatingModule.cols; c++) {
      el.seatingGrid.appendChild(buildDeskElement(r, c));
    }
  }

  renderBanks();
  renderGroupList();
  renderSeatingSettings();
}

/** Every seated student (active desk + occupied), with that desk's group number, ordered by group then class number. Ungrouped (0) sorts last. */
function computeGroupListEntries() {
  const entries = [];
  for (let r = 0; r < SeatingModule.rows; r++) {
    for (let c = 0; c < SeatingModule.cols; c++) {
      if (!SeatingModule.isActive(r, c)) continue;
      const studentId = SeatingModule.studentAt(r, c);
      if (!studentId) continue;
      const student = RosterModule.students.find((s) => s.id === studentId);
      if (!student) continue;
      entries.push({ student, group: SeatingModule.getGroup(r, c) });
    }
  }
  entries.sort((a, b) => {
    const groupA = a.group || Infinity;
    const groupB = b.group || Infinity;
    if (groupA !== groupB) return groupA - groupB;
    return (a.student.classNumber || 0) - (b.student.classNumber || 0);
  });
  return entries;
}

function renderGroupList() {
  const entries = computeGroupListEntries();
  el.groupListTbody.innerHTML = "";

  if (entries.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "hint";
    td.textContent = "No students seated yet.";
    tr.appendChild(td);
    el.groupListTbody.appendChild(tr);
    return;
  }

  entries.forEach(({ student, group }) => {
    const tr = document.createElement("tr");

    const classNumTd = document.createElement("td");
    classNumTd.textContent = student.classNumber ? `#${student.classNumber}` : "—";
    tr.appendChild(classNumTd);

    const nameTd = document.createElement("td");
    nameTd.textContent = student.name || "(unnamed)";
    tr.appendChild(nameTd);

    const pronTd = document.createElement("td");
    pronTd.textContent = student.pronunciation || "";
    tr.appendChild(pronTd);

    const idTd = document.createElement("td");
    idTd.textContent = student.schoolId || "";
    tr.appendChild(idTd);

    const emailTd = document.createElement("td");
    emailTd.textContent = student.email || "";
    tr.appendChild(emailTd);

    const groupTd = document.createElement("td");
    groupTd.textContent = group ? String(group) : "—";
    tr.appendChild(groupTd);

    el.groupListTbody.appendChild(tr);
  });
}

/** Largest font size (px) at which `text` fits within `maxWidthPx`, measured with a scratch canvas rather than guessed from character count — reused across calls instead of recreated each time. */
const _measureCanvas = document.createElement("canvas");
const _measureCtx = _measureCanvas.getContext("2d");
function fontSizeToFit(text, maxWidthPx, fontWeight = "400", maxSizePx = 40) {
  if (!text || maxWidthPx <= 0) return maxSizePx;
  const refSize = 100;
  _measureCtx.font = `${fontWeight} ${refSize}px Georgia, "Times New Roman", serif`;
  const widthAtRef = _measureCtx.measureText(text).width;
  if (widthAtRef <= 0) return maxSizePx;
  return Math.min(maxSizePx, (maxWidthPx / widthAtRef) * refSize);
}

/** "Period 2 (09:00–10:30)" for a course's assigned period — with whichever of the start / end times the period has — or "" if the course has no period assigned. */
function printPeriodLine(course) {
  return CoursesModule.scheduleLine(course);
}

/** "&n=<course name>&p=<period and time>" for the QR pop-out windows, so the course shows above the code. */
function qrCourseQuery() {
  const course = CoursesModule.find(RosterModule.currentCourseId);
  if (!course) return "";
  return `&n=${encodeURIComponent(course.name || "")}&p=${encodeURIComponent(printPeriodLine(course))}`;
}
window.qrCourseQuery = qrCourseQuery;

/**
 * Builds a printable sheet of the current seating arrangement, from the
 * teacher's own viewpoint (same row/column order as the on-screen
 * editor — unmirrored, unlike the pop-out). Landscape A4. Desks scale to
 * fill the available grid space, each showing pronunciation (top),
 * name, and School ID (bottom), all top-left justified. Three thin
 * fill-in boxes — Lesson Contents, Homework, Date of Lesson — are
 * pinned to the bottom of the page for handwriting; course name and
 * period/time (from Global Settings) appear in the page heading and in
 * a fourth pre-filled box.
 */
function buildSeatingPrintSheet() {
  const course = CoursesModule.find(RosterModule.currentCourseId);

  const sheet = document.createElement("div");
  sheet.className = "seating-print-sheet";

  // Sections 1-3 (top of the page) — chosen in Seating Settings (see seatingprint.js).
  sheet.appendChild(buildSeatingPrintTop(course));

  const grid = document.createElement("div");
  grid.className = "seating-print-grid";
  grid.style.gridTemplateColumns = `repeat(${SeatingModule.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${SeatingModule.rows}, 1fr)`;
  // Scales desk text to the grid's actual dimensions (rows/cols), the
  // same technique the pop-out uses for its live window — here based on
  // fixed A4-landscape-minus-margins measurements, since a print page's
  // size is known ahead of time. Approximate but self-consistent.
  const PRINT_GRID_WIDTH_PX = 1026; // page width (297mm) minus 0.5in left/right padding, at 96dpi — see .seating-print-sheet in style.css
  const PRINT_GRID_HEIGHT_PX = 460; // ~ budget left after heading/front-label/boxes/excluded-list
  const deskWidth = PRINT_GRID_WIDTH_PX / SeatingModule.cols;
  const deskHeight = PRINT_GRID_HEIGHT_PX / SeatingModule.rows;
  const deskSize = Math.min(deskWidth, deskHeight);
  // A font size purely from grid density (desk count) can still
  // overflow a long name, or look needlessly large for short ones —
  // so it's capped by how much room the longest seated name actually
  // needs at a given size, measured with a scratch canvas rather than
  // guessed from character count. class-number-tag text ("#12 ") also
  // has to fit alongside the name on the same line, so it's included
  // in the same measurement rather than sized separately.
  const gridBasedNameSize = Math.max(10, Math.round(deskSize * 0.16));
  const longestNameLabel = Object.values(SeatingModule.seats).reduce((longest, studentId) => {
    const student = RosterModule.students.find((s) => s.id === studentId);
    if (!student) return longest;
    const label = student.classNumber ? `#${student.classNumber} ${student.name || ""}` : student.name || "";
    return label.length > longest.length ? label : longest;
  }, "");
  const nameSize = longestNameLabel
    ? Math.min(gridBasedNameSize, fontSizeToFit(longestNameLabel, deskWidth - 8, "600"))
    : gridBasedNameSize;
  grid.style.setProperty("--print-name-size", `${Math.max(7, Math.round(nameSize))}px`);
  grid.style.setProperty("--print-subtext-size", `${Math.max(6, Math.round(nameSize * 0.72))}px`);
  // Caps how big the grid is allowed to grow — flex-grow (see CSS)
  // fills remaining space up to this cap, and flex-shrink (default)
  // still lets it shrink below the cap if the real page has less room
  // than assumed here, so this can never push content onto a 2nd page.
  const GRID_GAP_PX = 4;
  grid.style.maxHeight = `${Math.round(SeatingModule.rows * deskSize + GRID_GAP_PX * (SeatingModule.rows - 1))}px`;

  for (let r = 0; r < SeatingModule.rows; r++) {
    for (let c = 0; c < SeatingModule.cols; c++) {
      const active = SeatingModule.isActive(r, c);
      const studentId = active ? SeatingModule.studentAt(r, c) : null;
      const student = studentId ? RosterModule.students.find((s) => s.id === studentId) : null;
      const group = active ? SeatingModule.getGroup(r, c) : 0;
      const label = active ? SeatingModule.getLabel(r, c) : "";

      const desk = document.createElement("div");
      desk.className =
        "print-desk" +
        (!active ? " print-desk-inactive" : student ? " print-desk-occupied" : " print-desk-empty");
      if (group) {
        desk.classList.add("print-desk-grouped");
        desk.style.setProperty("--group-hue", String(groupHueDeg(group)));
      }

      if (group) {
        const badge = document.createElement("span");
        badge.className = "print-desk-group-badge";
        badge.textContent = String(group);
        desk.appendChild(badge);
      }

      if (student) {
        if (student.pronunciation) {
          const pronEl = document.createElement("span");
          pronEl.className = "print-desk-pronunciation";
          pronEl.textContent = student.pronunciation;
          desk.appendChild(pronEl);
        }

        const nameEl = document.createElement("span");
        nameEl.className = "print-desk-name";
        if (student.classNumber) {
          const numEl = document.createElement("span");
          numEl.className = "print-desk-classnumber-tag";
          numEl.textContent = `#${student.classNumber} `;
          nameEl.appendChild(numEl);
        }
        const nameTextEl = document.createElement("span");
        nameTextEl.textContent = student.name || "";
        nameEl.appendChild(nameTextEl);
        desk.appendChild(nameEl);

        if (student.schoolId) {
          const idEl = document.createElement("span");
          idEl.className = "print-desk-schoolid";
          idEl.textContent = student.schoolId;
          desk.appendChild(idEl);
        }
      } else if (label) {
        const labelEl = document.createElement("span");
        labelEl.className = "print-desk-name";
        labelEl.textContent = label;
        desk.appendChild(labelEl);
      }

      grid.appendChild(desk);
    }
  }
  sheet.appendChild(grid);

  const frontLabel = document.createElement("p");
  frontLabel.className = "seating-print-front-label";
  frontLabel.textContent = "Front of Classroom";
  sheet.appendChild(frontLabel);

  // Sections 3-8 (below "Front of Classroom").
  const bottomRow = buildSeatingPrintBottom(course);
  if (bottomRow) sheet.appendChild(bottomRow);

  return sheet;
}

/** One labeled, blank fill-in rectangle (~10:1 width:height) for the seating print sheet's bottom row — left blank for handwriting. */
function buildSeatingPrintBox(label) {
  const box = document.createElement("div");
  box.className = "seating-print-box";

  const labelEl = document.createElement("span");
  labelEl.className = "seating-print-box-label";
  labelEl.textContent = label;
  box.appendChild(labelEl);

  return box;
}

/** Bottom-right box: course name + period, pre-filled (unlike the other three, which are left blank for handwriting). */
function buildSeatingPrintCourseBox(courseName, course) {
  const box = document.createElement("div");
  box.className = "seating-print-box seating-print-box-right";

  const labelEl = document.createElement("span");
  labelEl.className = "seating-print-box-label";
  labelEl.textContent = "Course";
  box.appendChild(labelEl);

  const content = document.createElement("div");
  content.className = "seating-print-box-content";
  const nameP = document.createElement("p");
  nameP.textContent = courseName;
  content.appendChild(nameP);
  // Day + period name and the period's time go on separate lines, under the course name.
  const periodRec = course && course.periodId ? PeriodsModule.find(course.periodId) : null;
  const schedName = CoursesModule.scheduleName(course);
  if (schedName) {
    const periodP = document.createElement("p");
    periodP.textContent = schedName;
    content.appendChild(periodP);
    const time = periodRec
      ? (periodRec.startTime && periodRec.endTime ? `${periodRec.startTime}–${periodRec.endTime}` : periodRec.startTime || periodRec.endTime || "")
      : "";
    if (time) {
      const timeP = document.createElement("p");
      timeP.textContent = time;
      content.appendChild(timeP);
    }
  }
  box.appendChild(content);

  return box;
}

/**
 * Builds one desk. States:
 *  - inactive: no desk here yet. Click activates it (and seats the
 *    selected student in the same click, if one is selected).
 *  - active + empty, nothing selected: click deactivates it again.
 *  - active + empty, student selected: click seats them.
 *  - active + occupied: click unseats (unless locked — unlock first).
 * Group number (text input) and label (button, opens a prompt) are
 * available on any active desk, regardless of occupancy.
 */
function buildDeskElement(r, c) {
  const active = SeatingModule.isActive(r, c);
  const studentId = SeatingModule.studentAt(r, c);
  const student = studentId ? RosterModule.students.find((s) => s.id === studentId) : null;
  const locked = SeatingModule.isLocked(r, c);
  const group = SeatingModule.getGroup(r, c);
  const label = SeatingModule.getLabel(r, c);

  const desk = document.createElement("div");
  desk.className =
    "desk" +
    (!active ? " desk-inactive" : student ? " desk-occupied" : " desk-empty") +
    (locked ? " desk-locked" : "") +
    (group ? " desk-grouped" : "");
  if (group) desk.style.setProperty("--group-hue", String(groupHueDeg(group)));

  desk.title = !active
    ? ""
    : student
    ? locked
      ? `${student.name} — locked (click the lock icon to unlock before removing)`
      : `${student.name} — click to remove`
    : label
    ? `${label} — select a student to seat here`
    : selectedStudentId
    ? "Click to seat the selected student here"
    : "Select a student, then click here to seat them (use Set Up Desks to add or remove desks)";

  const nameEl = document.createElement("span");
  nameEl.className = "desk-name";
  if (active && student) {
    if (student.classNumber) {
      const numEl = document.createElement("span");
      numEl.className = "desk-classnumber-tag";
      numEl.textContent = `#${student.classNumber}`;
      nameEl.appendChild(numEl);
    }
    if (student.pronunciation) {
      const pronEl = document.createElement("span");
      pronEl.className = "desk-pronunciation-tag";
      pronEl.textContent = student.pronunciation;
      nameEl.appendChild(pronEl);
    }
    const textEl = document.createElement("span");
    textEl.className = "desk-student-name";
    textEl.textContent = student.name || "(unnamed)";
    nameEl.appendChild(textEl);
    if (student.schoolId) {
      const idEl = document.createElement("span");
      idEl.className = "desk-schoolid-tag";
      idEl.textContent = student.schoolId;
      nameEl.appendChild(idEl);
    }
  } else {
    nameEl.textContent = !active ? "" : label ? label : "";
  }
  desk.appendChild(nameEl);

  desk.addEventListener("click", () => {
    if (!active) return; // desks are added and removed with Set Up Desks, not by clicking here
    if (student) {
      if (locked) return; // unlock first
      SeatingModule.unseatAt(r, c);
      renderSeating();
    } else if (selectedStudentId) {
      SeatingModule.seatStudent(r, c, selectedStudentId);
      selectedStudentId = null;
      renderSeating();
    }
  });

  if (student) {
    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "desk-lock-btn";
    lockBtn.classList.add(locked ? "is-locked" : "is-unlocked");
    lockBtn.setAttribute("role", "switch");
    lockBtn.setAttribute("aria-checked", locked ? "true" : "false");
    lockBtn.textContent = locked ? "locked" : "unlocked";
    lockBtn.title = locked ? "Unlock this desk" : "Lock this desk (protects it from Clear Seating and Auto-Fill)";
    lockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      SeatingModule.toggleLock(r, c);
      renderSeating();
    });
    desk.appendChild(lockBtn);
  }

  if (active) {
    const groupInput = document.createElement("input");
    groupInput.type = "text";
    groupInput.inputMode = "numeric";
    groupInput.className = "desk-group-input";
    groupInput.placeholder = "grp";
    groupInput.value = group ? String(group) : "";
    groupInput.title = `Group number (1-${MAX_GROUP}) — colors this desk`;
    groupInput.addEventListener("click", (e) => e.stopPropagation());
    groupInput.addEventListener("change", () => {
      SeatingModule.setGroup(r, c, groupInput.value);
      renderSeating();
    });
    desk.appendChild(groupInput);

    const labelBtn = document.createElement("input");
    labelBtn.type = "text";
    labelBtn.readOnly = true; // a small box that opens the label menu when clicked
    labelBtn.className = "desk-label-box" + (label ? " desk-label-box-active" : "");
    labelBtn.value = "label";
    labelBtn.title = label ? `Label: "${label}" — click to change or clear` : "Add a label to this desk";
    labelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeskLabelMenu(labelBtn, r, c, label);
    });
    desk.appendChild(labelBtn);
  }

  return desk;
}

/** Pop-up menu on a desk's label button: pick from the label bank, type a custom one, or remove the current label. */
function closeDeskLabelMenu() {
  const old = document.getElementById("desk-label-menu");
  if (old) old.remove();
}

function openDeskLabelMenu(anchor, r, c, current) {
  closeDeskLabelMenu();
  const menu = document.createElement("div");
  menu.id = "desk-label-menu";
  menu.className = "desk-label-menu";

  const choose = (text) => {
    SeatingModule.setLabel(r, c, text);
    closeDeskLabelMenu();
    renderSeating();
  };
  const addItem = (text, onClick, extraClass) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "desk-label-menu-item" + (extraClass ? " " + extraClass : "");
    b.textContent = text;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onClick();
    });
    menu.appendChild(b);
    return b;
  };

  if (SeatingModule.labelBank.length === 0) {
    const hint = document.createElement("div");
    hint.className = "desk-label-menu-hint";
    hint.textContent = "No labels in the bank yet — add some in Seating Settings below.";
    menu.appendChild(hint);
  }
  SeatingModule.labelBank.forEach((text) => {
    addItem(text, () => choose(text), text === current ? "desk-label-menu-active" : "");
  });
  addItem("Custom…", () => {
    closeDeskLabelMenu();
    const next = prompt("Desk label (e.g. \"do not sit here\"). Leave blank to remove.", current);
    if (next === null) return;
    SeatingModule.setLabel(r, c, next);
    renderSeating();
  }, "desk-label-menu-custom");
  if (current) addItem("Remove label", () => choose(""), "desk-label-menu-remove");

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(rect.right - mw, window.innerWidth - mw - 8)) + "px";
  menu.style.top = (rect.bottom + mh + 8 > window.innerHeight ? Math.max(8, rect.top - mh - 4) : rect.bottom + 4) + "px";
}

document.addEventListener("click", (ev) => {
  const menu = document.getElementById("desk-label-menu");
  if (menu && !menu.contains(ev.target)) closeDeskLabelMenu();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeDeskLabelMenu();
});

// ----- Seating Settings: the label bank -----
let seatingSettingsEditing = false;

el.toggleSeatingSettingsBtn = document.getElementById("toggle-seating-settings-btn");
el.seatingSettingsBody = document.getElementById("seating-settings-body");
el.toggleSeatingSettingsBtn.addEventListener("click", () => {
  seatingSettingsEditing = !seatingSettingsEditing;
  el.toggleSeatingSettingsBtn.textContent = seatingSettingsEditing ? "Done Editing" : "Edit Settings";
  renderSeatingSettings();
});

function renderSeatingSettings() {
  const body = el.seatingSettingsBody;
  body.innerHTML = "";
  if (!seatingSettingsEditing) return; // the label bank and printout layout only show while Settings is open
  if (window.buildSeatingPrintSchematic) body.appendChild(window.buildSeatingPrintSchematic());
  const heading = document.createElement("h4");
  heading.textContent = "Label bank";
  body.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Labels you can put on a desk: click a desk's 🏷 button, then choose one. Labelled desks are skipped by Auto-Fill.";
  body.appendChild(hint);

  const list = document.createElement("ul");
  list.className = "label-bank-list";
  SeatingModule.labelBank.forEach((text, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = text;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn btn-ghost btn-small";
    rm.textContent = "×";
    rm.title = "Remove from the bank (desks already using it keep their label)";
    rm.addEventListener("click", () => {
      SeatingModule.removeBankLabel(i);
      renderSeatingSettings();
    });
    li.append(span, rm);
    list.appendChild(li);
  });
  body.appendChild(list);

  const addRow = document.createElement("div");
  addRow.className = "label-bank-add";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "New label, e.g. Do not sit here";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-ghost btn-small";
  addBtn.textContent = "+ Add label";
  const add = () => {
    if (SeatingModule.addBankLabel(input.value)) renderSeatingSettings();
    else input.focus();
  };
  addBtn.addEventListener("click", add);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });
  addRow.append(input, addBtn);
  body.appendChild(addRow);
}

function renderBanks() {
  el.banksList.innerHTML = "";

  SeatingModule.banks.forEach((bank, index) => {
    const isEmpty = !bank.snapshot;

    const card = document.createElement("div");
    card.className = "bank-card";

    const label = document.createElement("div");
    label.className = "bank-label";
    label.textContent = bank.name;
    card.appendChild(label);

    const status = document.createElement("div");
    status.className = "bank-status";
    status.textContent = isEmpty
      ? "Empty"
      : `Saved ${new Date(bank.snapshot.savedAt).toLocaleString()}`;
    card.appendChild(status);

    const buttonRow = document.createElement("div");
    buttonRow.className = "bank-buttons";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-ghost btn-small";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      if (!isEmpty && !confirm(`Overwrite "${bank.name}" with the current arrangement?`)) return;
      try {
        await SeatingModule.saveBank(index);
        el.seatingStatus.textContent = `Saved to "${bank.name}" — click Save Seating Chart to store it.`;
        renderBanks();
      } catch (err) {
        el.seatingStatus.textContent = `Couldn't save: ${err.message}`;
      }
    });
    buttonRow.appendChild(saveBtn);

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "btn btn-ghost btn-small";
    loadBtn.textContent = "Load";
    loadBtn.disabled = isEmpty;
    loadBtn.addEventListener("click", async () => {
      if (!confirm(`Load "${bank.name}"? This replaces your current seating arrangement (including grid size).`)) return;
      try {
        await SeatingModule.loadBank(index);
        selectedStudentId = null;
        renderSeating();
        el.seatingStatus.textContent = `Loaded "${bank.name}" ✓`;
      } catch (err) {
        el.seatingStatus.textContent = `Couldn't load: ${err.message}`;
      }
    });
    buttonRow.appendChild(loadBtn);

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn btn-ghost btn-small";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", async () => {
      const next = prompt("Name this memory bank:", bank.name);
      if (next === null) return;
      try {
        await SeatingModule.renameBank(index, next);
        renderBanks();
        el.seatingStatus.textContent = "";
      } catch (err) {
        el.seatingStatus.textContent = `Couldn't rename: ${err.message}`;
      }
    });
    buttonRow.appendChild(renameBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-ghost btn-small";
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = isEmpty;
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Delete the saved arrangement in "${bank.name}"? This can't be undone.`)) return;
      try {
        await SeatingModule.deleteBank(index);
        el.seatingStatus.textContent = `"${bank.name}" cleared.`;
        renderBanks();
      } catch (err) {
        el.seatingStatus.textContent = `Couldn't delete: ${err.message}`;
      }
    });
    buttonRow.appendChild(deleteBtn);

    card.appendChild(buttonRow);
    el.banksList.appendChild(card);
  });
}

el.applyGridSizeBtn.addEventListener("click", () => {
  SeatingModule.setSize(Number(el.gridRows.value), Number(el.gridCols.value));
  renderSeating();
});

el.trimEmptyBtn.addEventListener("click", () => {
  const trimmed = SeatingModule.trimEmptyRowsAndColumns();
  if (!trimmed) {
    el.seatingStatus.textContent = "Nothing to trim — every row and column already has at least one desk.";
    return;
  }
  selectedStudentId = null;
  renderSeating();
  el.seatingStatus.textContent = `Trimmed to ${SeatingModule.rows}×${SeatingModule.cols}.`;
});

el.autoFillBtn.addEventListener("click", () => {
  const seatedIds = SeatingModule.seatedStudentIds();
  const unseatedIds = RosterModule.students
    .filter((s) => !seatedIds.has(s.id) && !s.excludeFromSeating)
    .map((s) => s.id);
  SeatingModule.autoFill(unseatedIds);
  selectedStudentId = null;
  renderSeating();
});

el.autoFillNumericalBtn.addEventListener("click", () => {
  const seatedIds = SeatingModule.seatedStudentIds();
  const unseatedStudents = RosterModule.students.filter((s) => !seatedIds.has(s.id) && !s.excludeFromSeating);
  SeatingModule.autoFillNumericalOrder(unseatedStudents);
  selectedStudentId = null;
  renderSeating();
});

el.clearSeatingBtn.addEventListener("click", () => {
  if (!confirm("Remove every unlocked student from the seating chart? Locked desks and group colors are unaffected.")) return;
  SeatingModule.clear();
  selectedStudentId = null;
  renderSeating();
});

el.popoutBtn.addEventListener("click", () => {
  window.open("popout.html", "ggo-seating-popout", "width=900,height=700");
});

el.togglePopoutGroupsBtn.addEventListener("click", () => {
  SeatingModule.toggleShowGroupsInPopout();
  el.togglePopoutGroupsBtn.textContent = SeatingModule.showGroupsInPopout
    ? "Hide Group Colors in Pop-Out"
    : "Show Group Colors in Pop-Out";
});

el.printSeatingBtn.addEventListener("click", () => {
  el.printArea.innerHTML = "";
  el.printArea.appendChild(buildSeatingPrintSheet());
  const course = CoursesModule.find(RosterModule.currentCourseId);
  printSeatingChart(course ? course.name : "Seating Chart");
});

/**
 * Runs window.print() with the document title set to the course name.
 * Two effects: it replaces "GradingGridOnline" in the browser's print
 * header with the course name, and — more importantly — browsers use
 * document.title as the suggested file name when the print
 * destination is "Save as PDF". Restored after printing via the
 * afterprint event.
 *
 * Note: this can't remove the URL/date/page-number in the browser's
 * header/footer — that's controlled by the "Headers and footers"
 * checkbox in the print dialog itself, which no page can turn off.
 */
function printSeatingChart(titleForPrint) {
  const originalTitle = document.title;
  document.title = titleForPrint || originalTitle;
  const restore = () => {
    document.title = originalTitle;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

el.saveSeatingBtn.addEventListener("click", async () => {
  el.seatingStatus.textContent = "Saving…";
  try {
    await SeatingModule.save();
    el.seatingStatus.textContent = "Saved to Google Drive ✓";
  } catch (err) {
    el.seatingStatus.textContent = `Save failed: ${err.message}`;
  }
});

// ===== Attendance =====

el.saveAttendanceBtn.addEventListener("click", async () => {
  el.attendanceStatus.textContent = "Saving…";
  try {
    await AttendanceModule.save();
    el.attendanceStatus.textContent = "Saved to Google Drive ✓";
  } catch (err) {
    el.attendanceStatus.textContent = `Save failed: ${err.message}`;
  }
});

function renderAttendance() {
  el.attendanceTable.innerHTML = "";

  const thead = document.createElement("thead");
  thead.appendChild(buildAttendanceHeaderRow());
  el.attendanceTable.appendChild(thead);

  const tbody = document.createElement("tbody");
  RosterModule.students.forEach((student) => {
    tbody.appendChild(buildAttendanceStudentRow(student));
  });
  el.attendanceTable.appendChild(tbody);

  const tfoot = document.createElement("tfoot");
  tfoot.appendChild(buildAttendanceFooterRow());
  el.attendanceTable.appendChild(tfoot);

  renderAttendanceSeatingView();
  renderAttendanceSettings();
}

function buildAttendanceHeaderRow() {
  const tr = document.createElement("tr");

  ["Student", "Notes", "Score"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    tr.appendChild(th);
  });

  ["Attended", "Absences"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    tr.appendChild(th);
  });

  AttendanceModule.sessions.forEach((session) => {
    const th = document.createElement("th");
    th.className = "session-header-cell";

    const numberEl = document.createElement("div");
    numberEl.className = "session-number";
    numberEl.textContent = session.number;

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "session-date-input";
    dateInput.value = session.date || "";
    dateInput.addEventListener("change", async () => {
      AttendanceModule.setSessionDate(session.id, dateInput.value);
      await saveAttendanceThen();
    });

    const presentBtn = document.createElement("button");
    presentBtn.type = "button";
    presentBtn.className = "session-present-btn";
    presentBtn.textContent = "P";
    presentBtn.title = "Mark everyone present for this class";
    presentBtn.addEventListener("click", async () => {
      AttendanceModule.markAllPresent(session.id, RosterModule.students.map((s) => s.id));
      await saveAttendanceThen(renderAttendance);
    });

    const inner = document.createElement("div");
    inner.className = "session-header-inner";
    inner.append(numberEl, dateInput, presentBtn);
    th.appendChild(inner);
    tr.appendChild(th);
  });

  return tr;
}

function buildAttendanceStudentRow(student) {
  const tr = document.createElement("tr");
  tr.dataset.studentId = student.id;

  // ----- Student info: pronunciation above, name + school ID in one row -----
  const infoTd = document.createElement("td");
  infoTd.className = "attendance-student-cell";
  if (student.pronunciation) {
    const pron = document.createElement("div");
    pron.className = "attendance-pronunciation";
    pron.textContent = student.pronunciation;
    infoTd.appendChild(pron);
  }
  const nameRow = document.createElement("div");
  nameRow.className = "attendance-name-row";
  if (student.classNumber) {
    const numSpan = document.createElement("span");
    numSpan.className = "attendance-classnumber";
    numSpan.textContent = `#${student.classNumber}`;
    nameRow.appendChild(numSpan);
  }
  const nameSpan = document.createElement("span");
  nameSpan.className = "attendance-name";
  nameSpan.textContent = student.name || "(unnamed)";
  nameRow.appendChild(nameSpan);
  if (student.schoolId) {
    const idSpan = document.createElement("span");
    idSpan.className = "attendance-schoolid";
    idSpan.textContent = student.schoolId;
    nameRow.appendChild(idSpan);
  }
  infoTd.appendChild(nameRow);
  tr.appendChild(infoTd);

  // ----- Notes (general, ongoing) -----
  const notesTd = document.createElement("td");
  const notesInput = document.createElement("input");
  notesInput.type = "text";
  notesInput.className = "attendance-notes-input";
  notesInput.placeholder = "Notes…";
  notesInput.value = AttendanceModule.getNote(student.id);
  notesInput.addEventListener("change", async () => {
    AttendanceModule.setNote(student.id, notesInput.value);
    await saveAttendanceThen();
  });
  notesTd.appendChild(notesInput);

  const excludeRow = document.createElement("div");
  excludeRow.className = "exclude-toggle-row";

  const excludeSeatingBtn = document.createElement("button");
  excludeSeatingBtn.type = "button";
  excludeSeatingBtn.className =
    "exclude-toggle-btn" + (student.excludeFromSeating ? " exclude-toggle-btn-active" : "");
  excludeSeatingBtn.textContent = "Seating";
  excludeSeatingBtn.title = student.excludeFromSeating
    ? "Excluded from the seating chart — click to include again"
    : "Click to exclude this student from the seating chart";
  excludeSeatingBtn.addEventListener("click", () => {
    RosterModule.toggleExcludeFromSeating(student.id);
    if (student.excludeFromSeating) {
      SeatingModule.parkStudent(student.id); // remembers the desk, so including them again restores it
    } else {
      SeatingModule.restoreStudent(student.id);
    }
    renderAttendance();
  });
  excludeRow.appendChild(excludeSeatingBtn);

  const excludeScoringBtn = document.createElement("button");
  excludeScoringBtn.type = "button";
  excludeScoringBtn.className =
    "exclude-toggle-btn" + (student.excludeFromScoring ? " exclude-toggle-btn-active" : "");
  excludeScoringBtn.textContent = "Scoring";
  excludeScoringBtn.title = student.excludeFromScoring
    ? "Excluded from scoring (once built) — click to include again"
    : "Click to exclude this student from the scoring system (once built)";
  excludeScoringBtn.addEventListener("click", () => {
    RosterModule.toggleExcludeFromScoring(student.id);
    renderAttendance();
  });
  excludeRow.appendChild(excludeScoringBtn);

  notesTd.appendChild(excludeRow);
  tr.appendChild(notesTd);

  // ----- Score / Attended / Absences -----
  appendAttendanceStatCells(tr, student.id);

  // ----- One cell per class session -----
  AttendanceModule.sessions.forEach((session) => {
    const td = document.createElement("td");
    td.className = "attendance-session-cell";
    td.append(...buildAttendanceRecordControls(student, session));
    tr.appendChild(td);
  });

  return tr;
}

/** The three recording controls (code, infraction, memo) for one student in one class — shared by the Table and the Seating Grid. */
function buildAttendanceRecordControls(student, session) {
  const record = AttendanceModule.getRecord(student.id, session.id);

  const codeSelect = document.createElement("select");
  codeSelect.className = "attendance-code-select";
  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "—";
  codeSelect.appendChild(blankOpt);
  AttendanceModule.settings.participationTypes.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    if (type === record.code) opt.selected = true;
    codeSelect.appendChild(opt);
  });
  applyAttendanceCodeColor(codeSelect, record.code);
  codeSelect.addEventListener("change", async () => {
    AttendanceModule.setRecord(student.id, session.id, { code: codeSelect.value });
    applyAttendanceCodeColor(codeSelect, codeSelect.value);
    await saveAttendanceThen();
    refreshAttendanceStatsRow(student.id);
  });

  // One dropdown per infraction: choosing one makes another appear below it, and so on.
  const infractionStack = document.createElement("div");
  infractionStack.className = "attendance-infraction-stack";
  const drawInfractions = () => {
    infractionStack.textContent = "";
    const list = AttendanceModule.infractionsOf(AttendanceModule.getRecord(student.id, session.id));
    const slots = list.length >= 12 ? list.length : list.length + 1;
    for (let i = 0; i < slots; i++) {
      const sel = document.createElement("select");
      sel.className = "attendance-infraction-select";
      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = i === 0 ? "No infraction" : i < list.length ? "Remove this infraction" : "Add another infraction";
      sel.appendChild(noneOpt);
      AttendanceModule.settings.infractionOptions.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (opt === list[i]) o.selected = true;
        sel.appendChild(o);
      });
      applyInfractionColor(sel, list[i]);
      sel.addEventListener("change", async () => {
        AttendanceModule.setInfractionAt(student.id, session.id, i, sel.value);
        drawInfractions();
        await saveAttendanceThen();
        refreshAttendanceStatsRow(student.id);
      });
      infractionStack.appendChild(sel);
    }
  };
  drawInfractions();

  const memoInput = document.createElement("input");
  memoInput.type = "text";
  memoInput.className = "attendance-memo-input";
  memoInput.placeholder = "Memo";
  memoInput.value = record.memo || "";
  memoInput.addEventListener("change", async () => {
    AttendanceModule.setRecord(student.id, session.id, { memo: memoInput.value });
    await saveAttendanceThen();
  });

  return [codeSelect, infractionStack, memoInput];
}

// Highlight colours are chosen by palette name; the shade itself comes from the current theme (the .att-hl-* rules in css/grid.css).
const ATTENDANCE_PALETTE = [
  ["red", "Red"],
  ["orange", "Orange"],
  ["yellow", "Yellow"],
  ["green", "Green"],
  ["teal", "Teal"],
  ["blue", "Blue"],
  ["purple", "Purple"],
  ["pink", "Pink"],
  ["gray", "Gray"],
];

function applyHighlightClass(node, colorName) {
  ATTENDANCE_PALETTE.forEach(([id]) => node.classList.remove(`att-hl-${id}`));
  if (colorName) node.classList.add(`att-hl-${colorName}`);
}

function applyAttendanceCodeColor(select, code) {
  applyHighlightClass(select, (AttendanceModule.settings.codeColors || {})[code]);
}

function applyInfractionColor(select, infraction) {
  applyHighlightClass(select, (AttendanceModule.settings.infractionColors || {})[infraction]);
}

/** Orange at the configured absence limit, red beyond it, default color under it. */
function absenceCellColor(absences) {
  const limit = AttendanceModule.settings.absenceLimit;
  if (!limit || limit <= 0) return "";
  if (absences > limit) return "#e57373"; // red
  if (absences === limit) return "#ffb74d"; // orange
  return "";
}

function formatAttendanceScore(stats) {
  return stats.points === null ? "—" : String(stats.points);
}

function appendAttendanceStatCells(tr, studentId) {
  const stats = AttendanceModule.stats(studentId);

  const scoreTd = document.createElement("td");
  scoreTd.className = "attendance-stat-cell attendance-score-cell";
  scoreTd.textContent = formatAttendanceScore(stats);
  tr.appendChild(scoreTd);

  const attendedTd = document.createElement("td");
  attendedTd.className = "attendance-stat-cell";
  attendedTd.textContent = stats.attended;
  tr.appendChild(attendedTd);

  const absencesTd = document.createElement("td");
  absencesTd.className = "attendance-stat-cell";
  absencesTd.textContent = stats.absences;
  absencesTd.style.backgroundColor = absenceCellColor(stats.absences);
  tr.appendChild(absencesTd);
}

/** Updates just one student's Score/Attended/Absences cells, without rebuilding the whole table. */
function refreshAttendanceStatsRow(studentId) {
  const row = el.attendanceTable.querySelector(`tr[data-student-id="${studentId}"]`);
  if (!row) return;
  const stats = AttendanceModule.stats(studentId);
  const statCells = row.querySelectorAll(".attendance-stat-cell");
  if (statCells.length === 3) {
    statCells[0].textContent = formatAttendanceScore(stats);
    statCells[1].textContent = stats.attended;
    statCells[2].textContent = stats.absences;
    statCells[2].style.backgroundColor = absenceCellColor(stats.absences);
  }
}

/** Applies a local change's follow-up UI update (e.g. a re-render). Persistence to Google Drive happens only via the explicit "Save Attendance" button — kept as a function (rather than inlining every call site) so that button is the one place that actually saves. */
function saveAttendanceThen(after) {
  if (after) after();
}

// ----- Attendance: Seating Grid view (alternate way to record attendance) -----

let attendanceView = "table"; // "table" | "seating"
let attendanceSeatingSessionId = null;

function setAttendanceView(view) {
  attendanceView = view;
  const seating = view === "seating";
  document.getElementById("attendance-seating-view").hidden = !seating;
  document.getElementById("attendance-table-wrap").hidden = seating;
  const tb = document.getElementById("att-view-table-btn");
  const sb = document.getElementById("att-view-seating-btn");
  tb.classList.toggle("btn-primary", !seating);
  tb.classList.toggle("btn-ghost", seating);
  sb.classList.toggle("btn-primary", seating);
  sb.classList.toggle("btn-ghost", !seating);
  renderAttendance(); // both views read the same records, so re-render to show the latest
}

document.getElementById("att-view-table-btn").addEventListener("click", () => setAttendanceView("table"));
document.getElementById("att-view-seating-btn").addEventListener("click", () => setAttendanceView("seating"));

document.getElementById("att-seating-session").addEventListener("change", (e) => {
  attendanceSeatingSessionId = e.target.value;
  renderAttendanceSeatingView();
});

document.getElementById("att-seating-date").addEventListener("change", (e) => {
  if (!attendanceSeatingSessionId) return;
  AttendanceModule.setSessionDate(attendanceSeatingSessionId, e.target.value);
  renderAttendance(); // keeps the Table's date box and the Class list in step
});

document.getElementById("att-seating-export-btn").addEventListener("click", () => {
  const session = AttendanceModule.sessions.find((x) => x.id === attendanceSeatingSessionId);
  if (session) exportAttendanceSession(session);
});

document.getElementById("att-seating-present-btn").addEventListener("click", () => {
  if (!attendanceSeatingSessionId) return;
  AttendanceModule.markAllPresent(attendanceSeatingSessionId, RosterModule.students.map((s) => s.id));
  renderAttendance();
});

/** Which class the grid opens on: the first class with nothing recorded yet (the next one to take), else the last class. */
function defaultAttendanceSeatingSession() {
  const sessions = AttendanceModule.sessions;
  if (sessions.length === 0) return null;
  const empty = sessions.find((sess) =>
    RosterModule.students.every((st) => {
      const rec = AttendanceModule.getRecord(st.id, sess.id);
      return !rec.code && AttendanceModule.infractionsOf(rec).length === 0 && !rec.memo;
    })
  );
  return (empty || sessions[sessions.length - 1]).id;
}

/** One student's card: class #, pronunciation, name, school ID, plus the three recording controls for the chosen class. */
function buildAttendanceSeatCard(student, session) {
  const card = document.createElement("div");
  card.className = "att-seat-card";
  card.dataset.studentId = student.id;

  const top = document.createElement("div");
  top.className = "att-seat-top";
  if (student.classNumber) {
    const num = document.createElement("span");
    num.className = "att-seat-number";
    num.textContent = `#${student.classNumber}`;
    top.appendChild(num);
  }
  const info = document.createElement("div");
  info.className = "att-seat-info";
  if (student.pronunciation) {
    const pron = document.createElement("div");
    pron.className = "att-seat-pron";
    pron.textContent = student.pronunciation;
    info.appendChild(pron);
  }
  const name = document.createElement("div");
  name.className = "att-seat-name";
  name.textContent = student.name || "(unnamed)";
  info.appendChild(name);
  if (student.schoolId) {
    const sid = document.createElement("div");
    sid.className = "att-seat-id";
    sid.textContent = student.schoolId;
    info.appendChild(sid);
  }
  top.appendChild(info);
  card.appendChild(top);

  const controls = buildAttendanceRecordControls(student, session);
  // Keep the Score / Attended / Absences numbers in the (hidden) table current too.
  controls.forEach((c) => c.addEventListener("change", () => refreshAttendanceStatsRow(student.id)));
  controls.forEach((c) => card.appendChild(c));
  return card;
}

function renderAttendanceSeatingView() {
  const grid = document.getElementById("attendance-seating-grid");
  const unseatedBox = document.getElementById("attendance-seating-unseated");
  const sessionSelect = document.getElementById("att-seating-session");
  if (!grid || attendanceView !== "seating") return;

  // Class picker
  const sessions = AttendanceModule.sessions;
  if (!sessions.some((x) => x.id === attendanceSeatingSessionId)) {
    attendanceSeatingSessionId = defaultAttendanceSeatingSession();
  }
  sessionSelect.innerHTML = "";
  sessions.forEach((sess) => {
    const opt = document.createElement("option");
    opt.value = sess.id;
    opt.textContent = `Class ${sess.number}${sess.date ? " — " + sess.date : ""}`;
    if (sess.id === attendanceSeatingSessionId) opt.selected = true;
    sessionSelect.appendChild(opt);
  });
  grid.innerHTML = "";
  unseatedBox.innerHTML = "";
  const session = sessions.find((x) => x.id === attendanceSeatingSessionId);
  const dateInput = document.getElementById("att-seating-date");
  dateInput.value = (session && session.date) || "";
  dateInput.disabled = !session;
  if (!session) {
    grid.textContent = "No classes yet — set the number of classes in Attendance Settings.";
    return;
  }

  // Desk grid, same layout as the Seating Chart tab
  grid.style.gridTemplateColumns = `repeat(${SeatingModule.cols}, minmax(170px, 1fr))`;
  for (let r = 0; r < SeatingModule.rows; r++) {
    for (let c = 0; c < SeatingModule.cols; c++) {
      if (!SeatingModule.isActive(r, c)) {
        const gap = document.createElement("div");
        gap.className = "att-seat-gap";
        grid.appendChild(gap);
        continue;
      }
      const studentId = SeatingModule.studentAt(r, c);
      const student = studentId ? RosterModule.students.find((s) => s.id === studentId) : null;
      if (student) {
        grid.appendChild(buildAttendanceSeatCard(student, session));
      } else {
        const empty = document.createElement("div");
        empty.className = "att-seat-card att-seat-empty";
        empty.textContent = "empty desk";
        grid.appendChild(empty);
      }
    }
  }

  // Anyone not at a desk still needs marking
  const seatedIds = SeatingModule.seatedStudentIds();
  const unseated = RosterModule.students.filter((s) => !seatedIds.has(s.id));
  if (unseated.length > 0) {
    const heading = document.createElement("h4");
    heading.textContent = "Not seated";
    unseatedBox.appendChild(heading);
    const row = document.createElement("div");
    row.className = "att-seat-unseated-row";
    unseated.forEach((st) => row.appendChild(buildAttendanceSeatCard(st, session)));
    unseatedBox.appendChild(row);
  }
}

el.toggleAttendanceSettingsBtn.addEventListener("click", () => {
  attendanceSettingsEditing = !attendanceSettingsEditing;
  el.toggleAttendanceSettingsBtn.textContent = attendanceSettingsEditing ? "Done Editing" : "Edit Settings";
  renderAttendanceSettings();
});

function renderAttendanceSettings() {
  el.attendanceSettingsBody.innerHTML = "";

  if (!attendanceSettingsEditing) {
    const lines = [
      `Classes in term: ${AttendanceModule.settings.termClassCount}`,
      `Participation types (points · attended · absent): ${AttendanceModule.settings.participationTypes
        .map(
          (t) =>
            `${t} (${AttendanceModule.settings.points[t]} · ${AttendanceModule.settings.participationCounts[t] ?? "1"} · ${AttendanceModule.settings.absenceCounts[t] ?? "0"})`
        )
        .join(", ")}`,
      `Infractions: ${AttendanceModule.settings.infractionOptions
        .map((o) => `${o} (${AttendanceModule.settings.infractionPoints[o]})`)
        .join(", ") || "(none)"}`,
    ];
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = line;
      el.attendanceSettingsBody.appendChild(p);
    });
    return;
  }

  // ----- Edit mode: number of classes in term -----
  const termWrap = document.createElement("div");
  termWrap.className = "attendance-settings-block";
  const termLabel = document.createElement("h4");
  termLabel.textContent = "Number of classes in this term";
  termWrap.appendChild(termLabel);

  const termRow = document.createElement("div");
  termRow.className = "mapping-row";
  const termInput = document.createElement("input");
  termInput.type = "text";
  termInput.inputMode = "numeric";
  termInput.value = AttendanceModule.settings.termClassCount;
  termInput.addEventListener("change", async () => {
    AttendanceModule.setTermClassCount(termInput.value);
    await saveAttendanceThen(renderAttendance);
  });
  const termHint = document.createElement("label");
  termHint.textContent = "Sets how many class-session columns appear in the table.";
  termRow.append(termInput, termHint);
  termWrap.appendChild(termRow);
  el.attendanceSettingsBody.appendChild(termWrap);

  // ----- Edit mode: absence color limit -----
  const limitWrap = document.createElement("div");
  limitWrap.className = "attendance-settings-block";
  const limitLabel = document.createElement("h4");
  limitLabel.textContent = "Absence warning limit";
  limitWrap.appendChild(limitLabel);

  const limitRow = document.createElement("div");
  limitRow.className = "mapping-row";
  const limitInput = document.createElement("input");
  limitInput.type = "text";
  limitInput.inputMode = "numeric";
  limitInput.value = AttendanceModule.settings.absenceLimit || "";
  limitInput.placeholder = "(none)";
  limitInput.addEventListener("change", async () => {
    AttendanceModule.setAbsenceLimit(limitInput.value);
    await saveAttendanceThen(renderAttendance);
  });
  const limitHint = document.createElement("label");
  limitHint.textContent = "At this many absences the count turns orange; beyond it, red. Leave blank to disable.";
  limitRow.append(limitInput, limitHint);
  limitWrap.appendChild(limitRow);
  el.attendanceSettingsBody.appendChild(limitWrap);

  // ----- Edit mode: participation types -----
  el.attendanceSettingsBody.appendChild(
    buildEditableTypeList({
      title: "Participation types",
      hint: 'Points count toward the attendance score. "Attended" and "Absent" say how much of a class (or absence) each type counts as in the Attended and Absences totals — whole numbers, decimals, or fractions all work (e.g. Late: attended 1/2; Very late: absent 1/3).',
      items: AttendanceModule.settings.participationTypes,
      points: AttendanceModule.settings.points,
      extraColumns: [
        {
          label: "Attended",
          title: "How much of a class this counts as toward Attended (e.g. 1, 0.5, 1/2)",
          getValue: (item) => AttendanceModule.settings.participationCounts[item] ?? "1",
          onChange: async (item, value) => {
            try {
              AttendanceModule.setParticipationCount(item, value);
            } catch (err) {
              alert(err.message);
            }
            await saveAttendanceThen(renderAttendance);
          },
        },
        {
          label: "Absent",
          title: "How much of an absence this counts as toward Absences (e.g. 0, 1, 1/3)",
          getValue: (item) => AttendanceModule.settings.absenceCounts[item] ?? "0",
          onChange: async (item, value) => {
            try {
              AttendanceModule.setAbsenceCount(item, value);
            } catch (err) {
              alert(err.message);
            }
            await saveAttendanceThen(renderAttendance);
          },
        },
      ],
      fixedItems: ["P", "A"],
      colors: {
        get: (item) => (AttendanceModule.settings.codeColors || {})[item],
        set: async (item, color) => {
          AttendanceModule.setCodeColor(item, color);
          await saveAttendanceThen(renderAttendance);
        },
      },
      addPlaceholder: "New participation type (e.g. Sick)",
      onRename: async (list) => {
        AttendanceModule.setParticipationTypes(list);
        await saveAttendanceThen(renderAttendance);
      },
      onPointChange: async (item, value) => {
        AttendanceModule.setPointValue(item, value);
        await saveAttendanceThen(renderAttendance);
      },
      onRemove: async (item) => {
        AttendanceModule.setParticipationTypes(
          AttendanceModule.settings.participationTypes.filter((t) => t !== item)
        );
        await saveAttendanceThen(renderAttendance);
      },
      onAdd: async (value) => {
        AttendanceModule.setParticipationTypes([...AttendanceModule.settings.participationTypes, value]);
        await saveAttendanceThen(renderAttendance);
      },
    })
  );

  // ----- Edit mode: infractions -----
  el.attendanceSettingsBody.appendChild(
    buildEditableTypeList({
      title: "Infraction options",
      items: AttendanceModule.settings.infractionOptions,
      points: AttendanceModule.settings.infractionPoints,
      fixedItems: [],
      colors: {
        get: (item) => (AttendanceModule.settings.infractionColors || {})[item],
        set: async (item, color) => {
          AttendanceModule.setInfractionColor(item, color);
          await saveAttendanceThen(renderAttendance);
        },
      },
      addPlaceholder: "New infraction option",
      onRename: async (list) => {
        AttendanceModule.setInfractionOptions(list);
        await saveAttendanceThen(renderAttendance);
      },
      onPointChange: async (item, value) => {
        AttendanceModule.setInfractionPointValue(item, value);
        await saveAttendanceThen(renderAttendance);
      },
      onRemove: async (item) => {
        AttendanceModule.setInfractionOptions(
          AttendanceModule.settings.infractionOptions.filter((t) => t !== item)
        );
        await saveAttendanceThen(renderAttendance);
      },
      onAdd: async (value) => {
        AttendanceModule.setInfractionOptions([...AttendanceModule.settings.infractionOptions, value]);
        await saveAttendanceThen(renderAttendance);
      },
    })
  );

  // ----- Edit mode: LMS export template -----
  el.attendanceSettingsBody.appendChild(buildExportTemplateBlock());
}

/**
 * Shared builder for an editable "name + point value + remove" list,
 * used for both participation types and infractions. Items in
 * fixedItems show their name as plain text (no rename, no remove) —
 * only their point value is editable.
 */
function buildEditableTypeList(config) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";

  const heading = document.createElement("h4");
  heading.textContent = config.title;
  wrap.appendChild(heading);

  if (config.hint) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = config.hint;
    wrap.appendChild(hint);
  }

  const list = document.createElement("ul");
  list.className = "infraction-edit-list";

  // Column headings, shown only when there are extra columns to label.
  if (config.extraColumns && config.extraColumns.length > 0) {
    const headerLi = document.createElement("li");
    headerLi.className = "hint";
    const spacer = document.createElement("span");
    spacer.style.flex = "1";
    spacer.style.maxWidth = "260px";
    spacer.textContent = "Type";
    headerLi.appendChild(spacer);
    [{ label: "Points" }, ...config.extraColumns].forEach((col) => {
      const span = document.createElement("span");
      span.style.flex = "0 0 70px";
      span.style.fontSize = "0.75rem";
      span.textContent = col.label;
      if (col.title) span.title = col.title;
      headerLi.appendChild(span);
    });
    list.appendChild(headerLi);
  }

  config.items.forEach((item) => {
    const li = document.createElement("li");
    const isFixed = config.fixedItems.includes(item);

    if (isFixed) {
      const label = document.createElement("span");
      label.className = "fixed-type-label";
      label.textContent = item;
      li.appendChild(label);
    } else {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item;
      nameInput.addEventListener("change", async () => {
        const newList = config.items.map((i) => (i === item ? nameInput.value.trim() : i));
        await config.onRename(newList);
      });
      li.appendChild(nameInput);
    }

    const pointInput = document.createElement("input");
    pointInput.type = "text";
    pointInput.inputMode = "decimal";
    pointInput.className = "point-value-input";
    pointInput.value = config.points[item] ?? 0;
    pointInput.title = "Point value";
    pointInput.addEventListener("change", async () => {
      await config.onPointChange(item, pointInput.value);
    });
    li.appendChild(pointInput);

    (config.extraColumns || []).forEach((col) => {
      const extraInput = document.createElement("input");
      extraInput.type = "text";
      extraInput.inputMode = "decimal";
      extraInput.className = "point-value-input";
      extraInput.value = col.getValue(item);
      extraInput.title = col.title || "";
      extraInput.addEventListener("change", async () => {
        await col.onChange(item, extraInput.value);
      });
      li.appendChild(extraInput);
    });

    if (config.colors) {
      const colorSelect = document.createElement("select");
      colorSelect.className = "attendance-color-select";
      colorSelect.title = "Highlight colour (the shade follows the current theme)";
      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = "No colour";
      colorSelect.appendChild(noneOpt);
      ATTENDANCE_PALETTE.forEach(([id, label]) => {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = label;
        o.className = `att-hl-${id}`;
        colorSelect.appendChild(o);
      });
      colorSelect.value = config.colors.get(item) || "";
      applyHighlightClass(colorSelect, colorSelect.value);
      colorSelect.addEventListener("change", async () => {
        applyHighlightClass(colorSelect, colorSelect.value);
        await config.colors.set(item, colorSelect.value);
      });
      li.appendChild(colorSelect);
    }

    if (!isFixed) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost btn-small";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        await config.onRemove(item);
      });
      li.appendChild(removeBtn);
    }

    list.appendChild(li);
  });
  wrap.appendChild(list);

  const addRow = document.createElement("div");
  addRow.className = "add-course-row";
  const newInput = document.createElement("input");
  newInput.type = "text";
  newInput.placeholder = config.addPlaceholder;
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-primary btn-small";
  addBtn.textContent = "+ Add";
  addBtn.addEventListener("click", async () => {
    const val = newInput.value.trim();
    if (!val) return;
    newInput.value = "";
    await config.onAdd(val);
  });
  addRow.append(newInput, addBtn);
  wrap.appendChild(addRow);

  return wrap;
}

function buildExportTemplateBlock() {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "LMS export template";
  wrap.appendChild(heading);

  const tpl = AttendanceModule.settings.exportTemplate;

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = tpl
    ? `Template loaded: ${tpl.headers.length} columns. Choose what goes in each one below.`
    : "Upload a CSV/Excel file whose first row has your LMS's column headings (any student rows in it are ignored). Then choose what goes in each column.";
  wrap.appendChild(hint);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".csv,.xlsx,.xls";
  fileInput.hidden = true;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (rows.length === 0) throw new Error("That file appears to be empty.");
      const headers = rows[0].map((h) => String(h));
      const dataRows = rows.slice(1);
      AttendanceModule.setExportTemplate(headers, dataRows);
      await saveAttendanceThen(renderAttendance);
    } catch (err) {
      el.attendanceStatus.textContent = `Couldn't read that file: ${err.message}`;
    }
  });
  wrap.appendChild(fileInput);

  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.className = "btn btn-ghost btn-small";
  uploadBtn.textContent = tpl ? "Replace Template" : "Upload Template";
  uploadBtn.addEventListener("click", () => fileInput.click());
  wrap.appendChild(uploadBtn);

  if (!tpl) return wrap;

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn-ghost btn-small";
  clearBtn.textContent = "Remove Template";
  clearBtn.addEventListener("click", async () => {
    if (!confirm("Remove the uploaded export template?")) return;
    AttendanceModule.clearExportTemplate();
    await saveAttendanceThen(renderAttendance);
  });
  wrap.appendChild(clearBtn);

  AttendanceModule._ensureExportMapping(tpl);

  tpl.headers.forEach((header, idx) => {
    const row = document.createElement("div");
    row.className = "mapping-row";

    const label = document.createElement("label");
    label.textContent = header || `Column ${idx + 1}`;

    const select = document.createElement("select");
    EXPORT_FIELD_OPTIONS.forEach(([val, text]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = text;
      if (val === (tpl.columnFields[idx] || "")) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", async () => {
      AttendanceModule.setExportColumnField(idx, select.value);
      await saveAttendanceThen();
    });

    row.append(label, select);
    wrap.appendChild(row);
  });

  return wrap;
}

function downloadCsv(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Downloads the LMS-export CSV for one class (used by the Table's footer buttons and the Seating Grid's Export button). */
function exportAttendanceSession(session) {
  try {
    const csv = AttendanceModule.buildExportCsv(session.id, RosterModule.students);
    const course = CoursesModule.find(RosterModule.currentCourseId);
    // Course name + "Attendance" + class number, with characters that aren't allowed in file names removed.
    const safeName = (course ? course.name : "Course").replace(/[\\/:*?"<>|]/g, "").trim() || "Course";
    downloadCsv(csv, `${safeName} Attendance ${session.number}.csv`);
  } catch (err) {
    alert(err.message);
  }
}

function buildAttendanceFooterRow() {
  const tr = document.createElement("tr");

  // The label sits under the (frozen) names column only. The columns
  // between it and the class sessions — Notes, Score, Attended, Absences —
  // get a plain filler cell that scrolls away with them, so the frozen
  // label never covers the Export buttons as they slide left.
  const labelTd = document.createElement("td");
  labelTd.className = "attendance-footer-label";
  labelTd.textContent = "Export to LMS:";
  tr.appendChild(labelTd);

  const fillerTd = document.createElement("td");
  fillerTd.colSpan = 4;
  tr.appendChild(fillerTd);

  AttendanceModule.sessions.forEach((session) => {
    const td = document.createElement("td");
    td.className = "session-header-cell";
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn btn-ghost btn-small";
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", () => exportAttendanceSession(session));
    td.appendChild(exportBtn);
    tr.appendChild(td);
  });

  return tr;
}

// ===== Scoring =====
//
// The Scoring panel is itself tabbed (see the "Scoring tabs" block
// below), mirroring the Report Card panel's mode-switch pattern. This
// first tab, "entry", is everything that used to be the whole Scoring
// panel — the score table plus Scoring Settings. Further tool tabs get
// added to SCORING_MODE_RENDERERS as they're built.

el.saveScoringBtn.addEventListener("click", async () => {
  el.scoringStatus.textContent = "Saving…";
  try {
    await RubricBankModule.save();
    await ScoringModule.save();
    el.scoringStatus.textContent = "Saved to Google Drive ✓";
  } catch (err) {
    el.scoringStatus.textContent = `Save failed: ${err.message}`;
  }
});

function renderScoring() {
  el.scoringTable.innerHTML = "";

  if (RosterModule.students.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "hint";
    emptyMsg.textContent = "Add students on the Roster tab first — the scoring table needs a roster to work from.";
    el.scoringTable.replaceWith(emptyMsg);
    emptyMsg.id = "scoring-table"; // keep the id so a later render can find/replace it again
    el.scoringTable = emptyMsg;
    renderScoringSettings();
    return;
  }

  // If a previous render swapped the table out for the empty-state
  // message, put a real <table> back now that there are students.
  if (el.scoringTable.tagName !== "TABLE") {
    const freshTable = document.createElement("table");
    freshTable.id = "scoring-table";
    freshTable.className = "attendance-table scoring-table";
    el.scoringTable.replaceWith(freshTable);
    el.scoringTable = freshTable;
  }

  const thead = document.createElement("thead");
  const { row1, row2 } = buildScoringHeaderRows();
  thead.append(row1, row2);
  el.scoringTable.appendChild(thead);

  const tbody = document.createElement("tbody");
  RosterModule.students.forEach((student) => {
    tbody.appendChild(buildScoringStudentRow(student));
  });
  el.scoringTable.appendChild(tbody);

  renderScoringSettings();
}

function buildScoringHeaderRows() {
  const row1 = document.createElement("tr");
  const row2 = document.createElement("tr");

  const studentTh = document.createElement("th");
  studentTh.rowSpan = 2;
  studentTh.textContent = "Student";
  row1.appendChild(studentTh);

  const totalTh = document.createElement("th");
  totalTh.rowSpan = 2;
  totalTh.textContent = "Total Score";
  row1.appendChild(totalTh);

  const attendanceTh = document.createElement("th");
  attendanceTh.rowSpan = 2;
  attendanceTh.textContent = `Attendance (${ScoringModule.weights.attendance || 0})`;
  row1.appendChild(attendanceTh);

  ScoringModule.categories.forEach((category) => {
    const th = document.createElement("th");
    th.className = "category-header-cell";
    th.colSpan = Math.max(1, category.items.length);
    th.textContent = `${category.name} (${ScoringModule.categoryWeight(category.id)})`;
    row1.appendChild(th);

    category.items.forEach((item) => {
      const itemTh = document.createElement("th");
      itemTh.className = "item-header-cell";

      const nameLine = document.createElement("div");
      nameLine.textContent = item.name;
      const pointsLine = document.createElement("div");
      pointsLine.className = "item-points-label";
      pointsLine.textContent = `/${item.maxPoints} · ${Number(item.weight) || 0}`;
      pointsLine.title = `Out of ${item.maxPoints} points; worth ${Number(item.weight) || 0} of the Total Score`;

      itemTh.append(nameLine, pointsLine);

      const isOpen = itemScoreSourcesOpen.has(item.id);
      const sourcesToggleBtn = document.createElement("button");
      sourcesToggleBtn.type = "button";
      sourcesToggleBtn.className = "score-toggle-btn";
      sourcesToggleBtn.textContent = isOpen ? "Sources ▲" : "Sources ▼";
      sourcesToggleBtn.title = "Optionally draw this item's score from a Scoring Tool";
      sourcesToggleBtn.addEventListener("click", () => {
        if (isOpen) itemScoreSourcesOpen.delete(item.id);
        else itemScoreSourcesOpen.add(item.id);
        renderScoring();
      });
      itemTh.appendChild(sourcesToggleBtn);

      if (isOpen) itemTh.appendChild(buildItemScoreSourcesPanel(item));

      row2.appendChild(itemTh);
    });
  });

  const rawPointsTh = document.createElement("th");
  rawPointsTh.rowSpan = 2;
  rawPointsTh.textContent = "Raw Points";
  rawPointsTh.title = "Points earned / maximum possible — every scoring item's max points plus Attendance";
  row1.appendChild(rawPointsTh);

  return { row1, row2 };
}

/**
 * The "Sources" panel for one item: a "Manual" weight (default 100,
 * meaning this item behaves exactly like plain manual entry until
 * changed) plus one weight per Scoring Tool. A tool at weight 0 (the
 * default) contributes nothing; any other weight blends its
 * rightmost Total Score column into this item's grade, per student —
 * see ScoringModule.computeItemEffectiveScore for the actual math.
 */
function buildItemScoreSourcesPanel(item) {
  const sources = ScoringModule.getItemScoreSources(item.id);
  const panel = document.createElement("div");

  const totalPct = sources.manualWeight + Object.values(sources.toolWeights).reduce((sum, w) => sum + (w || 0), 0);
  const grid = document.createElement("table");
  grid.className = "source-grid" + (totalPct === 100 ? " source-grid-full" : totalPct > 100 ? " source-grid-over" : "");
  grid.title = `Sources add up to ${totalPct}% (green at exactly 100, red above 100)`;
  const gridBody = document.createElement("tbody");
  grid.appendChild(gridBody);
  const addGridRow = (name, inputEl) => {
    const tr = document.createElement("tr");
    const th = document.createElement("td");
    th.className = "source-grid-name" + (String(name).length > 45 ? " source-grid-long" : "");
    th.textContent = name;
    const td = document.createElement("td");
    td.className = "source-grid-value";
    td.appendChild(inputEl);
    tr.append(th, td);
    gridBody.appendChild(tr);
  };
  const addGridWideRow = (node) => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.className = "source-grid-wide";
    td.appendChild(node);
    tr.appendChild(td);
    gridBody.appendChild(tr);
  };
  const manualInput = document.createElement("input");
  manualInput.type = "text";
  manualInput.inputMode = "numeric";
  manualInput.className = "weight-input";
  manualInput.value = sources.manualWeight;
  manualInput.addEventListener("change", async () => {
    ScoringModule.setItemManualWeight(item.id, manualInput.value);
    await saveScoringThen(renderScoring);
  });
  addGridRow("Manual", manualInput);
  panel.appendChild(grid);

  if (ScoringModule.tools.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "No scoring tools added yet.";
    panel.appendChild(hint);
  } else {
    ScoringModule.tools.forEach((tool) => {
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.className = "weight-input";
      input.value = sources.toolWeights[tool.id] || 0;
      input.addEventListener("change", async () => {
        ScoringModule.setItemToolWeight(item.id, tool.id, input.value);
        await saveScoringThen(renderScoring);
      });
      addGridRow(tool.name, input);

      if (tool.type === "testbank") {
        const testSelect = document.createElement("select");
        testSelect.style.width = "100%";
        testSelect.style.marginBottom = "6px";
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "— choose a test/quiz —";
        testSelect.appendChild(blank);
        ScoringModule.testBankTests(tool.id).forEach((test) => {
          const opt = document.createElement("option");
          opt.value = test.id;
          opt.textContent = test.name;
          if (sources.testSelections[tool.id] === test.id) opt.selected = true;
          testSelect.appendChild(opt);
        });
        testSelect.addEventListener("change", async () => {
          ScoringModule.setItemTestSelection(item.id, tool.id, testSelect.value);
          await saveScoringThen(renderScoring);
        });
        addGridWideRow(testSelect);
      } else if (tool.type === "presentation" || tool.type === "table") {
        const projectSelect = document.createElement("select");
        projectSelect.style.width = "100%";
        projectSelect.style.marginBottom = "6px";
        const blankProject = document.createElement("option");
        blankProject.value = "";
        blankProject.textContent = "— choose a project —";
        projectSelect.appendChild(blankProject);
        (tool.type === "table" ? ScoringModule.tableProjects(tool.id) : ScoringModule.presentationProjects(tool.id)).forEach((project, pi) => {
          const opt = document.createElement("option");
          opt.value = project.id;
          opt.textContent = project.name;
          if ((sources.projectSelections[tool.id] || (tool.type === "table" ? ScoringModule.tableProjects(tool.id)[0].id : "")) === project.id) opt.selected = true;
          projectSelect.appendChild(opt);
        });
        projectSelect.addEventListener("change", async () => {
          ScoringModule.setItemProjectSelection(item.id, tool.id, projectSelect.value);
          await saveScoringThen(renderScoring);
        });
        addGridWideRow(projectSelect);
      }
    });
  }

  return panel;
}

el.toggleScoringSettingsBtn.addEventListener("click", () => {
  scoringSettingsEditing = !scoringSettingsEditing;
  el.toggleScoringSettingsBtn.textContent = scoringSettingsEditing ? "Done Editing" : "Edit Settings";
  renderScoringSettings();
});

function renderScoringSettings() {
  el.scoringSettingsBody.innerHTML = "";

  const toolsSummary = document.createElement("p");
  toolsSummary.className = "hint";
  toolsSummary.textContent = `Scoring tools: ${
    ScoringModule.tools.length ? ScoringModule.tools.map((t) => t.name).join(", ") : "(none)"
  }`;
  el.scoringSettingsBody.appendChild(toolsSummary);

  if (!scoringSettingsEditing) {
    if (ScoringModule.categories.length === 0) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Click Edit Settings to add a scoring category.";
      el.scoringSettingsBody.appendChild(hint);
      return;
    }
    const lines = ScoringModule.categories
      .map((c) => `${c.name}: ${ScoringModule.categoryWeight(c.id)}`)
      .concat(`Attendance: ${ScoringModule.weights.attendance || 0}`);
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Weights (sum of each category's items) — " + lines.join(", ");
    el.scoringSettingsBody.appendChild(p);
    el.scoringSettingsBody.appendChild(buildWeightTotalBox());
    return;
  }

  // ----- Edit mode: manage categories, their names, item counts, and each item's name/points -----
  const manageWrap = document.createElement("div");
  manageWrap.className = "attendance-settings-block";
  const manageHeading = document.createElement("h4");
  manageHeading.textContent = "Categories";
  manageWrap.appendChild(manageHeading);

  const list = document.createElement("ul");
  list.className = "infraction-edit-list category-manage-list";
  ScoringModule.categories.forEach((category) => {
    const li = document.createElement("li");
    li.className = "category-manage-item";

    const topRow = document.createElement("div");
    topRow.className = "category-manage-top-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = category.name;
    nameInput.addEventListener("change", async () => {
      ScoringModule.setCategoryName(category.id, nameInput.value);
      await saveScoringThen(renderScoring);
    });
    topRow.appendChild(nameInput);

    const catWeightEl = document.createElement("span");
    catWeightEl.className = "category-weight-sum";
    catWeightEl.textContent = `Weight: ${ScoringModule.categoryWeight(category.id)}`;
    catWeightEl.title = "The sum of this category's item weights";
    topRow.appendChild(catWeightEl);

    const countLabel = document.createElement("label");
    countLabel.textContent = "Items:";
    const countInput = document.createElement("input");
    countInput.type = "text";
    countInput.inputMode = "numeric";
    countInput.className = "point-value-input";
    countInput.value = category.items.length;
    countInput.addEventListener("change", async () => {
      ScoringModule.setItemCount(category.id, countInput.value);
      await saveScoringThen(renderScoring);
    });
    topRow.append(countLabel, countInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost btn-small";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      if (!confirm(`Remove "${category.name}"? This deletes all recorded scores in it.`)) return;
      ScoringModule.removeCategory(category.id);
      await saveScoringThen(renderScoring);
    });
    topRow.appendChild(removeBtn);

    li.appendChild(topRow);

    if (category.items.length > 0) {
      const itemsList = document.createElement("div");
      itemsList.className = "category-items-edit-list";
      category.items.forEach((item) => {
        const itemRow = document.createElement("div");
        itemRow.className = "category-item-edit-row";

        const itemNameInput = document.createElement("input");
        itemNameInput.type = "text";
        itemNameInput.value = item.name;
        itemNameInput.addEventListener("change", async () => {
          ScoringModule.setItemName(item.id, itemNameInput.value);
          await saveScoringThen(renderScoring);
        });

        const itemPointsInput = document.createElement("input");
        itemPointsInput.type = "text";
        itemPointsInput.inputMode = "numeric";
        itemPointsInput.className = "point-value-input";
        itemPointsInput.value = item.maxPoints;
        itemPointsInput.title = "Max points";
        itemPointsInput.addEventListener("change", async () => {
          ScoringModule.setItemMaxPoints(item.id, itemPointsInput.value);
          await saveScoringThen(renderScoring); // total scores depend on this
        });

        const itemWeightInput = document.createElement("input");
        itemWeightInput.type = "text";
        itemWeightInput.inputMode = "decimal";
        itemWeightInput.className = "point-value-input item-weight-input";
        itemWeightInput.value = Number(item.weight) || 0;
        itemWeightInput.title = "Weight: this item's share of the Total Score";
        itemWeightInput.addEventListener("change", async () => {
          ScoringModule.setItemWeight(item.id, itemWeightInput.value);
          await saveScoringThen(renderScoring);
        });

        const ptsLabel = document.createElement("span");
        ptsLabel.className = "hint";
        ptsLabel.textContent = "pts";
        const wtLabel = document.createElement("span");
        wtLabel.className = "hint";
        wtLabel.textContent = "weight";
        itemRow.append(itemNameInput, itemPointsInput, ptsLabel, itemWeightInput, wtLabel);
        itemsList.appendChild(itemRow);
      });
      li.appendChild(itemsList);
    }

    list.appendChild(li);
  });
  manageWrap.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-primary btn-small";
  addBtn.textContent = "+ Add Category";
  addBtn.addEventListener("click", async () => {
    try {
      ScoringModule.addCategory();
    } catch (err) {
      alert(err.message);
      return;
    }
    await saveScoringThen(renderScoring);
  });
  manageWrap.appendChild(addBtn);
  el.scoringSettingsBody.appendChild(manageWrap);

  // ----- Edit mode: scoring tools (extra tabs alongside Main Scores) -----
  el.scoringSettingsBody.appendChild(buildScoringToolsManageBlock());

  if (ScoringModule.categories.length === 0) return;

  // ----- Edit mode: Attendance weight + the overall total (category weights are the sums of their items' weights) -----
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Attendance weight";
  wrap.appendChild(heading);

  wrap.appendChild(
    buildWeightRow("Attendance", ScoringModule.weights.attendance, async (value) => {
      ScoringModule.setWeight("attendance", value);
      await saveScoringThen(renderScoring);
    })
  );

  wrap.appendChild(buildWeightTotalBox());
  el.scoringSettingsBody.appendChild(wrap);
}

/** Green at exactly 100, red over 100, neutral otherwise. */
function buildWeightTotalBox() {
  const total = ScoringModule.totalWeight();

  const box = document.createElement("div");
  box.className = "weight-total-box";
  if (total === 100) box.classList.add("weight-total-ok");
  else if (total > 100) box.classList.add("weight-total-over");
  box.textContent = `Total weight: ${total}${total === 100 ? " ✓" : total > 100 ? " (over 100)" : ""}`;
  return box;
}

function buildWeightRow(label, value, onChange) {
  const row = document.createElement("div");
  row.className = "weight-row";

  const labelEl = document.createElement("span");
  labelEl.className = "weight-label";
  labelEl.textContent = label;

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.className = "weight-input";
  input.value = value || 0;
  input.addEventListener("change", () => onChange(input.value));

  row.append(labelEl, input);
  return row;
}

/** Lists the tools currently added (each with a Remove button) and an "+ Add Scoring Tool" button that opens a small menu of tool types to add — this is how tabs alongside Main Scores get added/removed. Each tool's own content and settings live in its own tab, not here. */
function buildScoringToolsManageBlock() {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Scoring Tools";
  wrap.appendChild(heading);

  if (ScoringModule.tools.length > 0) {
    const list = document.createElement("ul");
    list.className = "infraction-edit-list";
    ScoringModule.tools.forEach((tool) => {
      const li = document.createElement("li");

      const nameText = document.createElement("span");
      nameText.textContent = tool.name;
      nameText.title = "Rename it on the tool's own tab";
      li.appendChild(nameText);

      const typeLabel = document.createElement("span");
      typeLabel.className = "hint";
      typeLabel.textContent = `(${SCORING_TOOL_TYPES[tool.type] || tool.type})`;
      li.appendChild(typeLabel);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost btn-small";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        if (!confirm(`Remove the "${tool.name}" tab? This can't be undone.`)) return;
        ScoringModule.removeTool(tool.id);
        delete SCORING_MODE_RENDERERS[tool.id];
        scoringToolSettingsEditing.delete(tool.id);
        if (scoringMode === tool.id) scoringMode = "entry";
        await saveScoringThen(() => {
          renderScoringToolTabs();
          showScoringMode(scoringMode);
        });
      });
      li.appendChild(removeBtn);

      list.appendChild(li);
    });
    wrap.appendChild(list);
  }

  const addWrap = document.createElement("div");
  addWrap.style.position = "relative";
  addWrap.style.display = "inline-block";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-ghost btn-small";
  addBtn.textContent = "+ Add Scoring Tool";

  const menu = document.createElement("ul");
  menu.className = "theme-list settings-panel";
  menu.hidden = true;
  Object.entries(SCORING_TOOL_TYPES).forEach(([type, label]) => {
    const li = document.createElement("li");
    li.className = "theme-item";
    li.textContent = label;
    li.addEventListener("click", async () => {
      let tool;
      try {
        tool = ScoringModule.addTool(type);
      } catch (err) {
        alert(err.message);
        return;
      }
      menu.hidden = true;
      await saveScoringThen(() => {
        pendingToolNameFocus = tool.id; // the new tool's name box takes focus right away
        scoringToolSettingsEditing.set(tool.id, true); // a new tool opens with its settings open, ready to name
        renderScoringToolTabs();
        showScoringMode(tool.id);
      });
    });
    menu.appendChild(li);
  });

  addBtn.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });

  addWrap.append(addBtn, menu);
  wrap.appendChild(addWrap);

  return wrap;
}

function buildScoringStudentRow(student) {
  const tr = document.createElement("tr");
  tr.dataset.studentId = student.id;

  // ----- Student info: class #, pronunciation, name + school ID -----
  const infoTd = document.createElement("td");
  infoTd.className = "attendance-student-cell";
  if (student.classNumber) {
    const numEl = document.createElement("div");
    numEl.className = "unseated-classnumber";
    numEl.textContent = `#${student.classNumber}`;
    infoTd.appendChild(numEl);
  }
  if (student.pronunciation) {
    const pron = document.createElement("div");
    pron.className = "attendance-pronunciation";
    pron.textContent = student.pronunciation;
    infoTd.appendChild(pron);
  }
  const nameRow = document.createElement("div");
  nameRow.className = "attendance-name-row";
  const nameSpan = document.createElement("span");
  nameSpan.className = "attendance-name";
  nameSpan.textContent = student.name || "(unnamed)";
  nameRow.appendChild(nameSpan);
  if (student.schoolId) {
    const idSpan = document.createElement("span");
    idSpan.className = "attendance-schoolid";
    idSpan.textContent = student.schoolId;
    nameRow.appendChild(idSpan);
  }
  infoTd.appendChild(nameRow);
  tr.appendChild(infoTd);

  // ----- Total score: points primary, percent secondary -----
  const totalTd = document.createElement("td");
  totalTd.className = "attendance-stat-cell attendance-score-cell";
  totalTd.appendChild(
    buildPointsWithPercentCell(ScoringModule.totalPoints(student.id), ScoringModule.weightedPercent(student.id))
  );
  tr.appendChild(totalTd);

  // ----- Attendance (read-only, computed from the Attendance tab): points primary, percent secondary -----
  const attendanceStats = ScoringModule.attendanceScore(student.id);
  const attendanceTd = document.createElement("td");
  attendanceTd.className = "attendance-stat-cell scoring-attendance-cell";
  attendanceTd.appendChild(buildPointsWithPercentCell(attendanceStats.points, attendanceStats.percent));
  tr.appendChild(attendanceTd);

  // ----- One cell per item, grouped by category (no separate cell needed — colspan lives in the header) -----
  ScoringModule.categories.forEach((category) => {
    category.items.forEach((item) => {
      const td = document.createElement("td");
      td.className = "scoring-item-cell";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "scoring-score-input";
      input.dataset.itemId = item.id;
      input.value = ScoringModule.getRecord(student.id, item.id);
      input.placeholder = `/${item.maxPoints}`;
      input.title = `Out of ${item.maxPoints} — or "E" for exempt`;
      input.addEventListener("change", async () => {
        try {
          ScoringModule.setRecord(student.id, item.id, input.value);
        } catch (err) {
          alert(err.message);
          input.value = ScoringModule.getRecord(student.id, item.id);
          return;
        }
        await saveScoringThen();
        refreshScoringTotalCell(student.id);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault(); // moving focus below triggers the change handler above via blur
        const nextRow = tr.nextElementSibling;
        if (!nextRow) return;
        const nextInput = nextRow.querySelector(`.scoring-score-input[data-item-id="${item.id}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      });

      const itemSources = ScoringModule.getItemScoreSources(item.id);
      if (Object.values(itemSources.toolWeights).some((w) => w > 0)) {
        // Several sources feed this item: show the composite score; with the Sources panel open, also each contributing source (manual included).
        const composite = document.createElement("div");
        composite.className = "score-composite";
        composite.dataset.itemId = item.id;
        const detail = document.createElement("div");
        detail.className = "score-source-detail";
        detail.dataset.itemId = item.id;
        td.append(composite, detail);
        td._manualInput = input;
        fillItemCompositeCell(td, student.id, item);
      } else {
        td.appendChild(input);
      }

      tr.appendChild(td);
    });
  });

  // ----- Raw Points (unweighted sum of all earned points across categories) -----
  const rawPointsTd = document.createElement("td");
  rawPointsTd.className = "attendance-stat-cell scoring-rawpoints-cell";
  fillRawPointsCell(rawPointsTd, student.id);
  tr.appendChild(rawPointsTd);

  return tr;
}

/** Raw Points cell: "earned / possible" with the percent underneath. Hover for the items / Attendance split. */
function fillRawPointsCell(td, studentId) {
  const sum = ScoringModule.rawPointsSummary(studentId);
  td.innerHTML = "";
  td.appendChild(buildPointsWithPercentCell(`${sum.earned} / ${sum.possible}`, sum.percent));
  td.title = `Scoring items: ${sum.items.earned} / ${sum.items.possible}\nAttendance: ${sum.attendance.earned} / ${sum.attendance.possible}`;
}

/** A small two-line display: the points value on top, its equivalent percentage underneath in a lighter style. Either can be null/undefined, shown as "—". Used for Total Score and Attendance, now that both are points-first with percent as secondary context. */
/** Fills a multi-source item cell: the composite score always; the per-source lines (manual input + each tool) only while that item's Sources panel is open. */
function fillItemCompositeCell(td, studentId, item) {
  const round = (n) => Math.round(n * 100) / 100;
  const composite = td.querySelector(".score-composite");
  const detail = td.querySelector(".score-source-detail");
  const input = td._manualInput;
  const effective = ScoringModule.computeItemEffectiveScore(studentId, item);
  const exempt = ScoringModule.getRecord(studentId, item.id) === "E";
  composite.textContent = exempt ? "E" : effective === null ? "—" : String(round(effective));
  composite.title = `Combined score from all sources (item is out of ${item.maxPoints}). Open "Sources" to see each one.`;

  detail.innerHTML = "";
  if (!itemScoreSourcesOpen.has(item.id)) {
    // Collapsed: just the composite, plus the manual entry box whenever Manual's percentage is above 0.
    if (ScoringModule.getItemScoreSources(item.id).manualWeight > 0) detail.appendChild(input);
    else if (input.parentElement) input.remove();
    return;
  }
  const { sources } = ScoringModule.itemSourceBreakdown(studentId, item);
  const cfg = ScoringModule.getItemScoreSources(item.id);
  const byKey = {};
  sources.forEach((src) => (byKey[src.key] = src));

  const grid = document.createElement("table");
  grid.className = "source-grid source-grid-mini";
  const body = document.createElement("tbody");
  grid.appendChild(body);
  const addLine = (name, valueNode) => {
    const tr = document.createElement("tr");
    const left = document.createElement("td");
    left.className = "source-grid-name" + (String(name).length > 45 ? " source-grid-long" : "");
    left.textContent = name;
    const right = document.createElement("td");
    right.className = "source-grid-value";
    right.appendChild(valueNode);
    tr.append(left, right);
    body.appendChild(tr);
  };

  if (cfg.manualWeight > 0) {
    addLine("Manual", input);
  } else if (input.parentElement) {
    input.remove();
  }
  Object.entries(cfg.toolWeights).forEach(([toolId, weight]) => {
    if (!(weight > 0)) return;
    const tool = ScoringModule.findTool(toolId);
    if (!tool) return;
    const src = byKey[toolId];
    const span = document.createElement("span");
    span.textContent = src ? String(round(src.points)) : "—";
    addLine(tool.name, span);
  });
  detail.appendChild(grid);
}

function buildPointsWithPercentCell(points) {
  // Points only — the percentage line that used to sit underneath has been removed.
  const wrap = document.createElement("div");
  const pointsLine = document.createElement("div");
  pointsLine.className = "score-points-line";
  pointsLine.textContent = points === null || points === undefined ? "—" : String(points);
  wrap.appendChild(pointsLine);
  return wrap;
}

function refreshScoringTotalCell(studentId) {
  const row = el.scoringTable.querySelector(`tr[data-student-id="${studentId}"]`);
  if (!row) return;
  const cell = row.querySelector(".attendance-score-cell");
  if (cell) {
    cell.innerHTML = "";
    cell.appendChild(
      buildPointsWithPercentCell(ScoringModule.totalPoints(studentId), ScoringModule.weightedPercent(studentId))
    );
  }
  const rawCell = row.querySelector(".scoring-rawpoints-cell");
  if (rawCell) fillRawPointsCell(rawCell, studentId);

  // This item's own edit can shift its own blended Score Sources
  // readout (if it has one) — refresh whichever are in this row.
  row.querySelectorAll("td.scoring-item-cell").forEach((cell) => {
    if (!cell._manualInput) return;
    const item = ScoringModule.findItem(cell._manualInput.dataset.itemId);
    if (item) fillItemCompositeCell(cell, studentId, item);
  });
}

/** Applies a local change's follow-up UI update. Persistence to Google Drive happens only via the explicit "Save Scoring" button, which covers Main Scores and every tool tab at once (they're all one file). */
function saveScoringThen(after) {
  if (after) after();
}

// ----- Scoring tabs (Scoring panel's own sub-tabs) -----
//
// "entry" (Main Scores) is the score table + Scoring Settings above —
// its tab button and view live in index.html. Every other tab is a
// scoring TOOL, added/removed from Main Scores' own Settings (see
// buildScoringToolsManageBlock above) rather than hardcoded in the
// HTML: renderScoringToolTabs() builds one <button> + one view <div>
// per tool in ScoringModule.tools and registers a render function for
// it here, so showScoringMode/the click handler below need no changes
// as tools are added or removed.

let scoringMode = "entry"; // which Scoring sub-tab is currently showing

const SCORING_MODE_RENDERERS = {
  entry: renderScoring,
};

// One render function per tool TYPE (not per tool instance) — add an
// entry here (and to SCORING_TOOL_TYPES in scoring.js) for each new
// kind of scoring tool.
const SCORING_TOOL_RENDERERS = {
  table: renderScoringToolTableView,
  presentation: renderScoringToolPresentationView,
  testbank: renderScoringToolTestBankView,
};

function showScoringMode(mode) {
  scoringMode = mode;
  document.querySelectorAll(".scoring-mode-view").forEach((view) => {
    view.hidden = view.id !== `scoring-mode-${mode}-view`;
  });
  document.querySelectorAll("#scoring-mode-row .tab-btn, #scoring-mode-entry-btn").forEach((btn) => {
    btn.classList.toggle("tab-btn-active", btn.dataset.scoringMode === mode);
  });
  const renderFn = SCORING_MODE_RENDERERS[mode];
  if (renderFn) renderFn();
}

el.scoringModeRow.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-scoring-mode]");
  if (btn) showScoringMode(btn.dataset.scoringMode);
});
document.getElementById("scoring-main-row").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-scoring-mode]");
  if (btn) showScoringMode(btn.dataset.scoringMode);
});

/** Rebuilds the tool tab buttons and their view containers from ScoringModule.tools — call after loading a course's scoring data, and after adding/removing a tool. Safe to call repeatedly: previously-built tool buttons/views are removed first. */
function renderScoringToolTabs() {
  el.scoringModeRow.querySelectorAll("[data-dynamic-tool]").forEach((btn) => btn.remove());
  el.scoringModeRow.hidden = ScoringModule.tools.length === 0; // the tool-tab bar only shows when there are tools
  el.scoringPanel.querySelectorAll(".scoring-tool-view").forEach((view) => view.remove());

  ScoringModule.tools.forEach((tool) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn";
    btn.dataset.scoringMode = tool.id;
    btn.dataset.dynamicTool = "true";
    btn.textContent = tool.name;
    el.scoringModeRow.appendChild(btn);

    const view = document.createElement("div");
    view.id = `scoring-mode-${tool.id}-view`;
    view.className = "scoring-mode-view scoring-tool-view";
    view.hidden = true;
    el.scoringPanel.appendChild(view);

    SCORING_MODE_RENDERERS[tool.id] = () => renderScoringToolView(tool, view);
  });
}

/** Dispatches to the render function for `tool.type`, filling `container`. */
function renderScoringToolView(tool, container) {
  const renderFn = SCORING_TOOL_RENDERERS[tool.type];
  container.innerHTML = "";
  if (!renderFn) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Unknown scoring tool type.";
    container.appendChild(p);
    return;
  }
  renderFn(tool, container);
  // The name box sits at the bottom of the tool's Settings section (or at the bottom of the tab if it has none).
  const settingsSections = container.querySelectorAll(".attendance-settings");
  let nameHost;
  if (settingsSections.length) {
    nameHost = settingsSections[settingsSections.length - 1];
  } else {
    // Tools without a Settings section of their own get one, so the name box always lives inside Settings.
    nameHost = document.createElement("div");
    nameHost.className = "attendance-settings";
    const header = document.createElement("div");
    header.className = "attendance-settings-header";
    const heading = document.createElement("h3");
    heading.textContent = `${tool.name} Settings`;
    header.appendChild(heading);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn btn-ghost btn-small";
    toggle.textContent = scoringToolSettingsEditing.get(tool.id) ? "Done Editing" : "Edit Settings";
    toggle.addEventListener("click", () => {
      scoringToolSettingsEditing.set(tool.id, !scoringToolSettingsEditing.get(tool.id));
      renderScoringToolView(tool, container);
    });
    header.appendChild(toggle);
    nameHost.appendChild(header);
    container.appendChild(nameHost);
  }
  // The rename box only shows while the tool's settings are being edited.
  if (scoringToolSettingsEditing.get(tool.id)) nameHost.appendChild(buildToolNameRow(tool));
  if (pendingToolNameFocus === tool.id) {
    pendingToolNameFocus = null;
    const nameBox = container.querySelector(".tool-name-input");
    if (nameBox) setTimeout(() => { nameBox.focus(); nameBox.select(); }, 0);
  }
}

let pendingToolNameFocus = null;

/** The tool's name box, at the top of its own tab. Renaming updates the tab label right away. */
function buildToolNameRow(tool) {
  const row = document.createElement("div");
  row.className = "tool-name-row";
  const label = document.createElement("label");
  label.textContent = "Tool name:";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tool-name-input";
  input.value = tool.name;
  input.title = "Name this scoring tool — it's the tab's label and what Sources lists";
  input.addEventListener("change", async () => {
    ScoringModule.renameTool(tool.id, input.value);
    input.value = tool.name;
    const btn = el.scoringModeRow.querySelector(`[data-scoring-mode="${tool.id}"]`);
    if (btn) btn.textContent = tool.name;
    const settingsHeading = row.closest(".attendance-settings") && row.closest(".attendance-settings").querySelector("h3");
    if (settingsHeading) settingsHeading.textContent = `${tool.name} Settings`;
    await saveScoringThen();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  label.appendChild(input);
  row.appendChild(label);
  return row;
}

/**
 * The "Progress Tracker" scoring tool. Rows are automatic (one per
 * roster student, or one per Seating Chart group, per the first
 * column's mode); columns are configurable in Settings below, and a
 * fixed "Total Score" column at the end adds up each row.
 */
const trackerToolProject = new Map(); // toolId -> id of the project tab showing

function renderScoringToolTableView(tool, container) {
  const projects = ScoringModule.tableProjects(tool.id);
  let projectId = trackerToolProject.get(tool.id);
  if (!projects.some((p) => p.id === projectId)) projectId = projects[0].id;
  trackerToolProject.set(tool.id, projectId);
  ScoringModule.setActiveTableProject(tool.id, projectId);
  const cfg = ScoringModule.getTableConfig(tool.id);
  container.innerHTML = "";
  const rerenderTracker = () => renderScoringToolView(tool, container);

  const projectRow = document.createElement("div");
  projectRow.className = "level-tab-row level3-row";
  projects.forEach((project) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn" + (project.id === projectId ? " tab-btn-active" : "");
    btn.textContent = project.name;
    btn.addEventListener("click", () => {
      trackerToolProject.set(tool.id, project.id);
      rerenderTracker();
    });
    projectRow.appendChild(btn);
  });
  const newProjectBtn = document.createElement("button");
  newProjectBtn.type = "button";
  newProjectBtn.className = "btn btn-ghost btn-small";
  newProjectBtn.textContent = "+ New Project";
  newProjectBtn.style.alignSelf = "center";
  newProjectBtn.style.margin = "0 0 6px 8px";
  newProjectBtn.addEventListener("click", async () => {
    const name = prompt("Name for the new project:", `Project ${projects.length + 1}`);
    if (name === null) return;
    try {
      const project = ScoringModule.addTableProject(tool.id, name);
      trackerToolProject.set(tool.id, project.id);
    } catch (err) {
      alert(err.message);
      return;
    }
    await saveScoringThen(rerenderTracker);
  });
  projectRow.appendChild(newProjectBtn);
  container.appendChild(projectRow);

  const projectHead = document.createElement("div");
  projectHead.className = "panel-toolbar";
  const projectTitle = document.createElement("span");
  projectTitle.className = "hint";
  projectTitle.textContent = `Project: ${cfg.name}`;
  projectHead.appendChild(projectTitle);
  const projectBtns = document.createElement("div");
  projectBtns.className = "panel-toolbar-buttons";
  const renameProjectBtn = document.createElement("button");
  renameProjectBtn.type = "button";
  renameProjectBtn.className = "btn btn-ghost btn-small";
  renameProjectBtn.textContent = "Rename Project";
  renameProjectBtn.addEventListener("click", async () => {
    const name = prompt("Rename project:", cfg.name);
    if (name === null) return;
    ScoringModule.renameTableProject(tool.id, projectId, name);
    await saveScoringThen(rerenderTracker);
  });
  const deleteProjectBtn = document.createElement("button");
  deleteProjectBtn.type = "button";
  deleteProjectBtn.className = "btn btn-ghost btn-small";
  deleteProjectBtn.textContent = "Delete Project";
  deleteProjectBtn.addEventListener("click", async () => {
    if (!confirm(`Delete the project "${cfg.name}"? Its columns and scores are removed, and Main Scores items pulling from it lose those scores.`)) return;
    try {
      ScoringModule.removeTableProject(tool.id, projectId);
    } catch (err) {
      alert(err.message);
      return;
    }
    await saveScoringThen(rerenderTracker);
  });
  projectBtns.append(renameProjectBtn, deleteProjectBtn);
  projectHead.appendChild(projectBtns);
  container.appendChild(projectHead);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "Enter scores below; the Total Score column adds up each row (with sub-rows, each box in the main row adds up its sub-rows first). To use a total in Main Scores, open an item's Sources panel and give this tracker a weight.";
  container.appendChild(hint);

  const choosing = trackerChoosing(tool);
  const modeRow = document.createElement("div");
  modeRow.className = "tracker-mode-row";
  modeRow.appendChild(
    makeTrackerModeSwitch(choosing, (on) => {
      trackerChooseMode.set(tool.id, on);
      renderScoringToolView(tool, container);
    })
  );
  if (choosing) {
    const chooseHint = document.createElement("span");
    chooseHint.className = "hint";
    chooseHint.textContent =
      "Choosing boxes: switch a box off and it stops taking scores and is left out of its row's total and maximum (what was typed in it is kept). Switch back to Scoring to enter scores.";
    modeRow.appendChild(chooseHint);
  }
  container.appendChild(modeRow);

  container.appendChild(buildTablePreview(tool, cfg, container));

  const settingsWrap = document.createElement("div");
  settingsWrap.className = "attendance-settings";

  const header = document.createElement("div");
  header.className = "attendance-settings-header";
  const heading = document.createElement("h3");
  heading.textContent = `${tool.name} Settings`;
  header.appendChild(heading);

  const editing = scoringToolSettingsEditing.get(tool.id) || false;
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "btn btn-ghost btn-small";
  toggleBtn.textContent = editing ? "Done Editing" : "Edit Settings";
  toggleBtn.addEventListener("click", () => {
    scoringToolSettingsEditing.set(tool.id, !editing);
    renderScoringToolView(tool, container);
  });
  header.appendChild(toggleBtn);
  settingsWrap.appendChild(header);

  if (!editing) {
    const summary = document.createElement("p");
    summary.className = "hint";
    const identityRowCount = ScoringModule.getTableIdentityRows(tool.id).length;
    summary.textContent =
      `Rows: ${cfg.firstColumn.mode === "groups" ? "Groups" : "Students"} — ` +
      `${identityRowCount} row(s), ${cfg.columns.length} column(s) plus Total Score. ` +
      (cfg.mode === "max" ? `Scored out of maximum points (Total Score out of ${ScoringModule.tableMaxTotal(tool.id)}). ` : "Scored in raw points. ") +
      (cfg.subRows.length > 0 ? `Sub-rows: ${cfg.subRows.map((r) => r.name).join(", ")}.` : "No sub-rows.");
    settingsWrap.appendChild(summary);
  } else {
    settingsWrap.appendChild(buildTableFirstColumnBlock(tool, cfg, container));
    settingsWrap.appendChild(buildTableRowsBlock(tool, cfg, container));
    settingsWrap.appendChild(buildTableModeBlock(tool, cfg, container));
    settingsWrap.appendChild(buildTableColumnsBlock(tool, cfg, container));
    settingsWrap.appendChild(buildTableSubRowsBlock(tool, cfg, container));
  }

  container.appendChild(settingsWrap);
}

/** Re-renders this one tool's view after a local change. Persistence happens only via the explicit "Save Scoring" button. */
function saveScoringToolThen(tool, container) {
  renderScoringToolView(tool, container);
}

/** The tracker's actual grid — the first (identifier) column, one column per cfg.columns entry, then the fixed Total Score column; one line per identity row (student or group). Score cells are editable inputs; Total Score is read-only. */
function buildTablePreview(tool, cfg, container) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-table-wrap";
  const table = document.createElement("table");
  table.className = "attendance-table scoring-table";
  const maxMode = cfg.mode === "max";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const studentsMode = cfg.firstColumn.mode !== "groups";
  if (studentsMode) {
    const numTh = document.createElement("th");
    numTh.textContent = "Class #";
    headRow.appendChild(numTh);
  }
  const firstTh = document.createElement("th");
  firstTh.textContent = cfg.firstColumn.name;
  headRow.appendChild(firstTh);
  if (studentsMode) {
    const idTh = document.createElement("th");
    idTh.textContent = "School ID";
    headRow.appendChild(idTh);
  }
  cfg.columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = maxMode && col.maxPoints > 0 ? `${col.name} (/${col.maxPoints})` : col.name;
    headRow.appendChild(th);
  });
  const totalMax = ScoringModule.tableMaxTotal(tool.id);
  const totalTh = document.createElement("th");
  totalTh.textContent = maxMode && totalMax > 0 ? `Total Score (/${totalMax})` : "Total Score";
  headRow.appendChild(totalTh);
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const identityRows = ScoringModule.getTableIdentityRows(tool.id);
  if (identityRows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = cfg.columns.length + (studentsMode ? 4 : 2);
    td.className = "hint";
    td.textContent =
      cfg.firstColumn.mode === "groups"
        ? "No groups are set up on the current Seating Chart yet."
        : "There are no students on the roster yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    identityRows.forEach(({ key, label }) => {
      buildTablePreviewRows(tool, cfg, container, key, label).forEach((tr) => tbody.appendChild(tr));
    });
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/** Progress Trackers currently in "choose boxes" mode (toolId → true). Just a view setting, so it isn't saved. */
const trackerChooseMode = new Map();
function trackerChoosing(tool) {
  return trackerChooseMode.get(tool.id) === true;
}

/** The Scoring ↔ Choose boxes switch above the grid. */
function makeTrackerModeSwitch(choosing, onChange) {
  const label = document.createElement("label");
  label.className = "tracker-switch";
  const left = document.createElement("span");
  left.className = "tracker-switch-text" + (choosing ? "" : " active");
  left.textContent = "Scoring";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("role", "switch");
  input.checked = choosing;
  input.addEventListener("change", () => onChange(input.checked));
  const track = document.createElement("span");
  track.className = "tracker-switch-track";
  const right = document.createElement("span");
  right.className = "tracker-switch-text" + (choosing ? " active" : "");
  right.textContent = "Choose boxes";
  label.appendChild(left);
  label.appendChild(input);
  label.appendChild(track);
  label.appendChild(right);
  return label;
}

/** The small on/off switch shown inside a box while choosing. */
function makeBoxSwitch(isOn, onToggle, title) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tracker-box-switch" + (isOn ? " on" : "");
  btn.setAttribute("role", "switch");
  btn.setAttribute("aria-checked", isOn ? "true" : "false");
  btn.title = title || (isOn ? "On — click to turn this box off" : "Off — click to turn this box on");
  const thumb = document.createElement("span");
  thumb.className = "tracker-box-switch-thumb";
  btn.appendChild(thumb);
  btn.addEventListener("click", onToggle);
  return btn;
}

/** A box plus (while choosing) its on/off switch. */
function makeTrackerBox(tool, cfg, container, lineId, col, subId) {
  const choosing = trackerChoosing(tool);
  const isOn = ScoringModule.isTableCellOn(tool.id, lineId, col.id, subId);
  const wrap = document.createElement("div");
  wrap.className = "tracker-box" + (isOn ? "" : " tracker-box-off");
  wrap.appendChild(makeTrackerInput(tool, cfg, container, lineId, col, subId, choosing || !isOn));
  if (choosing) {
    wrap.appendChild(
      makeBoxSwitch(isOn, async () => {
        ScoringModule.setTableCellOn(tool.id, lineId, col.id, !isOn, subId);
        await saveScoringToolThen(tool, container);
      })
    );
  }
  return wrap;
}

/** One score box. subId (optional) makes it a sub-row's box. locked: shown but can't be typed in (choosing mode, or the box is off). */
function makeTrackerInput(tool, cfg, container, lineId, col, subId, locked) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "scoring-score-input";
  input.value = ScoringModule.getTableValue(tool.id, lineId, col.id, subId);
  if (locked) {
    input.disabled = true;
    if (!ScoringModule.isTableCellOn(tool.id, lineId, col.id, subId)) input.title = "This box is turned off";
  }
  if (cfg.mode === "max" && col.maxPoints > 0) {
    input.placeholder = `/${col.maxPoints}`;
    input.title = `Out of ${col.maxPoints}`;
  }
  input.addEventListener("change", async () => {
    try {
      ScoringModule.setTableValue(tool.id, lineId, col.id, input.value, subId);
    } catch (err) {
      alert(err.message);
      input.value = ScoringModule.getTableValue(tool.id, lineId, col.id, subId);
      return;
    }
    await saveScoringToolThen(tool, container);
  });
  return input;
}

/** The grid line(s) for one identity row, keyed by its key (a student id, or a group number as a string): the main row, then — if the tracker has sub-rows — one line per sub-row. With sub-rows, the main row's boxes are read-only sums of their sub-rows. Returns an array of <tr>. */
function buildTablePreviewRows(tool, cfg, container, lineId, label) {
  const maxMode = cfg.mode === "max";
  const hasSubRows = cfg.subRows.length > 0;
  const rows = [];

  const tr = document.createElement("tr");
  if (hasSubRows) tr.className = "tracker-parent-row";
  const studentsMode = cfg.firstColumn.mode !== "groups";
  const student = studentsMode ? ((window.RosterModule && RosterModule.students) || []).find((s) => s.id === lineId) : null;
  if (studentsMode) {
    const numTd = document.createElement("td");
    numTd.className = "tracker-id-cell tracker-class-num";
    numTd.textContent = student && student.classNumber !== undefined && student.classNumber !== null ? String(student.classNumber) : "";
    tr.appendChild(numTd);
  }
  const labelTd = document.createElement("td");
  labelTd.textContent = label;
  tr.appendChild(labelTd);
  if (studentsMode) {
    const idTd = document.createElement("td");
    idTd.className = "tracker-id-cell";
    idTd.textContent = student && student.schoolId ? String(student.schoolId) : "";
    tr.appendChild(idTd);
  }

  cfg.columns.forEach((col) => {
    const td = document.createElement("td");
    if (col.type === "test" || hasSubRows) {
      const num = ScoringModule.tableCellNumber(tool.id, lineId, col);
      const colMax = ScoringModule.tableColumnMax(tool.id, col, lineId);
      const boxOn = col.type !== "test" || ScoringModule.isTableCellOn(tool.id, lineId, col.id);
      td.className = col.type === "test" ? "hint" : "tracker-parent-sum";
      const text = document.createElement("span");
      text.textContent = !boxOn
        ? "off"
        : num === null ? "—" : String(Math.round(num * 100) / 100) + (maxMode && colMax > 0 ? `/${colMax}` : "");
      if (col.type === "test" && (trackerChoosing(tool) || !boxOn)) {
        // A quiz/test box has no typing in it, but can still be switched off.
        const wrap = document.createElement("div");
        wrap.className = "tracker-box" + (boxOn ? "" : " tracker-box-off");
        wrap.appendChild(text);
        if (trackerChoosing(tool)) {
          wrap.appendChild(
            makeBoxSwitch(boxOn, async () => {
              ScoringModule.setTableCellOn(tool.id, lineId, col.id, !boxOn);
              await saveScoringToolThen(tool, container);
            })
          );
        }
        td.appendChild(wrap);
      } else {
        td.appendChild(text);
      }
      tr.appendChild(td);
      return;
    }
    td.appendChild(makeTrackerBox(tool, cfg, container, lineId, col));
    tr.appendChild(td);
  });

  const totalTd = document.createElement("td");
  totalTd.className = "attendance-stat-cell";
  const sum = ScoringModule.computeTableScoreSum(tool.id, lineId);
  const totalMax = ScoringModule.tableMaxTotal(tool.id, lineId); // this row's own maximum (boxes turned off don't count)
  if (sum === null) {
    totalTd.textContent = "—";
  } else {
    const shown = Math.round(sum * 100) / 100;
    totalTd.textContent = maxMode && totalMax > 0 ? `${shown}/${totalMax}` : String(shown);
  }
  tr.appendChild(totalTd);
  rows.push(tr);

  cfg.subRows.forEach((sub) => {
    const subTr = document.createElement("tr");
    subTr.className = "tracker-sub-row";
    if (studentsMode) subTr.appendChild(document.createElement("td")); // under Class #
    const subLabel = document.createElement("td");
    subLabel.textContent = sub.name;
    subTr.appendChild(subLabel);
    if (studentsMode) subTr.appendChild(document.createElement("td")); // under School ID
    cfg.columns.forEach((col) => {
      const td = document.createElement("td");
      if (col.type === "test") {
        td.className = "hint";
        td.textContent = "—";
      } else {
        td.appendChild(makeTrackerBox(tool, cfg, container, lineId, col, sub.id));
      }
      subTr.appendChild(td);
    });
    subTr.appendChild(document.createElement("td")); // no per-sub-row total
    rows.push(subTr);
  });

  return rows;
}

/** First-column setting: whether rows represent Students or Groups. (The column's name is fixed to match.) */
function buildTableFirstColumnBlock(tool, cfg, container) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "First column";
  wrap.appendChild(heading);

  const row = document.createElement("div");
  row.className = "mapping-row";

  const modeLabel = document.createElement("label");
  modeLabel.textContent = "Rows represent:";

  const modeSelect = document.createElement("select");
  [
    ["students", "Students"],
    ["groups", "Groups"],
  ].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    if (val === cfg.firstColumn.mode) opt.selected = true;
    modeSelect.appendChild(opt);
  });
  modeSelect.addEventListener("change", async () => {
    ScoringModule.setTableFirstColumnMode(tool.id, modeSelect.value);
    await saveScoringToolThen(tool, container);
  });

  row.append(modeLabel, modeSelect);
  wrap.appendChild(row);
  return wrap;
}

/** The Rows settings block — purely informational. In "Students" mode there's always exactly one row per current roster student, named to match; in "Groups" mode, one row per group currently on the Seating Chart. Nothing here is editable — this is what keeps Score Sources reliably matched. */
function buildTableRowsBlock(tool, cfg, container) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Rows";
  wrap.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    cfg.firstColumn.mode === "groups"
      ? "Rows are automatic — one per group currently on the Seating Chart — so they always stay matched for Score Sources."
      : "Rows are automatic — one per student on the roster — so they always stay matched for Score Sources.";
  wrap.appendChild(hint);

  const identityRows = ScoringModule.getTableIdentityRows(tool.id);
  if (identityRows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent =
      cfg.firstColumn.mode === "groups"
        ? "No groups are set up on the current Seating Chart yet."
        : "There are no students on the roster yet.";
    wrap.appendChild(empty);
    return wrap;
  }

  const list = document.createElement("p");
  list.className = "hint";
  list.textContent = identityRows.map((r) => r.label).join(", ");
  wrap.appendChild(list);

  return wrap;
}

/** Column count setting plus a nameable, editable list of columns ("Score" or "Test / quiz score"). In "max" mode each column also has its maximum. Doesn't include the first column (Students/Groups) or the fixed Total Score column at the end. */
function buildTableColumnsBlock(tool, cfg, container) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Columns";
  wrap.appendChild(heading);

  const countRow = document.createElement("div");
  countRow.className = "mapping-row";
  const countInput = document.createElement("input");
  countInput.type = "text";
  countInput.inputMode = "numeric";
  countInput.value = cfg.columns.length;
  countInput.addEventListener("change", async () => {
    ScoringModule.setTableColumnCount(tool.id, countInput.value);
    await saveScoringToolThen(tool, container);
  });
  const countHint = document.createElement("label");
  countHint.textContent = "Number of columns (a Total Score column is always added at the end)";
  countRow.append(countInput, countHint);
  wrap.appendChild(countRow);

  const list = document.createElement("ul");
  list.className = "infraction-edit-list";
  cfg.columns.forEach((column) => {
    const li = document.createElement("li");

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = column.name;
    nameInput.addEventListener("change", async () => {
      ScoringModule.setTableColumnName(tool.id, column.id, nameInput.value);
      await saveScoringToolThen(tool, container);
    });
    li.appendChild(nameInput);

    const typeSelect = document.createElement("select");
    [
      ["score", "Score"],
      ["test", "Test / quiz score"],
    ].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      if (val === column.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener("change", async () => {
      ScoringModule.setTableColumnType(tool.id, column.id, typeSelect.value);
      await saveScoringToolThen(tool, container);
    });
    li.appendChild(typeSelect);

    if (cfg.mode === "max") {
      const maxInput = document.createElement("input");
      maxInput.type = "text";
      maxInput.inputMode = "decimal";
      maxInput.className = "point-value-input";
      maxInput.title = "Maximum score for this column (for each sub-row, if the tracker has sub-rows)";
      maxInput.placeholder = "Max";
      maxInput.value = column.maxPoints || "";
      maxInput.addEventListener("change", async () => {
        ScoringModule.setTableColumnMaxPoints(tool.id, column.id, maxInput.value);
        await saveScoringToolThen(tool, container);
      });
      li.appendChild(maxInput);
    }

    if (column.type === "test") {
      li.appendChild(
        buildTestSourceSelect(column.testSource, async (sourceToolId, testId) => {
          ScoringModule.setTableColumnTestSource(tool.id, column.id, sourceToolId, testId);
          await saveScoringToolThen(tool, container);
        })
      );
      if (cfg.firstColumn.mode === "groups") {
        const note = document.createElement("span");
        note.className = "hint";
        note.textContent = "Only works when rows are Students.";
        li.appendChild(note);
      }
    }

    list.appendChild(li);
  });
  wrap.appendChild(list);

  return wrap;
}

/** Whole-tracker setting: raw points, or out of maximum points (each column then has a maximum, and the Total Score's maximum is worked out automatically). */
function buildTableModeBlock(tool, cfg, container) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Scoring type";
  wrap.appendChild(heading);

  const row = document.createElement("div");
  row.className = "mapping-row";
  const modeSelect = document.createElement("select");
  [
    ["raw", "Raw points (no maximums)"],
    ["max", "Out of maximum points"],
  ].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    if (val === cfg.mode) opt.selected = true;
    modeSelect.appendChild(opt);
  });
  modeSelect.addEventListener("change", async () => {
    ScoringModule.setTableMode(tool.id, modeSelect.value);
    await saveScoringToolThen(tool, container);
  });
  row.appendChild(modeSelect);
  wrap.appendChild(row);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    cfg.mode === "max"
      ? `Give each column its maximum below. The Total Score is worked out automatically as the sum of those maximums (currently ${ScoringModule.tableMaxTotal(tool.id)}), and Main Scores receives it as a percentage × 100 (e.g. 17 out of 20 → 85).`
      : "Scores are plain points; the Total Score is their sum, and Main Scores receives that sum as-is.";
  wrap.appendChild(hint);
  return wrap;
}

/** Sub-rows: a list of names shared by every row. Each row's boxes then add up their sub-rows. */
function buildTableSubRowsBlock(tool, cfg, container) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Sub-rows";
  wrap.appendChild(heading);

  const countRow = document.createElement("div");
  countRow.className = "mapping-row";
  const countInput = document.createElement("input");
  countInput.type = "text";
  countInput.inputMode = "numeric";
  countInput.value = cfg.subRows.length;
  countInput.addEventListener("change", async () => {
    ScoringModule.setTableSubRowCount(tool.id, countInput.value);
    await saveScoringToolThen(tool, container);
  });
  const countHint = document.createElement("label");
  countHint.textContent = "Number of sub-rows under each row (0 = none)";
  countRow.append(countInput, countHint);
  wrap.appendChild(countRow);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "With sub-rows, scores are entered on the sub-rows; each box in the main row shows the sum of its sub-rows, and those boxes add up in Total Score. Test / quiz columns aren't split into sub-rows. Scores typed directly into main rows before adding sub-rows are kept, but aren't counted while sub-rows exist.";
  wrap.appendChild(hint);

  if (cfg.subRows.length > 0) {
    const list = document.createElement("ul");
    list.className = "infraction-edit-list";
    cfg.subRows.forEach((sub) => {
      const li = document.createElement("li");
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = sub.name;
      nameInput.addEventListener("change", async () => {
        ScoringModule.setTableSubRowName(tool.id, sub.id, nameInput.value);
        await saveScoringToolThen(tool, container);
      });
      li.appendChild(nameInput);
      list.appendChild(li);
    });
    wrap.appendChild(list);
  }
  return wrap;
}

/** Settings for the fixed Total Score column: plain sum, or the sum out of a maximum (which Main Scores receives as a percentage × 100). */
function buildTableTotalColumnBlock(tool, cfg, container, projectId) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Total Score column";
  wrap.appendChild(heading);

  const row = document.createElement("div");
  row.className = "mapping-row";

  const modeSelect = document.createElement("select");
  [
    ["raw", "Raw points"],
    ["max", "Out of a maximum"],
  ].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    if (val === cfg.totalColumn.mode) opt.selected = true;
    modeSelect.appendChild(opt);
  });
  modeSelect.addEventListener("change", async () => {
    ScoringModule.setTableTotalMode(tool.id, modeSelect.value, projectId);
    await saveScoringToolThen(tool, container);
  });
  row.appendChild(modeSelect);

  if (cfg.totalColumn.mode === "max") {
    const maxInput = document.createElement("input");
    maxInput.type = "text";
    maxInput.inputMode = "decimal";
    maxInput.className = "point-value-input";
    maxInput.title = "Maximum total score";
    maxInput.placeholder = "Max";
    maxInput.value = cfg.totalColumn.maxPoints || "";
    maxInput.addEventListener("change", async () => {
      ScoringModule.setTableTotalMaxPoints(tool.id, maxInput.value, projectId);
      await saveScoringToolThen(tool, container);
    });
    row.appendChild(maxInput);
  }
  wrap.appendChild(row);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    cfg.totalColumn.mode === "max"
      ? "Main Scores receives this as a percentage × 100 (e.g. 17 out of 20 → 85), then blends it by the item's Sources weights."
      : "Main Scores receives the plain sum, then blends it by the item's Sources weights.";
  wrap.appendChild(hint);

  return wrap;
}

// ----- Presentation Calc scoring tool -----
//
// A scoring tool (added from Main Scores' Settings, like the Progress
// Tracker) with three pages: Scores (a grid of one row per presentation
// group, one column per active rubric, plus a fixed Total Score column
// with the same raw / out-of-max setting as the Progress Tracker),
// Student Groups (import the roster + group numbers from a Seating
// Chart memory bank), and Rubrics (the rubric bank plus the active
// Teacher / Audience rubrics that become the score columns). Everything
// is stored inside the tool's config and saved with "Save Scoring".

const presentationToolPage = new Map(); // toolId -> subtab showing: "scores" | "groups" | "rubrics" | "templates"
const presentationToolProject = new Map(); // toolId -> id of the project tab showing

function renderScoringToolPresentationView(tool, container) {
  const toolCfg = ScoringModule.getPresentationConfig(tool.id);
  container.innerHTML = "";
  const rerender = () => renderScoringToolView(tool, container);

  // Which project is showing (the first one if the remembered one is gone).
  let projectId = presentationToolProject.get(tool.id);
  if (!toolCfg.projects.some((p) => p.id === projectId)) {
    projectId = toolCfg.projects.length > 0 ? toolCfg.projects[0].id : null;
  }
  presentationToolProject.set(tool.id, projectId);

  const addProject = () => {
    const name = prompt("Name for the new project:", `Project ${toolCfg.projects.length + 1}`);
    if (name === null) return;
    try {
      const project = ScoringModule.addPresentationProject(tool.id, name);
      presentationToolProject.set(tool.id, project.id);
      presentationToolPage.set(tool.id, "groups"); // a new project starts at the first thing to set up
    } catch (err) {
      alert(err.message);
      return;
    }
    rerender();
  };

  // ----- Project tabs (one per project) + "+ New Project" -----
  const projectRow = document.createElement("div");
  projectRow.className = "level-tab-row level3-row"; // 3rd level of tabs: outlined, joined to its panel below
  toolCfg.projects.forEach((project) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn" + (project.id === projectId ? " tab-btn-active" : "");
    btn.textContent = project.name;
    btn.addEventListener("click", () => {
      presentationToolProject.set(tool.id, project.id);
      rerender();
    });
    projectRow.appendChild(btn);
  });
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "btn btn-ghost btn-small";
  newBtn.textContent = "+ New Project";
  newBtn.style.alignSelf = "center";
  newBtn.style.margin = "0 0 6px 8px";
  newBtn.addEventListener("click", addProject);
  projectRow.appendChild(newBtn);
  container.appendChild(projectRow);

  if (!projectId) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      'A Presentation Calc is organized into projects (for example "Midterm Presentations"). Click "+ New Project", give it a name, then set up its Student Groups, Rubrics, Scores, and Templates.';
    container.appendChild(hint);
    return;
  }

  const project = toolCfg.projects.find((p) => p.id === projectId);

  // The open project's contents sit in an outlined panel that joins its tab.
  const projectPanel = document.createElement("div");
  projectPanel.className = "level-panel level3-panel";
  container.appendChild(projectPanel);

  // ----- Project name + rename / delete -----
  const header = document.createElement("div");
  header.className = "panel-toolbar";
  const title = document.createElement("span");
  title.className = "hint";
  title.textContent = `Project: ${project.name}`;
  header.appendChild(title);
  const headerButtons = document.createElement("div");
  headerButtons.className = "panel-toolbar-buttons";
  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "btn btn-ghost btn-small";
  renameBtn.textContent = "Rename Project";
  renameBtn.addEventListener("click", () => {
    const name = prompt("Rename project:", project.name);
    if (name === null) return;
    ScoringModule.renamePresentationProject(tool.id, project.id, name);
    rerender();
  });
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-ghost btn-small";
  deleteBtn.textContent = "Delete Project";
  deleteBtn.addEventListener("click", () => {
    if (!confirm(`Delete the project "${project.name}"? Its groups, rubrics, and scores are removed, and Main Scores items pulling from it lose those scores.`)) return;
    ScoringModule.removePresentationProject(tool.id, project.id);
    rerender();
  });
  headerButtons.append(renameBtn, deleteBtn);
  header.appendChild(headerButtons);
  projectPanel.appendChild(header);

  // ----- The project's four subtabs -----
  const page = presentationToolPage.get(tool.id) || "scores";
  const tabRow = document.createElement("div");
  tabRow.className = "level-tab-row level4-row"; // 4th level of tabs
  [
    ["scores", "Scores"],
    ["groups", "Student Groups"],
    ["rubrics", "Rubrics"],
    ["templates", "QR Forms"],
  ].forEach(([id, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn" + (id === page ? " tab-btn-active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      presentationToolPage.set(tool.id, id);
      rerender();
    });
    tabRow.appendChild(btn);
  });
  projectPanel.appendChild(tabRow);

  const pagePanel = document.createElement("div");
  pagePanel.className = "level-panel level4-panel";
  projectPanel.appendChild(pagePanel);

  if (page === "groups") pagePanel.appendChild(buildPresentationGroupsPage(tool, project, container));
  else if (page === "rubrics") pagePanel.appendChild(buildPresentationRubricsPage(tool, project, container));
  else if (page === "templates") pagePanel.appendChild(buildPresentationTemplatesPage(tool, project, container));
  else pagePanel.appendChild(buildPresentationScoresPage(tool, project, container));
}

// ----- Scores page -----

// ----- Presentation Calc: clearly separated sections -----

/** A section with a header bar and a padded body, used on every Presentation Calc subtab. Returns { section, body }. */
function makePresSection(title) {
  const section = document.createElement("div");
  section.className = "pres-section";
  const head = document.createElement("div");
  head.className = "pres-section-head";
  head.textContent = title;
  const body = document.createElement("div");
  body.className = "pres-section-body";
  section.append(head, body);
  return { section, body };
}

/** Wraps an existing block (whose own heading becomes the header bar) in a section. */
function presSectionFromBlock(block, titleOverride) {
  const h = block.querySelector(":scope > h3, :scope > h4, :scope > h5");
  const title = titleOverride || (h ? h.textContent : "");
  if (h) h.remove();
  block.removeAttribute("style");
  block.classList.remove("attendance-settings-block");
  const { section, body } = makePresSection(title);
  body.appendChild(block);
  return section;
}

/** Puts everything already built for a page inside one titled section. */
function presPageInSection(page, title) {
  const { section, body } = makePresSection(title);
  while (page.firstChild) body.appendChild(page.firstChild);
  const wrapper = document.createElement("div");
  wrapper.appendChild(section);
  return wrapper;
}

function buildPresentationScoresPage(tool, cfg, container) {
  const page = document.createElement("div");
  const scoresSection = makePresSection("Scores");
  page.appendChild(scoresSection.section);
  const columns = ScoringModule.presentationColumns(tool.id, cfg.id);
  const rubricColumnCount = columns.filter((c) => c.kind !== "peer").length; // the Peer Evaluation column is always there
  const groups = ScoringModule.presentationGroups(tool.id, cfg.id);

  const hint = document.createElement("p");
  hint.className = "hint";
  if (groups.length === 0) {
    hint.textContent = 'No groups yet — open "Student Groups" and import a seating arrangement that has Group Numbers set.';
  } else if (rubricColumnCount === 0) {
    hint.textContent = 'No score columns yet — open "Rubrics" and activate at least one Teacher or Audience rubric.';
  } else {
    hint.textContent =
      "Enter one score per group for each rubric; the Total Score column adds up each row (weighted by the Weight row — enter percentages that add up to 100; with none entered the scores are simply added), and every student in a group shares their group's total. The Peer Evaluation column is each group's average peer rating — the Teacher, Audience and Peer cells are loaded automatically from the data sets in use on the QR Forms tab, and you can also type scores in. To use it in Main Scores, open an item's Sources panel, give this tool a weight, and choose this project.";
  }
  scoresSection.body.appendChild(hint);

  // ----- Which QR Forms data sets are loaded into the grid -----
  {
    const using = document.createElement("p");
    using.className = "hint";
    const labels = { teacher: "Teacher", audience: "Audience", peer: "Peer Evaluation" };
    const inUse = ["teacher", "audience", "peer"]
      .map((kind) => [kind, ScoringModule.presentationSelectedSet(tool.id, cfg.id, kind)])
      .filter(([, set]) => set);
    using.innerHTML = "<strong>Loaded from QR Forms:</strong> ";
    using.appendChild(
      document.createTextNode(
        inUse.length
          ? inUse.map(([kind, set]) => `${labels[kind]} — ${set.name}`).join("; ") + ". Choose a different data set on the QR Forms tab to load it here."
          : "nothing yet — launch a QR code on the QR Forms tab and choose a data set."
      )
    );
    scoresSection.body.appendChild(using);
  }

  const viewKey = `${tool.id}|${cfg.id}`;
  const view = presScoreView.get(viewKey) === "student" ? "student" : "group";
  if (groups.length > 0) {
    const toggle = document.createElement("div");
    toggle.className = "attendance-view-toggle";
    [["group", "By group"], ["student", "By student"]].forEach(([id, text]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-small " + (view === id ? "btn-primary" : "btn-ghost");
      b.textContent = text;
      b.addEventListener("click", () => { presScoreView.set(viewKey, id); renderScoringToolView(tool, container); });
      toggle.appendChild(b);
    });
    scoresSection.body.appendChild(toggle);
  }

  if (view === "student" && groups.length > 0) {
    scoresSection.body.appendChild(buildPresStudentTable(tool, cfg, container, columns));
  } else if (groups.length > 0 && rubricColumnCount > 0) {
    const wrap = document.createElement("div");
    wrap.className = "attendance-table-wrap";
    const table = document.createElement("table");
    table.className = "attendance-table scoring-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const groupTh = document.createElement("th");
    groupTh.textContent = "Group";
    headRow.appendChild(groupTh);
    columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.points > 0 ? `${col.label} (/${col.points})` : col.label;
      headRow.appendChild(th);
    });
    const totalTh = document.createElement("th");
    totalTh.textContent =
      cfg.totalColumn.mode === "max" && cfg.totalColumn.maxPoints > 0
        ? `Total Score (/${cfg.totalColumn.maxPoints})`
        : "Total Score";
    headRow.appendChild(totalTh);
    thead.appendChild(headRow);

    // Weight row: each rubric's weight as a percentage of the Total Score; the box at the right shows their sum.
    const weightRow = document.createElement("tr");
    const weightLabelTh = document.createElement("th");
    weightLabelTh.textContent = "Weight";
    weightRow.appendChild(weightLabelTh);
    columns.forEach((col) => {
      const th = document.createElement("th");
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.className = "weight-input";
      input.value = col.weight === null ? "" : col.weight;
      input.placeholder = "%";
      input.title = "Weight, as a percentage of the Total Score. Enter percentages for all the rubrics so they add up to 100 (see the box at the right).";
      input.addEventListener("change", () => {
        ScoringModule.presSetActiveWeight(tool.id, cfg.id, col.kind, col.entryId, input.value);
        renderScoringToolView(tool, container);
      });
      th.appendChild(input);
      weightRow.appendChild(th);
    });
    // Sum of the weights: green at exactly 100, red over 100.
    const sumTh = document.createElement("th");
    const weightSum = ScoringModule.presentationWeightSum(tool.id, cfg.id);
    const sumBox = document.createElement("div");
    sumBox.className = "weight-total-box";
    if (!weightSum.anySet) {
      sumBox.textContent = "Weights: not set";
      sumBox.title = "With no weights entered, the rubric scores are simply added up.";
    } else {
      const shown = Math.round(weightSum.total * 100) / 100;
      if (shown === 100) sumBox.classList.add("weight-total-ok");
      else if (shown > 100) sumBox.classList.add("weight-total-over");
      sumBox.textContent = `Weights: ${shown}%${shown === 100 ? " ✓" : shown > 100 ? " (over 100)" : ""}`;
      sumBox.title = "The weights should add up to 100%.";
    }
    sumTh.appendChild(sumBox);
    weightRow.appendChild(sumTh);
    thead.appendChild(weightRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    groups.forEach((group) => {
      const tr = document.createElement("tr");

      const labelTd = document.createElement("td");
      labelTd.textContent = `Group ${group}`;
      const members = cfg.roster.filter((e) => e.group === group).map((e) => (e.name || "(unnamed)") + (ScoringModule.presentationAttendanceCode(cfg, e.studentId) && ScoringModule.presentationAttendanceCode(cfg, e.studentId) !== "P" ? ` (${ScoringModule.presentationAttendanceCode(cfg, e.studentId)})` : ""));
      if (members.length > 0) {
        const memberLine = document.createElement("div");
        memberLine.className = "hint";
        memberLine.textContent = members.join(", ");
        labelTd.appendChild(memberLine);
      }
      tr.appendChild(labelTd);

      columns.forEach((col) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.className = "scoring-score-input";
        input.value = ScoringModule.getPresentationValue(tool.id, cfg.id, group, col.entryId);
        if (col.points > 0) {
          input.placeholder = `/${col.points}`;
          input.title = `Out of ${col.points}`;
        }
        input.addEventListener("change", () => {
          try {
            ScoringModule.setPresentationValue(tool.id, cfg.id, group, col.entryId, input.value);
          } catch (err) {
            alert(err.message);
            input.value = ScoringModule.getPresentationValue(tool.id, cfg.id, group, col.entryId);
            return;
          }
          renderScoringToolView(tool, container);
        });
        td.appendChild(input);
        tr.appendChild(td);
      });

      const totalTd = document.createElement("td");
      totalTd.className = "attendance-stat-cell";
      const sum = ScoringModule.computePresentationSum(tool.id, cfg.id, group);
      if (sum === null) {
        totalTd.textContent = "—";
      } else {
        const shown = Math.round(sum * 100) / 100;
        totalTd.textContent =
          cfg.totalColumn.mode === "max" && cfg.totalColumn.maxPoints > 0
            ? `${shown}/${cfg.totalColumn.maxPoints}`
            : String(shown);
      }
      tr.appendChild(totalTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    scoresSection.body.appendChild(wrap);
  }

  // Penalty for missing (or being late to) the presentations, taken from the attendance record of one class date.
  if (groups.length > 0) {
    const abs = makePresSection("Absences");
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Choose the class date on which the presentations were given. Each student's attendance code on that date (A = absent, L = late, …) decides their penalty, set below. Only that student's own score is reduced; the rest of their group keeps the group's score. The penalty applies in Main Scores and on the student's report page. Use the By student view to waive or force a penalty for one student.";
    abs.body.appendChild(note);
    const sessions = AttendanceModule.currentCourseId === ScoringModule.currentCourseId ? AttendanceModule.sessions : [];
    const dateRow = document.createElement("div");
    dateRow.className = "mapping-row";
    const dateLabel = document.createElement("label");
    dateLabel.textContent = "Class date";
    const dateSel = document.createElement("select");
    const none = document.createElement("option"); none.value = ""; none.textContent = sessions.length ? "(no penalty — choose a date)" : "(no attendance sessions yet)"; dateSel.appendChild(none);
    sessions.forEach((s, i) => {
      const o = document.createElement("option"); o.value = s.id;
      o.textContent = `Class ${s.number || i + 1}${s.date ? " — " + s.date : " (no date set)"}`;
      if (s.id === cfg.absenceSession) o.selected = true;
      dateSel.appendChild(o);
    });
    dateSel.addEventListener("change", () => { ScoringModule.setPresentationAbsenceSession(tool.id, cfg.id, dateSel.value); renderScoringToolView(tool, container); });
    dateRow.append(dateLabel, dateSel);
    abs.body.appendChild(dateRow);

    const modeRow = document.createElement("div");
    modeRow.className = "mapping-row";
    const modeLabel = document.createElement("label");
    modeLabel.textContent = "Penalty is";
    const modeSel = document.createElement("select");
    [["percent", "a % of the student's Total Score"], ["points", "points off the Total Score"]].forEach(([id, text]) => {
      const o = document.createElement("option"); o.value = id; o.textContent = text; if (id === cfg.absencePenalty.mode) o.selected = true; modeSel.appendChild(o);
    });
    modeSel.addEventListener("change", () => { ScoringModule.setPresentationAbsencePenalty(tool.id, cfg.id, modeSel.value); renderScoringToolView(tool, container); });
    modeRow.append(modeLabel, modeSel);
    abs.body.appendChild(modeRow);

    const unit = cfg.absencePenalty.mode === "points" ? "points" : "%";
    AttendanceModule.settings.participationTypes.filter((code) => code !== "P").forEach((code) => {
      const row = document.createElement("div");
      row.className = "mapping-row";
      const label = document.createElement("label");
      label.textContent = `Penalty for "${code}"`;
      const input = document.createElement("input");
      input.type = "text"; input.inputMode = "decimal"; input.className = "point-value-input";
      input.value = cfg.absencePenalty.amounts[code] ? String(cfg.absencePenalty.amounts[code]) : "";
      input.placeholder = "0";
      input.addEventListener("change", () => { ScoringModule.setPresentationAbsencePenalty(tool.id, cfg.id, null, code, input.value); renderScoringToolView(tool, container); });
      row.append(label, input, document.createTextNode(` ${unit}`));
      abs.body.appendChild(row);
    });

    const hit = cfg.roster.filter((e) => e.group && ScoringModule.isPresentationPenalized(cfg, e.studentId));
    if (hit.length) {
      const sum = document.createElement("p");
      sum.className = "hint";
      sum.textContent = "Penalized: " + hit.map((e) => {
        const v = ScoringModule.computePresentationStudentSum(tool.id, cfg.id, e.studentId);
        return `${e.name || "(unnamed)"} (${ScoringModule.presentationPenaltyInfo(cfg, e.studentId).code || "forced"}) → ${v === null ? "—" : Math.round(v * 100) / 100}`;
      }).join(" · ");
      abs.body.appendChild(sum);
    }
    page.appendChild(abs.section);
  }

  // Same raw / out-of-max setting as the Progress Tracker's Total Score column.
  page.appendChild(presSectionFromBlock(buildTableTotalColumnBlock(tool, cfg, container, cfg.id), "Total Score Column"));
  page.appendChild(presSectionFromBlock(buildPresentationPrintSection(tool, cfg), "Print"));
  page.appendChild(presSectionFromBlock(buildPresentationEmailSection(tool, cfg), "Email as PDF"));
  return page;
}

// ----- Student Groups page -----

function buildPresentationGroupsPage(tool, cfg, container) {
  const page = document.createElement("div");

  const toolbar = document.createElement("div");
  toolbar.className = "panel-toolbar";
  const status = document.createElement("span");
  status.className = "result";
  toolbar.appendChild(status);

  const controls = document.createElement("div");
  controls.className = "panel-toolbar-buttons";
  const bankLabel = document.createElement("label");
  bankLabel.textContent = "Memory bank:";
  const bankSelect = document.createElement("select");
  SeatingModule.banks.forEach((bank, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = bank.snapshot ? bank.name : `${bank.name} (empty)`;
    opt.disabled = !bank.snapshot;
    bankSelect.appendChild(opt);
  });
  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "btn btn-ghost";
  importBtn.textContent = "Import from Bank";
  importBtn.addEventListener("click", () => {
    const bank = SeatingModule.banks[Number(bankSelect.value)];
    try {
      ScoringModule.importPresentationRoster(tool.id, cfg.id, bank, RosterModule);
    } catch (err) {
      status.textContent = `Couldn't import: ${err.message}`;
      return;
    }
    renderScoringToolView(tool, container);
  });
  controls.append(bankLabel, bankSelect, importBtn);
  toolbar.appendChild(controls);
  page.appendChild(toolbar);

  const source = document.createElement("p");
  source.className = "hint";
  source.textContent = cfg.sourceBankName
    ? `Imported from: ${cfg.sourceBankName} — ${cfg.roster.length} seated student(s). Click Save Scoring to store it.`
    : "";
  page.appendChild(source);

  const table = document.createElement("table");
  table.className = "roster-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Class #", "Name", "Pronunciation", "School ID", "Group"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  if (cfg.roster.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "hint";
    td.textContent = 'No roster imported yet — choose a memory bank above and click "Import from Bank".';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    cfg.roster.forEach((entry) => {
      const tr = document.createElement("tr");
      [
        entry.classNumber ? `#${entry.classNumber}` : "—",
        entry.name || "(unnamed)",
        entry.pronunciation || "",
        entry.schoolId || "",
        entry.group ? String(entry.group) : "—",
      ].forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  page.appendChild(table);

  return presPageInSection(page, "Student Groups");
}

// ----- Rubrics page -----

function buildPresentationRubricsPage(tool, cfg, container) {
  const page = document.createElement("div");
  const rerender = () => renderScoringToolView(tool, container);

  const status = document.createElement("p");
  status.className = "result";
  page.appendChild(status);

  const topRow = document.createElement("div");
  topRow.className = "rubrics-top-row";
  topRow.appendChild(presSectionFromBlock(buildPresentationActiveBlock(tool, cfg, "teacher", "Active Teacher Rubrics", rerender, status)));
  topRow.appendChild(presSectionFromBlock(buildPresentationActiveBlock(tool, cfg, "audience", "Active Audience Rubrics", rerender, status)));
  page.appendChild(topRow);

  page.appendChild(presSectionFromBlock(buildPresentationBankBlock(tool, cfg, rerender, status)));
  return page;
}

/** One "Active ... Rubrics" block: a rubric picker table and, beside it, a matching points table. Each active rubric becomes a score column on the Scores page. */
function buildPresentationActiveBlock(tool, cfg, kind, title, rerender, status) {
  const list = kind === "audience" ? cfg.audienceRubrics : cfg.teacherRubrics;

  const block = document.createElement("div");
  block.className = "rubric-active-block";
  const heading = document.createElement("h5");
  heading.textContent = title;
  block.appendChild(heading);

  const gridWrap = document.createElement("div");
  gridWrap.className = "rubric-active-grid-wrap";

  const rubricTable = document.createElement("table");
  rubricTable.className = "rubric-active-grid";
  rubricTable.innerHTML = "<thead><tr><th>Rubric</th><th></th></tr></thead>";
  const rubricBody = document.createElement("tbody");
  rubricTable.appendChild(rubricBody);

  const pointsTable = document.createElement("table");
  pointsTable.className = "rubric-points-grid";
  pointsTable.innerHTML = "<thead><tr><th>Points</th></tr></thead>";
  const pointsBody = document.createElement("tbody");
  pointsTable.appendChild(pointsBody);

  if (list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.className = "hint";
    td.textContent = "+ Add Rubric below to activate one from the Rubric Bank.";
    tr.appendChild(td);
    rubricBody.appendChild(tr);
  }

  list.forEach((entry) => {
    const tr = document.createElement("tr");
    const selectTd = document.createElement("td");
    const select = document.createElement("select");
    const blankOpt = document.createElement("option");
    blankOpt.value = "";
    blankOpt.textContent = "— Choose a rubric —";
    select.appendChild(blankOpt);
    if (window.fillRubricSelect) window.fillRubricSelect(select, entry.rubricId); // grouped by Rubric Bank section
    else RubricBankModule.rubrics.forEach((rubric) => {
      const opt = document.createElement("option");
      opt.value = rubric.id;
      opt.textContent = rubric.text || "(untitled rubric)";
      if (entry.rubricId === rubric.id) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      ScoringModule.presSetActiveSelection(tool.id, cfg.id, kind, entry.id, select.value);
    });
    selectTd.appendChild(select);
    tr.appendChild(selectTd);

    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost btn-small";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove this active rubric";
    removeBtn.addEventListener("click", () => {
      ScoringModule.presRemoveActiveRubric(tool.id, cfg.id, kind, entry.id);
      rerender();
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);
    rubricBody.appendChild(tr);

    const pointsTr = document.createElement("tr");
    const pointsTd = document.createElement("td");
    const pointsSelect = document.createElement("select");
    for (let n = 0; n <= MAX_RUBRIC_POINTS; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (entry.points === n) opt.selected = true;
      pointsSelect.appendChild(opt);
    }
    pointsSelect.addEventListener("change", () => {
      ScoringModule.presSetActivePoints(tool.id, cfg.id, kind, entry.id, pointsSelect.value);
    });
    pointsTd.appendChild(pointsSelect);
    pointsTr.appendChild(pointsTd);
    pointsBody.appendChild(pointsTr);
  });

  gridWrap.append(rubricTable, pointsTable);
  block.appendChild(gridWrap);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-ghost btn-small";
  addBtn.textContent = "+ Add Rubric";
  addBtn.addEventListener("click", () => {
    try {
      ScoringModule.presAddActiveRubric(tool.id, cfg.id, kind);
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    rerender();
  });
  block.appendChild(addBtn);

  return block;
}

/** The shared Rubric Bank: free-text rubric descriptions used by every project in every course. */
function buildPresentationBankBlock(tool, cfg, rerender, status) {
  const block = document.createElement("div");
  block.className = "rubric-bank-block";
  const heading = document.createElement("h5");
  heading.textContent = "Rubric Bank (shared by every project and course)";
  block.appendChild(heading);

  const table = document.createElement("table");
  table.className = "rubric-bank-grid";
  table.innerHTML = "<thead><tr><th>Rubric</th><th></th></tr></thead>";
  const tbody = document.createElement("tbody");

  if (RubricBankModule.rubrics.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.className = "hint";
    td.textContent = 'No rubrics yet — click "+ Add Rubric" below to write one.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  RubricBankModule.rubrics.forEach((rubric) => {
    const tr = document.createElement("tr");

    const textTd = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.value = rubric.text;
    input.placeholder = "Describe the rubric…";
    input.addEventListener("change", () => {
      RubricBankModule.setText(rubric.id, input.value);
      rerender(); // the text may be shown in an active rubric's dropdown
    });
    textTd.appendChild(input);
    tr.appendChild(textTd);

    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost btn-small";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove this rubric from the shared bank";
    removeBtn.addEventListener("click", () => {
      if (!confirm("Remove this rubric from the shared bank? It disappears for every course. Projects in other courses using it will lose that column until you pick another rubric.")) return;
      ScoringModule.presRemoveRubricBankRow(rubric.id);
      rerender();
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  block.appendChild(table);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-ghost btn-small";
  addBtn.textContent = "+ Add Rubric";
  addBtn.addEventListener("click", () => {
    try {
      RubricBankModule.add();
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    rerender();
  });
  block.appendChild(addBtn);

  return block;
}

// ----- Test & Quiz Bank scoring tool -----
//
// A scoring tool that holds any number of tests/quizzes. Upload a CSV
// or Excel file of scores, say which row is the header, and which
// columns hold the student names and/or School IDs and the scores;
// each student is then matched to the roster (School ID first, then
// name). Items in Main Scores (via their Sources panel) and Progress
// Tracker columns can then pull from any test/quiz in the bank.
// Everything is stored inside the tool's config and saved with
// "Save Scoring".

const testBankImports = new Map(); // toolId -> the upload currently being mapped
const testBankStatus = new Map(); // toolId -> last status message
const testBankExpanded = new Map(); // toolId -> Set of test ids whose details are open

function testBankHeaderIndex(state) {
  return Math.max(0, Math.min(state.rawRows.length - 1, (Number(state.headerRow) || 1) - 1));
}

function testBankHeaders(state) {
  return state.rawRows[testBankHeaderIndex(state)].map((cell) => String(cell).trim());
}

/** Every non-blank row below the chosen header row. */
function testBankDataRows(state) {
  return state.rawRows
    .slice(testBankHeaderIndex(state) + 1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));
}

/** Best-effort guess at which columns hold the School ID, name, and score, from the header text. */
function applyTestBankGuess(state) {
  const headers = testBankHeaders(state);
  state.idCol = headers.findIndex((h) => /id|学籍|学生番号|番号/i.test(h));
  state.nameCol = headers.findIndex((h, i) => i !== state.idCol && /name|氏名|名前/i.test(h));
  state.scoreCol = headers.findIndex(
    (h, i) => i !== state.idCol && i !== state.nameCol && /score|point|total|mark|得点|点数|合計|点/i.test(h)
  );
}

function renderScoringToolTestBankView(tool, container) {
  ScoringModule.getTestBankConfig(tool.id);
  container.innerHTML = "";
  const rerender = () => renderScoringToolView(tool, container);
  const state = testBankImports.get(tool.id);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "Upload a CSV or Excel file of scores for one test or quiz at a time. Then, in Main Scores, open an item's Sources panel, give this bank a weight, and choose which test/quiz it pulls from. Progress Tracker columns can also pull from a test/quiz.";
  container.appendChild(hint);

  // ----- Upload toolbar -----
  const toolbar = document.createElement("div");
  toolbar.className = "panel-toolbar";
  const status = document.createElement("span");
  status.className = "result";
  status.textContent = testBankStatus.get(tool.id) || "";
  toolbar.appendChild(status);

  const buttons = document.createElement("div");
  buttons.className = "panel-toolbar-buttons";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".csv,.xlsx,.xls";
  fileInput.hidden = true;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (rawRows.length < 2) throw new Error("The file needs a header row and at least one row of scores.");
      const fresh = {
        fileName: file.name,
        rawRows,
        headerRow: 1,
        name: file.name.replace(/\.[^.]+$/, ""),
        maxPoints: "",
        nameCol: -1,
        idCol: -1,
        scoreCol: -1,
      };
      applyTestBankGuess(fresh);
      testBankImports.set(tool.id, fresh);
      testBankStatus.delete(tool.id);
    } catch (err) {
      testBankStatus.set(tool.id, `Couldn't read that file: ${err.message}`);
    }
    rerender();
  });
  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.className = "btn btn-ghost";
  uploadBtn.textContent = "Upload CSV / Excel";
  uploadBtn.addEventListener("click", () => fileInput.click());
  buttons.append(fileInput, uploadBtn);
  toolbar.appendChild(buttons);
  container.appendChild(toolbar);

  if (state) container.appendChild(buildTestBankImportPanel(tool, state, rerender));
  container.appendChild(buildTestBankTable(tool, rerender));
}

/** The "match your file's columns" step shown right after a file is chosen. */
function buildTestBankImportPanel(tool, state, rerender) {
  const headers = testBankHeaders(state);
  const dataRows = testBankDataRows(state);

  const panel = document.createElement("div");
  panel.className = "mapping-panel";
  const heading = document.createElement("h3");
  heading.textContent = "Match your file's columns";
  panel.appendChild(heading);
  const info = document.createElement("p");
  info.className = "hint";
  info.textContent = `${state.fileName} — ${dataRows.length} row(s) below the header row. Choose which column holds each thing below.`;
  panel.appendChild(info);

  const addRow = (labelText, control) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    const label = document.createElement("label");
    label.textContent = labelText;
    row.append(label, control);
    panel.appendChild(row);
  };

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = state.name;
  nameInput.addEventListener("input", () => {
    state.name = nameInput.value;
  });
  addRow("Test / quiz name", nameInput);

  const maxInput = document.createElement("input");
  maxInput.type = "text";
  maxInput.inputMode = "decimal";
  maxInput.className = "point-value-input";
  maxInput.placeholder = "Optional";
  maxInput.title = "The highest possible score. Leave blank if you don't want scores scaled.";
  maxInput.value = state.maxPoints;
  maxInput.addEventListener("input", () => {
    state.maxPoints = maxInput.value;
  });
  addRow("Maximum score", maxInput);

  const headerRowInput = document.createElement("input");
  headerRowInput.type = "text";
  headerRowInput.inputMode = "numeric";
  headerRowInput.className = "point-value-input";
  headerRowInput.value = state.headerRow;
  headerRowInput.title = "The row number that holds the column headings; rows above it are ignored";
  headerRowInput.addEventListener("change", () => {
    state.headerRow = Math.max(1, Math.min(state.rawRows.length - 1, Math.round(Number(headerRowInput.value) || 1)));
    applyTestBankGuess(state);
    rerender();
  });
  addRow("Header row number", headerRowInput);

  const makeSelect = (selected, noneLabel, onChange) => {
    const select = document.createElement("select");
    const none = document.createElement("option");
    none.value = "-1";
    none.textContent = noneLabel;
    select.appendChild(none);
    headers.forEach((header, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = header || `Column ${idx + 1}`;
      select.appendChild(opt);
    });
    select.value = String(selected);
    select.addEventListener("change", () => onChange(Number(select.value)));
    return select;
  };
  addRow("Student name column", makeSelect(state.nameCol, "(not in this file)", (v) => (state.nameCol = v)));
  addRow("School ID column", makeSelect(state.idCol, "(not in this file)", (v) => (state.idCol = v)));
  addRow("Score column", makeSelect(state.scoreCol, "(choose a column)", (v) => (state.scoreCol = v)));

  const buttons = document.createElement("div");
  buttons.className = "mapping-buttons";

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "btn btn-primary";
  importBtn.textContent = "Import & Match";
  importBtn.addEventListener("click", () => {
    if (state.scoreCol < 0) {
      alert("Choose which column holds the scores.");
      return;
    }
    if (state.nameCol < 0 && state.idCol < 0) {
      alert("Choose a student name column, a School ID column, or both, so students can be matched.");
      return;
    }

    const rows = [];
    let skipped = 0;
    dataRows.forEach((row) => {
      const name = state.nameCol >= 0 ? String(row[state.nameCol] ?? "").trim() : "";
      const schoolId = state.idCol >= 0 ? String(row[state.idCol] ?? "").trim() : "";
      const rawScore = String(row[state.scoreCol] ?? "").trim();
      const score = Number(rawScore);
      if ((!name && !schoolId) || rawScore === "" || Number.isNaN(score)) {
        skipped++;
        return;
      }
      rows.push({ name, schoolId, score: String(score) });
    });
    if (rows.length === 0) {
      alert("No usable rows were found — check the header row number and the column choices.");
      return;
    }

    try {
      const test = ScoringModule.addTest(tool.id, {
        name: state.name,
        maxPoints: state.maxPoints,
        rows,
        sourceFile: state.fileName,
      });
      const matched = Object.keys(test.scores).length;
      testBankStatus.set(
        tool.id,
        `Imported "${test.name}": ${matched} matched, ${test.unmatched.length} not matched` +
          (skipped > 0 ? `, ${skipped} skipped (blank or non-numeric score)` : "") +
          ". Click Save Scoring to store it."
      );
      testBankImports.delete(tool.id);
    } catch (err) {
      alert(err.message);
      return;
    }
    rerender();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    testBankImports.delete(tool.id);
    rerender();
  });

  buttons.append(importBtn, cancelBtn);
  panel.appendChild(buttons);
  return panel;
}

/** The list of tests/quizzes in this bank, each with rename, maximum, match counts, and details/re-match/delete. */
function buildTestBankTable(tool, rerender) {
  const tests = ScoringModule.testBankTests(tool.id);
  const expanded = testBankExpanded.get(tool.id) || new Set();
  testBankExpanded.set(tool.id, expanded);

  const table = document.createElement("table");
  table.className = "roster-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Test / Quiz", "Max score", "Matched", "Not matched", "File", ""].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  if (tests.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "hint";
    td.textContent = 'No tests or quizzes yet — click "Upload CSV / Excel" above.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  tests.forEach((test) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = test.name;
    nameInput.addEventListener("change", () => {
      ScoringModule.renameTest(tool.id, test.id, nameInput.value);
      rerender();
    });
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    const maxTd = document.createElement("td");
    const maxInput = document.createElement("input");
    maxInput.type = "text";
    maxInput.inputMode = "decimal";
    maxInput.placeholder = "—";
    maxInput.title = "Highest possible score. When set, scores pulled into an item are scaled to that item's own points.";
    maxInput.value = test.maxPoints || "";
    maxInput.addEventListener("change", () => {
      ScoringModule.setTestMaxPoints(tool.id, test.id, maxInput.value);
      rerender();
    });
    maxTd.appendChild(maxInput);
    tr.appendChild(maxTd);

    const matchedTd = document.createElement("td");
    matchedTd.textContent = `${Object.keys(test.scores).length} / ${RosterModule.students.length}`;
    tr.appendChild(matchedTd);

    const unmatchedTd = document.createElement("td");
    unmatchedTd.textContent = String(test.unmatched.length);
    tr.appendChild(unmatchedTd);

    const fileTd = document.createElement("td");
    fileTd.className = "hint";
    fileTd.textContent = test.sourceFile;
    tr.appendChild(fileTd);

    const actionsTd = document.createElement("td");
    actionsTd.className = "panel-toolbar-buttons";

    const detailsBtn = document.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.className = "btn btn-ghost btn-small";
    detailsBtn.textContent = expanded.has(test.id) ? "Hide" : "Details";
    detailsBtn.addEventListener("click", () => {
      if (expanded.has(test.id)) expanded.delete(test.id);
      else expanded.add(test.id);
      rerender();
    });
    actionsTd.appendChild(detailsBtn);

    const rematchBtn = document.createElement("button");
    rematchBtn.type = "button";
    rematchBtn.className = "btn btn-ghost btn-small";
    rematchBtn.textContent = "Re-match";
    rematchBtn.title = "Match the file's rows to the roster again (e.g. after adding students or fixing IDs)";
    rematchBtn.addEventListener("click", () => {
      ScoringModule.rematchTest(tool.id, test.id);
      rerender();
    });
    actionsTd.appendChild(rematchBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-ghost btn-small";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      if (!confirm(`Delete "${test.name}"? Items and Progress Tracker columns pulling from it will lose those scores.`)) return;
      ScoringModule.removeTest(tool.id, test.id);
      expanded.delete(test.id);
      rerender();
    });
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(actionsTd);
    tbody.appendChild(tr);

    if (expanded.has(test.id)) {
      const detailTr = document.createElement("tr");
      const detailTd = document.createElement("td");
      detailTd.colSpan = 6;

      const scoreHeading = document.createElement("p");
      scoreHeading.innerHTML = "<strong>Matched students</strong>";
      detailTd.appendChild(scoreHeading);
      const scoreList = document.createElement("ul");
      scoreList.className = "consultation-item-list";
      RosterModule.students.forEach((student) => {
        const li = document.createElement("li");
        const raw = test.scores[student.id];
        li.textContent = `#${student.classNumber || "—"} ${student.name || "(unnamed)"}: ${raw === undefined ? "—" : raw}`;
        scoreList.appendChild(li);
      });
      detailTd.appendChild(scoreList);

      if (test.unmatched.length > 0) {
        const unmatchedHeading = document.createElement("p");
        unmatchedHeading.innerHTML = "<strong>Rows that matched no one on the roster</strong>";
        detailTd.appendChild(unmatchedHeading);
        const unmatchedList = document.createElement("ul");
        unmatchedList.className = "consultation-item-list";
        test.unmatched.forEach((row) => {
          const li = document.createElement("li");
          li.className = "recall-unknown-id";
          li.textContent = `${[row.name, row.schoolId].filter(Boolean).join(" · ") || "(no name or ID)"}: ${row.score}`;
          unmatchedList.appendChild(li);
        });
        detailTd.appendChild(unmatchedList);
      }

      detailTr.appendChild(detailTd);
      tbody.appendChild(detailTr);
    }
  });

  table.appendChild(tbody);
  return table;
}

/** A dropdown listing every test/quiz in every Test & Quiz Bank (value "bankToolId|testId"); `selected` is { toolId, testId }. Used by Progress Tracker columns. */
function buildTestSourceSelect(selected, onChange) {
  const select = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— choose a test/quiz —";
  select.appendChild(blank);

  const banks = ScoringModule.tools.filter((t) => t.type === "testbank");
  banks.forEach((bank) => {
    ScoringModule.testBankTests(bank.id).forEach((test) => {
      const opt = document.createElement("option");
      opt.value = `${bank.id}|${test.id}`;
      opt.textContent = banks.length > 1 ? `${bank.name}: ${test.name}` : test.name;
      if (selected && selected.toolId === bank.id && selected.testId === test.id) opt.selected = true;
      select.appendChild(opt);
    });
  });

  select.addEventListener("change", () => {
    const [toolId, testId] = select.value ? select.value.split("|") : ["", ""];
    onChange(toolId, testId);
  });
  return select;
}

// ----- Templates page (Presentation Calc) -----
// The "QR Forms" subtab: one QR launcher per form (Teacher, Audience,
// Peer Evaluation), the data collected by each, and the settings the
// forms use (instructions, comments on/off, highest peer score), which
// are saved with "Save Scoring".

const DEFAULT_AUDIENCE_INSTRUCTIONS =
  "Rate each group that presents. Higher numbers are good, lower numbers are bad. You can leave a comment for each group. Only the teacher can see your answer.";

const PRES_KIND_LABEL = { teacher: "Teacher Scores", audience: "Audience Scores", peer: "Peer Evaluation" };

/** The table of data sets for one kind: which is in use, whether its QR code is open, and the actions for each. */
function buildPresDataSetTable(tool, project, container, kind, statusEl) {
  const rerender = () => renderScoringToolView(tool, container);
  const key = `${tool.id}|${project.id}|${kind}`;
  const say = (text) => presFormStatus.set(key, text);
  const stateKey = `${tool.id}|${project.id}`;
  const expanded = scoreSheetExpanded.get(stateKey) || new Set();
  scoreSheetExpanded.set(stateKey, expanded);
  const sets = ScoringModule.presentationDataSets(tool.id, project.id, kind);
  const chosen = ScoringModule.presentationSelectedSet(tool.id, project.id, kind);

  /** Puts the data set in use for this kind into the scoring grid. Returns a sentence for the status line ("" if there is none). */
  const loadIntoGrid = () => {
    const now = ScoringModule.presentationSelectedSet(tool.id, project.id, kind);
    if (!now) return "";
    const r = ScoringModule.presLoadDataSet(tool.id, project.id, kind); // clears this kind's cells first, then fills them
    return ` Loaded into the scoring grid (${r.applied} cell(s))` + (r.clamped > 0 ? `; ${r.clamped} average(s) above the rubric's points were limited to it` : "") + ".";
  };

  const table = document.createElement("table");
  table.className = "roster-table pres-dataset-table";
  table.innerHTML = "<thead><tr><th>In use</th><th>Data set</th><th>QR code</th><th>Responses</th><th>Last updated</th><th></th></tr></thead>";
  const tbody = document.createElement("tbody");
  if (sets.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "hint";
    td.textContent = `No data sets yet — click "+ Add Data Set" above, then "Launch New QR Code" on its row.`;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  const action = (parent, label, fn, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-ghost btn-small";
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await fn();
      } catch (err) {
        say(`Couldn't do that: ${err.message}`);
        rerender();
      }
    });
    parent.appendChild(b);
    return b;
  };

  sets.forEach((set) => {
    const tr = document.createElement("tr");
    if (chosen && chosen.id === set.id) tr.className = "pres-dataset-inuse";

    const useTd = document.createElement("td");
    if (chosen && chosen.id === set.id) {
      const badge = document.createElement("span");
      badge.className = "pres-inuse-badge";
      badge.textContent = "● In use";
      useTd.appendChild(badge);
    } else {
      action(useTd, "Use this set", async () => {
        ScoringModule.presentationSelectSet(tool.id, project.id, kind, set.id);
        say(`"${set.name}" is now the ${PRES_KIND_LABEL[kind]} data set in use.` + loadIntoGrid());
        presFormsSave();
        rerender();
      }, "Loads this data set into the Scores grid; reports use it too");
    }
    tr.appendChild(useTd);

    const nameTd = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "pres-dataset-name";
    nameInput.value = set.name;
    nameInput.addEventListener("change", () => {
      ScoringModule.renamePresentationDataSet(tool.id, project.id, set.id, nameInput.value);
      nameInput.value = set.name;
      presFormsSave();
    });
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    const qrTd = document.createElement("td");
    qrTd.textContent = set.token ? "Open" : "Closed";
    if (set.token) qrTd.className = "pres-qr-open";
    if (set.token && set.timeLimit) {
      const lim = document.createElement("div");
      lim.className = "hint";
      lim.textContent = `${set.timeLimit} min each, from login`;
      qrTd.appendChild(lim);
    }
    if (set.token && set.closesAt) {
      const left = document.createElement("div");
      left.className = "hint pres-timer-left";
      left.dataset.closes = set.closesAt;
      qrTd.appendChild(left);
      presTimerTick();
    }
    tr.appendChild(qrTd);

    const countTd = document.createElement("td");
    countTd.textContent = String(set.respondentCount || 0);
    tr.appendChild(countTd);

    const whenTd = document.createElement("td");
    const when = new Date(set.syncedAt || set.importedAt);
    whenTd.textContent = Number.isNaN(when.getTime()) ? "" : when.toLocaleString();
    tr.appendChild(whenTd);

    const actionsTd = document.createElement("td");
    actionsTd.className = "panel-toolbar-buttons";
    if (!set.token) {
      action(actionsTd, "Launch New QR Code", async () => {
        if ((set.respondentCount || 0) > 0 && !confirm(`"${set.name}" already holds ${set.respondentCount} response(s). A new QR code starts with no answers, and Get Responses will replace this data set's answers with the new form's. Launch anyway?`)) { rerender(); return; }
        const key = `${tool.id}|${project.id}|${kind}`;
        let minutes = 0; try { minutes = Number(localStorage.getItem(`ggo-pres-timer-${kind}`)) || 0; } catch (e) {}
        const made = await PresentationFormsModule.launch(tool.id, project.id, set.id, minutes);
        say(`"${set.name}" is open${kind === "teacher" ? "" : ` for ${made.count} student(s)`}${minutes > 0 ? `; each student gets ${minutes} min from when they log in` : ""}.` + (made.shared && made.shared.length ? ` Left out (School ID shared by several students): ${made.shared.join(", ")}.` : ""));
        presFormsSave();
        rerender();
        window.open(`presqr.html?k=${kind}&u=${encodeURIComponent(made.url + (window.QRStyles ? QRStyles.query(set.style) : ""))}${qrCourseQuery()}`, "ggo-pres-qr", "width=480,height=620");
      }, "Opens a new form students scan; its answers are collected in this data set");
    }
    if (set.token) {
      action(actionsTd, "Show QR Code", async () => {
        window.open(`presqr.html?k=${kind}&u=${encodeURIComponent(PresentationFormsModule.urlFor(set.token) + (window.QRStyles ? QRStyles.query(set.style) : ""))}${qrCourseQuery()}`, "ggo-pres-qr", "width=480,height=620");
        rerender();
      });
      if (window.QRStyles) {
        QRStyles.ensureLoaded().catch(() => {});
        actionsTd.appendChild(QRStyles.menuButton(() => set.style || null, (st) => { set.style = st || null; presFormsSave(); }, say));
      }
      action(actionsTd, "Get Responses", async () => {
        say("Getting responses…");
        const result = await PresentationFormsModule.sync(tool.id, project.id, set.id);
        const names = result.missing.slice(0, 12).join(", ");
        say(
          kind === "teacher"
            ? `"${set.name}": ${result.responses} teacher response(s).${result.note}`
            : `"${set.name}": ${result.responses} of ${result.expected} student(s) have answered.` +
                (result.missing.length > 0 && kind === "peer" ? ` Not yet: ${names}${result.missing.length > 12 ? ` and ${result.missing.length - 12} more` : ""}.` : "") +
                result.note
        );
        if (chosen && chosen.id === set.id) say(presFormStatus.get(key) + loadIntoGrid()); // the set in use was refreshed: reload it
        presFormsSave();
        rerender();
      }, "Copies the answers students have submitted so far into this data set");
      action(actionsTd, "Close QR Code", async () => {
        if (!confirm("Close this QR code? Students can no longer answer. Click Get Responses first if you haven't — the answers on the server are deleted when it closes. The data set stays here.")) {
          rerender();
          return;
        }
        await PresentationFormsModule.close(tool.id, project.id, set.id);
        say(`"${set.name}": QR code closed. The data set is kept.`);
        presFormsSave();
        rerender();
      });
    }
    action(actionsTd, expanded.has(set.id) ? "Hide Data" : "View Data", async () => {
      if (expanded.has(set.id)) expanded.delete(set.id);
      else expanded.add(set.id);
      rerender();
    });
    action(actionsTd, "Delete", async () => {
      if (!confirm(`Delete the data set "${set.name}"?${set.token ? " Its QR code will stop working." : ""} Scores already placed in the grid are not changed.`)) {
        rerender();
        return;
      }
      await PresentationFormsModule.remove(tool.id, project.id, set.id);
      expanded.delete(set.id);
      say(`Deleted "${set.name}".` + loadIntoGrid()); // if another set took its place, it is loaded now
      presFormsSave();
      rerender();
    });
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);

    if (expanded.has(set.id)) {
      const detailTr = document.createElement("tr");
      const detailTd = document.createElement("td");
      detailTd.colSpan = 6;
      detailTd.appendChild(buildScoreSheetDetails(tool, project, set));
      detailTr.appendChild(detailTd);
      tbody.appendChild(detailTr);
    }
  });
  table.appendChild(tbody);
  return table;
}

function buildPresentationTemplatesPage(tool, cfg, container) {
  const page = document.createElement("div");
  const settings = cfg.templateSettings;
  const rerender = () => renderScoringToolView(tool, container);

  const makeTextarea = (value, placeholder, onInput) => {
    const textarea = document.createElement("textarea");
    textarea.rows = 3;
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.addEventListener("input", () => onInput(textarea.value));
    return textarea;
  };

  const addSection = (kind, title, hintText) => {
    const { section, body } = makePresSection(title);
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = hintText;
    body.appendChild(hint);
    page.appendChild(section);
    return { body, kind };
  };

  /** Settings go first; then the launch button, a status line, and the data set table at the bottom. */
  const finishSection = ({ body, kind }) => {
    const key = `${tool.id}|${cfg.id}|${kind}`;
    const bar = document.createElement("div");
    bar.className = "panel-toolbar-buttons";
    bar.style.marginTop = "14px";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-ghost btn-small";
    add.textContent = "+ Add Data Set";
    add.title = "Adds an empty data set; use its row's Launch New QR Code button to collect answers into it";
    add.addEventListener("click", () => {
      try {
        const set = PresentationFormsModule.addSet(tool.id, cfg.id, kind);
        presFormStatus.set(key, `"${set.name}" added. Click Launch New QR Code on its row.`);
        presFormsSave();
      } catch (err) {
        presFormStatus.set(key, `Couldn't do that: ${err.message}`);
      }
      rerender();
    });
    bar.appendChild(add);
    const timerWrap = document.createElement("label");
    timerWrap.className = "hint";
    timerWrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;margin-left:10px;";
    timerWrap.title = "Applies to the next QR code you launch in this section. Each student\'s clock starts when they enter their School ID; their answers are sent automatically when it runs out.";
    timerWrap.appendChild(document.createTextNode("Time limit"));
    const timerInput = document.createElement("input");
    timerInput.type = "number"; timerInput.min = "1"; timerInput.max = "600"; timerInput.placeholder = "none";
    timerInput.style.width = "5em";
    try { timerInput.value = localStorage.getItem(`ggo-pres-timer-${kind}`) || ""; } catch (e) {}
    timerInput.addEventListener("input", () => { try { localStorage.setItem(`ggo-pres-timer-${kind}`, timerInput.value.trim()); } catch (e) {} });
    timerWrap.appendChild(timerInput);
    timerWrap.appendChild(document.createTextNode("minutes per student (blank = no limit)"));
    bar.appendChild(timerWrap);
    body.appendChild(bar);

    const explain = document.createElement("p");
    explain.className = "hint";
    explain.textContent =
      "Get Responses copies what students have submitted so far into the data set. The form always follows your current rubrics, groups and roster, so there is nothing to update. Launch New QR Code opens a form on that data set (it then reads Show QR Code); with a Time limit set, each student's countdown starts when they log in and their answers are sent automatically when it runs out; Close QR Code stops new answers, keeps the data set, and lets you launch again. The data set marked \"In use\" is loaded into the Scores grid and used for reports; choosing another one (Use this set) loads it right away.";
    body.appendChild(explain);

    const status = document.createElement("p");
    status.className = "result";
    status.textContent = presFormStatus.get(key) || "";
    body.appendChild(status);

    const tableHeading = document.createElement("h4");
    tableHeading.className = "pres-subhead";
    tableHeading.textContent = `Data sets — ${PRES_KIND_LABEL[kind]}`;
    body.appendChild(tableHeading);
    body.appendChild(buildPresDataSetTable(tool, cfg, container, kind, status));
  };

  // ----- Teacher -----
  const teacher = addSection(
    "teacher",
    "Teacher Scores — QR Code",
    "Teachers scan the QR code, type their name, and score every group on the Active Teacher Rubrics (with comments)."
  );
  // Shared phrase bank (all courses): shows as an "Insert a phrase" menu beside each group's comment box on the teacher form.
  const phraseBox = document.createElement("div");
  phraseBox.style.cssText = "margin-top:10px;";
  teacher.body.appendChild(phraseBox);
  const phraseSave = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => PhraseBankModule.save().catch((e) => alert(`Couldn't save phrases: ${e.message}`)), 500); }; })();
  const renderPhrases = () => {
    phraseBox.innerHTML = "";
    const h = document.createElement("h4");
    h.className = "pres-subhead";
    h.textContent = "Comment phrases (shared by all courses)";
    phraseBox.appendChild(h);
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Keep your often-used comments in collections (click a collection's name to fold it). Tick the collections to put on THIS project's teacher form; they appear as the Comments Selector under each comment box, grouped by each phrase's category. Click Get Responses / relaunch to publish changes to an open form.";
    phraseBox.appendChild(hint);
    const chosen = () => (Array.isArray(settings.teacherPhraseCollections) ? new Set(settings.teacherPhraseCollections) : new Set(PhraseBankModule.collections.map((c) => c.id)));
    const setChosen = (set) => { settings.teacherPhraseCollections = [...set]; };
    PhraseBankModule.collections.forEach((col) => {
      const box = document.createElement("div");
      box.style.cssText = "border:1px solid var(--line);border-radius:8px;margin:8px 0;padding:6px 10px;";
      const head = document.createElement("div");
      head.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;";
      const use = document.createElement("input");
      use.type = "checkbox"; use.checked = chosen().has(col.id); use.title = "Put this collection on this project's teacher form";
      use.addEventListener("change", () => { const set = chosen(); if (use.checked) set.add(col.id); else set.delete(col.id); setChosen(set); presFormsSave(); });
      const fold = document.createElement("button");
      fold.type = "button"; fold.className = "btn btn-ghost btn-small";
      fold.textContent = `${col.collapsed ? "▸" : "▾"} ${col.name} (${PhraseBankModule.inCollection(col.id).length})`;
      fold.title = "Show / hide this collection's phrases";
      fold.addEventListener("click", () => { col.collapsed = !col.collapsed; phraseSave(); renderPhrases(); });
      const rename = document.createElement("button");
      rename.type = "button"; rename.className = "btn btn-ghost btn-small"; rename.textContent = "Rename";
      rename.addEventListener("click", () => { const n = prompt("Collection name:", col.name); if (n === null || !n.trim()) return; col.name = n.trim(); phraseSave(); renderPhrases(); });
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn btn-ghost btn-small"; del.textContent = "Delete";
      del.addEventListener("click", () => {
        const count = PhraseBankModule.inCollection(col.id).length;
        if (!confirm(`Delete the collection "${col.name}"${count ? ` and its ${count} phrase(s)` : ""}? This affects every course.`)) return;
        PhraseBankModule.removeCollection(col.id);
        if (Array.isArray(settings.teacherPhraseCollections)) settings.teacherPhraseCollections = settings.teacherPhraseCollections.filter((x) => x !== col.id);
        phraseSave(); presFormsSave(); renderPhrases();
      });
      const lab = document.createElement("label");
      lab.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
      lab.append(use, document.createTextNode("Use"));
      head.append(lab, fold, rename, del);
      box.appendChild(head);
      if (!col.collapsed) {
        PhraseBankModule.inCollection(col.id).forEach((ph) => {
          const row = document.createElement("div");
          row.className = "mapping-row";
          const cat = document.createElement("input");
          cat.type = "text"; cat.placeholder = "Category (optional)"; cat.value = ph.category; cat.style.width = "11em";
          cat.addEventListener("input", () => { ph.category = cat.value; phraseSave(); });
          const txt = document.createElement("input");
          txt.type = "text"; txt.placeholder = "Phrase"; txt.value = ph.text; txt.style.flex = "1";
          txt.addEventListener("input", () => { ph.text = txt.value; phraseSave(); });
          const x = document.createElement("button");
          x.type = "button"; x.className = "btn btn-ghost btn-small"; x.textContent = "×"; x.title = "Remove this phrase";
          x.addEventListener("click", () => { PhraseBankModule.remove(ph.id); phraseSave(); renderPhrases(); });
          row.append(cat, txt, x);
          box.appendChild(row);
        });
        const add = document.createElement("button");
        add.type = "button"; add.className = "btn btn-ghost btn-small"; add.textContent = "+ Add phrase";
        add.addEventListener("click", () => {
          try {
            const mine = PhraseBankModule.inCollection(col.id);
            PhraseBankModule.add(col.id, mine.length ? mine[mine.length - 1].category : "");
          } catch (err) { alert(err.message); return; }
          renderPhrases();
          const inputs = phraseBox.querySelectorAll('input[placeholder="Phrase"]');
          if (inputs.length) inputs[inputs.length - 1].focus();
        });
        box.appendChild(add);
      }
      phraseBox.appendChild(box);
    });
    const addCol = document.createElement("button");
    addCol.type = "button"; addCol.className = "btn btn-ghost btn-small"; addCol.textContent = "+ New collection";
    addCol.addEventListener("click", () => {
      const n = prompt("Name for the new collection:", `Collection ${PhraseBankModule.collections.length + 1}`);
      if (n === null) return;
      try { const c = PhraseBankModule.addCollection(n); if (Array.isArray(settings.teacherPhraseCollections)) { settings.teacherPhraseCollections.push(c.id); presFormsSave(); } } catch (err) { alert(err.message); return; }
      phraseSave(); renderPhrases();
    });
    phraseBox.appendChild(addCol);
  };
  PhraseBankModule.ensureLoaded().then(renderPhrases).catch(() => { phraseBox.textContent = "Couldn't load the phrase bank."; });
  finishSection(teacher);

  // ----- Audience -----
  const audience = addSection(
    "audience",
    "Audience Scores — QR Code",
    "Students scan the QR code and type their School ID, then score every other group on the Active Audience Rubrics. They can leave a comment for each group."
  );
  audience.body.appendChild(
    makeTextarea(settings.audienceInstructions, `Instructions (leave blank for: "${DEFAULT_AUDIENCE_INSTRUCTIONS}")`, (value) => {
      settings.audienceInstructions = value;
    })
  );
  const commentsToggle = document.createElement("button");
  commentsToggle.type = "button";
  commentsToggle.className = "btn btn-ghost btn-small";
  commentsToggle.style.marginTop = "8px";
  commentsToggle.textContent = settings.audienceComments ? "Comments On" : "Comments Off";
  commentsToggle.title = "Whether audience members can leave a comment for each group";
  commentsToggle.addEventListener("click", () => {
    settings.audienceComments = !settings.audienceComments;
    rerender();
  });
  audience.body.appendChild(commentsToggle);
  finishSection(audience);

  // ----- Peer Evaluation -----
  const peer = addSection(
    "peer",
    "Peer Evaluation — QR Code",
    "Students scan the QR code and type their School ID, then rate each member of their own group from 0 to the highest score below."
  );
  const peerRow = document.createElement("div");
  peerRow.className = "mapping-row";
  const peerInstructions = makeTextarea(
    settings.peerInstructions,
    "Instructions (leave blank for the standard instructions, which use the highest score below)",
    (value) => {
      settings.peerInstructions = value;
    }
  );
  peerRow.appendChild(peerInstructions);
  const highestLabel = document.createElement("label");
  highestLabel.textContent = "Highest score (1–10)";
  highestLabel.style.width = "auto";
  const highestInput = document.createElement("input");
  highestInput.type = "text";
  highestInput.inputMode = "numeric";
  highestInput.className = "point-value-input";
  highestInput.value = settings.peerHighestScore;
  highestInput.addEventListener("change", () => {
    settings.peerHighestScore = highestInput.value;
    rerender(); // re-normalizes to 1-10
  });
  peerRow.append(highestLabel, highestInput);
  peer.body.appendChild(peerRow);
  finishSection(peer);

  return page;
}

// ----- Presentation Calc: score sheet uploads -----
//
// On a project's Scores page, the three score sheets (Teacher, Audience,
// Peer Evaluation) can be uploaded back as CSV/Excel files once
// participants have filled them in. Nothing needs to be mapped by hand —
// the file is read automatically:
//
//  * The "name" column holds each respondent: a student's School ID, or
//    an actual name (a teacher, say). Students are matched by School ID.
//  * Teacher / Audience sheets: the first column whose heading matches
//    one of the project's active rubrics starts the scores (and, in the
//    columns after it, the comments) for Group 1. Every time the first
//    active rubric shows up again, the next group begins (Group 2, ...).
//    A "Global Comments" column belongs to no group.
//  * Peer sheets: the rating columns are the ones headed with a student's
//    name.
//  * A student's score for their OWN group, and a student's rating of
//    THEMSELVES, are stored but never counted. Other respondents (such as
//    a teacher's name) count for every group.
// Everything is stored in the project and saved with "Save Scoring".

const SCORE_SHEET_LABELS = {
  teacher: "Teacher Scores",
  audience: "Audience Scores",
  peer: "Peer Evaluation Scores",
};

const scoreSheetStatus = new Map(); // "toolId|projectId" -> last status message
const scoreSheetExpanded = new Map(); // "toolId|projectId" -> Set of upload ids whose details are open

async function readSpreadsheetRows(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
}

/**
 * Reads an uploaded score sheet (rows from readSpreadsheetRows) for one
 * kind — "teacher", "audience" or "peer" — and returns what it holds:
 * { scores, comments, ratings, respondentCount, blocks, notes }.
 * Throws a readable Error if the file doesn't look like that kind of
 * sheet. See the comment at the top of this section for the rules.
 */
function parseScoreSheet(kind, rawRows, tool, project, uploadId) {
  const norm = (text) => ScoringModule._matchKey(text);
  const isPeer = kind === "peer";
  const rubrics = isPeer
    ? []
    : ScoringModule.presentationColumns(tool.id, project.id).filter((c) => c.kind === kind);
  const groups = ScoringModule.presentationGroups(tool.id, project.id);
  const notes = [];

  // ----- Which row holds the headings: the first of the top rows that mentions a rubric / a student -----
  const wantedKeys = (isPeer ? project.roster.map((e) => norm(e.name)) : rubrics.map((r) => norm(r.text))).filter(Boolean);
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, rawRows.length - 1); i++) {
    const cells = rawRows[i].map(norm);
    if (cells.some((cell) => cell && wantedKeys.some((key) => cell.includes(key)))) {
      headerIndex = i;
      break;
    }
  }
  const headers = rawRows[headerIndex].map((cell) => String(cell).trim());
  const dataRows = rawRows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));

  // ----- The "name" column (School IDs, or an actual name for a teacher) -----
  const findHeader = (...patterns) => {
    for (const pattern of patterns) {
      const index = headers.findIndex((h) => pattern.test(h.normalize("NFKC")));
      if (index !== -1) return index;
    }
    return -1;
  };
  const nameCol = findHeader(
    /^\s*name\s*$/i,
    /^\s*(user\s*)?name\b/i,
    /氏名|名前/,
    /school\s*id|student\s*id|学籍|学生番号/i,
    /(^|[^a-z])id($|[^a-z])/i
  );
  if (nameCol === -1) {
    throw new Error('Couldn\'t find the "name" column (the one holding School IDs or names). Its heading should be "name".');
  }

  // ----- Which columns are scores / comments / ratings -----
  const columns = [];
  let blocks = 0;

  if (isPeer) {
    headers.forEach((header, index) => {
      if (index === nameCol) return;
      const headerKey = norm(header);
      let best = null;
      project.roster.forEach((entry) => {
        const key = norm(entry.name);
        if (key && headerKey.includes(key) && (!best || key.length > best.key.length)) {
          best = { key, studentId: entry.studentId };
        }
      });
      if (best) columns.push({ index, role: "rating", studentId: best.studentId });
    });
    if (columns.length === 0) {
      throw new Error("No column headings matched the names of students in this project's groups.");
    }
  } else {
    const firstEntryId = rubrics[0].entryId;
    let groupIndex = -1; // which group's block we're in (an index into `groups`)
    let blockHasFirst = false; // has this block's first-rubric column been seen?

    headers.forEach((header, index) => {
      if (index === nameCol) return;
      const text = header.normalize("NFKC");

      if (/comment|コメント|感想|意見/i.test(text)) {
        if (/global|overall|全体|総合/i.test(text)) {
          columns.push({ index, role: "global", group: 0 });
        } else if (groupIndex >= 0 && groupIndex < groups.length) {
          columns.push({ index, role: "comment", group: groups[groupIndex] });
        }
        return;
      }

      const headerKey = norm(header);
      let best = null;
      rubrics.forEach((rubric) => {
        const key = norm(rubric.text);
        if (key && headerKey.includes(key) && (!best || key.length > best.key.length)) {
          best = { key, entryId: rubric.entryId };
        }
      });
      if (!best) return;

      const isFirst = best.entryId === firstEntryId;
      if (groupIndex === -1) {
        groupIndex = 0; // the first matching column starts Group 1
        blockHasFirst = isFirst;
      } else if (isFirst) {
        if (blockHasFirst) groupIndex++; // the first rubric again: the next group begins
        blockHasFirst = true;
      }
      blocks = groupIndex + 1;
      if (groupIndex < groups.length) {
        columns.push({ index, role: "score", group: groups[groupIndex], entryId: best.entryId });
      }
    });

    if (!columns.some((c) => c.role === "score")) {
      throw new Error(
        `No column headings matched this project's active ${kind === "teacher" ? "Teacher" : "Audience"} rubrics. The headings need to contain the rubric text.`
      );
    }
    if (blocks > groups.length) {
      notes.push(`the file has ${blocks} group sections but the project has ${groups.length} group(s), so the extra ones were skipped`);
    } else if (blocks < groups.length) {
      notes.push(`the file only has ${blocks} group section(s) for ${groups.length} group(s)`);
    }
  }

  // ----- Read every response row -----
  const scores = [];
  const comments = [];
  const ratings = [];
  const cell = (row, index) => String(row[index] ?? "").trim();

  dataRows.forEach((row, i) => {
    const respondentKey = cell(row, nameCol) || `#${uploadId}-${i}`;
    columns.forEach((col) => {
      const raw = cell(row, col.index);
      if (raw === "") return;
      if (col.role === "comment" || col.role === "global") {
        comments.push([respondentKey, col.group, raw]);
        return;
      }
      const value = Number(raw);
      if (Number.isNaN(value)) return;
      if (col.role === "rating") ratings.push([respondentKey, col.studentId, value]);
      else scores.push([respondentKey, col.group, col.entryId, value]);
    });
  });

  return { scores, comments, ratings, respondentCount: dataRows.length, blocks, notes };
}

// ----- Online score forms (QR codes) -----

/** Counts down the "closes in" labels, and closes forms whose time limit has passed (copying their answers into the data set first). */
function presTimerTick() {
  document.querySelectorAll(".pres-timer-left").forEach((n) => {
    const ms = new Date(n.dataset.closes).getTime() - Date.now();
    if (!(ms > 0)) { n.textContent = "Time is up — closing…"; return; }
    const s = Math.ceil(ms / 1000);
    n.textContent = `Closes in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  });
}
setInterval(presTimerTick, 1000);
let presTimerBusy = false;
setInterval(async () => {
  try {
    presTimerTick();
    if (presTimerBusy || !window.PresentationFormsModule || !window.ScoringModule || !ScoringModule.tools) return;
    presTimerBusy = true;
    let any = false;
    for (const tool of ScoringModule.tools.filter((t) => t.type === "presentation")) {
      const done = await PresentationFormsModule.closeExpired(tool.id);
      if (done.length) { any = true; presFormsSave(); }
    }
    if (any && typeof renderScoring === "function") renderScoring();
  } catch (e) { /* tries again in a few seconds */ } finally { presTimerBusy = false; }
}, 5000);

const presFormStatus = new Map(); // "toolId|projectId|kind" -> last status message

function presFormsSave() {
  try {
    if (window.GGOAutosave && window.GGOAutosave.enabled()) window.GGOAutosave.flush();
  } catch (err) {}
}

/** What one stored upload contains: average scores per group and rubric plus every comment (teacher/audience), or the average rating each student received (peer). Own-group scores and self-ratings are left out, and the count of those is shown. */
function buildScoreSheetDetails(tool, project, upload) {
  const wrap = document.createElement("div");

  const noteLine = (text) => {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = text;
    return p;
  };

  if (upload.kind === "peer") {
    const { counted, excluded } = ScoringModule.presentationCountedRatings(upload);
    const totals = {};
    counted.forEach(([, studentId, value]) => {
      if (!totals[studentId]) totals[studentId] = { sum: 0, count: 0 };
      totals[studentId].sum += value;
      totals[studentId].count += 1;
    });
    const heading = document.createElement("p");
    heading.innerHTML = "<strong>Average rating received</strong>";
    wrap.appendChild(heading);
    wrap.appendChild(noteLine(`${excluded} self-rating(s) were not counted.`));
    const list = document.createElement("ul");
    list.className = "consultation-item-list";
    project.roster.forEach((entry) => {
      const t = totals[entry.studentId];
      if (!t) return;
      const li = document.createElement("li");
      li.textContent = `Group ${entry.group || "—"} · ${entry.name || "(unnamed)"}: ${Math.round((t.sum / t.count) * 100) / 100} (${t.count} rating(s))`;
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  // ----- Average per group and rubric, for this upload alone -----
  const columns = ScoringModule.presentationColumns(tool.id, project.id).filter((c) => c.kind === upload.kind);
  const { counted, excluded } = ScoringModule.presentationCountedScores(tool.id, project.id, upload);
  const stats = {};
  counted.forEach(([, group, entryId, value]) => {
    const key = `${group}|${entryId}`;
    if (!stats[key]) stats[key] = { sum: 0, count: 0 };
    stats[key].sum += value;
    stats[key].count += 1;
  });
  const groups = ScoringModule.presentationGroups(tool.id, project.id);

  const scoreHeading = document.createElement("p");
  scoreHeading.innerHTML = "<strong>Average score per group and rubric</strong>";
  wrap.appendChild(scoreHeading);
  wrap.appendChild(noteLine(`${excluded} score(s) given by students to their own group were not counted.`));
  const table = document.createElement("table");
  table.className = "roster-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Group"].concat(columns.map((c) => c.text)).forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  groups.forEach((group) => {
    const tr = document.createElement("tr");
    const groupTd = document.createElement("td");
    groupTd.textContent = `Group ${group}`;
    tr.appendChild(groupTd);
    columns.forEach((col) => {
      const td = document.createElement("td");
      const s = stats[`${group}|${col.entryId}`];
      td.textContent = s ? String(Math.round((s.sum / s.count) * 100) / 100) : "—";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  // ----- Comments -----
  const commentHeading = document.createElement("p");
  commentHeading.innerHTML = `<strong>Comments (${upload.comments.length})</strong>`;
  wrap.appendChild(commentHeading);
  if (upload.comments.length === 0) {
    wrap.appendChild(noteLine("No comments in this upload."));
  } else {
    const box = document.createElement("div");
    box.style.maxHeight = "260px";
    box.style.overflow = "auto";
    const sorted = [...upload.comments].sort((a, b) => (a[1] || Infinity) - (b[1] || Infinity));
    sorted.forEach(([respondentKey, group, text]) => {
      const p = document.createElement("p");
      p.style.margin = "0 0 6px";
      const who = respondentKey.startsWith("#") ? "" : ` · ${respondentKey.replace(/^manual:/, "")} (typed in)`;
      const label = document.createElement("strong");
      label.textContent = `${group ? `Group ${group}` : "Global"}${who}: `;
      p.append(label, document.createTextNode(text));
      box.appendChild(p);
    });
    wrap.appendChild(box);
  }
  return wrap;
}

/** Combined average peer rating per student across all peer uploads (shown only when there are any). */
function buildPeerAveragesTable(tool, project) {
  const wrap = document.createElement("div");
  const averages = ScoringModule.presentationPeerAverages(tool.id, project.id);
  const rated = project.roster.filter((entry) => averages[entry.studentId]);
  if (rated.length === 0) return wrap;

  wrap.style.marginTop = "18px";
  const heading = document.createElement("h4");
  heading.textContent = "Peer evaluation averages (all uploads combined, self-ratings excluded)";
  wrap.appendChild(heading);

  const table = document.createElement("table");
  table.className = "roster-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Class #", "Name", "Group", "Average rating", "Ratings"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  rated.forEach((entry) => {
    const stat = averages[entry.studentId];
    const tr = document.createElement("tr");
    [
      entry.classNumber ? `#${entry.classNumber}` : "—",
      entry.name || "(unnamed)",
      entry.group ? String(entry.group) : "—",
      String(Math.round(stat.avg * 100) / 100),
      String(stat.count),
    ].forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// ----- Presentation Calc: printed reports -----
//
// Three buttons on the Scores page print (through the browser's print
// dialog — "Save as PDF" works too). Every page is ONE sheet: the text
// is automatically fitted by switching the comments into 2 or 3 columns
// and, if needed, shrinking the type.
//  1. Comments: one page per group — Global Comments, then that group's
//     Teacher's comments, then its Audience comments.
//  2. Group pages: one page per group — a score table by rubric (the
//     group's score, the maximum possible, the class average), then the
//     comments in the same order.
//  3. Student pages: one page per student — the same table with that
//     student's own scores (their group's rubric scores, and their own
//     peer evaluation), then the comments for their group.
// Only Teacher global comments are printed (there are no Audience ones).

function formatPrintNumber(value) {
  return value === null || value === undefined ? "—" : String(Math.round(value * 100) / 100);
}

/** One printed sheet: a fixed-size box (small enough for A4 or Letter) holding a "fit" block whose type size and comment columns get adjusted until everything fits. */
function createPresentationPrintPage() {
  const sheet = document.createElement("div");
  sheet.className = "report-sheet";
  sheet.style.width = "185mm";
  sheet.style.height = "255mm";
  sheet.style.padding = "7mm";
  sheet.style.margin = "0 auto";
  sheet.style.overflow = "hidden";

  const fit = document.createElement("div");
  fit.style.fontSize = "13px";
  fit.style.lineHeight = "1.35";
  sheet.appendChild(fit);

  const columns = document.createElement("div"); // the comments go here, in 1-3 columns
  columns.style.columnGap = "7mm";
  return { sheet, fit, columns };
}

/** Largest type / fewest columns at which the page's contents fit its sheet. */
function fitPresentationPage(page) {
  const attempts = [[13, 1], [13, 2], [12, 2], [11, 2], [10, 2], [10, 3], [9, 3], [8, 3], [7, 3], [6, 3]];
  const style = getComputedStyle(page.sheet);
  const available = page.sheet.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  for (const [size, columnCount] of attempts) {
    page.fit.style.fontSize = `${size}px`;
    page.columns.style.columnCount = String(columnCount);
    if (page.fit.offsetHeight <= available * 0.96) return;
  }
}

function printSheetHeading(text, subText) {
  const wrap = document.createElement("div");
  const h = document.createElement("h2");
  h.textContent = text;
  h.style.fontSize = "1.6em";
  h.style.margin = "0 0 2px";
  wrap.appendChild(h);
  if (subText) {
    const sub = document.createElement("p");
    sub.textContent = subText;
    sub.style.fontSize = "0.9em";
    sub.style.color = "#444";
    sub.style.margin = "0 0 8px";
    wrap.appendChild(sub);
  }
  return wrap;
}

/** A titled list of comments ("(none)" when empty). */
function appendCommentSection(parent, title, comments) {
  const heading = document.createElement("h3");
  heading.textContent = title;
  heading.style.fontSize = "1.05em";
  heading.style.margin = "8px 0 3px";
  heading.style.borderBottom = "1px solid #999";
  heading.style.breakAfter = "avoid";
  parent.appendChild(heading);

  if (comments.length === 0) {
    const none = document.createElement("p");
    none.textContent = "(none)";
    none.style.color = "#777";
    none.style.margin = "2px 0";
    parent.appendChild(none);
    return;
  }
  const list = document.createElement("ul");
  list.style.margin = "2px 0";
  list.style.paddingLeft = "1.2em";
  comments.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    li.style.marginBottom = "2px";
    li.style.breakInside = "avoid";
    list.appendChild(li);
  });
  parent.appendChild(list);
}

/** Score table: rubric | score | max possible | class average. With many rubrics it is split into two tables side by side. */
function buildPrintScoreTable(rows, scoreHeading) {
  const buildOne = (subset) => {
    const table = document.createElement("table");
    table.className = "report-sheet-table";
    table.style.fontSize = "1em";
    table.style.flex = "1";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Rubric", scoreHeading, "Max", "Class avg."].forEach((label, i) => {
      const th = document.createElement("th");
      th.textContent = label;
      th.style.textAlign = i === 0 ? "left" : "right";
      th.style.borderBottom = "2px solid #333";
      th.style.padding = "2px 6px";
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    subset.forEach((row) => {
      const tr = document.createElement("tr");
      [row.label, formatPrintNumber(row.score), formatPrintNumber(row.max), formatPrintNumber(row.classAverage)].forEach((text, i) => {
        const td = document.createElement("td");
        td.textContent = text;
        td.style.padding = "2px 6px";
        td.style.borderBottom = "1px solid #ddd";
        if (i > 0) td.style.textAlign = "right";
        if (row.isTotal) {
          td.style.fontWeight = "700";
          td.style.borderTop = "2px solid #333";
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  };

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "7mm";
  wrap.style.alignItems = "flex-start";
  wrap.style.marginBottom = "4px";
  if (rows.length > 10) {
    const half = Math.ceil(rows.length / 2);
    wrap.append(buildOne(rows.slice(0, half)), buildOne(rows.slice(half)));
  } else {
    wrap.appendChild(buildOne(rows));
  }
  return wrap;
}

/** Fits every page, puts them in the print area (one per sheet), and opens the print dialog in portrait, with the course/project as the suggested PDF file name. */
function printPresentationPages(pages, title) {
  // Pages are fitted while on screen but out of sight, since fitting needs a real layout.
  const measure = document.createElement("div");
  measure.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;";
  document.body.appendChild(measure);
  pages.forEach((page) => {
    measure.appendChild(page.sheet);
    fitPresentationPage(page);
  });

  el.printArea.innerHTML = "";
  pages.forEach((page, index) => {
    if (index < pages.length - 1) page.sheet.classList.add("report-sheet-page-break");
    el.printArea.appendChild(page.sheet);
  });
  measure.remove();

  const pageStyle = document.createElement("style");
  pageStyle.textContent = "@page { size: A4 portrait; margin: 0; }";
  document.head.appendChild(pageStyle);
  const originalTitle = document.title;
  document.title = title;
  const restore = () => {
    document.title = originalTitle;
    pageStyle.remove();
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

/** Prints one of the three reports. kind: "comments" | "groups" | "students". Returns a message if there's nothing to print. */
function printPresentationReport(tool, project, kind) {
  const built = buildPresentationReportPages(tool, project, kind);
  if (built.error) return built.error;
  printPresentationPages(built.pages, built.title);
  return "";
}

/**
 * Builds the pages of one report (not yet fitted or printed). Returns
 * { pages, title } or { error }. Each page also records which group it is
 * for (page.group) and, on student pages, which student (page.studentId),
 * so the pages can be matched to recipients when emailing.
 */
function buildPresentationReportPages(tool, project, kind) {
  const groups = ScoringModule.presentationGroups(tool.id, project.id);
  if (groups.length === 0) return { error: 'There are no groups yet — import them on the "Student Groups" subtab first.' };

  const comments = ScoringModule.presentationComments(tool.id, project.id);
  const course = CoursesModule.find(RosterModule.currentCourseId);
  const subtitle = [course ? course.name : "", project.name].filter(Boolean).join(" — ");
  const membersOf = (group) =>
    project.roster
      .filter((e) => e.group === group)
      .map((e) => e.name || "(unnamed)")
      .join(", ");
  const groupComments = (group) => comments.groups[group] || { teacher: [], audience: [] };
  const globalComments = comments.global.teacher; // only the teacher leaves global comments
  const pages = [];

  /** Global Comments (when there are any), then Teacher's, then Audience comments for the group. */
  const fillComments = (page, group) => {
    if (globalComments.length > 0) appendCommentSection(page.columns, "Global Comments", globalComments);
    appendCommentSection(page.columns, "Teacher's Comments", groupComments(group).teacher);
    appendCommentSection(page.columns, "Audience Comments", groupComments(group).audience);
  };
  const groupSubtitle = (group) => `${subtitle}${membersOf(group) ? ` · ${membersOf(group)}` : ""}`;

  if (kind === "comments") {
    const anyComments =
      globalComments.length > 0 || groups.some((g) => groupComments(g).teacher.length + groupComments(g).audience.length > 0);
    if (!anyComments) {
      return { error: "There are no comments yet — upload Teacher or Audience score sheets that include comments first." };
    }
    groups.forEach((group) => {
      const page = createPresentationPrintPage();
      page.group = group;
      page.fit.appendChild(printSheetHeading(`Group ${group}`, groupSubtitle(group)));
      page.fit.appendChild(page.columns);
      fillComments(page, group);
      pages.push(page);
    });
    return { pages, title: `${subtitle} Comments` };
  }

  if (kind === "groups") {
    groups.forEach((group) => {
      const page = createPresentationPrintPage();
      page.group = group;
      page.fit.appendChild(printSheetHeading(`Group ${group}`, groupSubtitle(group)));
      page.fit.appendChild(
        buildPrintScoreTable(ScoringModule.presentationScoreRows(tool.id, project.id, { group }).rows, "Group score")
      );
      page.fit.appendChild(page.columns);
      fillComments(page, group);
      pages.push(page);
    });
    return { pages, title: `${subtitle} Group Scores` };
  }

  // kind === "students"
  project.roster
    .filter((entry) => entry.group)
    .forEach((entry) => {
      const page = createPresentationPrintPage();
      page.group = entry.group;
      page.studentId = entry.studentId;
      const who = `${entry.classNumber ? `#${entry.classNumber} ` : ""}${entry.name || "(unnamed)"}`;
      page.fit.appendChild(printSheetHeading(who, `${subtitle} · Group ${entry.group}`));
      page.fit.appendChild(
        buildPrintScoreTable(
          ScoringModule.presentationScoreRows(tool.id, project.id, { studentId: entry.studentId }).rows,
          "Your score"
        )
      );
      page.fit.appendChild(page.columns);
      fillComments(page, entry.group);
      pages.push(page);
    });
  if (pages.length === 0) return { error: "There are no students in groups yet." };
  return { pages, title: `${subtitle} Student Scores` };
}

/** The three print buttons, shown on the Scores page. */
function buildPresentationPrintSection(tool, project) {
  const block = document.createElement("div");
  block.className = "attendance-settings-block";
  block.style.borderTop = "2px solid var(--line)";
  block.style.paddingTop = "18px";
  block.style.marginTop = "22px";

  const heading = document.createElement("h3");
  heading.textContent = "Print";
  heading.style.fontFamily = "var(--font-heading)";
  heading.style.fontSize = "1.5rem";
  heading.style.color = "var(--green-dark)";
  heading.style.margin = "0 0 8px";
  block.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "Comments come from the Teacher and Audience QR forms (sync them on the QR Forms tab). Each page is fitted to one sheet (comments run in columns, with smaller type if needed). Group and student pages include the score tables; on a student's page, the Peer Evaluation row (and the Total) is that student's own peer rating.";
  block.appendChild(hint);

  const status = document.createElement("p");
  status.className = "result";
  block.appendChild(status);

  const buttons = document.createElement("div");
  buttons.className = "panel-toolbar-buttons";
  [
    ["Print Comments", "comments"],
    ["Print Group Score Pages", "groups"],
    ["Print Student Score Pages", "students"],
  ].forEach(([label, kind]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      status.textContent = printPresentationReport(tool, project, kind);
    });
    buttons.appendChild(btn);
  });
  block.appendChild(buttons);
  return block;
}

// ----- Presentation Calc: emailing the reports as PDFs -----
//
// Each of the three printable reports can be emailed instead of printed:
// every page is drawn to an image (so Japanese text and the layout come
// out exactly as on the printout), made into a one-page PDF, and sent as
// an attachment through the signed-in Google account's Gmail (this needs
// the Gmail "send" permission — see js/config.js).
//   Comments / Group pages: each student receives their GROUP's page.
//   Student pages: each student receives their own page.
// Recipients are the students in the project's groups who have an email
// address on the Roster; students without one are skipped and listed.
// A "test address" sends just one email, to that address only.

const REPORT_EMAIL_LABELS = {
  comments: "Comments",
  groups: "Group Score Page",
  students: "Student Score Page",
};

const DEFAULT_EMAIL_SUBJECT = "{course}: {project} — {report}";
const DEFAULT_EMAIL_MESSAGE = "Hello {name},\n\nAttached is your {report} for {project}.\n";

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function utf8ToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

/** Base64 text broken into 76-character lines, as email requires. */
function wrapBase64(base64) {
  return (base64.match(/.{1,76}/g) || []).join("\r\n");
}

/** A complete email (headers + plain-text body + one PDF attachment) as text, ready for the Gmail API. Non-English subjects and file names are encoded the way email requires. */
function buildPdfEmailMessage({ to, subject, body, filename, pdfBytes }) {
  const boundary = `ggo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const encodedName = encodeURIComponent(filename).replace(/'/g, "%27");
  return [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${utf8ToBase64(subject)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(utf8ToBase64(body)),
    `--${boundary}`,
    'Content-Type: application/pdf; name="report.pdf"',
    `Content-Disposition: attachment; filename="report.pdf"; filename*=UTF-8''${encodedName}`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(bytesToBase64(pdfBytes)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

async function sendGmailMessage(message) {
  const raw = btoa(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const post = async () => {
    const token = await storage.getAccessToken();
    return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
  };
  let response = await post();
  if (response.status === 401 && storage.invalidateGoogleToken) { // token went stale: get one fresh token (one sign-in), then retry this email once
    storage.invalidateGoogleToken();
    response = await post();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Google hasn't allowed this app to send email yet. Sign out, sign in again and approve the email permission (and make sure the Gmail API is turned on in Google Cloud). " +
          text.slice(0, 160)
      );
    }
    throw new Error(`Gmail error (${response.status}): ${text.slice(0, 200)}`);
  }
}

/** Fits one report page, draws it to an image, and returns it as a one-page PDF (bytes). */
async function renderPageToPdfBytes(page, stage) {
  stage.appendChild(page.sheet);
  fitPresentationPage(page);
  const canvas = await html2canvas(page.sheet, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDocument) => {
      // The stage sits off-screen; bring it back to the top-left in the copy that gets drawn.
      const clonedStage = clonedDocument.getElementById("ggo-pdf-stage");
      if (clonedStage) {
        clonedStage.style.position = "static";
        clonedStage.style.left = "0";
        clonedStage.style.top = "0";
      }
    },
  });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: [185, 255], orientation: "portrait" });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 185, 255);
  return new Uint8Array(pdf.output("arraybuffer"));
}

/** Replaces {name}, {group}, {report}, {project}, {course} in the subject/message text. */
function fillEmailTemplate(template, values) {
  return template
    .replaceAll("{name}", values.name)
    .replaceAll("{group}", values.group)
    .replaceAll("{report}", values.report)
    .replaceAll("{project}", values.project)
    .replaceAll("{course}", values.course);
}

/**
 * Emails one report. targetStudentId: one student's id, or "" for every
 * student in the project's groups. testAddress: if given, only the first
 * email is sent, to that address. Progress is reported through `status`.
 */
async function emailPresentationReports(tool, project, kind, targetStudentId, testAddress, status) {
  if (typeof html2canvas === "undefined" || !window.jspdf) {
    status.textContent = "The PDF tools didn't load — check your internet connection and reload the page.";
    return;
  }
  const built = buildPresentationReportPages(tool, project, kind);
  if (built.error) {
    status.textContent = built.error;
    return;
  }

  const label = REPORT_EMAIL_LABELS[kind];
  const course = CoursesModule.find(RosterModule.currentCourseId);
  const settings = project.templateSettings;
  const subjectTemplate = settings.emailSubject.trim() || DEFAULT_EMAIL_SUBJECT;
  const messageTemplate = settings.emailMessage.trim() ? settings.emailMessage : DEFAULT_EMAIL_MESSAGE;

  // ----- Who gets what -----
  const recipients = project.roster.filter((entry) => entry.group && (!targetStudentId || entry.studentId === targetStudentId));
  const emailOf = (entry) => {
    const student = RosterModule.students.find((s) => s.id === entry.studentId);
    return student && /@/.test(student.email || "") ? student.email.trim() : "";
  };
  const pageFor = (entry) =>
    kind === "students" ? built.pages.find((p) => p.studentId === entry.studentId) : built.pages.find((p) => p.group === entry.group);

  let jobs = recipients.map((entry) => ({ entry, to: emailOf(entry), page: pageFor(entry) })).filter((job) => job.page);
  const skipped = jobs.filter((job) => !job.to).map((job) => job.entry.name || "(unnamed)");
  const test = testAddress.trim();
  if (test) {
    jobs = jobs.slice(0, 1).map((job) => ({ ...job, to: test, isTest: true }));
  } else {
    jobs = jobs.filter((job) => job.to);
  }
  if (jobs.length === 0) {
    status.textContent = skipped.length > 0 ? `None of those students has an email address on the Roster (${skipped.join(", ")}).` : "There is nobody to send to.";
    return;
  }

  const summary = test
    ? `Send ONE test email with a PDF to ${test}?`
    : `Send ${jobs.length} email(s), each with a PDF (${label}), to ${jobs.length === 1 ? jobs[0].to : "these students"}?` +
      (skipped.length > 0 ? `\n\nNo email address on the Roster, so skipped: ${skipped.join(", ")}.` : "");
  if (!confirm(summary)) return;
  // Sign in to Google ONCE, up front; every email in the batch then reuses that token.
  try { status.textContent = "Signing in to Google…"; await storage.getAccessToken(); }
  catch (err) { status.textContent = `Couldn't sign in to Google (${err.message}). Allow pop-ups for this site and try again.`; return; }

  // ----- Make the PDFs (one per page, reused by everyone who gets that page) and send -----
  const stage = document.createElement("div");
  stage.id = "ggo-pdf-stage";
  stage.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff;";
  document.body.appendChild(stage);

  const pdfs = new Map(); // page -> bytes
  const failures = [];
  let sent = 0;
  try {
    for (const job of jobs) {
      status.textContent = `Sending ${sent + failures.length + 1} of ${jobs.length}…`;
      try {
        if (!pdfs.has(job.page)) pdfs.set(job.page, await renderPageToPdfBytes(job.page, stage));
        const values = {
          name: job.entry.name || "",
          group: String(job.entry.group),
          report: label,
          project: project.name,
          course: course ? course.name : "",
        };
        const safe = (text) => text.replace(/[\\/:*?"<>|]/g, "").trim();
        const fileLabel = kind === "students" ? job.entry.name || "student" : `Group ${job.entry.group}`;
        const filename = `${[safe(values.course), safe(values.project), label, safe(fileLabel)].filter(Boolean).join(" ")}.pdf`;
        await sendGmailMessage(
          buildPdfEmailMessage({
            to: job.to,
            subject: (job.isTest ? "[TEST] " : "") + fillEmailTemplate(subjectTemplate, values),
            body: fillEmailTemplate(messageTemplate, values),
            filename,
            pdfBytes: pdfs.get(job.page),
          })
        );
        sent++;
      } catch (err) {
        failures.push(`${job.entry.name || "(unnamed)"}: ${err.message}`);
        if (/allowed this app to send email/.test(err.message)) break; // no point trying the rest
      }
      await new Promise((resolve) => setTimeout(resolve, 250)); // be gentle with Gmail's limits
    }
  } finally {
    stage.remove();
  }

  status.textContent =
    `Sent ${sent} email(s)` +
    (test ? " (test)" : "") +
    (skipped.length > 0 && !test ? `; skipped (no email address): ${skipped.join(", ")}` : "") +
    (failures.length > 0 ? `. Problems: ${failures.join(" | ")}` : ".");
}

/** The email section on the Scores page: who to send to, the message, and the three buttons. */
function buildPresentationEmailSection(tool, project) {
  const settings = project.templateSettings;

  const block = document.createElement("div");
  block.className = "attendance-settings-block";
  block.style.borderTop = "2px solid var(--line)";
  block.style.paddingTop = "18px";
  block.style.marginTop = "22px";

  const heading = document.createElement("h3");
  heading.textContent = "Email as PDF";
  heading.style.fontFamily = "var(--font-heading)";
  heading.style.fontSize = "1.5rem";
  heading.style.color = "var(--green-dark)";
  heading.style.margin = "0 0 8px";
  block.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "Sends the same pages as the Print buttons, one PDF per email, through your Google account. Comments and Group pages go to every student in that group; Student pages go to that student. Students need an email address on the Roster. Use the test box to send a single sample to yourself first.";
  block.appendChild(hint);

  const addRow = (labelText, control) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    const label = document.createElement("label");
    label.textContent = labelText;
    row.append(label, control);
    block.appendChild(row);
  };

  const recipientSelect = document.createElement("select");
  const everyone = document.createElement("option");
  everyone.value = "";
  everyone.textContent = "All students in the groups";
  recipientSelect.appendChild(everyone);
  project.roster
    .filter((entry) => entry.group)
    .forEach((entry) => {
      const opt = document.createElement("option");
      opt.value = entry.studentId;
      opt.textContent = `Group ${entry.group} · ${entry.name || "(unnamed)"}`;
      recipientSelect.appendChild(opt);
    });
  addRow("Send to", recipientSelect);

  const subjectInput = document.createElement("input");
  subjectInput.type = "text";
  subjectInput.placeholder = DEFAULT_EMAIL_SUBJECT;
  subjectInput.value = settings.emailSubject;
  subjectInput.addEventListener("input", () => {
    settings.emailSubject = subjectInput.value;
  });
  addRow("Subject", subjectInput);

  const messageInput = document.createElement("textarea");
  messageInput.rows = 4;
  messageInput.placeholder = DEFAULT_EMAIL_MESSAGE;
  messageInput.value = settings.emailMessage;
  messageInput.addEventListener("input", () => {
    settings.emailMessage = messageInput.value;
  });
  addRow("Message", messageInput);

  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = "In the subject and message, {name}, {group}, {report}, {project} and {course} are filled in for each student. Leave them blank to use the standard wording. Saved with Save Scoring.";
  block.appendChild(note);

  const testInput = document.createElement("input");
  testInput.type = "text";
  testInput.placeholder = "your own address — sends ONE test email only";
  addRow("Test address", testInput);

  const status = document.createElement("p");
  status.className = "result";
  block.appendChild(status);

  const buttons = document.createElement("div");
  buttons.className = "panel-toolbar-buttons";
  [
    ["Email Comments", "comments"],
    ["Email Group Score Pages", "groups"],
    ["Email Student Score Pages", "students"],
  ].forEach(([label, kind]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = label;
    btn.addEventListener("click", async () => {
      const all = buttons.querySelectorAll("button");
      all.forEach((b) => (b.disabled = true));
      try {
        await emailPresentationReports(tool, project, kind, recipientSelect.value, testInput.value, status);
      } catch (err) {
        status.textContent = `Couldn't send: ${err.message}`;
      }
      all.forEach((b) => (b.disabled = false));
    });
    buttons.appendChild(btn);
  });
  block.appendChild(buttons);
  return block;
}

// ===== Report Card =====

el.modeConsultationBtn.addEventListener("click", () => showReportCardMode("consultation"));
el.modePrintcardBtn.addEventListener("click", () => showReportCardMode("printcard"));

function showReportCardMode(mode) {
  el.consultationView.hidden = mode !== "consultation";
  el.printcardView.hidden = mode !== "printcard";
  el.modeConsultationBtn.classList.toggle("tab-btn-active", mode === "consultation");
  el.modePrintcardBtn.classList.toggle("tab-btn-active", mode === "printcard");
  if (mode === "printcard") {
    renderItemSelectionList(); // scoring items may have changed since this was last shown
    renderPrintcardStudentOptions(); // roster may have changed since this was last shown
  }
}

/** Rebuilds the student dropdown, preserving the current selection if that student still exists. */
function renderConsultationStudentOptions() {
  const previousValue = el.consultationStudentSelect.value;
  el.consultationStudentSelect.innerHTML = "";

  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "Select a student…";
  el.consultationStudentSelect.appendChild(blankOpt);

  RosterModule.students.forEach((student) => {
    const opt = document.createElement("option");
    opt.value = student.id;
    opt.textContent = `#${student.classNumber || "—"} ${student.name || "(unnamed)"}`;
    el.consultationStudentSelect.appendChild(opt);
  });

  const stillExists = RosterModule.students.some((s) => s.id === previousValue);
  el.consultationStudentSelect.value = stillExists ? previousValue : "";
  renderConsultationDetail();
}

el.consultationStudentSelect.addEventListener("change", renderConsultationDetail);

/** Total Score for Student Consultation, respecting its own local toggle. Points mode now uses ScoringModule.totalPoints (the same weighted-points figure shown on the Scoring tab), not an inflated percent×100. */
function formatConsultationTotal(studentId) {
  if (consultationDisplayMode === "points") {
    const points = ScoringModule.totalPoints(studentId);
    return points === null ? "—" : String(points);
  }
  const percent = ScoringModule.weightedPercent(studentId);
  return percent === null ? "—" : `${Math.round(percent)}%`;
}

function renderConsultationDetail() {
  const studentId = el.consultationStudentSelect.value;
  el.consultationDetail.innerHTML = "";

  if (!studentId) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Choose a student above to see their scores.";
    el.consultationDetail.appendChild(hint);
    return;
  }

  const student = RosterModule.students.find((s) => s.id === studentId);
  const detail = ReportCardModule.studentDetail(studentId);

  const header = document.createElement("div");
  header.className = "consultation-header";
  const nameLine = document.createElement("h3");
  nameLine.textContent = `#${student.classNumber || "—"} ${student.name || "(unnamed)"}`;
  header.appendChild(nameLine);
  if (student.pronunciation || student.schoolId) {
    const subLine = document.createElement("p");
    subLine.className = "hint";
    subLine.textContent = [student.pronunciation, student.schoolId].filter(Boolean).join(" · ");
    header.appendChild(subLine);
  }
  const totalLine = document.createElement("p");
  totalLine.className = "consultation-total";

  const totalToggleBtn = document.createElement("button");
  totalToggleBtn.type = "button";
  totalToggleBtn.className = "score-toggle-btn";
  totalToggleBtn.textContent = consultationDisplayMode === "points" ? "Points ⇄" : "Percent ⇄";
  totalToggleBtn.title = "Click to switch Total Score between percent and weighted points";
  totalToggleBtn.addEventListener("click", () => {
    consultationDisplayMode = consultationDisplayMode === "points" ? "percent" : "points";
    renderConsultationDetail();
  });

  const totalValue = document.createElement("span");
  totalValue.textContent = `Total Score: ${formatConsultationTotal(studentId)} `;
  totalLine.append(totalValue, totalToggleBtn);
  header.appendChild(totalLine);
  el.consultationDetail.appendChild(header);

  // ----- Categories -----
  detail.categories.forEach((category) => {
    if (category.items.length === 0) return; // nothing to show for an empty category
    const block = document.createElement("div");
    block.className = "consultation-category-block";

    const catHeading = document.createElement("h4");
    catHeading.textContent = `${category.name} — ${
      category.subtotal.percent === null ? "—" : `${category.subtotal.percent}%`
    } (weight ${category.weight})`;
    block.appendChild(catHeading);

    const itemList = document.createElement("ul");
    itemList.className = "consultation-item-list";
    category.items.forEach((item) => {
      const li = document.createElement("li");
      const scoreText = item.record === "" ? "—" : item.record === "E" ? "Exempt" : `${item.record}/${item.maxPoints}`;
      li.textContent = `${item.name}: ${scoreText}`;
      itemList.appendChild(li);
    });
    block.appendChild(itemList);
    el.consultationDetail.appendChild(block);
  });

  // ----- Attendance -----
  const attBlock = document.createElement("div");
  attBlock.className = "consultation-category-block";
  const attHeading = document.createElement("h4");
  attHeading.textContent = `Attendance — ${
    detail.attendance.percent === null ? "—" : `${detail.attendance.percent}%`
  } (weight ${detail.attendanceWeight})`;
  attBlock.appendChild(attHeading);
  const attLine = document.createElement("p");
  attLine.className = "hint";
  attLine.textContent = `Attended: ${detail.attendance.attended} — Absences: ${detail.attendance.absences}`;
  attBlock.appendChild(attLine);

  if (detail.attendanceNote) {
    const noteLine = document.createElement("p");
    noteLine.className = "hint consultation-attendance-note";
    noteLine.textContent = `Note: ${detail.attendanceNote}`;
    attBlock.appendChild(noteLine);
  }

  const recordedSessions = detail.attendanceSessions.filter((s) => s.code);
  if (recordedSessions.length > 0) {
    const sessionList = document.createElement("ul");
    sessionList.className = "consultation-item-list consultation-attendance-list";
    recordedSessions.forEach((s) => {
      const li = document.createElement("li");
      const dateLabel = s.date ? ` (${s.date})` : "";
      let text = `Class ${s.number}${dateLabel}: ${s.code}`;
      if (s.infraction) text += ` — ${s.infraction}`;
      if (s.memo) text += ` — "${s.memo}"`;
      li.textContent = text;
      sessionList.appendChild(li);
    });
    attBlock.appendChild(sessionList);
  }

  el.consultationDetail.appendChild(attBlock);
}

// ----- Item selection -----

function renderItemSelectionList() {
  el.itemSelectionList.innerHTML = "";

  if (ScoringModule.categories.every((c) => c.items.length === 0)) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "No scoring items exist yet — add some on the Scoring tab first.";
    el.itemSelectionList.appendChild(hint);
    return;
  }

  ScoringModule.categories.forEach((category) => {
    if (category.items.length === 0) return;
    const block = document.createElement("div");
    block.className = "consultation-category-block";

    const heading = document.createElement("h4");
    heading.textContent = category.name;
    block.appendChild(heading);

    const list = document.createElement("div");
    list.className = "item-checkbox-list";
    category.items.forEach((item) => {
      const label = document.createElement("label");
      label.className = "item-checkbox-label";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = ReportCardModule.isItemSelected(item.id);
      checkbox.addEventListener("change", async () => {
        ReportCardModule.toggleItemSelected(item.id);
        await savePrintcardThen();
      });

      label.append(checkbox, document.createTextNode(` ${item.name}`));
      list.appendChild(label);
    });
    block.appendChild(list);
    el.itemSelectionList.appendChild(block);
  });
}

el.selectAllItemsBtn.addEventListener("click", async () => {
  ReportCardModule.selectAll();
  await savePrintcardThen(renderItemSelectionList);
});

el.selectNoItemsBtn.addEventListener("click", async () => {
  ReportCardModule.selectNone();
  await savePrintcardThen(renderItemSelectionList);
});

function savePrintcardThen(after) {
  if (after) after();
}

el.savePrintcardBtn.addEventListener("click", async () => {
  el.printcardStatus.textContent = "Saving…";
  try {
    await ReportCardModule.save();
    el.printcardStatus.textContent = "Saved to Google Drive ✓";
  } catch (err) {
    el.printcardStatus.textContent = `Save failed: ${err.message}`;
  }
});

// ----- Student picker for single-student printing -----

function renderPrintcardStudentOptions() {
  const previousValue = el.printcardStudentSelect.value;
  el.printcardStudentSelect.innerHTML = "";

  RosterModule.students.forEach((student) => {
    const opt = document.createElement("option");
    opt.value = student.id;
    opt.textContent = `#${student.classNumber || "—"} ${student.name || "(unnamed)"}`;
    el.printcardStudentSelect.appendChild(opt);
  });

  const stillExists = RosterModule.students.some((s) => s.id === previousValue);
  if (stillExists) el.printcardStudentSelect.value = previousValue;
}

// ----- Printing -----

el.printOneBtn.addEventListener("click", () => {
  const studentId = el.printcardStudentSelect.value;
  if (!studentId) {
    el.printcardStatus.textContent = "Choose a student first.";
    return;
  }
  el.printArea.innerHTML = "";
  el.printArea.appendChild(buildReportCardSheet(studentId));
  window.print();
});

el.printAllBtn.addEventListener("click", () => {
  if (RosterModule.students.length === 0) {
    el.printcardStatus.textContent = "There are no students on the roster yet.";
    return;
  }
  el.printArea.innerHTML = "";
  RosterModule.students.forEach((student, index) => {
    const sheet = buildReportCardSheet(student.id);
    if (index < RosterModule.students.length - 1) sheet.classList.add("report-sheet-page-break");
    el.printArea.appendChild(sheet);
  });
  window.print();
});

/** Builds one printable report card page for a student, limited to the selected items.
 * Laid out as a compact header plus a multi-column grid of small tables (one per
 * category, plus Attendance), so a student with many categories/items still fits
 * on one printed page. */
function buildReportCardSheet(studentId) {
  const student = RosterModule.students.find((s) => s.id === studentId);
  const detail = ReportCardModule.studentDetail(studentId);
  const course = CoursesModule.find(RosterModule.currentCourseId);

  const sheet = document.createElement("div");
  sheet.className = "report-sheet";

  const courseHeading = document.createElement("p");
  courseHeading.className = "report-sheet-course";
  courseHeading.textContent = course ? course.name : "";
  sheet.appendChild(courseHeading);

  const nameHeading = document.createElement("h2");
  nameHeading.textContent = `#${student.classNumber || "—"} ${student.name || "(unnamed)"}`;
  sheet.appendChild(nameHeading);

  const subLine = document.createElement("p");
  subLine.className = "report-sheet-sub";
  subLine.textContent = [student.pronunciation, student.schoolId].filter(Boolean).join(" · ");
  sheet.appendChild(subLine);

  const columns = document.createElement("div");
  columns.className = "report-sheet-columns";

  detail.categories.forEach((category) => {
    const selectedItems = category.items.filter((item) => ReportCardModule.isItemSelected(item.id));
    if (selectedItems.length === 0) return;
    columns.appendChild(
      buildReportSheetTable(
        `${category.name} — ${category.subtotal.percent === null ? "—" : `${category.subtotal.percent}%`}`,
        selectedItems.map((item) => [
          item.name,
          item.record === "" ? "—" : item.record === "E" ? "Exempt" : `${item.record}/${item.maxPoints}`,
        ])
      )
    );
  });

  columns.appendChild(
    buildReportSheetTable(
      `Attendance — ${detail.attendance.percent === null ? "—" : `${detail.attendance.percent}%`}`,
      [
        ["Attended", String(detail.attendance.attended)],
        ["Absences", String(detail.attendance.absences)],
      ]
    )
  );

  sheet.appendChild(columns);

  const totalBlock = document.createElement("div");
  totalBlock.className = "report-sheet-total-block";
  totalBlock.textContent = `Total Score: ${detail.total === null ? "—" : detail.total}`;
  sheet.appendChild(totalBlock);

  return sheet;
}

/** A small two-column table (label / value rows) with a heading — the compact building block for each category/attendance box in the print grid. */
function buildReportSheetTable(heading, rows) {
  const wrap = document.createElement("div");
  wrap.className = "report-sheet-table-block";

  const table = document.createElement("table");
  table.className = "report-sheet-table";

  const caption = document.createElement("caption");
  caption.textContent = heading;
  table.appendChild(caption);

  const tbody = document.createElement("tbody");
  rows.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    const labelTd = document.createElement("td");
    labelTd.textContent = label;
    const valueTd = document.createElement("td");
    valueTd.className = "report-sheet-score-col";
    valueTd.textContent = value;
    tr.append(labelTd, valueTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}

// ===== Email collection (Google Form + QR code) =====

function renderEmailCollectButtons() {
  const active = EmailCollectModule.hasActiveForm();
  el.collectEmailBtn.hidden = active;
  el.syncEmailBtn.hidden = !active;
  el.showEmailQrBtn.hidden = !active;
  el.deleteEmailFormBtn.hidden = !active;
}

el.collectEmailBtn.addEventListener("click", async () => {
  el.emailCollectStatus.textContent = "Creating form…";
  const course = CoursesModule.find(RosterModule.currentCourseId);
  try {
    const made = await EmailCollectModule.createForm(RosterModule.students, course ? course.name : "");
    renderEmailCollectButtons();
    renderEmailSettings();
    el.emailCollectStatus.textContent = "Form created — opening QR code…" + emailLeftOutNote(made.summary);
    window.open("emailqr.html?" + qrCourseQuery().slice(1), "ggo-email-qr", "width=480,height=560");
  } catch (err) {
    el.emailCollectStatus.textContent = `Couldn't create the form: ${err.message}`;
  }
});

el.showEmailQrBtn.addEventListener("click", () => {
  window.open("emailqr.html?" + qrCourseQuery().slice(1), "ggo-email-qr", "width=480,height=560");
});

el.deleteEmailFormBtn.addEventListener("click", async () => {
  if (!confirm("Delete this email-collection form? Its QR code will stop working — you'd need to create a new one to collect more emails.")) return;
  el.emailCollectStatus.textContent = "Deleting form…";
  try {
    await EmailCollectModule.deleteForm();
    renderEmailCollectButtons();
    el.emailCollectStatus.textContent = "Form deleted.";
  } catch (err) {
    el.emailCollectStatus.textContent = `Couldn't delete the form: ${err.message}`;
  }
});

el.syncEmailBtn.addEventListener("click", async () => {
  el.emailCollectStatus.textContent = "Syncing…";
  try {
    const result = await EmailCollectModule.syncResponses(RosterModule.students);
    result.matches.forEach((m) => {
      RosterModule.updateStudent(m.studentId, { email: m.email });
    });
    if (result.matches.length > 0) {
      renderRoster();
    }
    renderEmailCollectButtons();
    el.emailCollectStatus.textContent =
      `Matched ${result.matches.length} of ${result.totalResponses} response(s).` +
      (result.unmatchedCount > 0 ? ` ${result.unmatchedCount} no longer match anyone on the roster (ignored).` : "") +
      (result.matches.length > 0
        ? window.GGOAutosave && window.GGOAutosave.enabled()
          ? " Saving automatically."
          : " Click Save Roster to store the emails."
        : "");
  } catch (err) {
    el.emailCollectStatus.textContent = `Couldn't sync: ${err.message}`;
  }
});

// ===== Email collection settings, and keeping the form's list equal to the roster =====

/** " 3 students are left out: ..." — empty when everyone is in. */
function emailLeftOutNote(summary) {
  if (!summary) return "";
  const parts = [];
  if (summary.blank > 0) parts.push(`${summary.blank} with nothing filled in`);
  if (summary.shared.length > 0) parts.push(`shared by several students (${summary.shared.join(", ")})`);
  return parts.length ? ` Left out: ${parts.join("; ")}.` : "";
}

let emailSettingsOpen = false;
const emailEls = {
  toggle: document.getElementById("toggle-email-settings-btn"),
  body: document.getElementById("email-settings-body"),
  field: document.getElementById("email-match-field"),
  label: document.getElementById("email-match-label"),
  note: document.getElementById("email-match-note"),
  status: document.getElementById("email-settings-status"),
};

function flashEmailSettingsStatus(text, ms = 2500) {
  emailEls.status.textContent = text;
  if (ms) setTimeout(() => { if (emailEls.status.textContent === text) emailEls.status.textContent = ""; }, ms);
}

/** Refreshes the settings section from the current roster and form. Cheap; safe to call often. */
function renderEmailSettings() {
  emailEls.body.hidden = !emailSettingsOpen;
  emailEls.toggle.textContent = emailSettingsOpen ? "Hide Settings" : "Edit Settings";
  if (!emailSettingsOpen) return;

  const students = RosterModule.students;
  const fields = EmailCollectModule.availableFields(students);
  const optionsKey = fields.map((f) => f.value).join("\n");
  if (emailEls.field.dataset.options !== optionsKey) {
    emailEls.field.innerHTML = "";
    fields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      emailEls.field.appendChild(opt);
    });
    emailEls.field.dataset.options = optionsKey;
  }
  const effective = EmailCollectModule.effectiveField(students);
  emailEls.field.value = effective;

  emailEls.label.placeholder = EmailCollectModule.defaultLabel(effective);
  if (document.activeElement !== emailEls.label) emailEls.label.value = EmailCollectModule.matchLabel;

  const notes = [];
  if (EmailCollectModule.matchField !== effective) {
    notes.push(`The column "${EmailCollectModule.matchField.replace(/^extra:/, "")}" isn't on the roster any more, so School ID is being used.`);
  }
  if (fields.length === 2) {
    notes.push("Other choices appear here when you upload a roster file and tick extra columns to keep in the import step.");
  }
  const info = EmailCollectModule.describe(students);
  if (EmailCollectModule.hasActiveForm()) {
    notes.push(
      info.known
        ? `${info.inForm} student${info.inForm === 1 ? "" : "s"} can answer.${emailLeftOutNote(info)}`
        : "Updating the form…"
    );
  } else {
    notes.push(`${info.inForm + info.shared.length} of ${students.length} students have a value filled in. Click "Collect Email Addresses" to start.`);
  }
  emailEls.note.textContent = notes.join(" ");
}

emailEls.toggle.addEventListener("click", () => {
  emailSettingsOpen = !emailSettingsOpen;
  renderEmailSettings();
});

emailEls.field.addEventListener("change", async () => {
  const chosen = emailEls.field.value;
  if (chosen === EmailCollectModule.matchField) return;
  try {
    if (EmailCollectModule.hasActiveForm()) {
      const ok = confirm(
        "Change what students are asked for?\n\nThe QR code keeps working, but students will be asked for the new item. " +
          "Answers collected so far will be discarded, because they were matched the old way — click Sync Emails first if you haven't yet.\n\nContinue?"
      );
      if (!ok) { renderEmailSettings(); return; }
      await EmailCollectModule.clearResponses();
    }
    EmailCollectModule.matchField = chosen;
    EmailCollectModule.matchLabel = "";
    await EmailCollectModule.save();
    if (EmailCollectModule.hasActiveForm()) await EmailCollectModule.pushAllowed(RosterModule.students);
    flashEmailSettingsStatus("Saved ✓");
  } catch (err) {
    flashEmailSettingsStatus(`Couldn't change it: ${err.message}`, 8000);
  }
  renderEmailSettings();
});

emailEls.label.addEventListener("change", async () => {
  const typed = emailEls.label.value.trim();
  EmailCollectModule.matchLabel = typed === EmailCollectModule.defaultLabel(EmailCollectModule.effectiveField(RosterModule.students)) ? "" : typed;
  try {
    await EmailCollectModule.save();
    if (EmailCollectModule.hasActiveForm()) await EmailCollectModule.pushAllowed(RosterModule.students);
    flashEmailSettingsStatus("Saved ✓");
  } catch (err) {
    flashEmailSettingsStatus(`Couldn't save: ${err.message}`, 8000);
  }
  renderEmailSettings();
});

// The open form always lists exactly the students on the roster right now. Whenever the roster's values
// change (a student added or edited, a new file uploaded, a student replaced) the list is re-sent a moment
// after the changes stop. Never runs while a course is still loading, so it can't send one course's students
// to another course's form.
(function keepEmailFormInSyncWithRoster() {
  let loading = 0;
  let rosterCourse = null;
  let emailCourse = null;
  let seenSig = null;
  let pushing = false;
  let retryAt = 0;

  const origRosterLoad = RosterModule.load;
  RosterModule.load = async function (...args) {
    loading++;
    rosterCourse = null;
    try {
      const r = await origRosterLoad.apply(this, args);
      rosterCourse = RosterModule.currentCourseId;
      return r;
    } finally {
      loading--;
    }
  };
  const origEmailLoad = EmailCollectModule.load;
  EmailCollectModule.load = async function (...args) {
    loading++;
    emailCourse = null;
    seenSig = null;
    try {
      const r = await origEmailLoad.apply(this, args);
      emailCourse = EmailCollectModule.currentCourseId;
      return r;
    } finally {
      loading--;
    }
  };

  setInterval(async () => {
    if (loading || pushing || Date.now() < retryAt) return;
    const course = RosterModule.currentCourseId;
    if (!course || rosterCourse !== course || emailCourse !== course) return;
    if (!storage || !storage.isSignedIn() || !EmailCollectModule.hasActiveForm()) return;

    renderEmailSettings();
    const sig = EmailCollectModule.signature(RosterModule.students);
    if (sig === EmailCollectModule.lastPushedSig) { seenSig = null; return; }
    if (sig !== seenSig) { seenSig = sig; return; } // wait until the changes have stopped
    pushing = true;
    try {
      await EmailCollectModule.pushAllowed(RosterModule.students);
      seenSig = null;
      renderEmailSettings();
    } catch (err) {
      retryAt = Date.now() + 8000;
      emailEls.note.textContent = `Couldn't update the email form (${err.message}) — retrying.`;
    } finally {
      pushing = false;
    }
  }, 1000);
})();

// ===== Report Card: emailing report cards as PDFs =====
// Uses the same page as "Print This Student" / "Print All Students"
// (buildReportCardSheet), drawn to an image and made into a one-page PDF,
// then sent through the signed-in Google account's Gmail — the helpers
// (buildPdfEmailMessage, sendGmailMessage, fillEmailTemplate) are shared
// with the Presentation Calc emailing. Students need an email address on
// the Roster. A "test address" sends just one email, to that address only.

const DEFAULT_REPORTCARD_SUBJECT = "{course}: Report Card";
const DEFAULT_REPORTCARD_MESSAGE = "Hello {name},\n\nAttached is your report card for {course}.\n";

/** Draws an element to an image and returns it as a one-page PDF (bytes). A page taller than the PDF is scaled down to fit. */
async function renderElementToPdfBytes(element, stage) {
  stage.appendChild(element);
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDocument) => {
      const clonedStage = clonedDocument.getElementById("ggo-pdf-stage");
      if (clonedStage) {
        clonedStage.style.position = "static";
        clonedStage.style.left = "0";
        clonedStage.style.top = "0";
      }
    },
  });
  stage.removeChild(element);

  const pageWidthMm = 185;
  const pageHeightMm = 255;
  let drawWidth = pageWidthMm;
  let drawHeight = (canvas.height / canvas.width) * pageWidthMm;
  if (drawHeight > pageHeightMm) {
    const shrink = pageHeightMm / drawHeight;
    drawWidth *= shrink;
    drawHeight = pageHeightMm;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: [pageWidthMm, pageHeightMm], orientation: "portrait" });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", (pageWidthMm - drawWidth) / 2, 0, drawWidth, drawHeight);
  return new Uint8Array(pdf.output("arraybuffer"));
}

/** Emails report cards: targetStudentId = one student's id, or "" for everyone on the roster. testAddress: if given, only the first email is sent, to that address. */
async function emailReportCards(targetStudentId, testAddress, status) {
  if (typeof html2canvas === "undefined" || !window.jspdf) {
    status.textContent = "The PDF tools didn't load — check your internet connection and reload the page.";
    return;
  }
  const course = CoursesModule.find(RosterModule.currentCourseId);
  const courseName = course ? course.name : "";
  const subjectTemplate = ReportCardModule.emailSubject.trim() || DEFAULT_REPORTCARD_SUBJECT;
  const messageTemplate = ReportCardModule.emailMessage.trim() ? ReportCardModule.emailMessage : DEFAULT_REPORTCARD_MESSAGE;

  const students = RosterModule.students.filter((s) => !targetStudentId || s.id === targetStudentId);
  let jobs = students.map((student) => ({ student, to: /@/.test(student.email || "") ? student.email.trim() : "" }));
  const skipped = jobs.filter((job) => !job.to).map((job) => job.student.name || "(unnamed)");
  const test = testAddress.trim();
  if (test) jobs = jobs.slice(0, 1).map((job) => ({ ...job, to: test, isTest: true }));
  else jobs = jobs.filter((job) => job.to);

  if (jobs.length === 0) {
    status.textContent =
      skipped.length > 0
        ? `None of those students has an email address on the Roster (${skipped.join(", ")}).`
        : "There are no students to send to.";
    return;
  }

  const summary = test
    ? `Send ONE test report card email to ${test}?`
    : `Send ${jobs.length} report card email(s), each with a PDF?` +
      (skipped.length > 0 ? `\n\nNo email address on the Roster, so skipped: ${skipped.join(", ")}.` : "");
  if (!confirm(summary)) return;
  // Sign in to Google ONCE, up front; every email in the batch then reuses that token.
  try { status.textContent = "Signing in to Google…"; await storage.getAccessToken(); }
  catch (err) { status.textContent = `Couldn't sign in to Google (${err.message}). Allow pop-ups for this site and try again.`; return; }

  const stage = document.createElement("div");
  stage.id = "ggo-pdf-stage";
  stage.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff;";
  document.body.appendChild(stage);

  const failures = [];
  let sent = 0;
  try {
    for (const job of jobs) {
      status.textContent = `Sending ${sent + failures.length + 1} of ${jobs.length}…`;
      try {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "width:185mm;padding:7mm;box-sizing:border-box;background:#fff;color:#000;";
        wrapper.appendChild(buildReportCardSheet(job.student.id));
        const pdfBytes = await renderElementToPdfBytes(wrapper, stage);

        const values = { name: job.student.name || "", group: "", report: "Report Card", project: "", course: courseName };
        const safe = (text) => text.replace(/[\\/:*?"<>|]/g, "").trim();
        const filename = `${[safe(courseName), "Report Card", safe(job.student.name || "")].filter(Boolean).join(" ")}.pdf`;
        await sendGmailMessage(
          buildPdfEmailMessage({
            to: job.to,
            subject: (job.isTest ? "[TEST] " : "") + fillEmailTemplate(subjectTemplate, values),
            body: fillEmailTemplate(messageTemplate, values),
            filename,
            pdfBytes,
          })
        );
        sent++;
      } catch (err) {
        failures.push(`${job.student.name || "(unnamed)"}: ${err.message}`);
        if (/allowed this app to send email/.test(err.message)) break; // no point trying the rest
      }
      await new Promise((resolve) => setTimeout(resolve, 250)); // be gentle with Gmail's limits
    }
  } finally {
    stage.remove();
  }

  status.textContent =
    `Sent ${sent} email(s)` +
    (test ? " (test)" : "") +
    (skipped.length > 0 && !test ? `; skipped (no email address): ${skipped.join(", ")}` : "") +
    (failures.length > 0 ? `. Problems: ${failures.join(" | ")}` : ".");
}

/** Builds (or rebuilds) the "Email report cards" block at the bottom of the Report Card print view. */
function renderReportCardEmailSection() {
  const existing = document.getElementById("reportcard-email-section");
  if (existing) existing.remove();

  const block = document.createElement("div");
  block.id = "reportcard-email-section";
  block.className = "attendance-settings-block";

  const heading = document.createElement("h4");
  heading.textContent = "Email report cards";
  block.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    'Sends each student their report card (the same page as printing, using the items selected above) as a PDF, through your Google account. Students need an email address on the Roster. "Email This Student" uses the student chosen in the Print box above. Use the test box to send one sample to yourself first.';
  block.appendChild(hint);

  const addRow = (labelText, control) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    const label = document.createElement("label");
    label.textContent = labelText;
    row.append(label, control);
    block.appendChild(row);
  };

  const subjectInput = document.createElement("input");
  subjectInput.type = "text";
  subjectInput.placeholder = DEFAULT_REPORTCARD_SUBJECT;
  subjectInput.value = ReportCardModule.emailSubject;
  subjectInput.addEventListener("input", () => {
    ReportCardModule.emailSubject = subjectInput.value;
  });
  addRow("Subject", subjectInput);

  const messageInput = document.createElement("textarea");
  messageInput.rows = 4;
  messageInput.placeholder = DEFAULT_REPORTCARD_MESSAGE;
  messageInput.value = ReportCardModule.emailMessage;
  messageInput.addEventListener("input", () => {
    ReportCardModule.emailMessage = messageInput.value;
  });
  addRow("Message", messageInput);

  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = "{name} and {course} are filled in for each student. Leave the boxes blank for the standard wording. Saved with Save Selection.";
  block.appendChild(note);

  const testInput = document.createElement("input");
  testInput.type = "text";
  testInput.placeholder = "your own address — sends ONE test email only";
  addRow("Test address", testInput);

  const status = document.createElement("p");
  status.className = "result";
  block.appendChild(status);

  const buttons = document.createElement("div");
  buttons.className = "panel-toolbar-buttons";
  [
    ["Email This Student", () => el.printcardStudentSelect.value],
    ["Email All Students", () => ""],
  ].forEach(([label, getTarget]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = label === "Email All Students" ? "btn btn-primary btn-small" : "btn btn-ghost btn-small";
    btn.textContent = label;
    btn.addEventListener("click", async () => {
      const target = getTarget();
      if (label === "Email This Student" && !target) {
        status.textContent = "Choose a student in the Print box above first.";
        return;
      }
      const all = buttons.querySelectorAll("button");
      all.forEach((b) => (b.disabled = true));
      try {
        await emailReportCards(target, testInput.value, status);
      } catch (err) {
        status.textContent = `Couldn't send: ${err.message}`;
      }
      all.forEach((b) => (b.disabled = false));
    });
    buttons.appendChild(btn);
  });
  block.appendChild(buttons);

  el.printcardView.appendChild(block);
}

// ===== Course <-> template links =====

/** The "Template" dropdown shown on each active course in the course list. */
function buildCourseTemplateSelect(course) {
  const select = document.createElement("select");
  select.className = "course-period-select";
  select.title = "Link this course to a template so its structure mirrors the template";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = "No template (standalone)";
  select.appendChild(none);
  TemplatesModule.templates
    .filter((t) => t.linkable || t.id === course.templateId)
    .forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `Template: ${t.name}`;
      select.appendChild(opt);
    });
  select.value = TemplatesModule.find(course.templateId) ? course.templateId : "";

  select.addEventListener("click", (e) => e.stopPropagation());
  select.addEventListener("change", () => {
    const next = select.value;
    if (!next) {
      if (!confirm(`Make "${course.name}" a standalone course again? It keeps its current structure but stops following the template.`)) {
        renderCourseList();
        return;
      }
      CoursesModule.setTemplate(course.id, null);
      runCourseAction("Unlinking…", () => CoursesModule.save(), "Course is now standalone ✓");
      return;
    }
    const template = TemplatesModule.find(next);
    if (
      !confirm(
        `Link "${course.name}" to the template "${template.name}"?\n\nIts scoring categories, items, weights and tools, attendance settings, and report card choices will be replaced by the template's (matched in order, so scores entered under matching items are kept). Students, scores, attendance records, groups and seating are not changed.\n\nThis is saved to Google Drive right away.`
      )
    ) {
      renderCourseList();
      return;
    }
    runCourseAction("Linking…", () => TemplatesModule.linkCourse(course.id, next), `Linked to "${template.name}" ✓`);
  });
  return select;
}

/** Runs when a course is opened: if it's linked to a template, re-applies the template's structure and shows the link note + update button. */
async function syncLinkedTemplate(course) {
  const row = document.getElementById("course-link-row");
  const note = document.getElementById("course-link-note");
  const updateBtn = document.getElementById("update-template-btn");
  row.hidden = true;
  updateBtn.hidden = true;
  if (!course.templateId) return;

  const template = TemplatesModule.find(course.templateId);
  row.hidden = false;
  if (!template) {
    note.textContent = "This course was linked to a template that no longer exists, so it is working as a standalone course.";
    return;
  }

  try {
    await TemplatesModule.syncLoadedCourse(template.id);
    renderAttendance();
    scoringMode = "entry";
    renderScoringToolTabs();
    showScoringMode("entry");
    renderItemSelectionList();
    note.textContent =
      `Linked to template "${template.name}". Its structure follows the template each time the course is opened; ` +
      "students, scores, groups and rubrics stay your own. To change the structure for every linked course, edit it here, then click Update Template.";
    updateBtn.hidden = false;
  } catch (err) {
    note.textContent = `Couldn't sync with the template "${template.name}": ${err.message}`;
  }
}

document.getElementById("update-template-btn").addEventListener("click", async () => {
  const course = CoursesModule.find(RosterModule.currentCourseId);
  const template = course && TemplatesModule.find(course.templateId);
  const status = document.getElementById("course-link-status");
  if (!template) return;
  if (
    !confirm(
      `Replace the structure of the template "${template.name}" with this course's?\n\nThis saves this course's Attendance, Scoring and Report Card settings now. Every other course linked to the template will follow the next time it is opened.`
    )
  ) {
    return;
  }
  status.textContent = "Updating template…";
  try {
    await RubricBankModule.save();
    await AttendanceModule.save();
    await ScoringModule.save();
    await ReportCardModule.save();
    await TemplatesModule.updateFromCourse(template.id, course.id);
    status.textContent = `Template "${template.name}" updated ✓`;
  } catch (err) {
    status.textContent = `Couldn't update the template: ${err.message}`;
  }
});


// ===== Autosave =====
// Quietly saves whatever changed, a moment after you stop editing. It only
// writes the files whose contents actually changed, one at a time, in the
// background (the screen never waits on it). Each module's snapshot below
// must list the same fields as that module's save() — add new fields to both.
(function () {
  const indicator = document.getElementById("autosave-indicator");
  const toggle = document.getElementById("autosave-toggle");
  const detail = document.getElementById("autosave-detail");
  const POLL_MS = 600;

  const MODULES = [
    { name: "courses", mod: CoursesModule, scoped: false, snap: () => ({ courses: CoursesModule.courses, sortMode: CoursesModule.sortMode, dayFormat: CoursesModule.dayFormat }) },
    { name: "periods", mod: PeriodsModule, scoped: false, snap: () => ({ periods: PeriodsModule.periods }) },
    { name: "templates", mod: TemplatesModule, scoped: false, snap: () => ({ templates: TemplatesModule.templates }) },
    { name: "phrasebank", mod: PhraseBankModule, scoped: false, snap: () => ({ phrases: PhraseBankModule.phrases, collections: PhraseBankModule.collections }) },
    { name: "rubricbank", mod: RubricBankModule, scoped: false, snap: () => ({ rubrics: RubricBankModule.rubrics, sections: RubricBankModule.sections }) },
    { name: "roster", mod: RosterModule, scoped: true, snap: () => ({ students: RosterModule.students }) },
    {
      name: "seating", mod: SeatingModule, scoped: true,
      snap: () => ({
        rows: SeatingModule.rows, cols: SeatingModule.cols, active: SeatingModule.active, seats: SeatingModule.seats,
        locks: SeatingModule.locks, groups: SeatingModule.groups, labels: SeatingModule.labels,
        labelBank: SeatingModule.labelBank, printSections: SeatingModule.printSections, printSizes: SeatingModule.printSizes, parked: SeatingModule.parked, separations: SeatingModule.separations, neighborHistory: SeatingModule.neighborHistory, banks: SeatingModule.banks, showGroupsInPopout: SeatingModule.showGroupsInPopout,
      }),
    },
    {
      name: "attendance", mod: AttendanceModule, scoped: true,
      snap: () => ({ sessions: AttendanceModule.sessions, records: AttendanceModule.records, notes: AttendanceModule.notes, settings: AttendanceModule.settings }),
    },
    {
      name: "scoring", mod: ScoringModule, scoped: true,
      snap: () => ({
        categories: ScoringModule.categories, records: ScoringModule.records, weights: ScoringModule.weights,
        tools: ScoringModule.tools, presentationMigrated: ScoringModule.presentationMigrated,
      }),
    },
    { name: "journal", mod: JournalModule, scoped: true, snap: () => ({ entries: JournalModule.entries, settings: JournalModule.settings }) },
    {
      name: "reportcard", mod: ReportCardModule, scoped: true,
      snap: () => ({
        selectedItemIds: Array.from(ReportCardModule.selectedItemIds),
        emailSubject: ReportCardModule.emailSubject, emailMessage: ReportCardModule.emailMessage,
      }),
    },
  ];

  let enabled = true;
  try { enabled = localStorage.getItem("ggo-autosave") !== "off"; } catch (e) {}
  toggle.checked = enabled;
  toggle.addEventListener("change", () => {
    enabled = toggle.checked;
    try { localStorage.setItem("ggo-autosave", enabled ? "on" : "off"); } catch (e) {}
    toggle.parentElement.lastChild.textContent = enabled ? " Autosave is on" : " Autosave is off — use the Save buttons";
    if (enabled) flush();
  });
  toggle.parentElement.lastChild.textContent = enabled ? " Autosave is on" : " Autosave is off — use the Save buttons";

  const baseline = new Map(); // name -> { course, json } : what is known to be saved
  const lastSeen = new Map(); // name -> json at the previous poll (to wait until typing stops)
  let loading = 0;            // loads in flight (data is half-swapped while loading — never save then)
  let saving = false;
  let retryAt = 0;
  let fadeTimer = null;

  const courseOf = (m) => (m.scoped ? m.mod.currentCourseId : "-");
  const snapJson = (m) => JSON.stringify(m.snap());

  // Remember "what's saved" right after a load or a manual save.
  MODULES.forEach((m) => {
    const origLoad = m.mod.load;
    const origSave = m.mod.save;
    m.mod.load = async function (...args) {
      // About to switch course (or reload): first write any edit made in the last moment,
      // while this module still holds the OLD course's data.
      const b = baseline.get(m.name);
      if (enabled && b && b.course != null && b.course === courseOf(m) && snapJson(m) !== b.json &&
          typeof storage !== "undefined" && storage && storage.isSignedIn()) {
        try { await this.save(); } catch (e) { /* the Save buttons still exist; don't block navigation */ }
      }
      loading++;
      baseline.delete(m.name);
      try {
        const r = await origLoad.apply(this, args);
        baseline.set(m.name, { course: courseOf(m), json: snapJson(m) });
        lastSeen.delete(m.name);
        return r;
      } finally {
        loading--;
      }
    };
    m.mod.save = async function (...args) {
      const before = { course: courseOf(m), json: snapJson(m) };
      const r = await origSave.apply(this, args);
      baseline.set(m.name, before);
      return r;
    };
  });

  function show(text, cls) {
    clearTimeout(fadeTimer);
    indicator.textContent = text;
    indicator.className = "autosave-indicator" + (cls ? " " + cls : "");
    if (!cls && text.startsWith("✓")) fadeTimer = setTimeout(() => indicator.classList.add("fade"), 2500);
  }

  function dirtyModules(requireStable) {
    const out = [];
    for (const m of MODULES) {
      const b = baseline.get(m.name);
      if (!b || b.course == null || b.course !== courseOf(m)) continue; // never loaded for this course -> never write
      const cur = snapJson(m);
      if (cur === b.json) { lastSeen.delete(m.name); continue; }
      if (requireStable && lastSeen.get(m.name) !== cur) { lastSeen.set(m.name, cur); continue; }
      out.push(m);
    }
    return out;
  }

  async function runSave(list) {
    saving = true;
    const t0 = performance.now();
    show("Saving…");
    try {
      for (const m of list) await m.mod.save();
      const secs = ((performance.now() - t0) / 1000).toFixed(2);
      show("✓ Saved");
      detail.textContent = `Last autosave ${new Date().toLocaleTimeString()} (${secs} s)`;
      window.dispatchEvent(new CustomEvent("ggo-autosaved", { detail: { names: list.map((m) => m.name) } }));
    } catch (err) {
      retryAt = Date.now() + 5000;
      show("Couldn't save — retrying", "err");
      detail.textContent = `Autosave problem: ${err.message}`;
    } finally {
      saving = false;
    }
  }

  function ready() {
    return enabled && typeof storage !== "undefined" && storage && storage.isSignedIn() && loading === 0 && !saving && Date.now() >= retryAt;
  }

  function flush() {
    if (ready()) {
      const list = dirtyModules(false);
      if (list.length) return runSave(list);
    }
    return Promise.resolve();
  }

  setInterval(() => {
    if (!ready()) return;
    const list = dirtyModules(true);
    if (list.length) runSave(list);
  }, POLL_MS);

  // Leaving the tab or closing the page: save right now.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);

  window.addEventListener("ggo-autosaved", () => {
    if (el.periodsStatus.textContent === "Autosaving…") el.periodsStatus.textContent = "Saved ✓";
  });

  window.GGOAutosave = { enabled: () => enabled, flush };
})();

main();

// ===== Save button inside every Settings panel =====
// Attendance Settings, Scoring Settings and every scoring tool's Settings get their own
// Save button (next to Edit Settings), so you don't have to scroll back up to the main
// Save button. It does exactly what that button does. The panels are rebuilt often, so
// buttons are added by watching for new settings headers.
(function setupSettingsSaveButtons() {
  const messages = {}; // panelId -> { text, until }

  async function saveFor(panelId) {
    if (panelId === "attendance-panel") {
      await AttendanceModule.save();
    } else if (panelId === "seating-panel") {
      await SeatingModule.save();
    } else {
      await RubricBankModule.save();
      await ScoringModule.save();
    }
  }

  function showMsg(panelId, text, ms) {
    messages[panelId] = { text, until: Date.now() + ms };
    document.querySelectorAll(`#${panelId} .settings-save-status`).forEach((s) => (s.textContent = text));
    setTimeout(() => {
      if (messages[panelId] && messages[panelId].until <= Date.now()) {
        document.querySelectorAll(`#${panelId} .settings-save-status`).forEach((s) => (s.textContent = ""));
      }
    }, ms + 50);
  }

  function addSaveButton(header) {
    if (header.querySelector(".settings-save-btn")) return;
    const panel = header.closest("#attendance-panel, #scoring-panel, #seating-panel");
    if (!panel) return;
    const panelId = panel.id;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary btn-small settings-save-btn";
    btn.textContent = "Save";
    btn.addEventListener("click", async () => {
      showMsg(panelId, "Saving…", 30000);
      try {
        await saveFor(panelId);
        showMsg(panelId, "Saved ✓", 3000);
      } catch (err) {
        showMsg(panelId, `Save failed: ${err.message}`, 8000);
      }
    });
    const status = document.createElement("span");
    status.className = "status settings-save-status";
    const m = messages[panelId];
    if (m && m.until > Date.now()) status.textContent = m.text;

    header.appendChild(btn);
    header.appendChild(status);
  }

  function scan() {
    document.querySelectorAll(".attendance-settings-header").forEach(addSaveButton);
  }

  const target = document.getElementById("course-detail-section");
  if (target) {
    new MutationObserver(scan).observe(target, { childList: true, subtree: true });
    scan();
  }
})();


// ===== Your data: backup export, restore, and one-time import from Google Drive =====
(function setupDataTools() {
  const status = document.getElementById("data-status");
  const say = (t) => (status.textContent = t);

  async function collectAll(provider, onProgress) {
    const names = await provider.listFiles();
    const files = {};
    let n = 0;
    for (const name of names) {
      files[name] = await provider.loadFile(name);
      n += 1;
      if (onProgress) onProgress(n, names.length);
    }
    return files;
  }

  document.getElementById("export-all-btn").addEventListener("click", async () => {
    say("Collecting your data…");
    try {
      const files = await collectAll(storage, (n, total) => say(`Collecting ${n} / ${total}…`));
      const backup = { app: "GradingGridOnline", exportedAt: new Date().toISOString(), files };
      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GradingGridOnline-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      say(`Backed up ${Object.keys(files).length} file(s) ✓`);
    } catch (err) {
      say(`Backup failed: ${err.message}`);
    }
  });

  // Restore from a backup file
  const restoreInput = document.createElement("input");
  restoreInput.type = "file";
  restoreInput.accept = "application/json,.json";
  restoreInput.hidden = true;
  document.body.appendChild(restoreInput);
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "btn btn-ghost btn-small";
  restoreBtn.textContent = "Restore from backup file";
  document.getElementById("import-drive-btn").after(restoreBtn);
  restoreBtn.addEventListener("click", () => restoreInput.click());
  restoreInput.addEventListener("change", async () => {
    const file = restoreInput.files[0];
    restoreInput.value = "";
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const names = Object.keys((backup && backup.files) || {});
      if (backup.app !== "GradingGridOnline" || names.length === 0) throw new Error("That doesn't look like a GradingGridOnline backup.");
      if (!confirm(`Restore ${names.length} file(s)? Anything here with the same name will be replaced.`)) return;
      let n = 0;
      for (const name of names) {
        await storage.saveFile(name, backup.files[name]);
        n += 1;
        say(`Restoring ${n} / ${names.length}…`);
      }
      say(`Restored ${names.length} file(s) ✓`);
      await showCourses();
    } catch (err) {
      say(`Restore failed: ${err.message}`);
    }
  });

  document.getElementById("import-drive-btn").addEventListener("click", async () => {
    say("Opening Google sign-in…");
    try {
      const g = await storage.getGoogle();
      await g.signIn();
      const names = await g.listFiles();
      if (names.length === 0) {
        say("No data found in that Google Drive account.");
        return;
      }
      if (!confirm(`Found ${names.length} file(s) in Google Drive. Import them? Anything here with the same name will be replaced.`)) {
        say("");
        return;
      }
      let n = 0;
      for (const name of names) {
        const data = await g.loadFile(name);
        if (data !== null) await storage.saveFile(name, data);
        n += 1;
        say(`Importing ${n} / ${names.length}…`);
      }
      say(`Imported ${names.length} file(s) ✓`);
      await showCourses();
    } catch (err) {
      say(err.message === "popup_blocked" ? "Google's pop-up was blocked — allow pop-ups and try again." : `Import failed: ${err.message}`);
    }
  });
})();
