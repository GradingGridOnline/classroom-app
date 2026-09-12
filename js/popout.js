// ===== Pop-out seating chart =====
// Read-only, name-only display for projecting. Pulls live data from
// the main app window (window.opener) rather than keeping its own
// copy — it re-checks that data automatically (see the polling
// interval at the bottom), so it stays in sync without any action
// needed in this window.
//
// "Reversed perspective": two changes from the main editor.
//  1. Rows render back-to-front reversed (last row first), so the row
//     nearest the front in the main editor now appears at the top
//     here, matching the "Front of Classroom" label moving to the top.
//  2. Columns render right-to-left (mirrored), because when two people
//     face each other, left and right swap — a desk on the teacher's
//     right is on the students' left, same as "stage right" being the
//     audience's left in a theater.

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

  // Size desks to fill most of the window, in both directions — not
  // just stretch to the width. Leaves a margin for the header, the
  // "Front of Classroom" labels, and the status line.
  const reservedHeight = 80;
  const availableWidth = window.innerWidth * 0.99;
  const availableHeight = window.innerHeight - reservedHeight;
  const deskSize = Math.max(
    30,
    Math.floor(Math.min(availableWidth / seating.cols, availableHeight / seating.rows))
  );

  grid.style.gridTemplateColumns = `repeat(${seating.cols}, ${deskSize}px)`;
  grid.style.gridTemplateRows = `repeat(${seating.rows}, ${deskSize}px)`;
  grid.style.setProperty("--popout-name-size", `${Math.max(10, Math.round(deskSize * 0.16))}px`);
  grid.style.setProperty("--popout-badge-size", `${Math.max(14, Math.round(deskSize * 0.3))}px`);

  // Reversed row order AND mirrored column order — see comment above.
  for (let r = seating.rows - 1; r >= 0; r--) {
    for (let c = seating.cols - 1; c >= 0; c--) {
      const active = seating.isActive(r, c);
      const studentId = active ? seating.studentAt(r, c) : null;
      const student = studentId ? roster.students.find((s) => s.id === studentId) : null;
      const group = active && seating.showGroupsInPopout ? seating.getGroup(r, c) : 0;
      const label = active ? seating.getLabel(r, c) : "";

      const desk = document.createElement("div");
      desk.className =
        "desk" +
        (!active ? " desk-inactive" : student ? " desk-occupied" : " desk-empty") +
        (group ? " desk-grouped" : "");
      if (group) desk.style.setProperty("--group-hue", String(groupHueDeg(group)));

      if (group) {
        const groupBadge = document.createElement("span");
        groupBadge.className = "popout-group-badge";
        groupBadge.textContent = String(group);
        desk.appendChild(groupBadge);
      }

      const nameEl = document.createElement("span");
      nameEl.className = "desk-name";
      nameEl.textContent = student ? student.name || "" : label || "";
      desk.appendChild(nameEl);

      grid.appendChild(desk);
    }
  }

  statusEl.textContent = "";
}

render();
setInterval(render, 1000);
