// ===== Attendance → Seating Grid: remember the desk arrangement used for each class =====
// Load AFTER app.js. The first time you record attendance for a class in the Seating Grid,
// the desk arrangement on screen is saved with that class. A toggle lets you view the class
// with the arrangement that was used then ("As recorded") or the arrangement in the Seating
// Chart tab right now ("Current"). "Save current arrangement" replaces what was saved.

(function () {
  const mode = new Map(); // sessionId -> "recorded" | "current" (this visit only)

  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  function snapshotNow() {
    return {
      rows: SeatingModule.rows,
      cols: SeatingModule.cols,
      active: clone(SeatingModule.active),
      seats: clone(SeatingModule.seats),
      labels: clone(SeatingModule.labels),
      savedAt: new Date().toISOString(),
    };
  }
  const sessionById = (id) => AttendanceModule.sessions.find((s) => s.id === id);
  const modeOf = (session) => mode.get(session.id) || (session.seating ? "recorded" : "current");

  // ----- save the arrangement the first time attendance is recorded in the grid -----
  function captureIfNeeded(sessionId) {
    if (attendanceView !== "seating" || sessionId !== attendanceSeatingSessionId) return;
    const s = sessionById(sessionId);
    if (!s || s.seating) return;
    s.seating = snapshotNow();
    updateInfo();
  }
  const origSetRecord = AttendanceModule.setRecord;
  AttendanceModule.setRecord = function (studentId, sessionId) {
    captureIfNeeded(sessionId);
    return origSetRecord.apply(this, arguments);
  };
  const origMarkAll = AttendanceModule.markAllPresent;
  AttendanceModule.markAllPresent = function (sessionId) {
    captureIfNeeded(sessionId);
    return origMarkAll.apply(this, arguments);
  };

  // ----- toolbar: toggle + save button + info line -----
  const toolbar = document.querySelector(".attendance-seating-toolbar");
  const wrap = document.createElement("span");
  wrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;";
  const lbl = document.createElement("span");
  lbl.textContent = "Seating shown:";
  const btnRec = document.createElement("button");
  btnRec.type = "button";
  btnRec.textContent = "As recorded";
  btnRec.title = "The desk arrangement that was in use when this class's attendance was taken";
  const btnCur = document.createElement("button");
  btnCur.type = "button";
  btnCur.textContent = "Current";
  btnCur.title = "The arrangement in the Seating Chart tab right now";
  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.className = "btn btn-ghost btn-small";
  btnSave.textContent = "Save current arrangement to this class";
  const info = document.createElement("span");
  info.className = "hint";
  info.style.margin = "0";
  wrap.append(lbl, btnRec, btnCur, btnSave, info);
  toolbar.appendChild(wrap);

  btnRec.addEventListener("click", () => { const s = sessionById(attendanceSeatingSessionId); if (s && s.seating) { mode.set(s.id, "recorded"); renderAttendanceSeatingView(); } });
  btnCur.addEventListener("click", () => { const s = sessionById(attendanceSeatingSessionId); if (s) { mode.set(s.id, "current"); renderAttendanceSeatingView(); } });
  btnSave.addEventListener("click", () => {
    const s = sessionById(attendanceSeatingSessionId);
    if (!s) return;
    if (s.seating && !confirm("Replace the arrangement saved with this class by the current Seating Chart?")) return;
    s.seating = snapshotNow();
    mode.set(s.id, "recorded");
    renderAttendanceSeatingView();
  });

  function updateInfo() {
    const s = sessionById(attendanceSeatingSessionId);
    if (!s) { info.textContent = ""; return; }
    const m = modeOf(s);
    [[btnRec, "recorded"], [btnCur, "current"]].forEach(([b, v]) => {
      b.className = "btn btn-small " + (m === v ? "btn-primary" : "btn-ghost");
    });
    btnRec.disabled = !s.seating;
    btnSave.textContent = s.seating ? "Replace saved arrangement with current" : "Save current arrangement to this class";
    if (!s.seating) info.textContent = "No arrangement saved for this class yet — it is saved when you record attendance here.";
    else {
      const d = s.seating.savedAt ? new Date(s.seating.savedAt).toLocaleDateString() : "";
      info.textContent = (m === "recorded" ? "Showing the arrangement used for this class" : "Showing the current Seating Chart (this class's saved arrangement is hidden)") + (d ? ` — saved ${d}.` : ".");
    }
  }

  // ----- the grid itself -----
  window.renderAttendanceSeatingView = function () {
    const grid = document.getElementById("attendance-seating-grid");
    const unseatedBox = document.getElementById("attendance-seating-unseated");
    const sessionSelect = document.getElementById("att-seating-session");
    if (!grid || attendanceView !== "seating") return;

    const sessions = AttendanceModule.sessions;
    if (!sessions.some((x) => x.id === attendanceSeatingSessionId)) {
      attendanceSeatingSessionId = defaultAttendanceSeatingSession();
    }
    sessionSelect.innerHTML = "";
    sessions.forEach((sess) => {
      const opt = document.createElement("option");
      opt.value = sess.id;
      opt.textContent = `Class ${sess.number}${sess.date ? " — " + sess.date : ""}${sess.seating ? "  ▦" : ""}`;
      if (sess.id === attendanceSeatingSessionId) opt.selected = true;
      sessionSelect.appendChild(opt);
    });
    grid.innerHTML = "";
    unseatedBox.innerHTML = "";
    const session = sessions.find((x) => x.id === attendanceSeatingSessionId);
    const dateInput = document.getElementById("att-seating-date");
    dateInput.value = (session && session.date) || "";
    dateInput.disabled = !session;
    updateInfo();
    if (!session) {
      grid.textContent = "No classes yet — set the number of classes in Attendance Settings.";
      return;
    }

    // Which arrangement to draw
    const useSaved = modeOf(session) === "recorded" && session.seating;
    const arr = useSaved
      ? { rows: session.seating.rows, cols: session.seating.cols, active: session.seating.active || {}, seats: session.seating.seats || {} }
      : { rows: SeatingModule.rows, cols: SeatingModule.cols, active: SeatingModule.active, seats: SeatingModule.seats };
    const keyOf = (r, c) => SeatingModule.key(r, c);

    grid.style.gridTemplateColumns = `repeat(${arr.cols}, minmax(170px, 1fr))`;
    const seatedIds = new Set();
    for (let r = 0; r < arr.rows; r++) {
      for (let c = 0; c < arr.cols; c++) {
        if (!arr.active[keyOf(r, c)]) {
          const gap = document.createElement("div");
          gap.className = "att-seat-gap";
          grid.appendChild(gap);
          continue;
        }
        const studentId = arr.seats[keyOf(r, c)] || null;
        const student = studentId ? RosterModule.students.find((s) => s.id === studentId) : null;
        if (student) {
          seatedIds.add(student.id);
          grid.appendChild(buildAttendanceSeatCard(student, session));
        } else {
          const empty = document.createElement("div");
          empty.className = "att-seat-card att-seat-empty";
          empty.textContent = studentId ? "(student no longer on roster)" : "empty desk";
          grid.appendChild(empty);
        }
      }
    }

    const addGroup = (title, list) => {
      if (!list.length) return;
      const heading = document.createElement("h4");
      heading.textContent = title;
      unseatedBox.appendChild(heading);
      const row = document.createElement("div");
      row.className = "att-seat-unseated-row";
      list.forEach((st) => row.appendChild(buildAttendanceSeatCard(st, session)));
      unseatedBox.appendChild(row);
    };
    const notAtDesk = RosterModule.students.filter((s) => !seatedIds.has(s.id));
    addGroup("Not seated", notAtDesk.filter((s) => !s.excludeFromSeating));
    addGroup("Excluded Students", notAtDesk.filter((s) => s.excludeFromSeating));
  };
  // ----- desk colors by absences: orange at the limit, red beyond it -----
  // Uses the "Absence warning limit" in Attendance Settings (same limit as the Table's Absences column).
  const stStyle = document.createElement("style");
  stStyle.textContent = `
    .att-seat-card.att-abs-limit { background: #ffb74d !important; border-color: #e65100 !important; border-width: 2px; }
    .att-seat-card.att-abs-over { background: #e57373 !important; border-color: #b71c1c !important; border-width: 2px; }
    .att-seat-card.att-abs-limit, .att-seat-card.att-abs-over { color: #111 !important; }
    .att-seat-card.att-abs-limit *:not(select):not(input):not(option), .att-seat-card.att-abs-over *:not(select):not(input):not(option) { color: #111 !important; }
  `;
  document.head.appendChild(stStyle);

  function colorCard(card, studentId) {
    const limit = AttendanceModule.settings.absenceLimit;
    card.classList.remove("att-abs-limit", "att-abs-over");
    if (!limit || limit <= 0) { card.removeAttribute("title"); return; }
    const abs = AttendanceModule.stats(studentId).absences;
    if (abs > limit) card.classList.add("att-abs-over");
    else if (abs === limit) card.classList.add("att-abs-limit");
    if (abs >= limit) card.title = `${abs} absence(s) — limit is ${limit}`;
    else card.removeAttribute("title");
  }
  const origCard = window.buildAttendanceSeatCard;
  window.buildAttendanceSeatCard = function (student, session) {
    const card = origCard.apply(this, arguments);
    colorCard(card, student.id);
    card.querySelectorAll("select, input").forEach((c) => c.addEventListener("change", () => colorCard(card, student.id)));
    return card;
  };
})();
