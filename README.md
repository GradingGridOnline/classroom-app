# Classroom Manager — Foundation (Google Drive version)

This is the login + save/load foundation. It doesn't have seating charts,
grades, or report cards yet — it's a minimal app that proves the Google
Drive connection works, so future features can be built on solid ground.

## 1. Set up a Google Cloud project (~5 minutes, free)

1. Go to https://console.cloud.google.com and sign in with any personal
   Google account (gmail.com or otherwise — does not need to be a
   university account).
2. Click the project dropdown at the top → **New Project**. Name it
   "Classroom Manager" → **Create**. Make sure it's selected once created.
3. In the search bar, type **"Google Drive API"**, open it, and click
   **Enable**.
4. In the left sidebar, go to **APIs & Services → OAuth consent screen**.
   - User type: **External**
   - Fill in the app name ("Classroom Manager"), your email as support
     contact and developer contact, then **Save and Continue** through
     the remaining screens (Scopes and Test users can be left as-is for
     now).
   - On the **Test users** step, add your own Google account's email —
     while the app is in "testing" status, only accounts you list here
     can sign in, which is fine since it's just for you.
5. Go to **APIs & Services → Credentials → + Create Credentials → OAuth
   client ID**.
   - Application type: **Web application**
   - Name it anything
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:5500`
     - (you'll add your GitHub Pages URL here too, once you have it — see step 4)
   - Click **Create**
6. Copy the **Client ID** shown (ends in `.apps.googleusercontent.com`).
7. Open `js/config.js` in this project and paste it in place of
   `PASTE-YOUR-GOOGLE-CLIENT-ID-HERE.apps.googleusercontent.com`.

No client secret is needed — this app signs in entirely from the
browser using a secure flow that doesn't require one.

## 2. What permission does it ask for?

Two scopes: **drive.appdata**, which means the app can only read or
write inside its own hidden, dedicated folder in your Google Drive —
never anything else in your Drive — and **userinfo.email**, just so the
app can show you which account is signed in.

## 3. Run it locally to test

Google's sign-in flow needs a real `http://` address, not a double-clicked
file, so run a quick local server from this folder:

- **Mac Terminal**: `python3 -m http.server 5500`, then open
  `http://localhost:5500/` in your browser.
- **VS Code**: install the "Live Server" extension, right-click
  `index.html` → "Open with Live Server" (runs on port 5500 by default).

Try it: sign in, type something in the test box, click **Save to Google
Drive**, refresh the page, sign in again, click **Load from Google
Drive** — your text should come back.

## 4. Deploy it so you can use it in class

**GitHub Pages** (free):
1. Create a new GitHub repository named `classroom-app`.
2. Upload all the files in this folder to it.
3. In the repo, go to **Settings → Pages**, set the source to the
   `main` branch, root folder.
4. GitHub gives you a URL like `https://yourusername.github.io/classroom-app/`.
5. Back in Google Cloud Console (Credentials → your OAuth client), add
   that URL (without a trailing path, just the origin, e.g.
   `https://yourusername.github.io`) to **Authorized JavaScript origins**.

From then on, open that URL on either your office or home Mac and sign
in with the same Google account — your data follows you automatically.

## 5. Migrating to a different cloud storage service later

Every feature in this app only ever calls methods on `window.storage`
(`signIn()`, `saveFile()`, `loadFile()`, etc.) — never anything
Google-specific directly. The full contract is documented in
`js/storage/storage-provider.js`.

To migrate again later:
1. Create a new file, e.g. `js/storage/dropbox-provider.js`, with a
   class implementing every method in that contract.
2. In `js/config.js`, change `storageProvider` to match.
3. In `index.html`, swap the `<script>` tag loading
   `googledrive-provider.js` for your new file.

Nothing else changes — seating charts, gradebooks, and report cards
built on top of this foundation will keep working unmodified.

## Next steps

Once you've confirmed sign-in and save/load both work for you, the next
phase is building the first real feature (seating charts are a natural
starting point) on top of this foundation.

## Courses & roster feature

This adds course management and per-course student rosters on top of the
foundation.

- **Courses**: up to 20, each just a name. Stored as `courses.json`.
- **Roster**: up to 100 students per course (name, school ID,
  pronunciation). Stored as `roster-<courseId>.json`, one file per course.
- **CSV/Excel upload**: click "Upload CSV / Excel" inside a course's
  roster view, pick a `.csv`, `.xlsx`, or `.xls` file. The app shows you
  its columns and asks you to confirm which one is the name, school ID,
  and pronunciation — it makes a best-effort guess first, but always
  double-check before importing. Importing **replaces** the current
  roster for that course, so re-upload a corrected file any time your
  university sends an updated list.
- Students can also be added/edited/removed by hand directly in the
  table — useful for quick corrections without re-uploading a file.
- Nothing saves automatically — click **Save Roster** (or the course
  list saves itself automatically when you add/rename/delete a course)
  to actually write to Google Drive.

No new setup steps are needed — this uses the same Google Drive
connection from the foundation build.

### Next feature

The seating chart grid itself (up to 10×10 desks, arranging students
from the roster into seats) is the next thing to build on top of this.
