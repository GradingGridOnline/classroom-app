// ===== Presentation Calc: the "By student" view of the Scores page =====
// One row per student: their group's rubric scores, their own peer rating, their group's Total Score, what
// their attendance on the chosen class date costs, and the Total Score that goes to Main Scores.
// Load BEFORE app.js is fine (only called while drawing); it is a plain global function.
const presScoreView = new Map(); // "toolId|projectId" -> "group" | "student"

function presAttendanceLabel(project) {
  const A = window.AttendanceModule;
  if (!project.absenceSession || !A) return "";
  const i = A.sessions.findIndex((x) => x.id === project.absenceSession);
  if (i < 0) return "";
  const s = A.sessions[i];
  return s.date ? s.date : `class ${s.number || i + 1}`;
}

function buildPresStudentTable(tool, project, container, columns) {
  const wrap = document.createElement("div");
  wrap.className = "attendance-table-wrap";
  const table = document.createElement("table");
  table.className = "attendance-table scoring-table";
  const rubricCols = columns.filter((c) => c.kind !== "peer");
  const peerCol = columns.find((c) => c.kind === "peer");
  const maxMode = project.totalColumn.mode === "max" && project.totalColumn.maxPoints > 0;
  const fmt = (v) => (v === null || v === undefined ? "—" : String(Math.round(v * 100) / 100));
  const attLabel = presAttendanceLabel(project);

  const hr = document.createElement("tr");
  ["Group", "Student"].forEach((t) => { const th = document.createElement("th"); th.textContent = t; hr.appendChild(th); });
  rubricCols.forEach((c) => { const th = document.createElement("th"); th.textContent = c.points > 0 ? `${c.label} (/${c.points})` : c.label; hr.appendChild(th); });
  if (peerCol) { const th = document.createElement("th"); th.textContent = `Peer Evaluation (own rating)`; hr.appendChild(th); }
  ["Group Total", attLabel ? `Attendance (${attLabel})` : "Attendance", "Penalty", "Override", maxMode ? `Student Total (/${project.totalColumn.maxPoints})` : "Student Total"].forEach((t) => {
    const th = document.createElement("th"); th.textContent = t; hr.appendChild(th);
  });
  const thead = document.createElement("thead"); thead.appendChild(hr); table.appendChild(thead);

  const peerAverages = ScoringModule.presentationPeerAverages(tool.id, project.id);
  const tbody = document.createElement("tbody");
  const rows = project.roster.filter((e) => e.group).slice().sort((a, b) => a.group - b.group || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  rows.forEach((entry) => {
    const tr = document.createElement("tr");
    const cell = (text, cls) => { const td = document.createElement("td"); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); return td; };
    cell(`Group ${entry.group}`);
    cell(entry.name || "(unnamed)");
    rubricCols.forEach((c) => cell(fmt(ScoringModule.getPresentationValue(tool.id, project.id, entry.group, c.entryId) === "" ? null : Number(ScoringModule.getPresentationValue(tool.id, project.id, entry.group, c.entryId)))));
    if (peerCol) {
      const mine = peerAverages[entry.studentId];
      const raw = ScoringModule.getPresentationValue(tool.id, project.id, entry.group, "peer");
      cell(mine ? fmt(mine.avg) : raw === "" ? "—" : `${fmt(Number(raw))} (group)`);
    }
    const groupSum = ScoringModule.computePresentationSum(tool.id, project.id, entry.group);
    cell(fmt(groupSum), "attendance-stat-cell");
    const info = ScoringModule.presentationPenaltyInfo(project, entry.studentId);
    cell(info.code || "—");
    const deduction = groupSum === null ? 0 : ScoringModule.presentationAbsenceDeduction(project, groupSum, entry.studentId);
    cell(deduction > 0 ? `−${fmt(deduction)}` : info.source === "waived" ? "waived" : "—");
    const ovTd = document.createElement("td");
    const sel = document.createElement("select");
    [["", "Automatic"], ["penalize", "Penalize"], ["waive", "Waive"]].forEach(([id, text]) => {
      const o = document.createElement("option"); o.value = id; o.textContent = text;
      if (id === (project.absenceOverride[entry.studentId] || "")) o.selected = true;
      sel.appendChild(o);
    });
    sel.title = "Automatic uses the attendance record of the chosen class date. Penalize applies the penalty for A; Waive removes any penalty (an excused absence, say).";
    sel.addEventListener("change", () => { ScoringModule.setPresentationAbsenceOverride(tool.id, project.id, entry.studentId, sel.value); renderScoringToolView(tool, container); });
    ovTd.appendChild(sel); tr.appendChild(ovTd);
    const total = ScoringModule.computePresentationStudentSum(tool.id, project.id, entry.studentId);
    cell(total === null ? "—" : maxMode ? `${fmt(total)}/${project.totalColumn.maxPoints}` : fmt(total), "attendance-stat-cell");
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
