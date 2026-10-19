// ===== Presentation Calc → QR Forms: section headers styled like the Test & Quiz Bank =====
// Load AFTER app.js. Keeps each theme's own color but darkens it, with a tinted body and
// matching border, the same way the Test & Quiz Bank's sections look.

(function () {
  const st = document.createElement("style");
  st.textContent = `
    .pres-section.pres-qrf { border-color: color-mix(in srgb, var(--green) 62%, #000); background: color-mix(in srgb, var(--green) 10%, var(--card)); }
    .pres-section.pres-qrf > .pres-section-head { background: color-mix(in srgb, var(--green) 62%, #000); color: #fff; border-bottom: 0; }
  `;
  document.head.appendChild(st);

  const orig = window.buildPresentationTemplatesPage;
  window.buildPresentationTemplatesPage = function () {
    const page = orig.apply(this, arguments);
    page.querySelectorAll(".pres-section").forEach((s) => s.classList.add("pres-qrf"));
    return page;
  };
})();
