// ===== App wiring =====

let storage = null;
let currentMapping = null; // set while the mapping panel is open

const el = {
  signInBtn: document.getElementById("sign-in-btn"),
  signOutBtn: document.getElementById("sign-out-btn"),
  status: document.getElementById("auth-status"),

  courseSection: document.getElementById("course-section"),
  courseList: document.getElementById("course-list"),
  courseCount: document.getElementById("course-count"),
  newCourseName: document.getElementById("new-course-name"),
  addCourseBtn: document.getElementById("add-course-btn"),
  courseStatus: document.getElementById("course-status"),

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
  printAllBtn: document.getElementById("print-all-btn"),
  printcardStatus: document.getElementById("printcard-status"),
  printArea: document.getElementById("print-area"),

  rosterCount: document.getElementById("roster-count"),
  rosterFileInput: document.getElementById("roster-file-input"),
  uploadRosterBtn: document.getElementById("upload-roster-btn"),
  addStudentBtn: document.getElementById("add-student-btn"),
  saveRosterBtn: document.getElementById("save-roster-btn"),
  collectEmailBtn: document.getElementById("collect-email-btn"),
  syncEmailBtn: document.getElementById("sync-email-btn"),
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
  confirmImportBtn: document.getElementById("confirm-import-btn"),
  cancelImportBtn: document.getElementById("cancel-import-btn"),

  gridRows: document.getElementById("grid-rows"),
  gridCols: document.getElementById("grid-cols"),
  applyGridSizeBtn: document.getElementById("apply-grid-size-btn"),
  autoFillBtn: document.getElementById("auto-fill-btn"),
  clearSeatingBtn: document.getElementById("clear-seating-btn"),
  popoutBtn: document.getElementById("popout-btn"),
  togglePopoutGroupsBtn: document.getElementById("toggle-popout-groups-btn"),
  saveSeatingBtn: document.getElementById("save-seating-btn"),
  unseatedList: document.getElementById("unseated-list"),
  unseatedCount: document.getElementById("unseated-count"),
  seatingGrid: document.getElementById("seating-grid"),
  seatingStatus: document.getElementById("seating-status"),
  banksList: document.getElementById("banks-list"),

  attendanceStatus: document.getElementById("attendance-status"),
  attendanceTable: document.getElementById("attendance-table"),
  toggleAttendanceSettingsBtn: document.getElementById("toggle-attendance-settings-btn"),
  attendanceSettingsBody: document.getElementById("attendance-settings-body"),

  scoringStatus: document.getElementById("scoring-status"),
  scoringTable: document.getElementById("scoring-table"),
  toggleScoringSettingsBtn: document.getElementById("toggle-scoring-settings-btn"),
  scoringSettingsBody: document.getElementById("scoring-settings-body"),

  settingsBtn: document.getElementById("settings-btn"),
  settingsPanel: document.getElementById("settings-panel"),
  themeList: document.getElementById("theme-list"),
};

let selectedStudentId = null; // currently-selected student in the "Unseated" list
let attendanceSettingsEditing = false;
let scoringSettingsEditing = false;
let consultationDisplayMode = "percent"; // "percent" or "points" — Total Score in Student Consultation

async function main() {
  ThemeModule.initLocal();
  renderThemeList();

  storage = new GoogleDriveProvider(APP_CONFIG);
  await storage.init();
  renderAuth();

  if (storage.isSignedIn()) {
    await ThemeModule.syncFromDrive();
    renderThemeList();
  }
}

// ===== Settings / theme =====

el.settingsBtn.addEventListener("click", () => {
  el.settingsPanel.hidden = !el.settingsPanel.hidden;
});

document.addEventListener("click", (e) => {
  if (
    !el.settingsPanel.hidden &&
    !el.settingsPanel.contains(e.target) &&
    e.target !== el.settingsBtn
  ) {
    el.settingsPanel.hidden = true;
  }
});

