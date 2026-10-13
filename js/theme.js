// ===== Theme module =====
// Themes are just a data-theme attribute on <html>, matched by CSS
// variable overrides in style.css. Preference is stored locally
// (instant, avoids a flash on reload) and in Google Drive (so it
// follows you between computers, once signed in).

const THEMES = [
  { id: "default", label: "Default" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "basic", label: "Basic" },
  { id: "tron-legacy", label: "Tron: Legacy" },
];

const TEXT_SIZES = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

const ThemeModule = {
  current: "default",
  textSize: "medium",

  /** Reads the local (pre-sign-in) preference. Called immediately on load. */
  initLocal() {
    try {
      const saved = localStorage.getItem("ggo-theme");
      if (saved && THEMES.some((t) => t.id === saved)) {
        this.current = saved;
      }
    } catch (e) {
      // localStorage unavailable — fine, just won't persist locally.
    }
    this.apply(this.current);
    try {
      const size = localStorage.getItem("ggo-textsize");
      if (size && TEXT_SIZES.some((t) => t.id === size)) this.textSize = size;
    } catch (e) {}
    this.applyTextSize(this.textSize);
  },

  /** Called once signed in — reconciles with the copy saved in Drive. */
  async syncFromDrive() {
    try {
      const data = await storage.loadFile("settings.json");
      if (data && data.theme && THEMES.some((t) => t.id === data.theme)) {
        this.set(data.theme, { save: false });
      }
      if (data && data.textSize && TEXT_SIZES.some((t) => t.id === data.textSize)) {
        this.setTextSize(data.textSize, { save: false });
      }
    } catch (e) {
      // No settings file yet, or a load error — keep the local theme.
    }
  },

  apply(themeId) {
    if (themeId === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
    }
  },

  applyTextSize(size) {
    if (size === "medium") document.documentElement.removeAttribute("data-textsize");
    else document.documentElement.setAttribute("data-textsize", size);
  },

  async setTextSize(size, { save = true } = {}) {
    this.textSize = size;
    this.applyTextSize(size);
    try {
      localStorage.setItem("ggo-textsize", size);
    } catch (e) {}
    if (save) await this._saveSettings();
  },

  async _saveSettings() {
    if (storage && storage.isSignedIn()) {
      try {
        await storage.saveFile("settings.json", { theme: this.current, textSize: this.textSize });
      } catch (e) {
        // Non-critical — the local copy still applies either way.
      }
    }
  },

  async set(themeId, { save = true } = {}) {
    this.current = themeId;
    this.apply(themeId);
    try {
      localStorage.setItem("ggo-theme", themeId);
    } catch (e) {}

    if (save) await this._saveSettings();
  },
};

// Exposed for the read-only pop-out window (popout.html) — see seating.js.
window.ThemeModule = ThemeModule;
