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

## Themes

A settings menu (the ⚙ button, top right) lets you switch between visual
themes:

- **Default** — the original paper/chalkboard look.
- **Cyberpunk** — a dark, neon terminal-style theme (magenta/teal accents,
  angular display type, monospace body text, HUD-style corner brackets,
  a subtle glow on buttons and focused fields).

Your choice is saved instantly to this browser (so it survives a reload
even before signing in) and, once you're signed in, also saved to
`settings.json` in your Google Drive — so the same theme follows you
between your office and home computers.

Adding a third theme later just means adding a new `[data-theme="..."]`
block in `css/style.css` (following the same variables the cyberpunk
theme overrides) and one new entry in the `THEMES` list in `js/theme.js`.

## Seating chart

Each course now has two tabs: **Roster** and **Seating Chart**.

- Grid size is adjustable from 1×1 up to 10×10 (set rows and columns,
  click "Apply Size"). Shrinking the grid only removes seats that fall
  outside the new bounds — those students just become unseated again,
  nothing is deleted from the roster.
- **To seat someone**: click their name in the "Unseated" list on the
  left (it highlights), then click an empty desk.
- **To remove someone**: click their occupied desk — they go back to
  the unseated list.
- **Auto-Fill** seats every remaining unseated student into the empty
  desks, in roster order — handy for a quick starting layout you can
  then adjust by hand.
- **Clear Seating** empties the whole chart (your roster is untouched).
- Like the roster, nothing saves automatically — click **Save Seating
  Chart** to store it in Google Drive, as `seating-<courseId>.json`.

Switching to the Seating Chart tab always reflects your roster's
current state, so if you add or rename students on the Roster tab,
those changes show up immediately in the unseated list and on any
desks they're already seated at.

## Seating chart — locks, groups, pop-out, and memory banks

Building on the basic grid:

- **Lock** 🔒 — appears on any occupied desk. While locked, that desk is
  skipped by both Clear Seating and Auto-Fill. To remove a locked
  student, click the lock icon to unlock first, then click the desk.
- **Group color** — the small badge in a desk's corner cycles through
  8 colors (click repeatedly to step through, wraps back to none).
  Groups belong to the *desk position*, not the student sitting there —
  so they represent your room's physical table layout and survive
  Clear Seating, even on an empty desk.
- **Pop-out** (`Pop Out ↗` button) — opens a second, read-only window
  showing just the grid with student names, ideal for sliding onto a
  projector or second monitor. It reads live from the main window, so
  click its **Refresh** button any time you want it to catch up with
  changes you've made since it opened. Its row order is flipped
  top-to-bottom relative to your editing view, and "Front of Classroom"
  moves to the top — meant to match the room as seen from the student
  side rather than the teacher's side. (Left-right is *not* mirrored —
  only vertical order — let me know if you'd like that added too.)
- **Front of Classroom** label sits at the bottom of your main editing
  grid, representing the teacher's own point of view.
- **Memory banks** — 6 save slots per course, below the grid. Save
  captures the current arrangement (size, seats, locks, groups) into a
  slot; Load replaces your current arrangement with a slot's contents;
  Delete clears a slot. All three write to Google Drive immediately —
  they don't wait for the main "Save Seating Chart" button.

## Seating chart — active desks, Class Numbers, wider layout

Several refinements on top of the seating chart:

- **Wider layout** — the whole app now uses most of the screen width
  instead of a fixed narrow column.
- **Active desks** — every grid cell starts as "no desk." Click an
  empty cell to activate it (creating a usable desk there); click an
  active-but-empty desk again to remove it. If you have a student
  selected when you click an inactive cell, it activates *and* seats
  them in one click. This lets your grid match your room's real
  layout — gaps, aisles, or fewer desks than the max grid size.
- **Group numbers are now a text field** (1-20, up from a 1-8 click
  cycle) — type a number into the small box in a desk's corner.
  Leaving it blank (or 0) clears the color.
- **Desk labels** — the 🏷 button on any active desk opens a prompt
  for a short note (e.g. "do not sit here"). It shows as the desk's
  text when that desk is empty, and survives Clear Seating like group
  colors do.
- **Auto-Fill now only fills active desks** — inactive cells are
  skipped, same as locked ones.
- **Class Number** — every student gets a persistent roll-call number
  (1-100), separate from their university School ID. It's assigned
  automatically (lowest number not in use) when a student is added or
  imported, shown as its own editable column in the roster table and
  in the unseated list, and you can hand-edit it (the app blocks
  duplicates within a course). CSV/Excel import now has an optional
  "Class Number" column mapping too, in case your university's file
  already includes an attendance number — leave it as "(not in this
  file)" to have numbers assigned automatically in file order instead.
- **Memory banks are now nameable** — click "Rename" on any bank to
  give it a name like "Exam Seating" instead of the default "Bank 3."
  A bank's name persists independently of whether anything is saved
  into it yet.

## Seating chart — wider list, Class Numbers on desks, pop-out group toggle

- The **Unseated** list is wider now, with room for Class #, Name,
  Pronunciation, and School ID all at once.
- **Desks** (both the main editor and the pop-out) now show a
  student's Class Number as a small line above their name.
- A new **"Hide/Show Group Colors in Pop-Out"** button in the Seating
  Chart toolbar lets you turn group coloring off in the projected
  pop-out view without affecting the colors in your own editing
  view. It's saved per course, alongside the rest of the chart.

## Header cleanup and bolder group colors

- **Sign Out** moved from the main content area to directly under the
  ⚙ Settings button, top-right.
- The "Signed in as ___" / "Not signed in" label is gone — whether
  you're signed in is now shown by which buttons are visible, not a
  text label. (Error messages during sign-in still show there if
  something goes wrong.)
- The "GradingGridOnline" title is smaller, and the "Courses & class
  rosters" subtitle is gone.
- The course title shown while you're working on its roster/seating
  chart is now noticeably larger than other section headings.
- **Group colors** are bolder and more saturated in both the main
  editor and the pop-out, in both themes.

## Pop-out: name-only again, auto-refreshing

- Class Numbers are no longer shown in the pop-out (still shown in the
  main editor's desks and unseated list) — the pop-out is back to
  name-only, per the original design.
- The pop-out no longer has a manual Refresh button. It now checks
  the main window automatically about once a second and updates
  itself — so any change or toggle you make in the main app appears
  in the pop-out within a second, with nothing to click over there.
