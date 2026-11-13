// ===== Delivery log: "has this result been emailed or printed, and to whom?" =====
// A log is a plain array saved with its owner (e.g. a Presentation Calc project's templateSettings.deliveries).
// DeliveryLog.record(list, {kind, method:'email'|'print', recipients:[text], test}) adds an entry;
// DeliveryLog.indicator(list, {kinds:[[key,label]], method, title}) draws one expandable line per result.
(function () {
  const MAX = 300;
  const stamp = (iso) => { try { return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso; } };
  const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
  const DeliveryLog = {
    clean(list) { return (Array.isArray(list) ? list : []).filter((e) => e && typeof e === "object" && e.kind && (e.method === "email" || e.method === "print") && e.at && Array.isArray(e.recipients)).slice(-MAX); },
    record(list, { kind, method, recipients, test }) {
      list.push({ id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, method, at: new Date().toISOString(), recipients: recipients.map(String), test: !!test });
      if (list.length > MAX) list.splice(0, list.length - MAX);
    },
    indicator(list, { kinds, method, title }) {
      const root = el("div", "dl-box");
      root.style.cssText = "margin:8px 0;padding:6px 10px;border:1px solid var(--line);border-radius:8px;";
      const verb = method === "email" ? "emailed" : "printed", icon = method === "email" ? "✉" : "🖨";
      const draw = () => {
        const open = new Set([...root.querySelectorAll("details[open]")].map((d) => d.dataset.kind));
        root.textContent = "";
        if (title) { const t = el("div", "hint", title); t.style.fontWeight = "700"; root.appendChild(t); }
        kinds.forEach(([key, label]) => {
          const mine = list.filter((e) => e.kind === key && e.method === method).sort((a, b) => String(b.at).localeCompare(String(a.at)));
          if (!mine.length) { const n = el("div", "hint", `${label} — not yet ${verb}`); n.style.opacity = ".7"; root.appendChild(n); return; }
          const d = el("details"); d.dataset.kind = key; if (open.has(key)) d.open = true;
          const last = mine[0], real = mine.filter((e) => !e.test);
          const sum = el("summary", "", `${icon} ${label} — ${verb}${mine.length > 1 ? ` ${mine.length}×` : ""} · last ${stamp(last.at)}${last.test ? " (test)" : ` · ${last.recipients.length} recipient${last.recipients.length === 1 ? "" : "s"}`}`);
          sum.style.cssText = "cursor:pointer;font-weight:600;color:" + (real.length ? "var(--green-dark)" : "inherit") + ";";
          d.appendChild(sum);
          mine.forEach((e) => {
            const blk = el("div"); blk.style.cssText = "margin:6px 0 6px 18px;";
            blk.appendChild(el("div", "", `${stamp(e.at)} — ${verb} ${e.test ? "as a test to" : "to"} ${e.recipients.length} ${e.recipients.length === 1 ? "recipient" : "recipients"}`));
            const ul = el("ul"); ul.style.cssText = "margin:2px 0 0;padding-left:20px;columns:2;font-size:.9rem;";
            e.recipients.forEach((r) => ul.appendChild(el("li", "", r)));
            blk.appendChild(ul); d.appendChild(blk);
          });
          root.appendChild(d);
        });
      };
      draw();
      root.refresh = draw;
      return root;
    },
  };
  window.DeliveryLog = DeliveryLog;
})();
