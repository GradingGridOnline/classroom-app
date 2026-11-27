// Seating Chart control bar readout ("18 / 28 SEATED"), shown by the Tron: Legacy theme.
// Counts seated desks and unseated students whenever the chart or the unseated list changes.
(function () {
  const out = document.getElementById("seated-count");
  const grid = document.getElementById("seating-grid");
  const list = document.getElementById("unseated-list");
  if (!out || !grid || !list) return;
  const update = () => {
    const seated = grid.querySelectorAll(".desk-occupied").length;
    const unseated = list.querySelectorAll(".unseated-item").length;
    const text = `${seated} / ${seated + unseated}`;
    if (out.textContent !== text) out.textContent = text;
  };
  const watch = new MutationObserver(update);
  watch.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  watch.observe(list, { childList: true, subtree: true });
  update();
})();
