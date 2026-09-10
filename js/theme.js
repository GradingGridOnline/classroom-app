// ===== Theme module =====
// Themes are just a data-theme attribute on <html>, matched by CSS
// variable overrides in style.css. Preference is stored locally
// (instant, avoids a flash on reload) and in Google Drive (so it
// follows you between computers, once signed in).

const THEMES = [
  { id: "default", label: "Default" },
  { id: "cyberpunk", label: "Cyberpunk" },
];

const ThemeModule = {
  current: "default",

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
  },

  /** Called once signed in — reconciles with the copy saved in Drive. */
  async syncFromDrive() {
    try {
      const data = await storage.loadFile("settings.json");
      if (data && data.theme && THEMES.some((t) => t.id === data.theme)) {
        this.set(data.theme, { save: false });
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

  async set(themeId, { save = true } = {}) {
    this.current = themeId;
    this.apply(themeId);
    try {
      localStorage.setItem("ggo-theme", themeId);
    } catch (e) {}

    if (save && storage && storage.isSignedIn()) {
      try {
        await storage.saveFile("settings.json", { theme: themeId });
      } catch (e) {
        // Non-critical — the local copy still applies either way.
      }
    }
  },
};

// Exposed for the read-only pop-out window (popout.html) — see seating.js.
window.ThemeModule = ThemeModule;
