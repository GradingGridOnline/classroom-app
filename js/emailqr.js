// ===== Email QR pop-out =====
// Reads the active form's link from the main app window (window.opener)
// and renders it as a QR code. This window doesn't need its own sign-in
// or data — it's just a display.

const statusEl = document.getElementById("emailqr-status");
const opener = window.opener;

if (!opener || opener.closed || !opener.EmailCollectModule) {
  statusEl.textContent =
    'Couldn\'t connect to the main GradingGridOnline window. Close this tab and click "Collect Email Addresses" again.';
} else {
  const url = opener.EmailCollectModule.activeFormUrl;
  if (!url) {
    statusEl.textContent = "No active form found — something may have gone wrong creating it.";
  } else {
    const box = document.getElementById("qr-container");
    const qs = new URLSearchParams(location.search);
    if (qs.get("n") || qs.get("p")) {
      // inside the white tile, so the course name and period are included when it is copied as a picture
      const cap = document.createElement("div");
      cap.style.cssText = "margin:0 0 10px;color:#222;";
      if (qs.get("n")) { const a = document.createElement("div"); a.textContent = qs.get("n"); a.style.cssText = "font-size:1.2rem;font-weight:700;"; cap.appendChild(a); }
      if (qs.get("p")) { const b = document.createElement("div"); b.textContent = qs.get("p"); b.style.cssText = "font-size:.95rem;color:#444;"; cap.appendChild(b); }
      box.appendChild(cap);
    }
    const holder = document.createElement("div");
    box.appendChild(holder);
    // eslint-disable-next-line no-undef
    new QRCode(holder, {
      text: url,
      width: 260,
      height: 260,
    });
  }
}
