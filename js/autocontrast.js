// ===== Dark theme: automatic dark text on bright backgrounds =====
// Load AFTER app.js. While the Dark theme is on, any light/white text that ends up on a
// bright background is switched to near-black automatically (and switched back if the
// background changes). Other themes are never touched.

(function () {
  const root = document.documentElement;
  const lum = (r, g, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  function bgOf(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 27, g: 26, b: 25, a: 1 }; // the page
  }
  const hasText = (el) => {
    if (el.matches("input,select,textarea,button")) return true;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  };

  let busy = false;
  function fix() {
    if (root.getAttribute("data-theme") !== "dark") {
      document.querySelectorAll("[data-ac]").forEach((el) => { el.style.removeProperty("color"); el.removeAttribute("data-ac"); });
      return;
    }
    busy = true;
    observer.disconnect();
    try {
      document.body.querySelectorAll("*").forEach((el) => {
        if (el.closest("svg") || !hasText(el)) return;
        if (el.hasAttribute("data-ac")) { el.style.removeProperty("color"); el.removeAttribute("data-ac"); }
        const fg = parse(getComputedStyle(el).color);
        if (!fg) return;
        const bg = bgOf(el);
        if (lum(fg.r, fg.g, fg.b) > 0.6 && lum(bg.r, bg.g, bg.b) > 0.3) {
          el.style.setProperty("color", "#0d0d0d", "important");
          el.setAttribute("data-ac", "1");
        }
      });
    } finally {
      busy = false;
      observe();
    }
  }

  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(fix, 120); };
  const observer = new MutationObserver(() => { if (!busy) schedule(); });
  function observe() {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class", "hidden"] });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }
  observe();
  document.addEventListener("click", schedule, true);
  schedule();
})();
