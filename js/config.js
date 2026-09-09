// ===== Classroom Manager Configuration =====
// Fill in your Google Client ID after completing the Google Cloud Console
// setup steps in README.md.

const APP_CONFIG = {
  // Which storage backend is active. This is here so a future migration
  // is a one-line change — see js/storage/storage-provider.js for how
  // to add a new backend.
  storageProvider: "googledrive",

  google: {
    clientId: "215852917712-bi50bgf8oikhvbmlsshktkbit72iep1n.apps.googleusercontent.com",

    // drive.appdata scopes the app to its own hidden folder in Drive —
    // it can never see or touch the rest of the user's Drive.
    // userinfo.email lets the app show whose account is signed in.
    scopes:
      "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email",
  },
};