function renderThemeList() {
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

function renderAuth() {
  const signedIn = storage.isSignedIn();
  el.signInBtn.hidden = signedIn;
  el.signOutBtn.hidden = !signedIn;
  el.courseSection.hidden = !signedIn;
  el.status.textContent = "";

  if (signedIn) {
    showCourses();
  } else {
    el.courseDetailSection.hidden = true;
  }
}

el.signInBtn.addEventListener("click", async () => {
  el.status.textContent = "Signing in…";
  try {
    await storage.signIn();
    renderAuth();
    await ThemeModule.syncFromDrive();
    renderThemeList();
  } catch (err) {
    el.status.textContent = `Sign-in failed: ${err.message}`;
  }
});

el.signOutBtn.addEventListener("click", async () => {
  await storage.signOut();
  renderAuth();
});

// ===== Courses =====

async function showCourses() {
  el.courseDetailSection.hidden = true;
  el.courseSection.hidden = false;
  el.courseStatus.textContent = "Loading courses…";
  try {
    await CoursesModule.load();
    renderCourseList();
    el.courseStatus.textContent = "";
  } catch (err) {
    el.courseStatus.textContent = `Couldn't load courses: ${err.message}`;
  }
}

function renderCourseList() {
  el.courseCount.textContent = `${CoursesModule.courses.length} / ${MAX_COURSES}`;
  el.courseList.innerHTML = "";

  CoursesModule.courses.forEach((course) => {
    const li = document.createElement("li");
    li.className = "course-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "course-name";
    nameSpan.textContent = course.name;
    nameSpan.addEventListener("click", () => openCourseDetail(course));

    const renameBtn = document.createElement("button");
    renameBtn.className = "btn btn-ghost btn-small";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newName = prompt("Rename course:", course.name);
      if (newName === null) return;
      try {
        CoursesModule.rename(course.id, newName);
        renderCourseList();
        CoursesModule.save().catch((err) => {
          el.courseStatus.textContent = `Couldn't save: ${err.message}`;
        });
      } catch (err) {
        alert(err.message);
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-ghost btn-small";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${course.name}"? This does not delete its saved roster.`)) return;
      CoursesModule.remove(course.id);
      renderCourseList();
      CoursesModule.save().catch((err) => {
        el.courseStatus.textContent = `Couldn't save: ${err.message}`;
      });
    });

    li.append(nameSpan, renameBtn, deleteBtn);
    el.courseList.appendChild(li);
  });
}

