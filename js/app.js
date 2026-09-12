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
  rosterPanel: document.getElementById("roster-panel"),
  seatingPanel: document.getElementById("seating-panel"),
  attendancePanel: document.getElementById("attendance-panel"),

  rosterCount: document.getElementById("roster-count"),
  rosterFileInput: document.getElementById("roster-file-input"),
  uploadRosterBtn: document.getElementById("upload-roster-btn"),
  addStudentBtn: document.getElementById("add-student-btn"),
  saveRosterBtn: document.getElementById("save-roster-btn"),
  rosterTbody: document.getElementById("roster-tbody"),
  rosterStatus: document.getElementById("roster-status"),

  mappingPanel: document.getElementById("mapping-panel"),
  mappingHint: document.getElementById("mapping-hint"),
  mapName: document.getElementById("map-name"),
  mapClassNumber: document.getElementById("map-classnumber"),
  mapSchoolId: document.getElementById("map-schoolid"),
  mapPronunciation: document.getElementById("map-pronunciation"),
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

  addSessionBtn: document.getElementById("add-session-btn"),
  attendanceStatus: document.getElementById("attendance-status"),
  attendanceTable: document.getElementById("attendance-table"),
  toggleAttendanceSettingsBtn: document.getElementById("toggle-attendance-settings-btn"),
  attendanceSettingsBody: document.getElementById("attendance-settings-body"),

  settingsBtn: document.getElementById("settings-btn"),
  settingsPanel: document.getElementById("settings-panel"),
  themeList: document.getElementById("theme-list"),
};

let selectedStudentId = null; // currently-selected student in the "Unseated" list
let attendanceSettingsEditing = false;

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
}

el.backToCoursesBtn.addEventListener("click", showCourses);

function showTab(tab) {
  el.rosterPanel.hidden = tab !== "roster";
  el.seatingPanel.hidden = tab !== "seating";
  el.attendancePanel.hidden = tab !== "attendance";
  el.tabRosterBtn.classList.toggle("tab-btn-active", tab === "roster");
  el.tabSeatingBtn.classList.toggle("tab-btn-active", tab === "seating");
  el.tabAttendanceBtn.classList.toggle("tab-btn-active", tab === "attendance");

  if (tab === "seating") {
    selectedStudentId = null;
    renderSeating(); // roster may have changed since the tab was last shown
  } else if (tab === "attendance") {
    renderAttendance(); // roster may have changed since the tab was last shown
  }
}

el.tabRosterBtn.addEventListener("click", () => showTab("roster"));
el.tabSeatingBtn.addEventListener("click", () => showTab("seating"));
el.tabAttendanceBtn.addEventListener("click", () => showTab("attendance"));

