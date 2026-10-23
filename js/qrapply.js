// ===== Applies a QR-form style (colors + font) to a student's form page =====
// Loaded by quizform.html and presform.html (and collect.html). The style travels in the link as
// ?s=<bg>-<card>-<ink>-<accent>-<head>-<line>-<font letter><size digit>, made by js/qrstyles.js.
(function () {
  const STACKS = {
    g: ['-apple-system,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",sans-serif', 'Georgia,"Times New Roman","Hiragino Mincho ProN","Noto Serif JP",serif'],
    a: ['-apple-system,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",sans-serif'],
    b: ['Georgia,"Times New Roman","Hiragino Mincho ProN","Noto Serif JP",serif'],
    c: ['"Trebuchet MS","Hiragino Maru Gothic ProN","Segoe UI",Roboto,sans-serif'],
    d: ['"Courier New",ui-monospace,Menlo,Consolas,monospace'],
    e: ['Verdana,"Gill Sans","Century Gothic","Hiragino Sans",sans-serif'],
    f: ['"Comic Sans MS","Chalkboard SE","Marker Felt","Hiragino Maru Gothic ProN",cursive'],
  };
  const SCALE = [0.9, 1, 1.2];
  const raw = new URLSearchParams(location.search).get("s");
  if (!raw) return;
  const parts = raw.split("-");
  if (parts.length !== 7 || !parts.slice(0, 6).every((p) => /^[0-9a-fA-F]{6}$/.test(p)) || !/^[a-g][0-2]$/.test(parts[6])) return;
  const [bg, card, ink, accent, head, line] = parts.slice(0, 6).map((p) => "#" + p);
  const font = STACKS[parts[6][0]] || STACKS.a;
  const body = font[0], heading = font[1] || font[0];
  const k = SCALE[Number(parts[6][1])] || 1;
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const onAccent = lum(accent) > 0.45 ? "#111111" : "#ffffff";
  const css = `
:root { --paper:${bg}; --card:${card}; --ink:${ink}; --soft:color-mix(in srgb, ${ink} 62%, ${bg}); --ink-soft:color-mix(in srgb, ${ink} 62%, ${bg});
  --green:${accent}; --dark:${head}; --green-dark:${head}; --line:${line}; --chip:color-mix(in srgb, ${accent} 14%, ${card}); }
html, body { background:${bg} !important; color:${ink} !important; }
body { font-family:${body} !important; font-size:${(17 * k).toFixed(1)}px !important; }
h1, h2, .block h2 { font-family:${heading} !important; color:${head} !important; }
input, textarea, button, select { font-family:inherit !important; }
.card, .timer:not(.low), .opt:not(.on), .chip:not(.on), input[type=text], textarea { background:${card} !important; color:${ink} !important; }
.opt.on, .chip.on, button.primary { color:${onAccent} !important; }
.timer:not(.low) { border-color:${accent} !important; }
`;
  const st = document.createElement("style");
  st.id = "qr-style";
  st.textContent = css;
  document.head.appendChild(st);
})();
