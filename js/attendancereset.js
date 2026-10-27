// ===== Attendance Settings: Reset attendance (one class, or all) =====
// Clears the codes, infractions and memos of a class — and the desk arrangement saved with it, so the class can be
// entered again from scratch. Dates and settings are kept. Changes are local until you click Save Attendance.
// Load AFTER app.js and attendanceseating.js.
(function () {
  const A = AttendanceModule;
  const hasData = (sessionId) => Object.keys(A.records).some((k) => k.endsWith(`|${sessionId}`)) || !!(A.sessions.find((s) => s.id === sessionId) || {}).seating;
  const label = (s) => `Class ${s.number}${s.date ? ` (${s.date})` : ""}${hasData(s.id) ? "" : " — nothing recorded"}`;
  let chosen = null;

  function resetSessions(ids) {
    const set = new Set(ids);
    Object.keys(A.records).forEach((key) => { if (set.has(key.slice(key.lastIndexOf("|") + 1))) delete A.records[key]; });
    A.sessions.forEach((s) => { if (set.has(s.id)) delete s.seating; });
  }

  const orig = window.renderAttendanceSettings;
  window.renderAttendanceSettings = function () {
    orig.apply(this, arguments);
    if (!attendanceSettingsEditing || !A.sessions.length) return;
    if (!chosen || !A.sessions.some((s) => s.id === chosen)) {
      const withData = A.sessions.filter((s) => hasData(s.id));
      chosen = (withData[withData.length - 1] || A.sessions[0]).id;
    }
    const block = document.createElement("div");
    block.className = "attendance-settings-block";
    const h = document.createElement("h4");
    h.textContent = "Reset attendance";
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Clears what was entered for a class (codes, infractions, memos, and the seating arrangement saved with it) so you can enter it again. Class dates are kept. Click Save Attendance afterwards to keep the change.";
    const row = document.createElement("div");
    row.className = "mapping-row";
    const sel = document.createElement("select");
    A.sessions.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = label(s); sel.appendChild(o); });
    sel.value = chosen;
    sel.addEventListener("change", () => { chosen = sel.value; one.textContent = `Reset ${name()}`; });
    const name = () => `Class ${(A.sessions.find((s) => s.id === chosen) || {}).number}`;
    const one = document.createElement("button");
    one.type = "button"; one.className = "btn btn-ghost btn-small"; one.textContent = `Reset ${name()}`;
    const all = document.createElement("button");
    all.type = "button"; all.className = "btn btn-ghost btn-small"; all.textContent = "Reset All";
    const msg = document.createElement("span");
    msg.className = "result";
    const done = (text) => { renderAttendance(); renderAttendanceSettings(); const m = el.attendanceSettingsBody.querySelector(".att-reset-msg"); if (m) m.textContent = text; };
    msg.className = "result att-reset-msg";
    one.addEventListener("click", () => {
      const s = A.sessions.find((x) => x.id === chosen);
      if (!s || !confirm(`Reset attendance for ${name()}${s.date ? ` (${s.date})` : ""}? Every code, infraction and memo for that class is cleared.`)) return;
      resetSessions([chosen]);
      done(`${name()} reset. Click Save Attendance to keep this.`);
    });
    all.addEventListener("click", () => {
      if (!confirm(`Reset attendance for ALL ${A.sessions.length} classes? Every code, infraction and memo is cleared. This can't be undone once saved.`)) return;
      resetSessions(A.sessions.map((s) => s.id));
      done("All attendance reset. Click Save Attendance to keep this.");
    });
    row.append(sel, one, all);
    block.append(h, hint, row, msg);
    el.attendanceSettingsBody.appendChild(block);
  };
})();