function renderRoster() {
  el.rosterCount.textContent = `${RosterModule.students.length} / ${MAX_STUDENTS}`;
  el.rosterTbody.innerHTML = "";

  RosterModule.students.forEach((student) => {
    const tr = document.createElement("tr");
    tr.appendChild(makeClassNumberCell(student));
    tr.appendChild(makeEditableCell(student, "name"));
    tr.appendChild(makeEditableCell(student, "schoolId"));
    tr.appendChild(makeEditableCell(student, "pronunciation"));

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

  const guess = RosterImport.guessMapping();
  el.mapName.value = String(guess.name);
  el.mapClassNumber.value = String(guess.classNumber);
  el.mapSchoolId.value = String(guess.schoolId);
  el.mapPronunciation.value = String(guess.pronunciation);

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
  const unseated = RosterModule.students.filter((s) => !seatedIds.has(s.id));

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

  renderAttendanceSettings();
}

function buildAttendanceHeaderRow() {
  const tr = document.createElement("tr");

  ["Student", "Notes", "Score", "Attended", "Absences"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    tr.appendChild(th);
  });

  AttendanceModule.sessions.forEach((session) => {
    const th = document.createElement("th");
    th.className = "session-header-cell";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "session-remove-btn";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove this class session";
    removeBtn.addEventListener("click", async () => {
      if (!confirm(`Remove class ${session.number}? This deletes all recorded attendance for it.`)) return;
      AttendanceModule.removeSession(session.id);
      await saveAttendanceThen(renderAttendance);
    });

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
    presentBtn.className = "btn btn-primary btn-small session-present-btn";
    presentBtn.textContent = "P";
    presentBtn.title = "Mark everyone present for this class";
    presentBtn.addEventListener("click", async () => {
      AttendanceModule.markAllPresent(session.id, RosterModule.students.map((s) => s.id));
      await saveAttendanceThen(renderAttendance);
    });

    th.append(removeBtn, numberEl, dateInput, presentBtn);
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
  tr.appendChild(notesTd);

  // ----- Score / Attended / Absences -----
  const stats = AttendanceModule.stats(student.id);
  [stats.score === null ? "—" : `${stats.score}%`, stats.attended, stats.absences].forEach((val) => {
    const td = document.createElement("td");
    td.className = "attendance-stat-cell";
    td.textContent = val;
    tr.appendChild(td);
  });

  // ----- One cell per class session -----
  AttendanceModule.sessions.forEach((session) => {
    const td = document.createElement("td");
    td.className = "attendance-session-cell";
    const record = AttendanceModule.getRecord(student.id, session.id);

    const codeSelect = document.createElement("select");
    codeSelect.className = "attendance-code-select";
    ATTENDANCE_CODES.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = code || "—";
      if (code === record.code) opt.selected = true;
      codeSelect.appendChild(opt);
    });
    codeSelect.addEventListener("change", async () => {
      AttendanceModule.setRecord(student.id, session.id, { code: codeSelect.value });
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

/** Updates just one student's Score/Attended/Absences cells, without rebuilding the whole table. */
function refreshAttendanceStatsRow(studentId) {
  const row = el.attendanceTable.querySelector(`tr[data-student-id="${studentId}"]`);
  if (!row) return;
  const stats = AttendanceModule.stats(studentId);
  const statCells = row.querySelectorAll(".attendance-stat-cell");
  if (statCells.length === 3) {
    statCells[0].textContent = stats.score === null ? "—" : `${stats.score}%`;
    statCells[1].textContent = stats.attended;
    statCells[2].textContent = stats.absences;
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

el.addSessionBtn.addEventListener("click", async () => {
  AttendanceModule.addSession();
  await saveAttendanceThen(renderAttendance);
});

el.toggleAttendanceSettingsBtn.addEventListener("click", () => {
  attendanceSettingsEditing = !attendanceSettingsEditing;
  el.toggleAttendanceSettingsBtn.textContent = attendanceSettingsEditing ? "Done Editing" : "Edit Settings";
  renderAttendanceSettings();
});

function renderAttendanceSettings() {
  el.attendanceSettingsBody.innerHTML = "";

  if (!attendanceSettingsEditing) {
    const infractionsP = document.createElement("p");
    infractionsP.className = "hint";
    infractionsP.textContent =
      "Infraction options: " + (AttendanceModule.settings.infractionOptions.join(", ") || "(none)");
    el.attendanceSettingsBody.appendChild(infractionsP);

    const points = AttendanceModule.settings.points;
    const pointsP = document.createElement("p");
    pointsP.className = "hint";
    pointsP.textContent = `Score points — P: ${points.P}, L: ${points.L}, E: ${points.E}, A: ${points.A}`;
    el.attendanceSettingsBody.appendChild(pointsP);
    return;
  }

  // ----- Edit mode: infraction options -----
  const infractionsWrap = document.createElement("div");
  infractionsWrap.className = "attendance-settings-block";
  const infractionsLabel = document.createElement("h4");
  infractionsLabel.textContent = "Infraction options";
  infractionsWrap.appendChild(infractionsLabel);

  const list = document.createElement("ul");
  list.className = "infraction-edit-list";
  AttendanceModule.settings.infractionOptions.forEach((opt, idx) => {
    const li = document.createElement("li");
    const input = document.createElement("input");
    input.type = "text";
    input.value = opt;
    input.addEventListener("change", async () => {
      const opts = [...AttendanceModule.settings.infractionOptions];
      opts[idx] = input.value.trim();
      AttendanceModule.updateSettings({ infractionOptions: opts.filter(Boolean) });
      await saveAttendanceThen(renderAttendance);
    });
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost btn-small";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const opts = AttendanceModule.settings.infractionOptions.filter((_, i) => i !== idx);
      AttendanceModule.updateSettings({ infractionOptions: opts });
      await saveAttendanceThen(renderAttendance);
    });
    li.append(input, removeBtn);
    list.appendChild(li);
  });
  infractionsWrap.appendChild(list);

  const addRow = document.createElement("div");
  addRow.className = "add-course-row";
  const newInfractionInput = document.createElement("input");
  newInfractionInput.type = "text";
  newInfractionInput.placeholder = "New infraction option";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-primary btn-small";
  addBtn.textContent = "+ Add";
  addBtn.addEventListener("click", async () => {
    const val = newInfractionInput.value.trim();
    if (!val) return;
    AttendanceModule.updateSettings({
      infractionOptions: [...AttendanceModule.settings.infractionOptions, val],
    });
    newInfractionInput.value = "";
    await saveAttendanceThen(renderAttendance);
  });
  addRow.append(newInfractionInput, addBtn);
  infractionsWrap.appendChild(addRow);
  el.attendanceSettingsBody.appendChild(infractionsWrap);

  // ----- Edit mode: score points per code -----
  const pointsWrap = document.createElement("div");
  pointsWrap.className = "attendance-settings-block";
  const pointsLabel = document.createElement("h4");
  pointsLabel.textContent = "Score points per code";
  pointsWrap.appendChild(pointsLabel);

  ["P", "L", "E", "A"].forEach((code) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    const label = document.createElement("label");
    label.textContent = ATTENDANCE_CODE_LABELS[code];
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.min = "0";
    input.max = "1";
    input.value = AttendanceModule.settings.points[code];
    input.addEventListener("change", async () => {
      const points = { ...AttendanceModule.settings.points, [code]: Number(input.value) };
      AttendanceModule.updateSettings({ points });
      await saveAttendanceThen(renderAttendance);
    });
    row.append(label, input);
    pointsWrap.appendChild(row);
  });
  el.attendanceSettingsBody.appendChild(pointsWrap);
}

main();
