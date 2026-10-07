// ===== Spreadsheet-style keyboard movement =====
// In the app's tables (Roster, Attendance, Scoring, Progress Tracker,
// Presentation Calc scores, Rubrics):
//   Enter        moves down to the box below (Shift+Enter: up)
//   Tab          moves right to the next box (Shift+Tab: left); at the end of
//                a row it continues at the start of the next one
// Pressing Tab on the last box of a table, or Enter on the last row, behaves
// as usual. Typing in Japanese: Enter / Tab that confirm a conversion are
// left alone.

(function () {
  const GRID_SELECTOR =
    "table.attendance-table, table.roster-table, table.rubric-active-grid, table.rubric-points-grid, table.rubric-bank-grid";
  const CONTROL_SELECTOR =
    'input:not([type="checkbox"]):not([type="hidden"]):not([type="file"]):not([type="button"]):not([type="submit"]), select';

  function controlsIn(cell) {
    return Array.from(cell.querySelectorAll(CONTROL_SELECTOR)).filter((c) => !c.disabled && c.offsetParent !== null);
  }

  function controlsInRow(row) {
    return Array.from(row.cells).flatMap(controlsIn);
  }

  /** The Active Rubrics block is two tables side by side (rubric + points); treat each pair of rows as one row. */
  function joinedRowControls(table, rowIndex) {
    let tables = [table];
    if (table.classList.contains("rubric-active-grid")) {
      const partner = table.nextElementSibling;
      if (partner && partner.classList.contains("rubric-points-grid")) tables = [table, partner];
    } else if (table.classList.contains("rubric-points-grid")) {
      const partner = table.previousElementSibling;
      if (partner && partner.classList.contains("rubric-active-grid")) tables = [partner, table];
    }
    return tables.flatMap((t) => (t.rows[rowIndex] ? controlsInRow(t.rows[rowIndex]) : []));
  }

  function isJoined(table) {
    return table.classList.contains("rubric-active-grid") || table.classList.contains("rubric-points-grid");
  }

  function locate(el) {
    const cell = el.closest("td, th");
    const row = cell.parentElement;
    const table = cell.closest(GRID_SELECTOR);
    return { cell, row, table, k: controlsIn(cell).indexOf(el) };
  }

  /** The box in the same column, in the next row down (dir = 1) or up (dir = -1). */
  function findVertical(el, dir) {
    const { cell, row, table, k } = locate(el);
    const rows = Array.from(table.rows);
    for (let i = row.rowIndex + dir; i >= 0 && i < rows.length; i += dir) {
      const target = rows[i].cells[cell.cellIndex];
      if (!target) continue;
      const ctrls = controlsIn(target);
      if (ctrls.length > Math.max(k, 0)) return ctrls[Math.max(k, 0)];
    }
    return null;
  }

  /** The next box to the right (dir = 1) or left (dir = -1), wrapping to the next / previous row. */
  function findHorizontal(el, dir) {
    const { cell, row, table, k } = locate(el);

    if (isJoined(table)) {
      const own = joinedRowControls(table, row.rowIndex);
      const at = own.indexOf(el);
      if (at !== -1 && own[at + dir]) return own[at + dir];
      const rowCount = table.rows.length;
      for (let r = row.rowIndex + dir; r >= 0 && r < rowCount; r += dir) {
        const next = joinedRowControls(table, r);
        if (next.length) return dir > 0 ? next[0] : next[next.length - 1];
      }
      return null;
    }

    const cells = Array.from(row.cells);
    for (let i = cell.cellIndex + dir; i >= 0 && i < cells.length; i += dir) {
      const ctrls = controlsIn(cells[i]);
      if (ctrls.length) return ctrls[Math.min(Math.max(k, 0), ctrls.length - 1)];
    }
    const rows = Array.from(table.rows);
    for (let r = row.rowIndex + dir; r >= 0 && r < rows.length; r += dir) {
      const all = controlsInRow(rows[r]);
      if (all.length) return dir > 0 ? all[0] : all[all.length - 1];
    }
    return null;
  }

  /** Where a box sits, so it can be found again if the table is rebuilt (several tables rebuild themselves when a value changes). */
  function describe(el) {
    const { cell, row, table, k } = locate(el);
    const root = el.closest(".scoring-mode-view, .tab-panel") || document.body;
    return {
      root,
      tableIndex: Array.from(root.querySelectorAll(GRID_SELECTOR)).indexOf(table),
      rowIndex: row.rowIndex,
      cellIndex: cell.cellIndex,
      controlIndex: Math.max(k, 0),
    };
  }

  function refind(desc) {
    const table = desc.root.querySelectorAll(GRID_SELECTOR)[desc.tableIndex];
    const cell = table && table.rows[desc.rowIndex] && table.rows[desc.rowIndex].cells[desc.cellIndex];
    return cell ? controlsIn(cell)[desc.controlIndex] || null : null;
  }

  function focusBox(el) {
    el.focus();
    if (typeof el.select === "function" && el.tagName === "INPUT") {
      try {
        el.select();
      } catch (e) {}
    }
  }

  function goTo(target) {
    const desc = describe(target);
    focusBox(target); // leaving the old box saves its value; some tables then rebuild themselves
    const ensure = () => {
      if (target.isConnected) return; // still there (focused, or the user has moved on)
      const again = refind(desc);
      if (again) focusBox(again);
    };
    ensure();
    setTimeout(ensure, 40);
  }

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
    if (e.key !== "Enter" && e.key !== "Tab") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches(CONTROL_SELECTOR)) return;
    const cell = el.closest("td, th");
    if (!cell || !cell.closest(GRID_SELECTOR)) return;

    const target = e.key === "Enter" ? findVertical(el, e.shiftKey ? -1 : 1) : findHorizontal(el, e.shiftKey ? -1 : 1);
    if (!target) return;
    e.preventDefault();
    goTo(target);
  });
})();
