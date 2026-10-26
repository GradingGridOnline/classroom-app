// ===== Module layout: every module = control buttons (top-left) + Save (top-right), the main content,
// then collapsible Sections (rounded-corner heading bars), the last of which is the module's Settings. =====
// Sections are registered below by CSS selector; the first heading inside (a direct h3, or the
// .attendance-settings-header) becomes a click-to-collapse bar. Collapsed state is remembered on this device.
// Load AFTER the modules' own scripts.
(function () {
  const SECTIONS = [
    ["seating-banks", "#seating-panel .banks-section"],
    ["seating-groups", "#seating-panel .group-list-section"],
    ["seating-settings", "#seating-settings"],
  ];
  const KEY = "ggo-sections-closed";
  let closed = new Set();
  try { closed = new Set(JSON.parse(localStorage.getItem(KEY)) || []); } catch (e) { closed = new Set(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...closed])); } catch (e) {} };

  SECTIONS.forEach(([id, selector]) => {
    const sec = document.querySelector(selector);
    if (!sec || sec.dataset.ggoSection) return;
    const head = sec.querySelector(":scope > .attendance-settings-header") || sec.querySelector(":scope > h3");
    if (!head) return;
    sec.dataset.ggoSection = id;
    sec.classList.add("ggo-section");
    head.classList.add("ggo-sec-head");
    head.title = "Click the heading to collapse or expand";
    const apply = () => sec.classList.toggle("ggo-collapsed", closed.has(id));
    head.addEventListener("click", (e) => {
      if (e.target.closest("button, select, input, a, label")) return; // controls inside the bar keep working
      if (closed.has(id)) closed.delete(id); else closed.add(id);
      save(); apply();
    });
    apply();
  });
})();
