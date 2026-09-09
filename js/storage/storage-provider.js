/**
 * StorageProvider — the contract every cloud backend must implement.
 *
 * This app never talks to OneDrive (or any other cloud service) directly.
 * It only talks to whatever object is assigned to `window.storage`, and
 * that object must implement every method below with these exact
 * signatures.
 *
 * TO MIGRATE TO A DIFFERENT CLOUD PROVIDER LATER:
 *   1. Create a new file in js/storage/, e.g. googledrive-provider.js
 *   2. Implement a class that provides every method below
 *   3. In config.js, change APP_CONFIG.storageProvider to match
 *   4. In index.html, swap the <script> tag that loads onedrive-provider.js
 *      for your new file
 *   Nothing in app.js or any future feature (seating charts, grades,
 *   report cards) needs to change, because they only ever call
 *   window.storage.saveFile(...) / .loadFile(...) / etc.
 */
class StorageProvider {
  /** One-time setup (load SDKs, restore any existing session). */
  async init() {
    throw new Error("init() not implemented");
  }

  /** Prompt the user to sign in. Resolves once signed in. */
  async signIn() {
    throw new Error("signIn() not implemented");
  }

  /** Sign the current user out. */
  async signOut() {
    throw new Error("signOut() not implemented");
  }

  /** Synchronous check: is a user currently signed in? */
  isSignedIn() {
    throw new Error("isSignedIn() not implemented");
  }

  /** Display name of the signed-in user, or null. */
  getUserName() {
    throw new Error("getUserName() not implemented");
  }

  /**
   * Save a JSON-serializable object as a named file in cloud storage.
   * @param {string} fileName e.g. "notes.json"
   * @param {object} dataObject
   */
  async saveFile(fileName, dataObject) {
    throw new Error("saveFile() not implemented");
  }

  /**
   * Load a previously saved file.
   * @param {string} fileName
   * @returns {object|null} the parsed object, or null if it doesn't exist yet
   */
  async loadFile(fileName) {
    throw new Error("loadFile() not implemented");
  }

  /** List file names currently stored by this app. */
  async listFiles() {
    throw new Error("listFiles() not implemented");
  }
}
