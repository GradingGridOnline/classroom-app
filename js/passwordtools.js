// ===== Password tools: Show password, Change password, nicer reset form =====
// Load AFTER app.js. Adds: a "Show" checkbox on the sign-in password box, a "Change password"
// button in Global Settings (when signed in), and replaces the plain pop-up that appears
// after a "Forgot password?" email link with a proper form that has a Show option.
// (Passwords are stored only as a scrambled hash, so an existing password can't be
// displayed — "Show" reveals what you are typing.)

(function () {
  // ---------- "Show" checkbox on the sign-in password box ----------
  const pw = el.loginPassword;
  const showLabel = document.createElement("label");
  showLabel.style.cssText = "display:inline-flex;align-items:center;gap:4px;font-size:0.85em;white-space:nowrap;";
  const showBox = document.createElement("input");
  showBox.type = "checkbox";
  showBox.addEventListener("change", () => { pw.type = showBox.checked ? "text" : "password"; });
  showLabel.append(showBox, document.createTextNode("Show password"));
  pw.insertAdjacentElement("afterend", showLabel);

  // Make "Forgot password?" easier to see and explain what it needs.
  if (el.resetPwBtn) {
    el.resetPwBtn.classList.remove("btn-small");
    el.resetPwBtn.title = "Type your email above, then click this to get a password-reset link by email";
  }

  // ---------- the password dialog ----------
  let dialog = null;
  function closeDialog() {
    if (dialog) dialog.remove();
    dialog = null;
  }
  function openPasswordDialog(title, intro) {
    closeDialog();
    const back = document.createElement("div");
    back.style.cssText = "position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;";
    const card = document.createElement("form");
    card.style.cssText = "background:var(--card);color:inherit;border:2px solid var(--accent, #c2571a);border-radius:10px;padding:20px;max-width:380px;width:100%;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);";
    const h = document.createElement("h3");
    h.textContent = title;
    h.style.margin = "0";
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = intro;
    p.style.margin = "0";
    const mkInput = (ph) => {
      const i = document.createElement("input");
      i.type = "password";
      i.placeholder = ph;
      i.minLength = 8;
      i.required = true;
      i.autocomplete = "new-password";
      return i;
    };
    const a = mkInput("New password (8+ characters)");
    const b = mkInput("Type it again");
    const showWrap = document.createElement("label");
    showWrap.style.cssText = "display:flex;align-items:center;gap:6px;font-size:0.9em;";
    const sb = document.createElement("input");
    sb.type = "checkbox";
    sb.addEventListener("change", () => { a.type = b.type = sb.checked ? "text" : "password"; });
    showWrap.append(sb, document.createTextNode("Show password"));
    const msg = document.createElement("p");
    msg.className = "result";
    msg.style.margin = "0";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", closeDialog);
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-primary";
    save.textContent = "Save new password";
    row.append(cancel, save);
    card.append(h, p, a, b, showWrap, msg, row);
    card.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (a.value.length < 8) { msg.textContent = "Password must be at least 8 characters."; return; }
      if (a.value !== b.value) { msg.textContent = "The two passwords don't match."; return; }
      save.disabled = true;
      msg.textContent = "Saving…";
      try {
        await storage.updatePassword(a.value);
        closeDialog();
        el.status.textContent = "Password changed ✓";
        alert("Password changed ✓");
      } catch (err) {
        save.disabled = false;
        msg.textContent = `Couldn't change it: ${err.message}`;
      }
    });
    back.appendChild(card);
    document.body.appendChild(back);
    dialog = back;
    a.focus();
  }

  // After clicking the link in a reset email, show the form instead of a plain pop-up.
  window.onPasswordRecovery = () => openPasswordDialog("Choose a new password", "You came from a password-reset email. Pick a new password for your account.");

  // ---------- "Change password" button in Global Settings ----------
  const changeBtn = document.createElement("button");
  changeBtn.type = "button";
  changeBtn.className = "btn btn-ghost btn-small";
  changeBtn.textContent = "Change password";
  changeBtn.addEventListener("click", () => openPasswordDialog("Change password", "Choose a new password for your account."));
  el.signOutBtn.insertAdjacentElement("beforebegin", changeBtn);
  const sync = () => { changeBtn.hidden = el.signOutBtn.hidden; };
  const origUpdate = window.updateAuthUI;
  window.updateAuthUI = function () {
    const r = origUpdate.apply(this, arguments);
    sync();
    return r;
  };
  sync();
})();
