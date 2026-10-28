// ===== QR code window colors =====
// Used by the pop-out QR windows (presqr.html, emailqr.html) AND by the main page, where it
// adds a "QR code colors" drop-down to Global Settings. Choices: match the app's current
// theme, bright, or dark. The QR code itself always sits on a white tile so phones scan it
// reliably. The choice is remembered on this computer.

(function () {
  const KEY = "ggo-qrtheme";
  const PALETTES = {
    bright: { bg: "#f6f5f1", ink: "#2b2a28", head: "#223d26", soft: "#6b6560", line: "#ddd8cd" },
    dark: { bg: "#1b1a19", ink: "#f7f5f2", head: "#f2eee4", soft: "#b0ada8", line: "#615e5a" },
  };
  // What "match the current theme" looks like for each app theme.
  const MATCH = {
    default: PALETTES.bright,
    basic: { bg: "#e6ebef", ink: "#1f2430", head: "#8f3009", soft: "#5b6472", line: "#6b7d8f" },
    cyberpunk: { bg: "#f1f4f7", ink: "#1c232b", head: "#08508f", soft: "#5a6672", line: "#c3cdd8" },
    "tron-legacy": { bg: "#0e1217", ink: "#d9faff", head: "#4de8ff", soft: "#5f8a95", line: "#0f3e4a" },
    dark: PALETTES.dark,
    vintage: { bg: "#efe4cb", ink: "#3a3d40", head: "#3f5c68", soft: "#6e695e", line: "#cdbf9f" },
  };

  function get() {
    try { const v = localStorage.getItem(KEY); if (v === "match" || v === "bright" || v === "dark") return v; } catch (e) {}
    return "match";
  }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function palette() {
    const choice = get();
    if (choice === "bright" || choice === "dark") return PALETTES[choice];
    let theme = "default";
    try { theme = localStorage.getItem("ggo-theme") || "default"; } catch (e) {}
    return MATCH[theme] || PALETTES.bright;
  }

  // ----- the QR pop-out windows -----
  const isPopup = !!(document.getElementById("qr") || document.getElementById("qr-container"));
  if (isPopup || /(presqr|emailqr)\.html/.test(location.pathname)) {
    const p = palette();
    const st = document.createElement("style");
    st.textContent = `
      html, body { background: ${p.bg} !important; color: ${p.ink} !important; }
      h1, .emailqr-wrap h1 { color: ${p.head} !important; }
      p, .emailqr-wrap p, #link { color: ${p.soft} !important; }
      #qr, #qr-container { background: #fff !important; border-color: ${p.line} !important; }
      #qr canvas, #qr img, #qr-container canvas, #qr-container img { background: #fff; }
    `;
    document.documentElement.appendChild(st);
  }

  // ----- the drop-down in Global Settings -----
  function addSetting() {
    const anchor = document.getElementById("textsize-list");
    if (!anchor || document.getElementById("qr-theme-select")) return;
    const after = anchor.closest(".settings-block");
    const block = document.createElement("div");
    block.className = "settings-block";
    const h = document.createElement("h3");
    h.textContent = "QR code colors";
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Colors of the QR code windows you show to students. The code itself stays on a white tile so it scans reliably.";
    const sel = document.createElement("select");
    sel.id = "qr-theme-select";
    [["match", "Match the current theme"], ["bright", "Bright"], ["dark", "Dark"]].forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      sel.appendChild(o);
    });
    sel.value = get();
    sel.addEventListener("change", () => set(sel.value));
    block.append(h, hint, sel);
    (after || anchor.parentElement).insertAdjacentElement("afterend", block);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addSetting);
  else addSetting();
})();
