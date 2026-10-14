/**
 * GoogleDriveProvider — talks to the signed-in user's Google Drive via
 * the Drive API, using Google Identity Services (GIS) for sign-in.
 *
 * Files are stored in Drive's special "appDataFolder" — a hidden folder
 * scoped entirely to this app (requested via the drive.appdata scope),
 * so this app can only ever see the files it creates itself, never the
 * rest of the user's Drive.
 *
 * Implements the StorageProvider contract — see storage-provider.js.
 */
class GoogleDriveProvider extends StorageProvider {
  constructor(config) {
    super();
    this.config = config;
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.userEmail = null;
  }

  async init() {
    await this._waitForGoogleScript();

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.config.google.clientId,
      scope: this.config.google.scopes,
      callback: () => {}, // overridden per-call in _requestToken()
      // Fires when the popup can't open (blocked, common on mobile) or is
      // closed before finishing. Without this the sign-in promise never
      // settles and the page just looks frozen.
      error_callback: (err) => {
        if (this._pendingReject) {
          const msg =
            err && err.type === "popup_failed_to_open"
              ? "popup_blocked"
              : err && err.type === "popup_closed"
              ? "popup_closed"
              : (err && err.type) || "sign_in_error";
          this._pendingReject(new Error(msg));
        }
      },
    });

    // Restore a still-valid token from a previous page load first —
    // access tokens last about an hour, so a plain refresh within that
    // window can reuse it directly instead of asking Google again.
    // This matters because the silent re-auth attempt below relies on
    // Google's own background session check, which some browsers
    // (Safari in particular) block — without this cache, THAT was
    // failing on every single reload and forcing you to pick your
    // account again even though your token hadn't actually expired.
    if (this._restoreSavedToken()) {
      return;
    }

    // Try to restore a session silently (no visible popup) — succeeds
    // if the browser still has an active Google session and you've
    // already granted access before. Fails quietly otherwise (e.g. no
    // session, or the browser blocks silent auth — Safari does this
    // more aggressively than Chrome) and just leaves you signed out,
    // same as today.
    try {
      await this._requestToken({ prompt: "" }, 4000);
      await this._loadUserEmail();
    } catch (e) {
      // No existing session to restore — normal, not an error.
    }
  }

  /** Sets up Google sign-in WITHOUT the silent re-auth attempt — used for the one-time "Import from Google Drive" (and Google Forms / Gmail features), where a button click triggers the sign-in. */
  async initInteractive() {
    if (this.tokenClient) return;
    await this._waitForGoogleScript();
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.config.google.clientId,
      scope: this.config.google.scopes,
      callback: () => {},
      error_callback: (err) => {
        if (this._pendingReject) {
          const msg =
            err && err.type === "popup_failed_to_open" ? "popup_blocked" : err && err.type === "popup_closed" ? "popup_closed" : (err && err.type) || "sign_in_error";
          this._pendingReject(new Error(msg));
        }
      },
    });
    this._restoreSavedToken();
  }

  async signIn() {
    await this._requestToken({ prompt: "consent" });
    await this._loadUserEmail();
  }

  async signOut() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.userEmail = null;
    this._clearSavedToken();
  }

  isSignedIn() {
    return this.accessToken !== null && Date.now() < this.tokenExpiresAt;
  }

  getUserName() {
    return this.userEmail;
  }

  async saveFile(fileName, dataObject) {
    const token = await this._getAccessToken();
    const existingId = await this._findFileId(fileName, token);
    const body = JSON.stringify(dataObject, null, 2);

    if (existingId) {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body,
        }
      );
      if (!response.ok) throw new Error(`Failed to save ${fileName}: ${response.status} ${response.statusText}`);
    } else {
      const metadata = { name: fileName, parents: ["appDataFolder"] };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", new Blob([body], { type: "application/json" }));

      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }
      );
      if (!response.ok) throw new Error(`Failed to save ${fileName}: ${response.status} ${response.statusText}`);
    }

    return true;
  }

  async loadFile(fileName) {
    const token = await this._getAccessToken();
    const fileId = await this._findFileId(fileName, token);
    if (!fileId) return null; // File doesn't exist yet — a normal state, not an error.

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error(`Failed to load ${fileName}: ${response.status} ${response.statusText}`);

    return response.json();
  }

  async listFiles() {
    const token = await this._getAccessToken();
    const url =
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(name)";
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Failed to list files: ${response.status} ${response.statusText}`);

    const data = await response.json();
    return data.files.map((f) => f.name);
  }

  // ---- internal helpers ----

  async _waitForGoogleScript(timeoutMs = 8000) {
    const start = Date.now();
    while (typeof google === "undefined" || !google.accounts) {
      if (Date.now() - start > timeoutMs) {
        throw new Error("Google sign-in script failed to load. Check your internet connection.");
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  _requestToken({ prompt }, timeoutMs = 0) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const done = (fn, v) => {
        if (timer) clearTimeout(timer);
        this._pendingReject = null;
        fn(v);
      };
      this._pendingReject = (e) => done(reject, e);
      if (timeoutMs) timer = setTimeout(() => done(reject, new Error("timeout")), timeoutMs);
      this.tokenClient.callback = (response) => {
        if (response.error) {
          done(reject, new Error(response.error));
          return;
        }
        this.accessToken = response.access_token;
        this.tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000 - 60000;
        this._saveTokenToStorage();
        done(resolve);
      };
      try {
        this.tokenClient.requestAccessToken({ prompt });
      } catch (e) {
        done(reject, e);
      }
    });
  }

  async _getAccessToken() {
    if (this.isSignedIn()) return this.accessToken;
    // Try a silent refresh (no prompt) before falling back to interactive.
    try {
      await this._requestToken({ prompt: "" }, 4000);
    } catch {
      await this._requestToken({ prompt: "consent" }, 120000);
    }
    return this.accessToken;
  }

  /** Public wrapper — other modules (e.g. the email-collection feature) reuse the same authenticated token for Forms/Drive calls beyond plain file save/load. */
  async getAccessToken() {
    return this._getAccessToken();
  }

  async _loadUserEmail() {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (response.ok) {
      const info = await response.json();
      this.userEmail = info.email || null;
      this._saveTokenToStorage();
    }
  }

  /** Caches the access token (and its expiry + the signed-in email) in localStorage, so a page reload within the token's ~1hr lifetime can reuse it instead of re-authenticating. The token only grants access to this app's own Drive scope (see the class comment above), so caching it locally carries the same risk as keeping any other short-lived bearer token in the browser. */
  _saveTokenToStorage() {
    try {
      localStorage.setItem(
        "ggo-auth",
        JSON.stringify({
          accessToken: this.accessToken,
          tokenExpiresAt: this.tokenExpiresAt,
          userEmail: this.userEmail,
        })
      );
    } catch (e) {
      // localStorage unavailable — fine, just falls back to re-authenticating every reload, same as before this cache existed.
    }
  }

  /** Returns true and restores this.accessToken/tokenExpiresAt/userEmail if a still-valid cached token exists; otherwise leaves state untouched and returns false. */
  _restoreSavedToken() {
    try {
      const raw = localStorage.getItem("ggo-auth");
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved.accessToken || !saved.tokenExpiresAt || Date.now() >= saved.tokenExpiresAt) {
        localStorage.removeItem("ggo-auth");
        return false;
      }
      this.accessToken = saved.accessToken;
      this.tokenExpiresAt = saved.tokenExpiresAt;
      this.userEmail = saved.userEmail || null;
      return true;
    } catch (e) {
      return false;
    }
  }

  _clearSavedToken() {
    try {
      localStorage.removeItem("ggo-auth");
    } catch (e) {}
  }

  async _findFileId(fileName, token) {
    const url =
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)` +
      `&q=${encodeURIComponent(`name = '${fileName.replace(/'/g, "\\'")}'`)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Failed to search for ${fileName}: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }
}
