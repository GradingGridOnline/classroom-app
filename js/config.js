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
    // drive.file, forms.body, and forms.responses.readonly are for the
    // email-collection feature: creating/deleting a real (visible)
    // Google Form and reading its responses. drive.file only grants
    // access to files this app itself creates — never the rest of
    // your Drive.
    // gmail.send is for emailing the printable reports (PDFs) to
    // students: it only lets the app SEND mail as you — it cannot read
    // or delete anything in your mailbox.
    scopes: [
      "https://www.googleapis.com/auth/drive.appdata",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/forms.body",
      "https://www.googleapis.com/auth/forms.responses.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
  },
};
