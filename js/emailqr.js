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
    // eslint-disable-next-line no-undef
    new QRCode(document.getElementById("qr-container"), {
      text: url,
      width: 260,
      height: 260,
    });
  }
}
