// ===== Journal module (screen) =====
// Tab "Journal" (after Report Card). Layout follows the module convention: Main button top-left, Save top-right,
// the entries, then collapsible Sections: Counts & Timeline, Search & Report, and Journal Settings (last).
// Load AFTER app.js and layout.js.
(function () {
  const J = JournalModule;
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const btn = (label, cls, fn) => { const b = mk("button", cls || "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", fn); return b; };
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;

  const tabBtn = mk("button", "tab-btn", "Journal"); tabBtn.id = "tab-journal-btn";
  reportBtn.after(tabBtn);
  const panel = mk("div", "tab-panel"); panel.id = "journal-panel"; panel.hidden = true;
  reportPanel.after(panel);

  const css = mk("style");
  css.textContent = `
:is(#journal-panel, #journal-modal) .jr-form { border:1px solid var(--line,#ccc); border-radius:8px; padding:10px; margin:0 0 12px; display:grid; gap:8px; }
:is(#journal-panel, #journal-modal) .jr-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
:is(#journal-panel, #journal-modal) textarea { width:100%; min-height:90px; font:inherit; padding:6px; box-sizing:border-box; }
:is(#journal-panel, #journal-modal) .jr-chip { display:inline-block; border:1px solid var(--line,#ccc); border-radius:999px; padding:1px 9px; margin:2px 3px 2px 0; font-size:.8rem; cursor:pointer; background:transparent; color:inherit; }
:is(#journal-panel, #journal-modal) .jr-chip { border-color:currentColor; }
:is(#journal-panel, #journal-modal) .jr-chip.on { background:var(--ink,#222); color:var(--card,#fff); border-color:var(--ink,#222); }
:is(#journal-panel, #journal-modal) .jr-chip.on.static { background:transparent; color:inherit; border-color:currentColor; }
:is(#journal-panel, #journal-modal) .jr-chip.static { cursor:default; }
:is(#journal-panel, #journal-modal) .jr-entry { border:1px solid var(--line,#ccc); border-radius:8px; padding:8px 10px; margin:0 0 8px; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-meta { font-size:.82rem; opacity:.85; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-text { white-space:pre-wrap; margin:4px 0; display:-webkit-box; -webkit-line-clamp:3; line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-text.full { display:block; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-subject { font-weight:700; font-size:1rem; }
:is(#journal-panel, #journal-modal) .jr-entry details summary { cursor:pointer; font-size:.85rem; }
:is(#journal-panel, #journal-modal) .jr-chip.tagbtn { cursor:pointer; }
:is(#journal-panel, #journal-modal) .jr-bar.click { cursor:pointer; }
:is(#journal-panel, #journal-modal) .jr-filterbar { margin:0 0 8px; }
:is(#journal-panel, #journal-modal) .jr-sf { margin:6px 0 14px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:var(--card); color:var(--ink); }
:is(#journal-panel, #journal-modal) .jr-sf-top { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; justify-content:space-between; margin-bottom:8px; }
:is(#journal-panel, #journal-modal) .jr-sf-top b { font-family:var(--font-heading); }
:is(#journal-panel, #journal-modal) .jr-sf-grid { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:flex-end; }
:is(#journal-panel, #journal-modal) .jr-sf-grid label { display:flex; flex-direction:column; font-size:.78rem; gap:2px; }
:is(#journal-panel, #journal-modal) .jr-sf-tags { display:flex; flex-wrap:wrap; gap:5px; align-items:center; margin-top:8px; font-size:.82rem; }
:is(#journal-panel, #journal-modal) .jr-snap { font-size:.8rem; opacity:.8; border-top:1px dashed var(--line,#ccc); margin-top:4px; padding-top:3px; }
:is(#journal-panel, #journal-modal) .jr-pick { position:relative; }
:is(#journal-panel, #journal-modal) .jr-pick-list { max-height:220px; overflow:auto; border:1px solid var(--line,#ccc); border-radius:6px; padding:4px 8px; margin-top:4px; }
:is(#journal-panel, #journal-modal) .jr-pick-list label { display:block; font-size:.88rem; }
:is(#journal-panel, #journal-modal) .jr-bar { display:flex; align-items:center; gap:6px; font-size:.85rem; margin:2px 0; }
:is(#journal-panel, #journal-modal) .jr-bar i { display:inline-block; height:12px; background:var(--green,#3d5a40); border-radius:3px; min-width:2px; }
:is(#journal-panel, #journal-modal) .jr-two { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
:is(#journal-panel, #journal-modal) table.jr-table { border-collapse:collapse; font-size:.85rem; width:100%; }
:is(#journal-panel, #journal-modal) table.jr-table th, :is(#journal-panel, #journal-modal) table.jr-table td { border:1px solid var(--line,#ccc); padding:2px 6px; text-align:left; vertical-align:top; }
:is(#journal-panel, #journal-modal) .jr-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin:0 0 8px; }
:is(#journal-panel, #journal-modal) .jr-filters label { display:flex; flex-direction:column; font-size:.78rem; gap:1px; }

/* ----- the book ----- */
:is(#journal-panel, #journal-modal) .jr-bookwrap { margin:0 0 16px; }
:is(#journal-panel, #journal-modal) .jr-bookrow { display:flex; align-items:stretch; gap:8px; }
:is(#journal-panel, #journal-modal) .jr-turn { flex:0 0 38px; font-size:2rem; line-height:1; cursor:pointer; border:1px solid var(--line,#ccc); border-radius:var(--radius,8px); background:var(--card,#fff); color:var(--green-dark,#333); }
:is(#journal-panel, #journal-modal) .jr-turn:disabled { opacity:.3; cursor:default; }
:is(#journal-panel, #journal-modal) .jr-book { --jr-ms:260ms; flex:1; min-width:0; display:grid; grid-template-columns:1fr 14px 1fr; perspective:1600px; position:relative;
  border:6px solid var(--jr-cover,#5a6f5d); border-radius:10px; background:var(--jr-cover,#5a6f5d); box-shadow:0 4px 14px rgba(0,0,0,.25); }
:is(#journal-panel, #journal-modal) .jr-page { background:var(--jr-page,#fffdf6); color:var(--ink,#222); padding:12px 14px 26px; min-height:320px; position:relative; min-width:0; }
:is(#journal-panel, #journal-modal) .jr-page-left { border-radius:5px 0 0 5px; transform-origin:right center; box-shadow:inset -22px 0 22px -22px rgba(0,0,0,.35); }
:is(#journal-panel, #journal-modal) .jr-page-right { border-radius:0 5px 5px 0; transform-origin:left center; box-shadow:inset 22px 0 22px -22px rgba(0,0,0,.35); }
:is(#journal-panel, #journal-modal) .jr-spine { background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(0,0,0,.05) 50%,rgba(0,0,0,.28)), var(--jr-page,#fffdf6); }
:is(#journal-panel, #journal-modal) .jr-pageno { position:absolute; bottom:6px; left:0; right:0; text-align:center; font-size:.8rem; opacity:.6; }
:is(#journal-panel, #journal-modal) .jr-bookinfo { text-align:center; font-size:.82rem; opacity:.75; margin-top:4px; }
:is(#journal-panel, #journal-modal) .jr-book .jr-entry { border:0; border-bottom:1px dashed var(--line,#ccc); border-radius:0; padding:6px 2px; margin:0 0 6px; background:transparent; }
:is(#journal-panel, #journal-modal) .jr-book .jr-form { background:transparent; }
@media (max-width:760px) { :is(#journal-panel, #journal-modal) .jr-book { grid-template-columns:1fr; } :is(#journal-panel, #journal-modal) .jr-spine { display:none; } :is(#journal-panel, #journal-modal) .jr-turn { flex-basis:30px; } }

/* page-turn animations (each theme picks its own style) */
@keyframes jr-flip-out-next { to { transform:rotateY(-88deg); filter:brightness(.8); } }
@keyframes jr-flip-in-next  { from { transform:rotateY(88deg); filter:brightness(.8); } }
@keyframes jr-flip-out-prev { to { transform:rotateY(88deg); filter:brightness(.8); } }
@keyframes jr-flip-in-prev  { from { transform:rotateY(-88deg); filter:brightness(.8); } }
@keyframes jr-fade-out { to { opacity:0; transform:translateX(-10px); } }
@keyframes jr-fade-in  { from { opacity:0; transform:translateX(10px); } }
@keyframes jr-glitch-out { 0% { opacity:1; } 30% { transform:translateX(-6px) skewX(-6deg); filter:hue-rotate(60deg); } 60% { transform:translateX(5px) skewX(5deg); opacity:.5; } 100% { opacity:0; transform:translateX(-10px); clip-path:inset(0 0 60% 0); } }
@keyframes jr-glitch-in  { 0% { opacity:0; clip-path:inset(60% 0 0 0); transform:translateX(10px); } 40% { opacity:.6; transform:translateX(-5px) skewX(5deg); filter:hue-rotate(-60deg); } 100% { opacity:1; clip-path:inset(0); } }
@keyframes jr-wipe-out { to { clip-path:inset(0 0 0 100%); filter:drop-shadow(0 0 6px #00d9ff); } }
@keyframes jr-wipe-in  { from { clip-path:inset(0 100% 0 0); filter:drop-shadow(0 0 6px #00d9ff); } }
/* left page turns for "prev", right page for "next" */
:is(#journal-panel, #journal-modal) .jr-book.jr-out-next .jr-page-right { animation:var(--jr-out-next,jr-flip-out-next) var(--jr-ms) ease-in forwards; }
:is(#journal-panel, #journal-modal) .jr-book.jr-in-next  .jr-page-left  { animation:var(--jr-in-next,jr-flip-in-next) var(--jr-ms) ease-out; }
:is(#journal-panel, #journal-modal) .jr-book.jr-out-prev .jr-page-left  { animation:var(--jr-out-prev,jr-flip-out-prev) var(--jr-ms) ease-in forwards; }
:is(#journal-panel, #journal-modal) .jr-book.jr-in-prev  .jr-page-right { animation:var(--jr-in-prev,jr-flip-in-prev) var(--jr-ms) ease-out; }

/* theme looks */
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#7a5238; --jr-page:#f3e5c4; --jr-ms:340ms; border-radius:6px; box-shadow:0 5px 0 #5c3d29, 0 10px 18px rgba(0,0,0,.35); }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-page { background:linear-gradient(180deg,#f6ebcf,#eddcb6); outline:1px solid rgba(122,82,56,.45); outline-offset:-7px; font-family:var(--font-body); }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-turn { background:#7a5238; color:#f3e5c4; border-color:#5c3d29; }
[data-theme="dark"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#5b5651; --jr-page:#2b2927; }
[data-theme="cyberpunk"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#0073e6; --jr-page:#ffffff; --jr-ms:300ms; --jr-out-next:jr-glitch-out; --jr-in-next:jr-glitch-in; --jr-out-prev:jr-glitch-out; --jr-in-prev:jr-glitch-in; border-width:2px; border-radius:2px; box-shadow:0 0 14px rgba(0,190,255,.55); }
[data-theme="cyberpunk"] :is(#journal-panel, #journal-modal) .jr-page { border-radius:0; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#00d9ff; --jr-page:#0c1a22; --jr-ms:320ms; --jr-out-next:jr-wipe-out; --jr-in-next:jr-wipe-in; --jr-out-prev:jr-wipe-out; --jr-in-prev:jr-wipe-in; border-width:1px; border-radius:0; box-shadow:0 0 18px rgba(0,217,255,.5); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-page { border-radius:0; box-shadow:none; }
[data-theme="basic"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#6b7d8f; --jr-page:#ffffff; --jr-ms:220ms; --jr-out-next:jr-fade-out; --jr-in-next:jr-fade-in; --jr-out-prev:jr-fade-out; --jr-in-prev:jr-fade-in; border-width:2px; border-radius:2px; box-shadow:none; }

/* ----- one entry per page: big title, text, then a thin rule and the date / tags / actions ----- */
:is(#journal-panel, #journal-modal) .jr-page { height:clamp(430px, 70vh, 680px); min-height:0; display:flex; flex-direction:column; overflow:hidden; }
:is(#journal-panel, #journal-modal) .jr-page > .jr-form { overflow:auto; max-height:100%; margin:0; }
:is(#journal-panel, #journal-modal) .jr-leaf { flex:1; min-height:0; display:flex; flex-direction:column; padding-bottom:14px; }
:is(#journal-panel, #journal-modal) .jr-title { font-family:var(--font-heading); font-size:1.75rem; line-height:1.15; margin:0 0 10px; font-weight:700; overflow-wrap:anywhere; }
:is(#journal-panel, #journal-modal) .jr-body { flex:1 1 0; min-height:0; overflow:auto; line-height:1.55; white-space:pre-wrap; padding-right:4px; }
:is(#journal-panel, #journal-modal) .jr-foot { flex:none; border-top:1px solid var(--jr-rule, var(--line,#999)); margin-top:8px; padding-top:6px; font-size:.8rem; display:grid; gap:3px; }
:is(#journal-panel, #journal-modal) .jr-foot-meta { display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; }
:is(#journal-panel, #journal-modal) .jr-foot .jr-who { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:.85; }
:is(#journal-panel, #journal-modal) .jr-foot .jr-chip { font-size:.72rem; padding:0 8px; margin:0 3px 0 0; }
:is(#journal-panel, #journal-modal) .jr-foot .jr-snap { border-top:0; margin:0; padding:0; font-size:.72rem; }
:is(#journal-panel, #journal-modal) .jr-foot-actions { display:flex; flex-wrap:wrap; gap:4px; margin-top:2px; }
:is(#journal-panel, #journal-modal) .jr-foot-actions .btn, :is(#journal-panel, #journal-modal) .jr-foot-actions .jr-pinpill { font-size:.7rem; padding:1px 8px; margin:0; }
:is(#journal-panel, #journal-modal) .jr-leaf.jr-isdone .jr-title { text-decoration:line-through; opacity:.7; }
:is(#journal-panel, #journal-modal) .jr-blank { margin:auto; text-align:center; font-style:italic; opacity:.6; max-width:80%; line-height:1.5; }
:is(#journal-panel, #journal-modal) .jr-stage-head, :is(#journal-panel, #journal-modal) .jr-stage-foot { display:none; }
@media (max-width:760px) { :is(#journal-panel, #journal-modal) .jr-page { height:auto; min-height:360px; } }

/* writing a new entry (or editing one) happens on the page itself */
:is(#journal-panel, #journal-modal) .jr-leafform { display:flex; flex-direction:column; gap:8px; border:0; padding:0; background:transparent; }
:is(#journal-panel, #journal-modal) .jr-page > .jr-leafform { height:100%; padding-bottom:14px; box-sizing:border-box; }
:is(#journal-panel, #journal-modal) .jr-leafform .jr-subject { flex:none; font-family:var(--font-heading); font-size:1.6rem; font-weight:700; line-height:1.2; color:inherit; background:transparent; border:0; border-bottom:1px dashed var(--jr-rule, var(--line,#999)); border-radius:0; padding:2px 0 6px; width:100%; box-sizing:border-box; box-shadow:none; }
:is(#journal-panel, #journal-modal) .jr-leafform .jr-ed { flex:1 1 0; min-height:120px; display:flex; flex-direction:column; }
:is(#journal-panel, #journal-modal) .jr-page .jr-leafform .jr-ed [contenteditable] { flex:1; min-height:0 !important; overflow:auto; }
:is(#journal-panel, #journal-modal) .jr-leafform .jr-formfoot { flex:none; border-top:1px solid var(--jr-rule, var(--line,#999)); padding-top:6px; display:grid; gap:6px; font-size:.82rem; max-height:55%; overflow:auto; }

/* VINTAGE: an old leather-bound journal lying open on the desk */
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-bookwrap { margin:8px 6px 26px; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-book { --jr-rule:rgba(70,45,20,.6); --jr-cover:#5a3822; border:18px solid #5a3822; border-radius:12px; background:#5a3822;
  box-shadow:0 0 0 2px #2f1a0e, inset 0 0 0 2px #8c5d38, 0 16px 22px -4px rgba(0,0,0,.6), 0 30px 34px -12px rgba(0,0,0,.55); }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-book::before { content:""; position:absolute; inset:-11px; border:2px dashed rgba(226,190,120,.55); border-radius:7px; pointer-events:none; z-index:2; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-book::after { content:""; position:absolute; left:calc(50% - 7px); bottom:-38px; width:14px; height:40px; background:linear-gradient(90deg,#7a2323,#a33a3a 50%,#7a2323); clip-path:polygon(0 0,100% 0,100% 100%,50% 82%,0 100%); filter:drop-shadow(0 3px 2px rgba(0,0,0,.5)); z-index:3; pointer-events:none; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-page { background:radial-gradient(ellipse at 50% 35%, #f7ecd0 0%, #efdfb8 62%, #e1ca98 100%); color:#33200f; outline:none; padding:26px 28px 34px; font-family:var(--font-body); }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-page-left { border-radius:5px 0 0 5px; box-shadow:inset -38px 0 30px -26px rgba(70,40,10,.6), inset 0 0 40px rgba(120,80,30,.22), -2px 0 0 #ecdfb8, -4px 0 0 #b39a66, -6px 0 0 #ecdfb8, -8px 0 0 #b39a66, -10px 0 0 #e8d8ac; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-page-right { border-radius:0 5px 5px 0; box-shadow:inset 38px 0 30px -26px rgba(70,40,10,.6), inset 0 0 40px rgba(120,80,30,.22), 2px 0 0 #ecdfb8, 4px 0 0 #b39a66, 6px 0 0 #ecdfb8, 8px 0 0 #b39a66, 10px 0 0 #e8d8ac; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-spine { background:linear-gradient(90deg,rgba(60,35,10,.6),rgba(60,35,10,.1) 38%,rgba(60,35,10,.1) 62%,rgba(60,35,10,.6)), #dcc999; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-title { color:#3a2110; font-weight:900; font-size:2rem; letter-spacing:.01em; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-body { color:#2d1c0e; font-size:1.02rem; line-height:28px; background-image:repeating-linear-gradient(to bottom, transparent 0 27px, rgba(110,75,35,.2) 27px 28px); background-attachment:local; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-foot { color:#5a4430; font-style:italic; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-leafform { color:#2d1c0e; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-leafform .jr-subject { color:#3a2110; font-weight:900; font-size:1.9rem; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-leafform .jr-formfoot { color:#5a4430; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-foot .jr-chip { border-color:#8a6a46; background:rgba(120,80,40,.1); color:#4a3320; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-pageno { color:#6b5236; opacity:.8; font-style:italic; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-bookinfo { color:#e8d8ac; opacity:.9; margin-top:30px; }

/* TRON: LEGACY: a data pad — a dark glass slab with a lit frame, two screens with readout strips,
   a segmented hinge, slim chevron tabs and HUD-style tags. Same functions as every other theme. */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-bookwrap {
  --c:#00d9ff; --k:20px; position:relative; margin:14px 4px 24px; padding:14px 18px 12px;
  border:1px solid rgba(0,217,255,.55);
  background:
    linear-gradient(var(--c),var(--c)) left top / var(--k) 2px, linear-gradient(var(--c),var(--c)) left top / 2px var(--k),
    linear-gradient(var(--c),var(--c)) right top / var(--k) 2px, linear-gradient(var(--c),var(--c)) right top / 2px var(--k),
    linear-gradient(var(--c),var(--c)) left bottom / var(--k) 2px, linear-gradient(var(--c),var(--c)) left bottom / 2px var(--k),
    linear-gradient(var(--c),var(--c)) right bottom / var(--k) 2px, linear-gradient(var(--c),var(--c)) right bottom / 2px var(--k),
    radial-gradient(120% 80% at 50% 0%, rgba(0,217,255,.10), transparent 60%),
    #040a0e;
  background-repeat:no-repeat; background-origin:border-box;
  box-shadow:0 0 0 5px #040a0e, 0 0 0 6px rgba(0,217,255,.25), 0 0 34px rgba(0,217,255,.22), inset 0 0 40px rgba(0,217,255,.06);
}
/* grip ticks on the slab's left and right edges */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-bookwrap::before, [data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-bookwrap::after {
  content:""; position:absolute; top:50%; width:4px; height:64px; margin-top:-32px; pointer-events:none;
  background:repeating-linear-gradient(to bottom, rgba(0,217,255,.75) 0 6px, transparent 6px 10px);
}
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-bookwrap::before { left:-3px; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-bookwrap::after { right:-3px; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-head, [data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-foot { display:flex; justify-content:space-between; align-items:center; gap:12px; font-family:var(--font-heading); font-size:.6rem; letter-spacing:.24em; text-transform:uppercase; color:#7fe9ff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-head { border-bottom:1px solid rgba(0,217,255,.3); padding-bottom:6px; margin-bottom:12px; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-head > span:first-child::before { content:""; display:inline-block; width:8px; height:8px; margin-right:9px; background:var(--marker,#ff7a1a); box-shadow:0 0 8px var(--marker,#ff7a1a); vertical-align:0; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-head > span:last-child { font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.8rem; letter-spacing:.08em; color:#e8fdff; text-shadow:0 0 6px rgba(0,217,255,.7); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-foot { border-top:1px solid rgba(0,217,255,.3); padding-top:6px; margin-top:12px; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-foot .jr-sf-bars i { display:inline-block; width:26px; height:5px; margin-left:5px; background:rgba(0,217,255,.25); border:0; border-radius:0; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-foot .jr-sf-bars i:first-child { background:#00d9ff; box-shadow:0 0 8px #00d9ff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-stage-foot > span:last-child { font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.75rem; letter-spacing:.08em; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-book { --jr-rule:rgba(0,217,255,.55); border:0; background:transparent; box-shadow:none; gap:0; grid-template-columns:1fr 18px 1fr; }
/* the hinge between the two screens: a segmented light */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-spine { background:repeating-linear-gradient(to bottom, rgba(0,217,255,.55) 0 14px, transparent 14px 22px) center / 2px 100% no-repeat; box-shadow:none; }
/* each page is a screen: dark glass, thin frame, corner brackets, a readout strip on top */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-page {
  --c:rgba(0,217,255,.95); --k:12px;
  border:1px solid rgba(0,217,255,.35); border-radius:0; color:#c9f6ff; padding:40px 22px 30px; font-family:var(--font-body);
  background:
    linear-gradient(var(--c),var(--c)) left top / var(--k) 2px, linear-gradient(var(--c),var(--c)) left top / 2px var(--k),
    linear-gradient(var(--c),var(--c)) right bottom / var(--k) 2px, linear-gradient(var(--c),var(--c)) right bottom / 2px var(--k),
    repeating-linear-gradient(to bottom, rgba(0,217,255,.03) 0 1px, transparent 1px 3px),
    linear-gradient(to bottom, rgba(0,217,255,.07), transparent 120px),
    #061017;
  background-repeat:no-repeat, no-repeat, no-repeat, no-repeat, repeat, no-repeat, no-repeat; background-origin:border-box;
  box-shadow:0 0 16px rgba(0,217,255,.16), inset 0 0 30px rgba(0,217,255,.06);
}
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-page::before { content:"DATA LOG"; position:absolute; top:10px; left:16px; right:16px; height:16px; font-family:var(--font-heading); font-size:.56rem; letter-spacing:.26em; color:#4fe0ff; border-bottom:1px solid rgba(0,217,255,.28); }
/* status lights, bottom-left */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-page::after { content:""; position:absolute; left:16px; bottom:10px; width:34px; height:5px; background:linear-gradient(90deg, #00d9ff 0 8px, transparent 8px 13px, rgba(0,217,255,.45) 13px 21px, transparent 21px 26px, rgba(0,217,255,.2) 26px 34px); }
/* page number moves into the readout strip: "PG 03" */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-pageno { top:9px; bottom:auto; left:auto; right:16px; text-align:right; font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.78rem; letter-spacing:.08em; color:#e8fdff; opacity:1; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-pageno::before { content:"PG "; color:#4fe0ff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-title { font-family:var(--font-heading); font-size:1.15rem; line-height:1.35; color:#eaffff; letter-spacing:.08em; text-transform:uppercase; text-shadow:0 0 10px rgba(0,217,255,.55); padding-left:12px; border-left:3px solid #00d9ff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-body { color:#bff3ff; padding-left:12px; border-left:1px solid rgba(0,217,255,.22); background-image:repeating-linear-gradient(to bottom, transparent 0 3px, rgba(0,217,255,.03) 3px 4px); background-attachment:local; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot { color:#7fe9ff; letter-spacing:.04em; border-top-color:rgba(0,217,255,.5); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot .jr-date { background:#f2d33c; color:#06121a; font-family:"Share Tech Mono",ui-monospace,monospace; font-weight:700; padding:0 7px; letter-spacing:.08em; clip-path:polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot .jr-chip, [data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-chip { border-color:rgba(0,217,255,.6); color:#4fe0ff; border-radius:0; background:rgba(0,217,255,.07); text-transform:uppercase; letter-spacing:.08em; clip-path:polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-chip.on:not(.static) { background:rgba(0,217,255,.35); color:#fff; border-color:#00d9ff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot .jr-snap { font-family:"Share Tech Mono",ui-monospace,monospace; color:#7fb0bc; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot-actions .btn, [data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot-actions .jr-pinpill { border-radius:0; border-color:rgba(0,217,255,.5); background:rgba(0,217,255,.05); color:#c4f7ff; text-transform:uppercase; letter-spacing:.08em; font-size:.64rem !important; clip-path:polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot-actions .btn:hover, [data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-foot-actions .jr-pinpill:hover { background:rgba(0,217,255,.2); color:#fff; box-shadow:inset 0 0 10px rgba(0,217,255,.45); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-leafform { color:#bff3ff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-leafform .jr-subject { color:#eaffff; font-family:var(--font-heading); font-size:1.1rem; text-transform:uppercase; letter-spacing:.08em; border-bottom-color:rgba(0,217,255,.5); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-leafform .jr-formfoot { color:#7fe9ff; border-top-color:rgba(0,217,255,.5); }
/* slim chevron tabs on either side */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-turn { flex-basis:30px; background:linear-gradient(to bottom, transparent, rgba(0,217,255,.08) 50%, transparent); color:#4fe0ff; border:1px solid rgba(0,217,255,.35); border-radius:0; font-size:1.6rem; text-shadow:0 0 8px rgba(0,217,255,.8); clip-path:polygon(0 12px, 12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-turn:not(:disabled):hover { background:rgba(0,217,255,.18); color:#fff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-bookinfo { display:none; } /* the readout strip under the screens shows the pages */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-newslot .btn, [data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-newbtn { border:1px dashed rgba(0,217,255,.7); border-radius:0; background:rgba(0,217,255,.05); color:#7fe9ff; font-family:var(--font-heading); font-size:.78rem; letter-spacing:.18em; text-transform:uppercase; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-newslot .btn:hover, [data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-newbtn:hover { background:rgba(0,217,255,.16); color:#fff; box-shadow:0 0 14px rgba(0,217,255,.35); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-blank { font-family:"Share Tech Mono",ui-monospace,monospace; font-style:normal; color:#7fb0bc; }
/* full view: the same data pad, larger */
[data-theme="tron-legacy"] #journal-modal { background:rgba(0,6,10,.72); }
[data-theme="tron-legacy"] #journal-modal .jr-modal-box {
  --c:#00d9ff; --k:18px; border-radius:0; border:1px solid rgba(0,217,255,.55); color:#c9f6ff;
  background:
    linear-gradient(var(--c),var(--c)) left top / var(--k) 2px, linear-gradient(var(--c),var(--c)) left top / 2px var(--k),
    linear-gradient(var(--c),var(--c)) right bottom / var(--k) 2px, linear-gradient(var(--c),var(--c)) right bottom / 2px var(--k),
    repeating-linear-gradient(to bottom, rgba(0,217,255,.03) 0 1px, transparent 1px 3px), #061017;
  background-repeat:no-repeat, no-repeat, no-repeat, no-repeat, repeat, no-repeat; background-origin:border-box;
  box-shadow:0 0 0 5px #040a0e, 0 0 0 6px rgba(0,217,255,.25), 0 0 40px rgba(0,217,255,.3);
}
[data-theme="tron-legacy"] #journal-modal .jr-modal-title { color:#eaffff; text-transform:uppercase; letter-spacing:.08em; font-size:1.15rem; text-shadow:0 0 10px rgba(0,217,255,.55); padding-left:12px; border-left:3px solid #00d9ff; }
/* Sort & filter: a config strip */
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-sf { border-radius:0; border-color:rgba(0,217,255,.35); background:rgba(3,10,14,.7); box-shadow:inset 0 0 20px rgba(0,217,255,.05); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-sf-top b { text-transform:uppercase; letter-spacing:.14em; font-size:.8rem; color:#7fe9ff; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-sf-grid label { text-transform:uppercase; letter-spacing:.1em; font-size:.66rem; color:#7fb0bc; }

/* ----- the data pad (Tron: Legacy): one screen, index + open entry ----- */
[data-theme="tron-legacy"] #journal-panel .jr-pad-screen { display:grid; grid-template-columns:minmax(250px, 32%) 1fr; height:clamp(460px, 70vh, 720px); border:1px solid rgba(0,217,255,.4);
  background:repeating-linear-gradient(to bottom, rgba(0,217,255,.03) 0 1px, transparent 1px 3px), linear-gradient(to bottom, rgba(0,217,255,.06), transparent 140px), #061017;
  box-shadow:0 0 18px rgba(0,217,255,.16), inset 0 0 34px rgba(0,217,255,.06); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-screen.jr-pad-full { grid-template-columns:1fr; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-screen.jr-pad-full .jr-pad-list { display:none; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-list { display:flex; flex-direction:column; min-height:0; border-right:1px solid rgba(0,217,255,.3); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-listhead, [data-theme="tron-legacy"] #journal-panel .jr-pad-dethead { flex:none; display:flex; align-items:center; gap:10px; height:34px; padding:0 14px; border-bottom:1px solid rgba(0,217,255,.28);
  font-family:var(--font-heading); font-size:.58rem; letter-spacing:.26em; text-transform:uppercase; color:#4fe0ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-listhead > span { flex:1; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-new, [data-theme="tron-legacy"] #journal-panel .jr-pad-back { font-family:var(--font-heading); font-size:.58rem; letter-spacing:.2em; text-transform:uppercase; color:#001218; background:#00d9ff; border:0; padding:4px 10px 4px 9px; cursor:pointer;
  clip-path:polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-back { color:#4fe0ff; background:rgba(0,217,255,.1); box-shadow:inset 0 0 0 1px rgba(0,217,255,.55); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-new:hover { background:#7ff0ff; } [data-theme="tron-legacy"] #journal-panel .jr-pad-back:hover { background:rgba(0,217,255,.25); color:#fff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-dethead .jr-pad-dlabel { flex:1; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-rows { flex:1; min-height:0; overflow:auto; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-cat { position:sticky; top:0; z-index:1; display:flex; align-items:center; gap:8px; width:100%; padding:6px 14px; border:0; border-bottom:1px solid rgba(0,217,255,.35); cursor:pointer;
  background:linear-gradient(90deg, rgba(0,217,255,.16), rgba(0,217,255,.03)), #071319; color:#7fe9ff; font-family:var(--font-heading); font-size:.6rem; letter-spacing:.24em; text-transform:uppercase; text-align:left; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-cat:hover { color:#fff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-cat-name { flex:1; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-cat-count { font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.78rem; letter-spacing:.06em; color:#e8fdff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row + .jr-pad-cat, [data-theme="tron-legacy"] #journal-panel .jr-pad-empty + .jr-pad-cat { margin-top:10px; border-top:1px solid rgba(0,217,255,.35); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-cat-pinned { box-shadow:inset 3px 0 0 var(--marker,#ff7a1a); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-empty { padding:12px 14px; font-size:.8rem; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row { display:grid; gap:3px; width:100%; text-align:left; padding:9px 14px 10px; background:transparent; border:0; border-bottom:1px solid rgba(0,217,255,.12); color:#bff3ff; cursor:pointer; font:inherit; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row:hover:not(:disabled) { background:rgba(0,217,255,.07); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row.on { background:linear-gradient(90deg, rgba(0,217,255,.22), rgba(0,217,255,.04)); box-shadow:inset 3px 0 0 #00d9ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row:disabled { cursor:default; opacity:.55; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-rowtop { display:flex; gap:10px; align-items:center; font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.74rem; color:#4fe0ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-n { color:#7fb0bc; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row.on .jr-pad-d { color:#06121a; background:#f2d33c; padding:0 5px; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-task { margin-left:auto; color:#7fe9ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-t { font-family:var(--font-heading); font-size:.76rem; letter-spacing:.08em; text-transform:uppercase; color:#eaffff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row.on .jr-pad-t { text-shadow:0 0 8px rgba(0,217,255,.7); }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row.jr-isdone .jr-pad-t { text-decoration:line-through; opacity:.7; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-s { font-size:.82rem; line-height:1.4; color:#9fd8e3; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; white-space:pre-line; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-s-full { -webkit-line-clamp:10; line-clamp:10; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-s-partial { -webkit-line-clamp:3; line-clamp:3; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-who { font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.72rem; color:#7fb0bc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-row.jr-pad-compact { padding:8px 14px; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-tags .jr-chip { font-size:.62rem; padding:0 6px; margin:0 3px 0 0; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-detail { display:flex; flex-direction:column; min-height:0; min-width:0; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-detbody { flex:1; min-height:0; display:flex; flex-direction:column; padding:18px 24px 18px; animation:jr-wipe-in .28s ease-out; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-detbody > .jr-leaf, [data-theme="tron-legacy"] #journal-panel .jr-pad-detbody > .jr-leafform { flex:1; min-height:0; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-detbody > .jr-leafform { overflow:hidden; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-detbody .jr-leafform .jr-ed [contenteditable] { flex:1; min-height:0 !important; overflow:auto; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-detbody > .jr-newslot { margin:auto; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-stage-foot { margin-top:10px; }
/* the command strip above the main screen (entry count, + New Entry, Show entries) */
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmd { position:relative; margin:0 0 12px; border:1px solid rgba(0,217,255,.4); color:#c9f6ff;
  background:repeating-linear-gradient(to bottom, rgba(0,217,255,.03) 0 1px, transparent 1px 3px), #061017;
  box-shadow:0 0 14px rgba(0,217,255,.12), inset 0 0 26px rgba(0,217,255,.05); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmd::after { content:""; position:absolute; left:50%; bottom:-13px; width:120px; margin-left:-60px; height:12px; pointer-events:none;
  background:linear-gradient(90deg, transparent 0 8px, rgba(0,217,255,.55) 8px 10px, transparent 10px calc(100% - 10px), rgba(0,217,255,.55) calc(100% - 10px) calc(100% - 8px), transparent 0); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmdhead { display:flex; align-items:center; gap:12px; height:28px; padding:0 14px; border-bottom:1px solid rgba(0,217,255,.28);
  font-family:var(--font-heading); font-size:.58rem; letter-spacing:.26em; text-transform:uppercase; color:#4fe0ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmdhead > span:first-child { flex:1; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmdhead .result { margin:0; font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.74rem; letter-spacing:.06em; text-transform:none; }
/* the toolbar inside it keeps its readout, groups and buttons but loses its own frame */
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmd .pad-toolbar { margin:0; padding:12px 14px 10px; border:0; background:none; box-shadow:none; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmd .pad-toolbar::before, [data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-cmd .pad-toolbar::after { content:none; }
/* the control screen under the main screen (sort & filter) */
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl { position:relative; margin:12px 0 0; padding:0; border:1px solid rgba(0,217,255,.4); border-radius:0; color:#c9f6ff;
  background:repeating-linear-gradient(to bottom, rgba(0,217,255,.03) 0 1px, transparent 1px 3px), #061017;
  box-shadow:0 0 14px rgba(0,217,255,.12), inset 0 0 26px rgba(0,217,255,.05); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl::before { content:""; position:absolute; left:50%; top:-13px; width:120px; margin-left:-60px; height:12px; pointer-events:none;
  background:linear-gradient(90deg, transparent 0 8px, rgba(0,217,255,.55) 8px 10px, transparent 10px calc(100% - 10px), rgba(0,217,255,.55) calc(100% - 10px) calc(100% - 8px), transparent 0); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-top { display:flex; align-items:center; gap:12px; height:32px; margin:0; padding:0 14px; border-bottom:1px solid rgba(0,217,255,.28); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-top b { flex:1; font-family:var(--font-heading); font-size:.58rem; font-weight:400; letter-spacing:.26em; text-transform:uppercase; color:#4fe0ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-top .hint { margin:0; font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.78rem; letter-spacing:.06em; color:#e8fdff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-top .btn { font-family:var(--font-heading); font-size:.56rem; letter-spacing:.2em; text-transform:uppercase; padding:3px 10px; border-radius:0; color:#001218; background:var(--marker,#ff7a1a); border:0; clip-path:polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-grid { padding:12px 14px 6px; gap:10px 16px; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-grid label { font-family:var(--font-heading); font-size:.54rem; letter-spacing:.2em; text-transform:uppercase; color:#7fb0bc; gap:5px; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl :is(input, select) { border-radius:0; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl-body { max-height:380px; overflow:auto; padding:12px 14px 14px; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-stack { position:relative; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-stack.jr-pad-alt-on > :not(.jr-pad-alt) { visibility:hidden; }
[data-theme="tron-legacy"] #journal-panel .jr-pad-screen.jr-pad-alt { position:absolute; inset:0; height:auto; display:flex; flex-direction:column; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-alt-body { flex:1; min-height:0; max-height:none; padding:16px 22px 18px; animation:jr-wipe-in .28s ease-out; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl-body h4 { margin:12px 0 6px; font-family:var(--font-heading); font-size:.58rem; font-weight:400; letter-spacing:.24em; text-transform:uppercase; color:#4fe0ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl-body .hint { color:#9fd8e3; font-family:"Share Tech Mono",ui-monospace,monospace; font-size:.8rem; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl-body .jr-bar { font-family:"Share Tech Mono",ui-monospace,monospace; color:#bff3ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl-body .jr-bar i { background:linear-gradient(90deg, #00d9ff, rgba(0,217,255,.45)); border-radius:0; height:8px; box-shadow:0 0 8px rgba(0,217,255,.5); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl-body .btn { border-radius:0; text-transform:uppercase; letter-spacing:.08em; font-size:.68rem; clip-path:polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); }
[data-theme="tron-legacy"] #journal-panel .jr-stage-foot .jr-sf-bars .jr-pad-bars { display:inline-flex; gap:6px; }
[data-theme="tron-legacy"] #journal-panel .jr-stage-foot .jr-sf-bars .jr-pad-bar { display:inline-flex; flex-direction:column; align-items:center; gap:3px; padding:2px 2px 0; background:none; border:0; cursor:pointer; color:#4f8f9c; font-family:var(--font-heading); font-size:.5rem; letter-spacing:.22em; text-transform:uppercase; }
[data-theme="tron-legacy"] #journal-panel .jr-stage-foot .jr-sf-bars .jr-pad-bar i { display:block; width:46px; height:6px; margin:0; background:rgba(0,217,255,.25); border:0; border-radius:0; box-shadow:none; transition:background .2s, box-shadow .2s; }
[data-theme="tron-legacy"] #journal-panel .jr-stage-foot .jr-sf-bars .jr-pad-bar:hover { color:#bff3ff; } [data-theme="tron-legacy"] #journal-panel .jr-stage-foot .jr-sf-bars .jr-pad-bar:hover i { background:rgba(0,217,255,.55); }
[data-theme="tron-legacy"] #journal-panel .jr-stage-foot .jr-sf-bars .jr-pad-bar.on { color:#e8fdff; } [data-theme="tron-legacy"] #journal-panel .jr-stage-foot .jr-sf-bars .jr-pad-bar.on i { background:#00d9ff; box-shadow:0 0 10px #00d9ff; }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-tags { margin:0; padding:6px 14px 12px; border-top:1px dashed rgba(0,217,255,.2); }
[data-theme="tron-legacy"] #journal-panel .jr-pad .jr-pad-ctl .jr-sf-tags > span:first-child { font-family:var(--font-heading); font-size:.54rem; letter-spacing:.2em; text-transform:uppercase; color:#7fb0bc; margin-right:4px; }
@media (max-width:760px) { [data-theme="tron-legacy"] #journal-panel .jr-pad-screen { grid-template-columns:1fr; height:auto; } [data-theme="tron-legacy"] #journal-panel .jr-pad-list { max-height:260px; border-right:0; border-bottom:1px solid rgba(0,217,255,.3); } [data-theme="tron-legacy"] #journal-panel .jr-pad-detbody { min-height:360px; } }

/* display modes: full (one whole entry), partial (3 per page), compact (6 titles per page) */
:is(#journal-panel, #journal-modal) .jr-seg { display:inline-flex; align-items:center; gap:4px; margin-left:12px; }
:is(#journal-panel, #journal-modal) .jr-seg-label { font-size:.82rem; opacity:.8; margin-right:2px; }
:is(#journal-panel, #journal-modal) .jr-page.jr-multi { overflow:auto; justify-content:flex-start; }
:is(#journal-panel, #journal-modal) .jr-multi > .jr-item { flex:none; }
:is(#journal-panel, #journal-modal) .jr-multi > .jr-item + .jr-item { border-top:4px solid var(--jr-rule, var(--ink-soft,#666)); margin-top:10px; padding-top:10px; }
:is(#journal-panel, #journal-modal) .jr-newslot { display:grid; gap:12px; justify-items:center; text-align:center; }
:is(#journal-panel, #journal-modal) .jr-newslot:first-child { margin:auto; }
:is(#journal-panel, #journal-modal) .jr-newbtn { border-style:dashed; padding:10px 22px; font-size:1rem; }
:is(#journal-panel, #journal-modal) .jr-pe-head { display:flex; align-items:center; gap:8px; }
:is(#journal-panel, #journal-modal) .jr-pe .jr-title { font-size:1.2rem; margin:0; cursor:pointer; }
:is(#journal-panel, #journal-modal) .jr-ce .jr-title { font-size:1.1rem; margin:0; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
:is(#journal-panel, #journal-modal) .jr-pe.jr-isdone .jr-title, :is(#journal-panel, #journal-modal) .jr-ce.jr-isdone .jr-title { text-decoration:line-through; opacity:.7; }
:is(#journal-panel, #journal-modal) .jr-snip { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; white-space:pre-line; line-height:1.45; margin:4px 0 6px; overflow-wrap:anywhere; }
:is(#journal-panel, #journal-modal) .jr-pe .jr-foot { display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; margin-top:2px; padding-top:5px; }
:is(#journal-panel, #journal-modal) .jr-pe .jr-foot-actions { margin:0 0 0 auto; }
:is(#journal-panel, #journal-modal) .jr-foot.jr-foot-dotted { border-top:1px dotted var(--jr-rule, var(--line,#999)); }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-pe .jr-title { font-size:1.4rem; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-ce .jr-title { font-size:1.25rem; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-snip { line-height:1.45; }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-seg-label { color:#2b2118; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-pe .jr-title { font-size:.95rem; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-ce .jr-title { font-size:.9rem; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-multi > .jr-item + .jr-item { border-top:1px solid rgba(0,217,255,.55); box-shadow:0 -1px 8px -2px rgba(0,217,255,.6); margin-top:14px; padding-top:14px; }

#journal-modal { position:fixed; inset:0; z-index:20050; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; padding:16px; }
#journal-modal .jr-modal-box { background:var(--card,#fff); color:var(--ink,#222); border:1px solid var(--line,#ccc); border-radius:var(--radius,10px); box-shadow:0 12px 40px rgba(0,0,0,.45); width:min(780px,94vw); max-height:88vh; overflow:auto; padding:18px 20px; }
#journal-modal .jr-modal-head { display:flex; align-items:flex-start; gap:12px; justify-content:space-between; }
#journal-modal .jr-modal-title { font-family:var(--font-heading); font-size:1.4rem; margin:0 0 4px; color:var(--green-dark,#222); }
#journal-modal .jr-modal-text { white-space:pre-wrap; margin:10px 0; line-height:1.5; font-size:1rem; }
#journal-modal .jr-modal-row { margin:6px 0; }
#journal-panel .jr-cpill, #journal-modal .jr-cpill { cursor:pointer; font:inherit; font-size:.85rem; padding:2px 12px; margin:2px 4px 2px 0; border-radius:6px; border:2px solid #7dffb2; background:#14201b; color:#7dffb2; }
#journal-panel .jr-cpill.on, #journal-modal .jr-cpill.on { background:#7dffb2; color:#14201b; font-weight:700; }
:is(#journal-panel, #journal-modal) .jr-switch { display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
:is(#journal-panel, #journal-modal) .jr-switch input { position:absolute; opacity:0; width:0; height:0; }
:is(#journal-panel, #journal-modal) .jr-switch .jr-track { width:42px; height:22px; border-radius:11px; background:#777; position:relative; transition:background .15s; }
:is(#journal-panel, #journal-modal) .jr-switch .jr-track::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .15s; }
:is(#journal-panel, #journal-modal) .jr-switch input:checked + .jr-track { background:#2e9e5b; }
:is(#journal-panel, #journal-modal) .jr-switch input:checked + .jr-track::after { left:22px; }
:is(#journal-panel, #journal-modal) .jr-switch input:focus-visible + .jr-track { outline:2px solid currentColor; }
:is(#journal-panel, #journal-modal) .jr-donepill { cursor:pointer; font:inherit; font-weight:700; font-size:1rem; padding:6px 22px; border-radius:999px; border:2px solid currentColor; background:transparent; color:inherit; margin:4px 0; }
:is(#journal-panel, #journal-modal) .jr-donepill.on { background:#3ddc84; border-color:#3ddc84; color:#06240f; box-shadow:0 0 12px 3px rgba(61,220,132,.8); }
:is(#journal-panel, #journal-modal) .jr-entry.jr-isdone .jr-subject { text-decoration:line-through; opacity:.7; }
:is(#journal-panel, #journal-modal) .jr-pinpill { cursor:pointer; font:inherit; font-size:.8rem; padding:1px 12px; margin:2px 6px; border-radius:999px; border:2px solid currentColor; background:transparent; color:inherit; }
:is(#journal-panel, #journal-modal) .jr-pinpill.on { background:var(--ink,#222); color:var(--card,#fff); border-color:var(--ink,#222); }
:is(#journal-panel, #journal-modal) .jr-mentry { border-bottom:1px dashed var(--line,#999); padding:3px 0; }
:is(#journal-panel, #journal-modal) .jr-mentry > summary { cursor:pointer; display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
:is(#journal-panel, #journal-modal) .jr-margin { border-top:3px double var(--line,#999); background:var(--card,#fff); color:var(--ink,#222); border-radius:0 0 8px 8px; padding:8px 14px 10px; margin:0 0 16px; }
:is(#journal-panel, #journal-modal) .jr-margin-title { font-weight:700; margin:0 0 6px; cursor:pointer; user-select:none; display:flex; align-items:center; gap:6px; }
:is(#journal-panel, #journal-modal) .jr-margin.shut .jr-margin-title { margin:0; }
:is(#journal-panel, #journal-modal) .jr-margin .jr-entry .jr-text { -webkit-line-clamp:6; line-clamp:6; }
`;
  document.head.appendChild(css);

  let openForm = null;    // the form on screen: { submit(quiet) }
  let editingId = null;   // entry being edited
  let creating = false;   // new-entry form open
  let spread = null;    // which two-page spread is showing (null = open at the latest entry)
  let turning = false;  // a page-turn animation is running
  const PER = { full: 1, partial: 3, compact: 6 }; // entries per page for each display mode
  let displayMode = (() => { try { const v = localStorage.getItem("ggo-journal-display"); return PER[v] ? v : "full"; } catch (e) { return "full"; } })();
  let focusId = null; // the entry the book should open at on its next draw
  // Tron: Legacy shows the journal as one data-pad screen (index + the open entry) instead of a book.
  const isPad = () => document.documentElement.getAttribute("data-theme") === "tron-legacy";
  let padSel = null;    // the entry open on the data pad
  let padFull = false;  // the open entry fills the whole screen (index hidden)
  let leadId = null;  // the first entry on the spread now showing
  const modeNow = () => (creating || editingId ? "full" : displayMode); // writing and editing always use a whole page
  let tagFilter = new Set(); // tags ticked in the By-tag list: only entries with any of them are listed
  let sel = { from: "", to: "", tag: "", student: "", word: "" };
  const SORTS = { "date-asc": "Date: oldest first", "date-desc": "Date: newest first", "title-asc": "Title: A → Z", "title-desc": "Title: Z → A", "edited": "Recently edited", "students": "Most students", "tags": "Most tags" };
  const VIEW0 = { word: "", from: "", to: "", student: "", type: "", status: "", any: true };
  let view = Object.assign({}, VIEW0);
  let sortKey = (() => { try { const v = localStorage.getItem("ggo-journal-sort"); return SORTS[v] ? v : "date-asc"; } catch (e) { return "date-asc"; } })();
  const viewActive = () => tagFilter.size || Object.keys(VIEW0).some((k) => k !== "any" && view[k]);

  const students = () => RosterModule.students.slice().sort((a, b) => (a.classNumber || 0) - (b.classNumber || 0));
  const sName = (id) => { const s = RosterModule.students.find((x) => x.id === id); return s ? `#${s.classNumber || "—"} ${s.name || "(unnamed)"}` : "(removed student)"; };
  const courseName = (id) => { const c = window.CoursesModule && CoursesModule.find ? CoursesModule.find(id) : null; return c && c.name ? c.name : "(another course)"; };
  const otherCourses = () => (window.CoursesModule ? CoursesModule.activeCourses() : []).filter((c) => c.id !== J.currentCourseId);
  const warnFail = (failed) => { if (failed && failed.length) alert(`Couldn't update the shared entry in: ${failed.map(courseName).join(", ")}.`); };
  /** Marks / unmarks a whole entry as done (check-list mode). */
  const setDone = (e, v) => { e.done = v; e.updatedAt = new Date().toISOString(); (J.syncShared ? J.syncShared(e).then(warnFail) : null); render(); };
  const donePill = (e, onFlip) => { const b = mk("button", `jr-donepill${e.done ? " on" : ""}`, e.done ? "✔ Done" : "○ To do"); b.type = "button"; b.setAttribute("aria-pressed", String(!!e.done)); b.addEventListener("click", () => onFlip(!e.done)); return b; };
  const bindBoxes = (el, e, after) => QuizRich.bindChecks && QuizRich.bindChecks(el, () => e.rich || "", (nr) => { e.rich = nr; e.text = QuizRich.plain(nr); e.updatedAt = new Date().toISOString(); (J.syncShared ? J.syncShared(e).then(warnFail) : null); after(); });
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const attOk = () => AttendanceModule.currentCourseId === J.currentCourseId;
  const scoreOk = () => ScoringModule.currentCourseId === J.currentCourseId;

  /** Attendance that day + attendance-so-far + current score, for the entry's students (or the class). */
  function snapParts(e) {
    const out = [];
    const sess = attOk() ? AttendanceModule.sessions.find((s) => s.date && s.date === e.date) : null;
    if (e.students.length) {
      e.students.forEach((id) => {
        if (!RosterModule.students.some((s) => s.id === id)) return;
        const bits = [];
        if (attOk()) {
          const rec = sess ? AttendanceModule.getRecord(id, sess.id) : null;
          bits.push(`that day: ${rec && rec.code ? rec.code + (rec.infraction ? " (" + rec.infraction + ")" : "") : "—"}`);
          const st = AttendanceModule.stats(id);
          bits.push(`attended ${st.attended}, absences ${st.absences}`);
        }
        if (scoreOk()) { const pct = ScoringModule.weightedPercent(id); bits.push(`score now: ${pct === null || pct === undefined ? "—" : Math.round(pct) + "%"}`); }
        out.push({ who: sName(id), text: bits.join(" · ") });
      });
    } else if (sess) {
      const n = {};
      RosterModule.students.forEach((s) => { const c = AttendanceModule.getRecord(s.id, sess.id).code; if (c) n[c] = (n[c] || 0) + 1; });
      const t = Object.entries(n).map(([c, k]) => `${c} ${k}`).join(", ");
      if (t) out.push({ who: "Class", text: `attendance that day: ${t}` });
    }
    return out;
  }

  // ---------- the entry form ----------
  function buildForm(entry, onDone, onCancel) {
    const f = mk("div", "jr-form jr-leafform"); const foot = mk("div", "jr-formfoot"); // title + text on top, the details under a thin rule
    const st = { date: entry ? entry.date : today(), subject: entry ? entry.subject || "" : "", students: new Set(entry ? entry.students : []), tags: new Set(entry ? entry.tags : []), mode: entry && entry.mode === "list" ? "list" : "entry", done: !!(entry && entry.done), courses: new Set(entry ? entry.sharedWith || [] : []) };
    const row = mk("div", "jr-row");
    const date = mk("input"); date.type = "date"; date.value = st.date; date.addEventListener("input", () => { st.date = date.value; });
    const dl = mk("label", "", "Date "); dl.appendChild(date); row.appendChild(dl);

    const det = mk("details", "jr-pick"); const sum = mk("summary"); det.appendChild(sum);
    const list = mk("div", "jr-pick-list");
    const upd = () => { sum.textContent = st.students.size ? `Students (${st.students.size}): ${[...st.students].map((id) => sName(id)).join(", ").slice(0, 80)}` : "Students (optional — none = whole class)"; };
    students().forEach((s) => {
      const l = mk("label"); const c = mk("input"); c.type = "checkbox"; c.checked = st.students.has(s.id);
      c.addEventListener("change", () => { c.checked ? st.students.add(s.id) : st.students.delete(s.id); upd(); });
      l.append(c, document.createTextNode(` ${sName(s.id)}`)); list.appendChild(l);
    });
    if (!students().length) list.appendChild(mk("em", "", "No students in this course's roster."));
    det.appendChild(list); upd(); row.appendChild(det);
    foot.appendChild(row);

    // entry / check list switch, and the "also show in" course pills
    const mrow = mk("div", "jr-row");
    const sw = mk("label", "jr-switch"); const swc = mk("input"); swc.type = "checkbox"; swc.checked = st.mode === "list";
    const dp = mk("span"); const drawDone = () => { dp.textContent = ""; if (st.mode === "list") { const b = mk("button", `jr-donepill${st.done ? " on" : ""}`, st.done ? "✔ Done" : "○ To do"); b.type = "button"; b.addEventListener("click", () => { st.done = !st.done; drawDone(); }); dp.appendChild(b); } };
    swc.addEventListener("change", () => { st.mode = swc.checked ? "list" : "entry"; drawDone(); });
    sw.append(swc, mk("span", "jr-track"), mk("span", "", "Check list (this whole entry is a task to complete)"));
    mrow.append(sw, dp); drawDone(); foot.appendChild(mrow);
    const others = otherCourses();
    if (others.length) {
      const cd = mk("details", "jr-pick"); const cs = mk("summary"); cd.appendChild(cs);
      const cl = mk("div", "jr-pick-list");
      const updC = () => { cs.textContent = st.courses.size ? `Also shown in: ${[...st.courses].map(courseName).join(", ").slice(0, 80)}` : "Also show this entry in other courses…"; };
      others.forEach((c) => {
        const b = mk("button", `jr-cpill${st.courses.has(c.id) ? " on" : ""}`, c.name); b.type = "button"; b.setAttribute("aria-pressed", String(st.courses.has(c.id)));
        b.addEventListener("click", () => { if (st.courses.has(c.id)) st.courses.delete(c.id); else st.courses.add(c.id); b.classList.toggle("on", st.courses.has(c.id)); b.setAttribute("aria-pressed", String(st.courses.has(c.id))); updC(); });
        cl.appendChild(b);
      });
      cl.appendChild(mk("div", "jr-meta", "The entry appears in each ticked course's journal and can be edited there too. Its students stay with each course."));
      cd.appendChild(cl); updC(); foot.appendChild(cd);
    }

    const subj = mk("input"); subj.className = "jr-subject"; subj.placeholder = "Title"; subj.value = st.subject; subj.style.width = "100%"; subj.addEventListener("input", () => { st.subject = subj.value; });
    f.appendChild(subj);
    const body = { text: entry ? entry.text : "", rich: entry ? entry.rich || "" : "" };
    const text = QuizRich.editor({ text: body.text, rich: body.rich, placeholder: "Journal entry…", lists: true, onSubmit: () => { if (formSubmit) formSubmit(false); }, onChange: (t, r) => { body.text = t; body.rich = r; } });
    text.style.width = "100%"; text.style.boxSizing = "border-box"; text.classList.add("jr-ed");
    text.querySelector("[contenteditable]").style.minHeight = "110px";
    f.appendChild(text);

    const tagBox = mk("div");
    const drawTags = () => {
      tagBox.innerHTML = ""; tagBox.appendChild(mk("div", "", "Tags:"));
      const all = J.cleanTags([...J.allTags(), ...st.tags]);
      all.forEach((t) => {
        const on = [...st.tags].some((x) => x.toLowerCase() === t.toLowerCase());
        const c = btn(t, "jr-chip" + (on ? " on" : ""), () => {
          if (on) st.tags = new Set([...st.tags].filter((x) => x.toLowerCase() !== t.toLowerCase())); else st.tags.add(t);
          drawTags();
        });
        c.setAttribute("aria-pressed", String(on)); tagBox.appendChild(c);
      });
      const ni = mk("input"); ni.placeholder = "new tag…"; ni.size = 12;
      const addTag = () => { const v = ni.value.trim(); if (v) { J.cleanTags([v]).forEach((x) => st.tags.add(x)); drawTags(); } };
      ni.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addTag(); } });
      tagBox.append(ni, btn("Add tag", "btn btn-ghost btn-small", addTag));
    };
    drawTags(); foot.appendChild(tagBox);

    const acts = mk("div", "jr-row");
    // Saves the form into the journal. quiet = called by Save Journal / leaving the tab: an empty form is just dropped.
    let formSubmit = null;
    const submit = (quiet) => {
      if (!body.text.trim() && !st.subject.trim() && !st.tags.size) { if (!quiet) alert("Write something first."); return false; }
      if (!st.date) { if (!quiet) alert("Choose a date."); return false; }
      const data = { date: st.date, subject: st.subject, text: body.text, rich: body.rich, students: [...st.students], tags: [...st.tags], mode: st.mode, done: st.done, sharedWith: [...st.courses] };
      let saved;
      if (entry) saved = J.updateEntry(entry.id, data); else { saved = J.addEntry(data); spread = null; }
      if (saved && saved.id) focusId = saved.id; // the book opens at the page just written
      if (saved && J.syncShared && ((saved.sharedWith || []).length || (saved.syncedTo || []).length)) J.syncShared(saved).then(warnFail);
      editingId = null; creating = false; openForm = null;
      if (!quiet) { render(); if (onDone) onDone(); }
      return true;
    };
    openForm = { submit }; formSubmit = submit;
    acts.appendChild(btn(entry ? "Save changes" : "Add entry", "btn btn-primary btn-small", () => submit(false)));
    acts.appendChild(btn("Cancel", "btn btn-ghost btn-small", () => { if (entry) focusId = entry.id; editingId = null; creating = false; openForm = null; if (onCancel) onCancel(); else render(); }));
    foot.appendChild(acts); f.appendChild(foot);
    if (!entry) setTimeout(() => subj.focus(), 0);
    return f;
  }

  const pinPill = (e, fn) => { const b = mk("button", `jr-pinpill${e.pinned ? " on" : ""}`, e.pinned ? (isPad() ? "Unpin" : "Pinned ✓ (click to unpin)") : (isPad() ? "Pin" : "Pin to margin")); b.type = "button"; b.setAttribute("aria-pressed", String(!!e.pinned)); b.addEventListener("click", fn); return b; };
  const delMsg = (e) => ((e.sharedWith || []).length ? `Delete this entry here and in: ${e.sharedWith.map(courseName).join(", ")}?` : "Delete this entry?");
  function entryCard(e) {
    if (editingId === e.id) return buildForm(e);
    const c = mk("div", `jr-entry${e.mode === "list" && e.done ? " jr-isdone" : ""}`);
    if (e.mode === "list") c.appendChild(donePill(e, (v) => setDone(e, v)));
    c.appendChild(mk("div", "jr-subject", e.subject || "(no subject)"));
    if ((e.sharedWith || []).length) c.appendChild(mk("div", "jr-meta", `Also in: ${e.sharedWith.map(courseName).join(", ")}`));
    c.appendChild(mk("div", "jr-meta", e.date));
    if (e.tags.length) { const t = mk("div"); e.tags.forEach((x) => t.appendChild(mk("span", "jr-chip static", x))); c.appendChild(t); }
    if (e.students.length) {
      const d = mk("details"); d.appendChild(mk("summary", "", `Students (${e.students.length})`));
      d.appendChild(mk("div", "jr-meta", e.students.map(sName).join(", "))); c.appendChild(d);
    } else c.appendChild(mk("div", "jr-meta", "Whole class"));
    const tx = mk("div", "jr-text"); tx.innerHTML = QuizRich.show(e); bindBoxes(tx, e, render); c.appendChild(tx);
    c.appendChild(btn("Show full entry", "btn btn-ghost btn-small", () => openEntry(e.id)));
    if (J.settings.snapshots) {
      const sn = snapParts(e);
      if (sn.length) { const d = mk("div", "jr-snap"); sn.forEach((p) => d.appendChild(mk("div", "", `${p.who}: ${p.text}`))); c.appendChild(d); }
    }
    const a = mk("div", "jr-row");
    a.appendChild(btn("Edit", "btn btn-ghost btn-small", () => { editingId = e.id; creating = false; render(); }));
    a.appendChild(pinPill(e, () => { J.setPinned(e.id, !e.pinned); render(); }));
    a.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm(delMsg(e))) { if (J.removeShared) J.removeShared(e); J.removeEntry(e.id); render(); } }));
    c.appendChild(a);
    return c;
  }

  /** One entry as a journal page: big title, the text, then a thin rule with the date / who / tags / snapshot / buttons beneath. */
  function leaf(e) {
    if (editingId === e.id) return buildForm(e);
    const c = mk("div", `jr-leaf${e.mode === "list" && e.done ? " jr-isdone" : ""}`);
    if (e.mode === "list") c.appendChild(donePill(e, (v) => setDone(e, v)));
    c.appendChild(mk("h3", "jr-title", e.subject || "(no subject)"));
    const tx = mk("div", "jr-body"); tx.innerHTML = QuizRich.show(e); bindBoxes(tx, e, render); c.appendChild(tx);
    const foot = mk("div", "jr-foot");
    const meta = mk("div", "jr-foot-meta");
    meta.appendChild(mk("span", "jr-date", e.date));
    const who = mk("span", "jr-who", e.students.length ? `Students (${e.students.length}): ${e.students.map(sName).join(", ")}` : "Whole class");
    who.title = e.students.length ? e.students.map(sName).join(", ") : "Whole class";
    meta.appendChild(who);
    if ((e.sharedWith || []).length) meta.appendChild(mk("span", "jr-who", `Also in: ${e.sharedWith.map(courseName).join(", ")}`));
    foot.appendChild(meta);
    if (e.tags.length) { const t = mk("div"); e.tags.forEach((x) => t.appendChild(mk("span", "jr-chip static", x))); foot.appendChild(t); }
    if (J.settings.snapshots) { const sn = snapParts(e); if (sn.length) { const d = mk("div", "jr-snap"); sn.forEach((p) => d.appendChild(mk("div", "", `${p.who}: ${p.text}`))); foot.appendChild(d); } }
    const a = mk("div", "jr-foot-actions");
    a.appendChild(btn("Edit", "btn btn-ghost btn-small", () => { editingId = e.id; creating = false; focusId = e.id; render(); }));
    a.appendChild(btn("Full view", "btn btn-ghost btn-small", () => openEntry(e.id)));
    a.appendChild(pinPill(e, () => { J.setPinned(e.id, !e.pinned); render(); }));
    a.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm(delMsg(e))) { if (J.removeShared) J.removeShared(e); J.removeEntry(e.id); render(); } }));
    foot.appendChild(a);
    c.appendChild(foot);
    return c;
  }

  // ---------- the full-entry window ----------
  function openEntry(id) {
    if (isPad()) { // the data pad opens the entry on its own screen, full size, instead of a pop-up
      padSel = id; padFull = true; editingId = null; creating = false; padCtl = "filter"; render();
      const w = panel.querySelector(".jr-pad"); if (w) w.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const existing = document.getElementById("journal-modal"); if (existing) existing.remove();
    const root = mk("div"); root.id = "journal-modal";
    const box = mk("div", "jr-modal-box"); root.appendChild(box);
    const close = () => { root.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (ev) => { if (ev.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    root.addEventListener("mousedown", (ev) => { if (ev.target === root) close(); });
    function show() {
      const e = J.entries.find((x) => x.id === id); if (!e) { close(); return; }
      box.innerHTML = "";
      const head = mk("div", "jr-modal-head");
      const hl = mk("div"); hl.appendChild(mk("h3", "jr-modal-title", e.subject || "(no subject)")); hl.appendChild(mk("div", "jr-meta", e.date + ((e.sharedWith || []).length ? ` · also in: ${e.sharedWith.map(courseName).join(", ")}` : "")));
      if (e.mode === "list") hl.appendChild(donePill(e, (v) => { e.done = v; e.updatedAt = new Date().toISOString(); (J.syncShared ? J.syncShared(e).then(warnFail) : null); show(); render(); }));
      head.appendChild(hl); head.appendChild(btn("✕ Close", "btn btn-ghost btn-small", close)); box.appendChild(head);
      if (e.tags.length) { const t = mk("div", "jr-modal-row"); e.tags.forEach((x) => t.appendChild(mk("span", "jr-chip static", x))); box.appendChild(t); }
      box.appendChild(mk("div", "jr-meta jr-modal-row", e.students.length ? `Students (${e.students.length}): ${e.students.map(sName).join(", ")}` : "Whole class"));
      { const mt = mk("div", "jr-modal-text"); mt.innerHTML = QuizRich.show(e); bindBoxes(mt, e, () => { show(); render(); }); box.appendChild(mt); }
      if (J.settings.snapshots) { const sn = snapParts(e); if (sn.length) { const d = mk("div", "jr-snap"); sn.forEach((p) => d.appendChild(mk("div", "", `${p.who}: ${p.text}`))); box.appendChild(d); } }
      const a = mk("div", "jr-row jr-modal-row");
      a.appendChild(btn("Edit", "btn btn-primary btn-small", () => { box.innerHTML = ""; box.appendChild(buildForm(e, show, show)); }));
      a.appendChild(pinPill(e, () => { J.setPinned(e.id, !e.pinned); show(); render(); }));
      a.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm(delMsg(e))) { if (J.removeShared) J.removeShared(e); J.removeEntry(e.id); close(); render(); } }));
      box.appendChild(a);
    }
    show();
    document.body.appendChild(root);
  }

  // ---------- the book: two pages showing, page-turn buttons on either side ----------
  function startNew() {
    padCtl = "filter";
    creating = true; editingId = null; spread = null; focusId = null; render();
    const bw = panel.querySelector(".jr-bookwrap"); if (bw) bw.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  /** The "+ New Entry" slot that follows the last entry. */
  function newSlot(count) {
    const d = mk("div", "jr-item jr-newslot");
    if (!count) d.appendChild(mk("div", "jr-blank", viewActive() ? "No entries match the filters." : "This journal is empty."));
    d.appendChild(btn("+ New Entry", "btn btn-ghost jr-newbtn", startNew));
    return d;
  }
  /** Partial: title, the first two lines, then a thin dotted rule and the date / tags / buttons in one compact row. */
  function partialEntry(e) {
    const c = mk("div", `jr-item jr-pe${e.mode === "list" && e.done ? " jr-isdone" : ""}`);
    const head = mk("div", "jr-pe-head");
    if (e.mode === "list") head.appendChild(donePill(e, (v) => setDone(e, v)));
    const t = mk("h3", "jr-title", e.subject || "(no subject)"); t.title = "Open full view"; t.addEventListener("click", () => openEntry(e.id));
    head.appendChild(t); c.appendChild(head);
    c.appendChild(mk("div", "jr-snip", e.text || ""));
    const foot = mk("div", "jr-foot jr-foot-dotted jr-foot-meta");
    foot.appendChild(mk("span", "jr-date", e.date));
    foot.appendChild(mk("span", "jr-who", e.students.length ? `Students (${e.students.length})` : "Whole class"));
    e.tags.forEach((x) => foot.appendChild(mk("span", "jr-chip static", x)));
    const a = mk("div", "jr-foot-actions");
    a.appendChild(btn("Edit", "btn btn-ghost btn-small", () => { editingId = e.id; creating = false; focusId = e.id; render(); }));
    a.appendChild(btn("Full view", "btn btn-ghost btn-small", () => openEntry(e.id)));
    a.appendChild(pinPill(e, () => { J.setPinned(e.id, !e.pinned); render(); }));
    a.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm(delMsg(e))) { if (J.removeShared) J.removeShared(e); J.removeEntry(e.id); render(); } }));
    foot.appendChild(a); c.appendChild(foot);
    return c;
  }
  /** Compact: the title only (click it to open the entry). */
  function compactEntry(e) {
    const c = mk("div", `jr-item jr-ce${e.mode === "list" && e.done ? " jr-isdone" : ""}`);
    const t = mk("h3", "jr-title", e.subject || "(no subject)"); t.title = "Open full view"; t.addEventListener("click", () => openEntry(e.id));
    c.appendChild(t);
    return c;
  }
  const cmpDate = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || "");
  function visibleEntries() {
    const want = [...tagFilter].map((t) => t.toLowerCase()), w = view.word.trim().toLowerCase();
    const list = J.entries.filter((e) => {
      if (e.pinned) return false;
      if (want.length) { const has = e.tags.map((t) => t.toLowerCase()); if (!(view.any ? want.some((t) => has.includes(t)) : want.every((t) => has.includes(t)))) return false; }
      if (w && !`${e.subject || ""} ${e.text || ""} ${e.tags.join(" ")}`.toLowerCase().includes(w)) return false;
      if (view.from && e.date < view.from) return false;
      if (view.to && e.date > view.to) return false;
      if (view.student && !(view.student === "__class" ? !e.students.length : e.students.includes(view.student))) return false;
      if (view.type && (view.type === "list") !== (e.mode === "list")) return false;
      if (view.status && (e.mode !== "list" || (view.status === "done") !== !!e.done)) return false;
      return true;
    });
    const t = (e) => (e.subject || "").toLowerCase();
    const by = {
      "date-asc": cmpDate, "date-desc": (a, b) => cmpDate(b, a),
      "title-asc": (a, b) => t(a).localeCompare(t(b)) || cmpDate(a, b), "title-desc": (a, b) => t(b).localeCompare(t(a)) || cmpDate(a, b),
      "edited": (a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""),
      "students": (a, b) => b.students.length - a.students.length || cmpDate(a, b), "tags": (a, b) => b.tags.length - a.tags.length || cmpDate(a, b),
    }[sortKey];
    return list.sort(by);
  }
  let refocus = null;
  const defSpread = () => (sortKey === "date-asc" ? null : 0);
  /** The sort & filter bar that sits right under the book. */
  function sortFilterBar(shown, total) {
    const bar = mk("div", "jr-sf");
    const top = mk("div", "jr-sf-top");
    top.appendChild(mk("b", "", isPad() ? "Control · Sort & filter" : "Sort & filter"));
    const cnt = mk("span", "hint", viewActive() ? `Showing ${shown} of ${total} entries` : `${total} entr${total === 1 ? "y" : "ies"}`);
    top.appendChild(cnt);
    if (viewActive()) top.appendChild(btn("Clear filters", "btn btn-ghost btn-small", () => { tagFilter = new Set(); view = Object.assign({}, VIEW0); spread = defSpread(); render(); }));
    bar.appendChild(top);
    const g = mk("div", "jr-sf-grid"); bar.appendChild(g);
    const lab = (t, el) => { const l = mk("label", "", t); l.appendChild(el); g.appendChild(l); return el; };
    const opt = (v, t) => Object.assign(mk("option"), { value: v, textContent: t });
    const sortSel = mk("select"); Object.entries(SORTS).forEach(([k, v]) => sortSel.appendChild(opt(k, v))); sortSel.value = sortKey;
    sortSel.addEventListener("change", () => { sortKey = sortSel.value; try { localStorage.setItem("ggo-journal-sort", sortKey); } catch (e) {} spread = defSpread(); render(); });
    lab("Sort by", sortSel);
    const word = lab("Search", Object.assign(mk("input"), { type: "search", id: "jr-f-word", value: view.word, placeholder: "title, text or tag…" }));
    let wt; word.addEventListener("input", () => { clearTimeout(wt); wt = setTimeout(() => { view.word = word.value; refocus = "jr-f-word"; spread = defSpread(); render(); }, 250); });
    const from = lab("From", Object.assign(mk("input"), { type: "date", value: view.from }));
    const to = lab("To", Object.assign(mk("input"), { type: "date", value: view.to }));
    const stu = mk("select"); stu.appendChild(opt("", "Anyone")); stu.appendChild(opt("__class", "Whole class only")); students().forEach((x) => stu.appendChild(opt(x.id, sName(x.id)))); stu.value = view.student;
    lab("Student", stu);
    const type = mk("select"); [["", "All"], ["note", "Notes"], ["list", "Check-lists"]].forEach(([v, t]) => type.appendChild(opt(v, t))); type.value = view.type;
    lab("Type", type);
    const status = mk("select"); [["", "Any"], ["todo", "To do"], ["done", "Done"]].forEach(([v, t]) => status.appendChild(opt(v, t))); status.value = view.status;
    lab("Check-list status", status);
    [[from, "from"], [to, "to"], [stu, "student"], [type, "type"], [status, "status"]].forEach(([el, k]) => el.addEventListener("change", () => { view[k] = el.value; if (k === "type" && el.value === "note") view.status = ""; spread = defSpread(); render(); }));
    const tags = J.allTags();
    if (tags.length) {
      const tb = mk("div", "jr-sf-tags"); tb.appendChild(mk("span", "", "Tags:"));
      tags.forEach((t) => {
        const on = [...tagFilter].some((x) => x.toLowerCase() === t.toLowerCase());
        const c = mk("button", `jr-chip tagbtn${on ? " on" : ""}`, t); c.type = "button"; c.setAttribute("aria-pressed", String(on));
        c.addEventListener("click", () => { tagFilter = new Set([...tagFilter].filter((x) => x.toLowerCase() !== t.toLowerCase())); if (!on) tagFilter.add(t); spread = defSpread(); render(); });
        tb.appendChild(c);
      });
      if (tagFilter.size > 1) {
        const m = mk("select"); m.append(opt("any", "match any tag"), opt("all", "match all tags")); m.value = view.any ? "any" : "all";
        m.addEventListener("change", () => { view.any = m.value === "any"; spread = defSpread(); render(); }); tb.appendChild(m);
      }
      bar.appendChild(tb);
    }
    return bar;
  }

  /** Tron: Legacy — one screen: an index of entries on the left and the open entry on the right.
   *  Full view (or a new entry / editing) uses the whole screen; "◂ Index" brings the list back. */
  const padCatsShut = (() => { try { return new Set(JSON.parse(localStorage.getItem("ggo-journal-pad-shut")) || []); } catch (e) { return new Set(); } })();
  let padCtl = (() => { try { const v = localStorage.getItem("ggo-journal-pad-ctl"); return ["filter", "stats", "settings"].includes(v) ? v : "filter"; } catch (e) { return "filter"; } })();
  /** The control screen under the main screen: Sort & filter, Stats or Export (picked with the three bars). */
  function padControls(sorted, pinned, filterBar) { filterBar.classList.add("jr-pad-ctl"); return filterBar; }
  /** Stats or Settings, shown on the main screen in place of the index and entry (same size, scrolls inside). */
  function padAltScreen(sorted, pinned) {
    const box = mk("div", "jr-pad-screen jr-pad-alt");
    const top = mk("div", "jr-pad-dethead");
    top.appendChild(mk("span", "jr-pad-dlabel", padCtl === "stats" ? "Stats · Entry counts & timeline" : "Settings · Journal & export"));
    top.appendChild(btn("◂ Journal", "jr-pad-back", () => { padCtl = "filter"; try { localStorage.setItem("ggo-journal-pad-ctl", "filter"); } catch (e) {} render(); }));
    box.appendChild(top);
    const body = mk("div", "jr-pad-ctl-body jr-pad-alt-body");
    if (padCtl === "stats") body.appendChild(countsBody());
    else {
      body.appendChild(mk("h4", "", "Journal settings"));
      body.appendChild(settingsBody());
      const all = J.entries.slice().sort(cmpDate);
      body.appendChild(mk("h4", "", "Export"));
      body.appendChild(mk("p", "hint", "Download entries as a CSV file for Excel: date, subject, students, tags, the entry, and the attendance / score snapshot."));
      const row = mk("div", "jr-row");
      row.appendChild(btn(`Export CSV — showing now (${sorted.length})`, "btn btn-ghost btn-small", () => downloadCsv(sorted, `journal-${today()}.csv`))).title = "The Log entries the index is showing, with the current sort and filters";
      if (pinned.length) row.appendChild(btn(`Export CSV — pinned (${pinned.length})`, "btn btn-ghost btn-small", () => downloadCsv(pinned, `journal-pinned-${today()}.csv`)));
      row.appendChild(btn(`Export CSV — all entries (${all.length})`, "btn btn-ghost btn-small", () => downloadCsv(all, `journal-all-${today()}.csv`)));
      body.appendChild(row);
    }
    box.appendChild(body);
    return box;
  }
  function buildPad(sorted, pinned, controls, command) {
    pinned = pinned || [];
    const wrap = mk("div", "jr-bookwrap jr-pad");
    const known = (id) => sorted.some((e) => e.id === id) || pinned.some((e) => e.id === id);
    if (focusId && known(focusId)) padSel = focusId;
    focusId = null;
    if (!known(padSel)) { padSel = sorted.length ? (sortKey === "date-asc" ? sorted[sorted.length - 1] : sorted[0]).id : pinned.length ? pinned[0].id : null; padFull = false; }
    const open = sorted.find((e) => e.id === padSel) || pinned.find((e) => e.id === padSel) || null;
    const openPinned = !!(open && open.pinned);
    const writing = creating || (editingId && open && editingId === open.id);
    const full = padFull || writing;
    const mode = displayMode;

    function padFoot(open) {
    const foot = mk("div", "jr-stage-foot");
    // the three bars pick what the main screen shows: the journal, Stats or Settings
    const bars = mk("span", "jr-sf-bars jr-pad-bars"); bars.setAttribute("role", "tablist"); bars.setAttribute("aria-label", "Control screen");
    [["filter", "Control"], ["stats", "Stats"], ["settings", "Settings"]].forEach(([k, label]) => {
      const b = mk("button", `jr-pad-bar${padCtl === k ? " on" : ""}`); b.type = "button";
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(padCtl === k)); b.title = { filter: "Control: the journal, with sort & filter below", stats: "Stats: entry counts & timeline on the screen", settings: "Settings: journal settings and CSV export on the screen" }[k];
      b.append(mk("i"), mk("span", "", label));
      b.addEventListener("click", () => { padCtl = k; try { localStorage.setItem("ggo-journal-pad-ctl", k); } catch (e) {} render(); });
      bars.appendChild(b);
    });
    foot.append(mk("span", "", "Link"), bars, mk("span", "", open ? (openPinned ? `Pinned ${pinned.indexOf(open) + 1} of ${pinned.length}` : `Entry ${sorted.indexOf(open) + 1} of ${sorted.length}`) : `${sorted.length} entries`));
    // the control screen under the main screen: sort & filter, as part of the pad
    return foot;
    }
    const head = mk("div", "jr-stage-head");
    head.append(mk("span", "", "Data pad · Teaching log"), mk("span", "", `${sorted.length} entr${sorted.length === 1 ? "y" : "ies"}${pinned.length ? ` · ${pinned.length} pinned` : ""}`));
    const screen = mk("div", `jr-pad-screen${full ? " jr-pad-full" : ""}`);

    // the index
    const list = mk("div", "jr-pad-list");
    const lh = mk("div", "jr-pad-listhead");
    lh.append(mk("span", "", "Index"), btn("+ New", "jr-pad-new", startNew));
    const rows = mk("div", "jr-pad-rows");
    const row = (e, num) => {
      const r = mk("button", `jr-pad-row jr-pad-${mode}${e.id === padSel ? " on" : ""}${e.mode === "list" && e.done ? " jr-isdone" : ""}`);
      r.type = "button"; r.setAttribute("aria-pressed", String(e.id === padSel));
      // Full: number, date, title, most of the text, who and tags · Partial: number, date, title, first 3 lines · Compact: the title only
      if (mode !== "compact") {
        const top = mk("span", "jr-pad-rowtop");
        top.append(mk("span", "jr-pad-n", num), mk("span", "jr-pad-d", e.date));
        if (e.mode === "list") top.appendChild(mk("span", "jr-pad-task", e.done ? "✔ done" : "○ to do"));
        r.appendChild(top);
      }
      r.appendChild(mk("span", "jr-pad-t", e.subject || "(no subject)"));
      if (mode !== "compact" && e.text) r.appendChild(mk("span", `jr-pad-s jr-pad-s-${mode}`, e.text));
      if (mode === "full") {
        r.appendChild(mk("span", "jr-pad-who", e.students.length ? `Students (${e.students.length}): ${e.students.map(sName).join(", ")}` : "Whole class"));
        if (e.tags.length) { const t = mk("span", "jr-pad-tags"); e.tags.forEach((x) => t.appendChild(mk("span", "jr-chip static", x))); r.appendChild(t); }
      }
      r.addEventListener("click", () => { if (creating || editingId) return; padSel = e.id; padFull = false; render(); });
      r.disabled = !!(creating || editingId);
      return r;
    };
    /** A category in the index: a heading bar (click to fold) and its rows. */
    const category = (key, label, items, numOf, empty) => {
      const shut = padCatsShut.has(key) && !items.some((e) => e.id === padSel);
      const h = mk("button", `jr-pad-cat jr-pad-cat-${key}${shut ? " shut" : ""}`); h.type = "button";
      h.append(mk("span", "jr-pad-cat-arrow", shut ? "▸" : "▾"), mk("span", "jr-pad-cat-name", label), mk("span", "jr-pad-cat-count", String(items.length).padStart(2, "0")));
      h.setAttribute("aria-expanded", String(!shut));
      h.addEventListener("click", () => {
        if (padCatsShut.has(key)) padCatsShut.delete(key); else padCatsShut.add(key);
        try { localStorage.setItem("ggo-journal-pad-shut", JSON.stringify([...padCatsShut])); } catch (e) {}
        render();
      });
      rows.appendChild(h);
      if (shut) return;
      if (!items.length && empty) rows.appendChild(mk("div", "jr-blank jr-pad-empty", empty));
      items.forEach((e, i) => rows.appendChild(row(e, numOf(i))));
    };
    if (pinned.length) category("pinned", "Pinned", pinned, (i) => `P${i + 1}`);
    category("log", pinned.length ? "Log" : "All entries", sorted, (i) => String(i + 1).padStart(2, "0"), viewActive() ? "No entries match the filters." : "This journal is empty.");
    list.append(lh, rows);

    // the open entry
    const det = mk("div", "jr-pad-detail");
    const dh = mk("div", "jr-pad-dethead");
    if (full && !writing) dh.appendChild(btn("◂ Index", "jr-pad-back", () => { padFull = false; render(); }));
    const where = open ? (openPinned ? `Pinned · P${pinned.indexOf(open) + 1}` : `Entry ${String(sorted.indexOf(open) + 1).padStart(2, "0")} / ${String(sorted.length).padStart(2, "0")}`) : "Data log";
    dh.appendChild(mk("span", "jr-pad-dlabel", creating ? "New entry" : editingId ? "Editing" : where));
    if (!full && open) dh.appendChild(btn("Expand ▸", "jr-pad-back", () => { padFull = true; render(); }));
    det.appendChild(dh);
    const body = mk("div", "jr-pad-detbody");
    if (creating) body.appendChild(buildForm(null));
    else if (open) {
      const lf = leaf(open);
      // on the pad the entry is already open right here: "Full view" becomes Expand / Index
      lf.querySelectorAll(".jr-foot-actions .btn").forEach((b) => { if (b.textContent === "Full view") b.remove(); });
      body.appendChild(lf);
    } else body.appendChild(newSlot(0));
    det.appendChild(body);
    screen.append(list, det);

    // The command strip, the journal screen and sort & filter belong to Control. Stats and Settings cover all three
    // with one screen of exactly the same size (the journal stays laid out underneath, hidden), so the pad never resizes.
    const stack = mk("div", "jr-pad-stack");
    if (command) stack.append(command);
    stack.append(screen);
    if (controls) { controls.classList.add("jr-pad-ctl"); stack.append(controls); }
    if (padCtl !== "filter") { stack.classList.add("jr-pad-alt-on"); stack.append(padAltScreen(sorted, pinned)); }
    wrap.append(head, stack, padFoot(padCtl === "filter" ? open : null));
    leadId = open ? open.id : null;
    return wrap;
  }

  function buildBook(sorted) {
    const wrap = mk("div", "jr-bookwrap");
    const mode = modeNow(), per = PER[mode];
    // pages: each is a list of items. A new entry's form gets a page of its own; otherwise "+ New Entry" follows the last entry.
    const pages = [];
    for (let i = 0; i < sorted.length; i += per) pages.push(sorted.slice(i, i + per).map((e) => ({ e })));
    if (creating) pages.push([{ form: true }]);
    else { const last = pages[pages.length - 1]; if (last && last.length < per) last.push({ nu: true }); else pages.push([{ nu: true }]); }
    const total = Math.max(1, Math.ceil(pages.length / 2));
    if (focusId) { const pi = pages.findIndex((pg) => pg.some((x) => x.e && x.e.id === focusId)); if (pi >= 0) spread = Math.floor(pi / 2); focusId = null; }
    if (spread === null) { const li = creating ? pages.length - 1 : pages.map((pg) => pg.some((x) => x.e)).lastIndexOf(true); spread = li < 0 ? 0 : Math.floor(li / 2); }
    spread = Math.max(0, Math.min(spread, total - 1));
    const prev = btn("‹", "jr-turn jr-turn-prev", () => turn(-1)); prev.title = "Previous pages"; prev.setAttribute("aria-label", "Previous pages");
    const next = btn("›", "jr-turn jr-turn-next", () => turn(1)); next.title = "Next pages"; next.setAttribute("aria-label", "Next pages");
    const book = mk("div", "jr-book");
    const left = mk("div", "jr-page jr-page-left"), right = mk("div", "jr-page jr-page-right");
    book.append(left, mk("div", "jr-spine"), right);
    const info = mk("div", "jr-bookinfo");
    // panel lettering (only the Tron: Legacy theme shows these)
    const stageHead = mk("div", "jr-stage-head"); const shR = mk("span"); stageHead.append(mk("span", "", "Data pad · Teaching log"), shR);
    const stageFoot = mk("div", "jr-stage-foot"); const sfR = mk("span"); const bars = mk("span", "jr-sf-bars"); bars.append(mk("i"), mk("i"), mk("i"));
    stageFoot.append(mk("span", "", "Link"), bars, sfR);
    function fill() {
      [[left, spread * 2], [right, spread * 2 + 1]].forEach(([pg, idx]) => {
        pg.innerHTML = "";
        pg.classList.toggle("jr-multi", per > 1);
        (pages[idx] || []).forEach((x) => {
          if (x.form) pg.appendChild(buildForm(null)); // a new entry is written on its own blank page
          else if (x.nu) pg.appendChild(newSlot(sorted.length));
          else pg.appendChild(mode === "full" ? leaf(x.e) : mode === "partial" ? partialEntry(x.e) : compactEntry(x.e));
        });
        pg.appendChild(mk("div", "jr-pageno", String(idx + 1)));
      });
      const first = [...(pages[spread * 2] || []), ...(pages[spread * 2 + 1] || [])].find((x) => x.e);
      leadId = first ? first.e.id : null;
      const lock = creating || !!editingId; // finish or cancel the open page first
      prev.disabled = lock || spread === 0; next.disabled = lock || spread >= total - 1;
      prev.title = next.title = lock ? "Save or cancel the open entry first" : "";
      info.textContent = `Pages ${spread * 2 + 1}–${spread * 2 + 2} of ${total * 2} · ${sorted.length} entr${sorted.length === 1 ? "y" : "ies"}`;
      shR.textContent = `${sorted.length} entr${sorted.length === 1 ? "y" : "ies"}`; sfR.textContent = `Pages ${spread * 2 + 1}–${spread * 2 + 2} of ${total * 2}`;
    }
    function turn(dir) {
      if (turning || creating || editingId || spread + dir < 0 || spread + dir >= total) return;
      const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const T = reduce ? 0 : parseInt(getComputedStyle(book).getPropertyValue("--jr-ms")) || 260;
      const name = dir > 0 ? "next" : "prev";
      turning = true;
      book.classList.add(`jr-out-${name}`);
      setTimeout(() => {
        spread += dir; fill();
        book.classList.remove(`jr-out-${name}`); book.classList.add(`jr-in-${name}`);
        setTimeout(() => { book.classList.remove(`jr-in-${name}`); turning = false; }, T);
      }, T);
    }
    fill();
    const row = mk("div", "jr-bookrow"); row.append(prev, book, next);
    wrap.append(stageHead, row, stageFoot, info);
    return wrap;
  }

  // ---------- sections ----------
  function section(id, title) {
    const s = mk("div", "settings-section"); s.id = `journal-sec-${id}`;
    s.appendChild(mk("h3", "", title));
    return s;
  }
  const bars = (rows, fmt, onClick) => {
    const max = Math.max(1, ...rows.map((r) => r[1])); const box = mk("div");
    rows.forEach(([label, n]) => { const d = mk("div", "jr-bar" + (onClick ? " click" : "")); if (onClick) d.addEventListener("click", () => onClick(label)); const i = mk("i"); i.style.width = `${Math.round((n / max) * 160)}px`; d.append(mk("span", "", fmt ? fmt(label) : label), i, mk("span", "", String(n))); box.appendChild(d); });
    if (!rows.length) box.appendChild(mk("p", "hint", "Nothing yet."));
    return box;
  };

  function countsSection() {
    const s = section("counts", "Entry Counts & Timeline"); s.appendChild(countsBody());
    return s;
  }
  /** Entry counts, the timeline, by tag and by student (the Stats screen on the data pad; a section elsewhere). */
  function countsBody() {
    const body = mk("div");
    const E = J.entries;
    const days = new Set(E.map((e) => e.date)).size;
    const mentioned = new Set(E.flatMap((e) => e.students)).size;
    body.appendChild(mk("p", "hint", `${E.length} entr${E.length === 1 ? "y" : "ies"} on ${days} day${days === 1 ? "" : "s"}; ${mentioned} of ${RosterModule.students.length} students mentioned.`));
    const months = {}; E.forEach((e) => { const m = e.date.slice(0, 7); months[m] = (months[m] || 0) + 1; });
    const mrows = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
    const two = mk("div", "jr-two");
    const c1 = mk("div"); c1.appendChild(mk("h4", "", "Timeline (entries per month)")); c1.appendChild(bars(mrows)); two.appendChild(c1);
    const tags = {}; E.forEach((e) => e.tags.forEach((t) => { const k = t.toLowerCase(); tags[k] = tags[k] || { name: t, n: 0 }; tags[k].n++; }));
    const c2 = mk("div"); c2.appendChild(mk("h4", "", "By tag (click tags to list their entries)"));
    const tl = Object.values(tags).sort((a, b) => b.n - a.n);
    const maxN = Math.max(1, ...tl.map((t) => t.n));
    tl.forEach((t) => {
      const on = [...tagFilter].some((x) => x.toLowerCase() === t.name.toLowerCase());
      const d = mk("div", "jr-bar");
      const chip = btn(t.name, "jr-chip" + (on ? " on" : ""), () => {
        tagFilter = new Set([...tagFilter].filter((x) => x.toLowerCase() !== t.name.toLowerCase()));
        if (!on) tagFilter.add(t.name);
        if (isPad()) padCtl = "filter"; // on the data pad, show the journal listing that tag's entries
        spread = null; const y = window.scrollY; render(); window.scrollTo({ top: y });
      });
      chip.setAttribute("aria-pressed", String(on));
      const i = mk("i"); i.style.width = `${Math.round((t.n / maxN) * 160)}px`;
      d.append(chip, i, mk("span", "", String(t.n))); c2.appendChild(d);
    });
    if (!tl.length) c2.appendChild(mk("p", "hint", "Nothing yet."));
    two.appendChild(c2);
    body.appendChild(two);
    const per = students().map((st) => [sName(st.id), E.filter((e) => e.students.includes(st.id)).length]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], undefined, { numeric: true }));
    body.appendChild(mk("h4", "", "By student (fewest entries first)"));
    body.appendChild(bars(per));
    return body;
  }
  function downloadCsv(list, name) {
    const a = mk("a"); a.href = URL.createObjectURL(new Blob([csvText(exportRows(list))], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  function csvText(rows) {
    return "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  }
  function exportRows(list) {
    const rows = [["Date", "Subject", "Students", "Tags", "Entry", "Attendance / score snapshot"]];
    list.forEach((e) => rows.push([e.date, e.subject || "", e.students.length ? e.students.map(sName).join("; ") : "whole class", e.tags.join("; "), e.text, snapParts(e).map((p) => `${p.who}: ${p.text}`).join(" | ")]));
    return rows;
  }

  function searchSection() {
    const s = section("search", "Search & Report"); const body = mk("div"); s.appendChild(body);
    const f = mk("div", "jr-filters");
    const lab = (t, input) => { const l = mk("label", "", t); l.appendChild(input); f.appendChild(l); return input; };
    const from = lab("From", Object.assign(mk("input"), { type: "date", value: sel.from }));
    const to = lab("To", Object.assign(mk("input"), { type: "date", value: sel.to }));
    const tag = mk("select"); tag.appendChild(Object.assign(mk("option"), { value: "", textContent: "Any" })); J.allTags().forEach((t) => tag.appendChild(Object.assign(mk("option"), { value: t, textContent: t }))); tag.value = sel.tag; lab("Tag", tag);
    const stu = mk("select"); stu.appendChild(Object.assign(mk("option"), { value: "", textContent: "Anyone" })); students().forEach((x) => stu.appendChild(Object.assign(mk("option"), { value: x.id, textContent: sName(x.id) }))); stu.value = sel.student; lab("Student", stu);
    const word = lab("Word", Object.assign(mk("input"), { type: "search", value: sel.word, placeholder: "keyword…" }));
    body.appendChild(f);
    const out = mk("div"); body.appendChild(out);
    const run = () => {
      sel = { from: from.value, to: to.value, tag: tag.value, student: stu.value, word: word.value };
      const list = J.search(sel); out.innerHTML = "";
      const bar = mk("div", "jr-row"); bar.appendChild(mk("span", "hint", `${list.length} matching entr${list.length === 1 ? "y" : "ies"}`));
      bar.appendChild(btn("Export CSV", "btn btn-ghost btn-small", () => {
        const a = mk("a"); a.href = URL.createObjectURL(new Blob([csvText(exportRows(list))], { type: "text/csv;charset=utf-8" }));
        a.download = `journal-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
      }));
      out.appendChild(bar);
      if (!list.length) return;
      const t = mk("table", "jr-table"); const hr = mk("tr"); ["Date", "Subject", "Students", "Tags", "Entry", "Snapshot"].forEach((h) => hr.appendChild(mk("th", "", h)));
      const th = mk("thead"); th.appendChild(hr); t.appendChild(th); const tb = mk("tbody"); t.appendChild(tb);
      list.forEach((e) => { const tr = mk("tr"); [e.date, e.subject || "", e.students.length ? e.students.map(sName).join(", ") : "whole class", e.tags.join(", "), e.text, snapParts(e).map((p) => `${p.who}: ${p.text}`).join("\n")].forEach((v) => { const td = mk("td", "", v); td.style.whiteSpace = "pre-wrap"; tr.appendChild(td); }); tb.appendChild(tr); });
      out.appendChild(t);
    };
    [from, to, tag, stu].forEach((i) => i.addEventListener("change", run));
    word.addEventListener("input", run);
    run();
    return s;
  }

  function settingsSection() {
    const s = section("settings", "Journal Settings"); s.appendChild(settingsBody());
    return s;
  }
  /** Snapshot switch and the quick-pick tags (the Settings screen on the data pad; a section elsewhere). */
  function settingsBody() {
    const body = mk("div");
    const l = mk("label"); const c = mk("input"); c.type = "checkbox"; c.checked = J.settings.snapshots;
    c.addEventListener("change", () => { J.settings.snapshots = c.checked; render(); });
    l.append(c, document.createTextNode(" Show attendance / score snapshot beside entries")); body.appendChild(l);
    body.appendChild(mk("h4", "", "Quick-pick tags"));
    const box = mk("div");
    J.settings.tags.forEach((t) => { const chip = mk("span", "jr-chip static", t + " "); chip.appendChild(btn("✕", "btn btn-ghost btn-small", () => { J.removeSettingsTag(t); render(); })); box.appendChild(chip); });
    if (!J.settings.tags.length) box.appendChild(mk("p", "hint", "None yet. Tags you type into an entry are also offered next time."));
    body.appendChild(box);
    const ni = mk("input"); ni.placeholder = "add a tag…";
    const add = () => { if (ni.value.trim()) { J.addSettingsTag(ni.value); render(); } };
    ni.addEventListener("keydown", (ev) => { if (ev.key === "Enter") add(); });
    body.append(ni, btn("Add", "btn btn-ghost btn-small", add));
    return body;
  }

  // ---------- the panel ----------
  const status = mk("span", "result");
  function render() {
    panel.innerHTML = "";
    const bar = mk("div", "panel-toolbar pad-toolbar");
    const readout = mk("div", "pad-readout pad-readout-tron"); // entry count, shown by the Tron: Legacy theme
    readout.append(mk("span", "count-badge", String(J.entries.length)), mk("span", "pad-readout-label", "Entries"));
    bar.appendChild(readout);
    const left = mk("div", "panel-toolbar-buttons pad-main");
    const writeGroup = mk("div", "pad-group"); writeGroup.dataset.label = "Write";
    writeGroup.appendChild(btn("+ New Entry", "btn btn-ghost", startNew));
    left.appendChild(writeGroup);
    const seg = mk("div", "jr-seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "How entries are shown");
    seg.appendChild(mk("span", "jr-seg-label", "Show entries:"));
    [["full", "Full"], ["partial", "Partial"], ["compact", "Compact"]].forEach(([id, label]) => {
      const b = btn(label, `btn btn-small ${displayMode === id ? "btn-primary" : "btn-ghost"}`, () => {
        if (creating || editingId) return;
        focusId = leadId; displayMode = id;
        try { localStorage.setItem("ggo-journal-display", id); } catch (e) {}
        render();
      });
      b.setAttribute("aria-pressed", String(displayMode === id)); b.disabled = creating || !!editingId;
      b.title = isPad()
        ? { full: "Index shows most of each entry: title, text, students and tags", partial: "Index shows each entry's title and first 3 lines", compact: "Index shows titles only" }[id]
        : { full: "One whole entry per page", partial: "Up to 3 entries per page: title, first 2 lines, details", compact: "Up to 6 entries per page: titles only" }[id];
      seg.appendChild(b);
    });
    const showGroup = mk("div", "pad-group"); showGroup.dataset.label = "Show Entries";
    showGroup.appendChild(seg);
    left.appendChild(showGroup);
    bar.appendChild(left);
    const saveJournal = async () => {
      try { status.textContent = "Saving…"; if (openForm && openForm.submit(true)) render(); await J.save(); status.textContent = "Saved ✓"; } catch (e) { status.textContent = `Couldn't save: ${e.message}`; }
    };
    const autosaving = !!(window.GGOAutosave && GGOAutosave.enabled());
    if (!isPad()) {
      const right = mk("div", "pad-save"); right.appendChild(status);
      right.appendChild(btn("Save Journal", "btn btn-primary", saveJournal));
      bar.appendChild(right); panel.appendChild(bar);
    } else if (!autosaving) {
      // the data pad has no Save button while autosave is on; with autosave off it keeps a small one so entries can still be stored
      const right = mk("div", "pad-save");
      right.appendChild(btn("Save", "btn btn-primary btn-small", saveJournal)).title = "Autosave is off: save the journal";
      bar.appendChild(right);
    }

    const pinned = J.entries.filter((e) => e.pinned).sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""));
    const sorted = visibleEntries();
    const sf = sortFilterBar(sorted.length, J.entries.filter((e) => !e.pinned).length);
    if (isPad()) { // the data pad carries its commands on a strip at the top and sort & filter / stats / settings at the bottom
      const cmd = mk("div", "jr-pad-cmd");
      const strip = mk("div", "jr-pad-cmdhead"); strip.append(mk("span", "", "Command"), status);
      cmd.append(strip, bar);
      panel.appendChild(buildPad(sorted, pinned, padControls(sorted, pinned, sf), cmd));
    }
    else { panel.appendChild(buildBook(sorted)); panel.appendChild(sf); } // the journal is always on the desk, even with no entries
    if (refocus) { const f = document.getElementById(refocus); refocus = null; if (f) { f.focus(); try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} } }
    if (pinned.length && !isPad()) { // the data pad lists pinned entries as their own category in its index
      const m = mk("div", "jr-margin");
      let shut = false; try { shut = localStorage.getItem("ggo-journal-margin-shut") === "1"; } catch (e) {}
      const mt = mk("div", "jr-margin-title"); mt.tabIndex = 0; mt.setAttribute("role", "button");
      const mtext = () => `${shut ? "▸" : "▾"} 📌 Margin — pinned entries (${pinned.length})`;
      mt.textContent = mtext(); mt.setAttribute("aria-expanded", String(!shut)); m.classList.toggle("shut", shut);
      const flip = () => {
        shut = !shut; try { localStorage.setItem("ggo-journal-margin-shut", shut ? "1" : "0"); } catch (e) {}
        mt.textContent = mtext(); mt.setAttribute("aria-expanded", String(!shut)); m.classList.toggle("shut", shut);
        m.querySelectorAll(".jr-mentry").forEach((x) => { x.hidden = shut; });
      };
      mt.addEventListener("click", flip); mt.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); flip(); } });
      m.appendChild(mt);
      pinned.forEach((e) => {
        const d = mk("details", "jr-mentry"); if (editingId === e.id) d.open = true;
        const sm = mk("summary"); sm.appendChild(mk("b", "", e.subject || "(no subject)")); sm.appendChild(mk("span", "jr-meta", `  ${e.date}${e.mode === "list" ? (e.done ? " · ✔ done" : " · to do") : ""}${e.tags.length ? " · " + e.tags.map((t) => "#" + t).join(" ") : ""}`));
        sm.appendChild(pinPill(e, () => { J.setPinned(e.id, false); render(); }));
        sm.querySelector(".jr-pinpill").addEventListener("click", (ev) => ev.stopPropagation());
        d.append(sm, entryCard(e)); d.hidden = shut && editingId !== e.id; m.appendChild(d);
      });
      panel.appendChild(m);
    }

    // On the data pad, Stats, Settings and Export live on its control screen: nothing sits below it.
    (isPad() ? [] : [["journal-counts", countsSection()], ["journal-search", searchSection()], ["journal-settings", settingsSection()]]).forEach(([id, sec]) => {
      panel.appendChild(sec);
      if (window.GGOSections) window.GGOSections.add(id, `#${sec.id}`);
    });
  }

  new MutationObserver(() => { if (!panel.hidden && !creating && !editingId) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  let loadedFor = null;
  async function ensureLoaded() {
    const cid = AttendanceModule.currentCourseId || ScoringModule.currentCourseId;
    if (!cid) { status.textContent = ""; return; }
    if (loadedFor === cid && J.currentCourseId === cid) return;
    try { status.textContent = "Loading…"; await J.load(cid); loadedFor = cid; status.textContent = ""; editingId = null; creating = false; spread = null; }
    catch (e) { J.entries = []; status.textContent = `Couldn't load journal: ${e.message}`; }
  }

  const origShowTab = window.showTab;
  window.showTab = function (tab) {
    if (tab !== "journal" && !panel.hidden && openForm && openForm.submit(true)) { try { render(); } catch (e) {} }
    origShowTab.apply(this, arguments);
    const on = tab === "journal";
    panel.hidden = !on;
    tabBtn.classList.toggle("tab-btn-active", on);
    if (on) { spread = null; ensureLoaded().then(render); } // opens at the latest entry
  };
  tabBtn.addEventListener("click", () => window.showTab("journal"));
  window.JournalUI = { render, ensureLoaded };
})();