el.addCourseBtn.addEventListener("click", async () => {
  try {
    CoursesModule.add(el.newCourseName.value);
    el.newCourseName.value = "";
    renderCourseList();
    el.courseStatus.textContent = "Saving…";
    await CoursesModule.save();
    el.courseStatus.textContent = "Saved ✓";
  } catch (err) {
    el.courseStatus.textContent = err.message;
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
    await ScoringModule.load(course.id);
    renderScoring();
    el.scoringStatus.textContent = "";
  } catch (err) {
    el.scoringStatus.textContent = `Couldn't load scoring: ${err.message}`;
  }

  try {
    await ReportCardModule.load(course.id);
    renderItemSelectionList();
    renderPrintcardStudentOptions();
    el.printcardStatus.textContent = "";
  } catch (err) {
    el.printcardStatus.textContent = `Couldn't load report card settings: ${err.message}`;
  }

  try {
    await EmailCollectModule.load(course.id);
    renderEmailCollectButtons();
  } catch (err) {
    el.emailCollectStatus.textContent = `Couldn't load email collection state: ${err.message}`;
  }
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
    renderScoring(); // roster/attendance may have changed since the tab was last shown
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

    el.rosterTbody.appendChild(tr);
  });
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
  input.type = "number";
  input.min = "1";
  input.max = String(MAX_STUDENTS);
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
    el.rosterStatus.textContent = `Imported ${students.length} students — click "Save Roster" to store them in Google Drive.`;
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

  // ----- Grid -----
  el.seatingGrid.innerHTML = "";
  el.seatingGrid.style.gridTemplateColumns = `repeat(${SeatingModule.cols}, 1fr)`;

  for (let r = 0; r < SeatingModule.rows; r++) {
    for (let c = 0; c < SeatingModule.cols; c++) {
      el.seatingGrid.appendChild(buildDeskElement(r, c));
    }
  }

  renderBanks();
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
    ? "Click to add a desk here"
    : student
    ? locked
      ? `${student.name} — locked (click the lock icon to unlock before removing)`
      : `${student.name} — click to remove`
    : label
    ? `${label} — click to remove this desk, or select a student to seat here`
    : selectedStudentId
    ? "Click to seat the selected student here"
    : "Select a student, or click to remove this desk";

  const nameEl = document.createElement("span");
  nameEl.className = "desk-name";
  if (active && student) {
    if (student.classNumber) {
      const numEl = document.createElement("span");
      numEl.className = "desk-classnumber-tag";
      numEl.textContent = `#${student.classNumber}`;
      nameEl.appendChild(numEl);
    }
    const textEl = document.createElement("span");
    textEl.textContent = student.name || "(unnamed)";
    nameEl.appendChild(textEl);
  } else {
    nameEl.textContent = !active ? "" : label ? label : "+";
  }
  desk.appendChild(nameEl);

  desk.addEventListener("click", () => {
    if (!active) {
      SeatingModule.activate(r, c);
      if (selectedStudentId) {
        SeatingModule.seatStudent(r, c, selectedStudentId);
        selectedStudentId = null;
      }
      renderSeating();
      return;
    }
    if (student) {
      if (locked) return; // unlock first
      SeatingModule.unseatAt(r, c);
      renderSeating();
    } else if (selectedStudentId) {
      SeatingModule.seatStudent(r, c, selectedStudentId);
      selectedStudentId = null;
      renderSeating();
    } else {
      SeatingModule.deactivate(r, c);
      renderSeating();
    }
  });

  if (student) {
    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "desk-lock-btn";
    lockBtn.textContent = locked ? "🔒" : "🔓";
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
    groupInput.type = "number";
    groupInput.min = "1";
    groupInput.max = String(MAX_GROUP);
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

    const labelBtn = document.createElement("button");
    labelBtn.type = "button";
    labelBtn.className = "desk-label-btn" + (label ? " desk-label-btn-active" : "");
    labelBtn.textContent = "🏷";
    labelBtn.title = label ? `Label: "${label}" — click to edit or clear` : "Add a label to this desk";
    labelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = prompt("Desk label (e.g. \"do not sit here\"). Leave blank to remove.", label);
      if (next === null) return; // cancelled
      SeatingModule.setLabel(r, c, next);
      renderSeating();
    });
    desk.appendChild(labelBtn);
  }

  return desk;
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
      el.seatingStatus.textContent = "Saving to memory bank…";
      try {
        await SeatingModule.saveBank(index);
        el.seatingStatus.textContent = `Saved to "${bank.name}" ✓`;
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
      el.seatingStatus.textContent = "Loading memory bank…";
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
      el.seatingStatus.textContent = "Renaming…";
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
      el.seatingStatus.textContent = "Deleting…";
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

el.autoFillBtn.addEventListener("click", () => {
  const seatedIds = SeatingModule.seatedStudentIds();
  const unseatedIds = RosterModule.students
    .filter((s) => !seatedIds.has(s.id))
    .map((s) => s.id);
  SeatingModule.autoFill(unseatedIds);
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

el.togglePopoutGroupsBtn.addEventListener("click", async () => {
  el.seatingStatus.textContent = "Saving…";
  try {
    await SeatingModule.toggleShowGroupsInPopout();
    el.togglePopoutGroupsBtn.textContent = SeatingModule.showGroupsInPopout
      ? "Hide Group Colors in Pop-Out"
      : "Show Group Colors in Pop-Out";
    el.seatingStatus.textContent = "";
  } catch (err) {
    el.seatingStatus.textContent = `Couldn't save: ${err.message}`;
  }
});

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

  renderAttendanceSettings();
}

function buildAttendanceHeaderRow() {
  const tr = document.createElement("tr");

  ["Student", "Notes"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    tr.appendChild(th);
  });

  const scoreTh = document.createElement("th");
  const scoreToggleBtn = document.createElement("button");
  scoreToggleBtn.type = "button";
  scoreToggleBtn.className = "score-toggle-btn";
  scoreToggleBtn.textContent =
    AttendanceModule.settings.scoreDisplayMode === "points" ? "Score (pts) ⇄" : "Score (%) ⇄";
  scoreToggleBtn.title = "Click to switch between percent and points";
  scoreToggleBtn.addEventListener("click", async () => {
    AttendanceModule.setScoreDisplayMode(
      AttendanceModule.settings.scoreDisplayMode === "points" ? "percent" : "points"
    );
    await saveAttendanceThen(renderAttendance);
  });
  scoreTh.appendChild(scoreToggleBtn);
  tr.appendChild(scoreTh);

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
  excludeSeatingBtn.addEventListener("click", async () => {
    RosterModule.toggleExcludeFromSeating(student.id);
    if (student.excludeFromSeating) {
      SeatingModule.unseatStudent(student.id);
      try {
        await SeatingModule.save();
      } catch (err) {
        el.attendanceStatus.textContent = `Couldn't save seating chart: ${err.message}`;
      }
    }
    try {
      await RosterModule.save();
    } catch (err) {
      el.attendanceStatus.textContent = `Couldn't save roster: ${err.message}`;
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
  excludeScoringBtn.addEventListener("click", async () => {
    RosterModule.toggleExcludeFromScoring(student.id);
    try {
      await RosterModule.save();
    } catch (err) {
      el.attendanceStatus.textContent = `Couldn't save roster: ${err.message}`;
    }
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

    const infractionSelect = document.createElement("select");
    infractionSelect.className = "attendance-infraction-select";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "No infraction";
    infractionSelect.appendChild(noneOpt);
    AttendanceModule.settings.infractionOptions.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === record.infraction) o.selected = true;
      infractionSelect.appendChild(o);
    });
    infractionSelect.addEventListener("change", async () => {
      AttendanceModule.setRecord(student.id, session.id, { infraction: infractionSelect.value });
      await saveAttendanceThen();
      refreshAttendanceStatsRow(student.id);
    });

    const memoInput = document.createElement("input");
    memoInput.type = "text";
    memoInput.className = "attendance-memo-input";
    memoInput.placeholder = "Memo";
    memoInput.value = record.memo || "";
    memoInput.addEventListener("change", async () => {
      AttendanceModule.setRecord(student.id, session.id, { memo: memoInput.value });
      await saveAttendanceThen();
    });

    td.append(codeSelect, infractionSelect, memoInput);
    tr.appendChild(td);
  });

  return tr;
}

// Fixed, literal colors for these three specific codes — independent
// of any custom renaming, since the request was for exactly A/L/E.
const ATTENDANCE_CODE_COLORS = { A: "#e57373", L: "#ffd54f", E: "#64b5f6" };

function applyAttendanceCodeColor(select, code) {
  const color = ATTENDANCE_CODE_COLORS[code];
  select.style.backgroundColor = color || "";
  select.style.color = color ? "#1a1a1a" : "";
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
  if (AttendanceModule.settings.scoreDisplayMode === "points") {
    return stats.points === null ? "—" : String(stats.points);
  }
  return stats.percent === null ? "—" : `${stats.percent}%`;
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

async function saveAttendanceThen(after) {
  el.attendanceStatus.textContent = "Saving…";
  try {
    await AttendanceModule.save();
    el.attendanceStatus.textContent = "";
  } catch (err) {
    el.attendanceStatus.textContent = `Couldn't save: ${err.message}`;
  }
  if (after) after();
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
      `Participation types: ${AttendanceModule.settings.participationTypes
        .map((t) => `${t} (${AttendanceModule.settings.points[t]})`)
        .join(", ")}`,
      `Infractions: ${AttendanceModule.settings.infractionOptions
        .map((o) => `${o} (${AttendanceModule.settings.infractionPoints[o]})`)
        .join(", ") || "(none)"}`,
      `Score display: ${AttendanceModule.settings.scoreDisplayMode === "points" ? "Points" : "Percent"}`,
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
  termInput.type = "number";
  termInput.min = "0";
  termInput.max = "100";
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
  limitInput.type = "number";
  limitInput.min = "0";
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
      items: AttendanceModule.settings.participationTypes,
      points: AttendanceModule.settings.points,
      fixedItems: ["P", "A"],
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

  const list = document.createElement("ul");
  list.className = "infraction-edit-list";

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
    pointInput.type = "number";
    pointInput.step = "0.1";
    pointInput.className = "point-value-input";
    pointInput.value = config.points[item] ?? 0;
    pointInput.title = "Point value";
    pointInput.addEventListener("change", async () => {
      await config.onPointChange(item, pointInput.value);
    });
    li.appendChild(pointInput);

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
    ? `Template loaded: ${tpl.headers.length} columns, ${tpl.rows.length} rows.`
    : "Upload a CSV template from your LMS. After uploading, choose which column identifies each student and which column receives their attendance code.";
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

  const buildColumnSelect = (selectedIdx, onChange) => {
    const select = document.createElement("select");
    tpl.headers.forEach((h, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = h || `Column ${idx + 1}`;
      if (idx === selectedIdx) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", onChange);
    return select;
  };

  const idRow = document.createElement("div");
  idRow.className = "mapping-row";
  const idLabel = document.createElement("label");
  idLabel.textContent = "Identifier column";
  const idSelect = buildColumnSelect(tpl.identifierColumn, async () => {
    AttendanceModule.updateExportMapping({ identifierColumn: Number(idSelect.value) });
    await saveAttendanceThen();
  });
  idRow.append(idLabel, idSelect);
  wrap.appendChild(idRow);

  const fieldRow = document.createElement("div");
  fieldRow.className = "mapping-row";
  const fieldLabel = document.createElement("label");
  fieldLabel.textContent = "Match by";
  const fieldSelect = document.createElement("select");
  [
    ["schoolId", "School ID"],
    ["name", "Name"],
  ].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    if (val === tpl.identifierField) opt.selected = true;
    fieldSelect.appendChild(opt);
  });
  fieldSelect.addEventListener("change", async () => {
    AttendanceModule.updateExportMapping({ identifierField: fieldSelect.value });
    await saveAttendanceThen();
  });
  fieldRow.append(fieldLabel, fieldSelect);
  wrap.appendChild(fieldRow);

  const valueRow = document.createElement("div");
  valueRow.className = "mapping-row";
  const valueLabel = document.createElement("label");
  valueLabel.textContent = "Attendance value column";
  const valueSelect = buildColumnSelect(tpl.valueColumn, async () => {
    AttendanceModule.updateExportMapping({ valueColumn: Number(valueSelect.value) });
    await saveAttendanceThen();
  });
  valueRow.append(valueLabel, valueSelect);
  wrap.appendChild(valueRow);

  return wrap;
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildAttendanceFooterRow() {
  const tr = document.createElement("tr");

  const labelTd = document.createElement("td");
  labelTd.colSpan = 5;
  labelTd.className = "attendance-footer-label";
  labelTd.textContent = "Export to LMS:";
  tr.appendChild(labelTd);

  AttendanceModule.sessions.forEach((session) => {
    const td = document.createElement("td");
    td.className = "session-header-cell";
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn btn-ghost btn-small";
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", () => {
      try {
        const csv = AttendanceModule.buildExportCsv(session.id, RosterModule.students);
        downloadCsv(csv, `class-${session.number}-attendance.csv`);
      } catch (err) {
        alert(err.message);
      }
    });
    td.appendChild(exportBtn);
    tr.appendChild(td);
  });

  return tr;
}

// ===== Scoring =====

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
  attendanceTh.textContent = "Attendance";
  row1.appendChild(attendanceTh);

  ScoringModule.categories.forEach((category) => {
    const th = document.createElement("th");
    th.className = "category-header-cell";
    th.colSpan = Math.max(1, category.items.length);
    th.textContent = category.name;
    row1.appendChild(th);

    category.items.forEach((item) => {
      const itemTh = document.createElement("th");
      itemTh.className = "item-header-cell";

      const nameLine = document.createElement("div");
      nameLine.textContent = item.name;
      const pointsLine = document.createElement("div");
      pointsLine.className = "item-points-label";
      pointsLine.textContent = `/${item.maxPoints}`;

      itemTh.append(nameLine, pointsLine);
      row2.appendChild(itemTh);
    });
  });

  const rawPointsTh = document.createElement("th");
  rawPointsTh.rowSpan = 2;
  rawPointsTh.textContent = "Raw Points";
  row1.appendChild(rawPointsTh);

  return { row1, row2 };
}

