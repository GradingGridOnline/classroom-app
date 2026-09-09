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
    });
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

  _requestToken({ prompt }) {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        this.accessToken = response.access_token;
        this.tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000 - 60000;
        resolve();
      };
      this.tokenClient.requestAccessToken({ prompt });
    });
  }

  async _getAccessToken() {
    if (this.isSignedIn()) return this.accessToken;
    // Try a silent refresh (no prompt) before falling back to interactive.
    try {
      await this._requestToken({ prompt: "" });
    } catch {
      await this._requestToken({ prompt: "consent" });
    }
    return this.accessToken;
  }

  async _loadUserEmail() {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (response.ok) {
      const info = await response.json();
      this.userEmail = info.email || null;
    }
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
