// ===== Pop-out seating chart =====
// Read-only, name-only display for projecting. Pulls live data from
// the main app window (window.opener) rather than keeping its own
// copy — click "Refresh" any time the main chart changes.
//
// "Reversed perspective": rows are rendered in reverse order (last
// row first), so the row that was nearest the front in the main
// editor now appears at the top here, matching the "Front of
// Classroom" label moving from the bottom to the top.

function render() {
  const statusEl = document.getElementById("popout-status");
  const opener = window.opener;

  if (!opener || opener.closed || !opener.SeatingModule) {
    statusEl.textContent =
      'Couldn\'t connect to the main GradingGridOnline window. Close this tab and click "Pop Out ↗" again from the Seating Chart tab.';
    return;
  }

  const seating = opener.SeatingModule;
  const roster = opener.RosterModule;
  const courses = opener.CoursesModule;
  const theme = opener.ThemeModule;
  const groupHueDeg = opener.groupHueDeg;

  // Match the main app's current theme.
  if (theme.current === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme.current);
  }

  const course = courses.find(seating.currentCourseId);
  document.getElementById("popout-course-title").textContent = course
    ? course.name
    : "Seating Chart";

  const grid = document.getElementById("popout-grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${seating.cols}, 1fr)`;

  // Reversed row order — see comment above.
  for (let r = seating.rows - 1; r >= 0; r--) {
    for (let c = 0; c < seating.cols; c++) {
      const active = seating.isActive(r, c);
      const studentId = active ? seating.studentAt(r, c) : null;
      const student = studentId ? roster.students.find((s) => s.id === studentId) : null;
      const group = active ? seating.getGroup(r, c) : 0;

      const desk = document.createElement("div");
      desk.className =
        "desk" +
        (!active ? " desk-inactive" : student ? " desk-occupied" : " desk-empty") +
        (group ? " desk-grouped" : "");
      if (group) desk.style.setProperty("--group-hue", String(groupHueDeg(group)));

      const nameEl = document.createElement("span");
      nameEl.className = "desk-name";
      nameEl.textContent = student ? student.name || "" : "";
      desk.appendChild(nameEl);

      grid.appendChild(desk);
    }
  }

  statusEl.textContent = "";
}

document.getElementById("popout-refresh-btn").addEventListener("click", render);
render();