el.toggleScoringSettingsBtn.addEventListener("click", () => {
  scoringSettingsEditing = !scoringSettingsEditing;
  el.toggleScoringSettingsBtn.textContent = scoringSettingsEditing ? "Done Editing" : "Edit Settings";
  renderScoringSettings();
});

/** Two toggle buttons — Total Score display and Attendance display — shown at the top of Scoring Settings regardless of edit mode. */
function buildScoringDisplayToggles() {
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block scoring-display-toggles";

  const totalBtn = document.createElement("button");
  totalBtn.type = "button";
  totalBtn.className = "score-toggle-btn";
  totalBtn.textContent =
    ScoringModule.scoreDisplayMode === "points" ? "Total Score (pts) ⇄" : "Total Score (%) ⇄";
  totalBtn.title = "Click to switch the Total Score column between percent and points";
  totalBtn.addEventListener("click", async () => {
    ScoringModule.setScoreDisplayMode(ScoringModule.scoreDisplayMode === "points" ? "percent" : "points");
    await saveScoringThen(renderScoring);
  });

  const attendanceBtn = document.createElement("button");
  attendanceBtn.type = "button";
  attendanceBtn.className = "score-toggle-btn";
  attendanceBtn.textContent =
    ScoringModule.attendanceDisplayMode === "points" ? "Attendance (pts) ⇄" : "Attendance (%) ⇄";
  attendanceBtn.title = "Click to switch the Attendance column between percent and points";
  attendanceBtn.addEventListener("click", async () => {
    ScoringModule.setAttendanceDisplayMode(
      ScoringModule.attendanceDisplayMode === "points" ? "percent" : "points"
    );
    await saveScoringThen(renderScoring);
  });

  wrap.append(totalBtn, attendanceBtn);
  return wrap;
}

