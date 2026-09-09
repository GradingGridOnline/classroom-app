// ===== App wiring =====
// Note: everything here calls `storage.<method>()` and never anything
// OneDrive-specific directly. That's what makes the provider swappable.

let storage = null;

const el = {
  signInBtn: document.getElementById("sign-in-btn"),
  signOutBtn: document.getElementById("sign-out-btn"),
  status: document.getElementById("auth-status"),
  testSection: document.getElementById("test-section"),
  notesInput: document.getElementById("notes-input"),
  saveBtn: document.getElementById("save-btn"),
  loadBtn: document.getElementById("load-btn"),
  testResult: document.getElementById("test-result"),
};

async function main() {
  if (APP_CONFIG.storageProvider === "onedrive") {
    storage = new OneDriveProvider(APP_CONFIG);
  } else if (APP_CONFIG.storageProvider === "googledrive") {
    storage = new GoogleDriveProvider(APP_CONFIG);
  } else {
    throw new Error(`Unknown storage provider: ${APP_CONFIG.storageProvider}`);
  }

  await storage.init();
  render();
}

function render() {
  const signedIn = storage.isSignedIn();
  el.signInBtn.hidden = signedIn;
  el.signOutBtn.hidden = !signedIn;
  el.testSection.hidden = !signedIn;
  el.status.textContent = signedIn
    ? `Signed in as ${storage.getUserName()}`
    : "Not signed in";
}

el.signInBtn.addEventListener("click", async () => {
  el.status.textContent = "Signing in…";
  try {
    await storage.signIn();
    render();
  } catch (err) {
    el.status.textContent = `Sign-in failed: ${err.message}`;
  }
});

el.signOutBtn.addEventListener("click", async () => {
  await storage.signOut();
  render();
});

el.saveBtn.addEventListener("click", async () => {
  el.testResult.textContent = "Saving…";
  try {
    await storage.saveFile("foundation-test.json", {
      notes: el.notesInput.value,
      savedAt: new Date().toISOString(),
    });
    el.testResult.textContent = "Saved to Google Drive ✓";
  } catch (err) {
    el.testResult.textContent = `Save failed: ${err.message}`;
  }
});

el.loadBtn.addEventListener("click", async () => {
  el.testResult.textContent = "Loading…";
  try {
    const data = await storage.loadFile("foundation-test.json");
    if (data === null) {
      el.testResult.textContent = "No saved file yet — try Save first.";
    } else {
      el.notesInput.value = data.notes;
      el.testResult.textContent = `Loaded ✓ (last saved ${new Date(data.savedAt).toLocaleString()})`;
    }
  } catch (err) {
    el.testResult.textContent = `Load failed: ${err.message}`;
  }
});

main();