function renderScoringSettings() {
  el.scoringSettingsBody.innerHTML = "";
  el.scoringSettingsBody.appendChild(buildScoringDisplayToggles());

  if (!scoringSettingsEditing) {
    if (ScoringModule.categories.length === 0) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Click Edit Settings to add a scoring category.";
      el.scoringSettingsBody.appendChild(hint);
      return;
    }
    const lines = ScoringModule.categories
      .map((c) => `${c.name}: ${ScoringModule.weights[c.id] || 0}`)
      .concat(`Attendance: ${ScoringModule.weights.attendance || 0}`);
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Category weights — " + lines.join(", ");
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

    const countLabel = document.createElement("label");
    countLabel.textContent = "Items:";
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.min = "0";
    countInput.max = String(MAX_ITEMS_PER_CATEGORY);
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
        itemPointsInput.type = "number";
        itemPointsInput.min = "0";
        itemPointsInput.className = "point-value-input";
        itemPointsInput.value = item.maxPoints;
        itemPointsInput.title = "Max points";
        itemPointsInput.addEventListener("change", async () => {
          ScoringModule.setItemMaxPoints(item.id, itemPointsInput.value);
          await saveScoringThen(renderScoring); // total scores depend on this
        });

        itemRow.append(itemNameInput, itemPointsInput);
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

  if (ScoringModule.categories.length === 0) return;

  // ----- Edit mode: category weights -----
  const wrap = document.createElement("div");
  wrap.className = "attendance-settings-block";
  const heading = document.createElement("h4");
  heading.textContent = "Category weights";
  wrap.appendChild(heading);

  ScoringModule.categories.forEach((category) => {
    wrap.appendChild(
      buildWeightRow(category.name, ScoringModule.weights[category.id], async (value) => {
        ScoringModule.setWeight(category.id, value);
        await saveScoringThen(renderScoring);
      })
    );
  });

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
  const total =
    ScoringModule.categories.reduce((sum, c) => sum + (ScoringModule.weights[c.id] || 0), 0) +
    (ScoringModule.weights.attendance || 0);

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
  input.type = "number";
  input.min = "0";
  input.className = "weight-input";
  input.value = value || 0;
  input.addEventListener("change", () => onChange(input.value));

  row.append(labelEl, input);
  return row;
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

  // ----- Total score -----
  const totalTd = document.createElement("td");
  totalTd.className = "attendance-stat-cell attendance-score-cell";
  totalTd.textContent = formatScoringTotal(ScoringModule.totalScore(student.id));
  tr.appendChild(totalTd);

  // ----- Attendance (read-only, computed from the Attendance tab) -----
  const attendanceTd = document.createElement("td");
  attendanceTd.className = "attendance-stat-cell scoring-attendance-cell";
  attendanceTd.textContent = formatScoringValue(ScoringModule.attendanceScore(student.id));
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

      td.appendChild(input);
      tr.appendChild(td);
    });
  });

  // ----- Raw Points (unweighted sum of all earned points across categories) -----
  const rawPointsTd = document.createElement("td");
  rawPointsTd.className = "attendance-stat-cell scoring-rawpoints-cell";
  rawPointsTd.textContent = String(ScoringModule.totalRawPoints(student.id));
  tr.appendChild(rawPointsTd);

  return tr;
}

/** Formats an { earned, possible, percent, points } result (e.g. from attendanceScore) according to the Attendance column's display mode. */
function formatScoringValue(result) {
  if (ScoringModule.attendanceDisplayMode === "points") {
    return result.points === null || result.points === undefined ? "—" : `${result.points} pts`;
  }
  return result.percent === null || result.percent === undefined ? "—" : `${result.percent}%`;
}

/** Formats the raw totalScore() number (already percent or points depending on mode) for display. */
function formatScoringTotal(total) {
  if (total === null || total === undefined) return "—";
  return ScoringModule.scoreDisplayMode === "points" ? `${total} pts` : `${total}%`;
}

function refreshScoringTotalCell(studentId) {
  const row = el.scoringTable.querySelector(`tr[data-student-id="${studentId}"]`);
  if (!row) return;
  const cell = row.querySelector(".attendance-score-cell");
  if (cell) cell.textContent = formatScoringTotal(ScoringModule.totalScore(studentId));
  const rawCell = row.querySelector(".scoring-rawpoints-cell");
  if (rawCell) rawCell.textContent = String(ScoringModule.totalRawPoints(studentId));
}

async function saveScoringThen(after) {
  el.scoringStatus.textContent = "Saving…";
  try {
    await ScoringModule.save();
    el.scoringStatus.textContent = "";
  } catch (err) {
    el.scoringStatus.textContent = `Couldn't save: ${err.message}`;
  }
  if (after) after();
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

/** Total Score for Student Consultation, respecting its own local toggle (independent of the Scoring tab's toggle). Points mode = weighted percent × 100, same convention as the Scoring tab. */
function formatConsultationTotal(studentId) {
  const percent = ScoringModule.weightedPercent(studentId);
  if (percent === null) return "—";
  return consultationDisplayMode === "points" ? `${Math.round(percent * 100)} pts` : `${Math.round(percent)}%`;
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

async function savePrintcardThen(after) {
  el.printcardStatus.textContent = "Saving…";
  try {
    await ReportCardModule.save();
    el.printcardStatus.textContent = "";
  } catch (err) {
    el.printcardStatus.textContent = `Couldn't save: ${err.message}`;
  }
  if (after) after();
}

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
  totalBlock.textContent = `Total Score: ${detail.total === null ? "—" : `${detail.total}%`}`;
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
}

el.collectEmailBtn.addEventListener("click", async () => {
  el.emailCollectStatus.textContent = "Creating form…";
  const course = CoursesModule.find(RosterModule.currentCourseId);
  try {
    await EmailCollectModule.createForm(RosterModule.students, course ? course.name : "");
    renderEmailCollectButtons();
    el.emailCollectStatus.textContent = "Form created — opening QR code…";
    window.open("emailqr.html", "ggo-email-qr", "width=480,height=560");
  } catch (err) {
    el.emailCollectStatus.textContent = `Couldn't create the form: ${err.message}`;
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
      await RosterModule.save();
      renderRoster();
    }
    renderEmailCollectButtons();
    el.emailCollectStatus.textContent =
      `Matched ${result.matches.length} of ${result.totalResponses} response(s).` +
      (result.unmatchedCount > 0 ? ` ${result.unmatchedCount} didn't match any School ID.` : "");
  } catch (err) {
    el.emailCollectStatus.textContent = `Couldn't sync: ${err.message}`;
  }
});

main();
