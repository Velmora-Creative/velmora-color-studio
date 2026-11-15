const palette = [
  { hex: "#8062DF", locked: false },
  { hex: "#42C6B7", locked: false },
  { hex: "#F2B880", locked: false },
  { hex: "#E879A8", locked: false },
  { hex: "#29324B", locked: false }
];

const $ = (id) => document.getElementById(id);

/* ---------- Helpers ---------- */

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return ("#" + toHex(f(0)) + toHex(f(8)) + toHex(f(4))).toUpperCase();
}

const rand = (min, max) => Math.random() * (max - min) + min;

// Spread hues around the wheel with controlled saturation/lightness so palettes look balanced.
function generateColors(count) {
  const base = rand(0, 360);
  return Array.from({ length: count }, (_, i) => {
    const hue = (base + i * (360 / count) + rand(-15, 15) + 360) % 360;
    return hslToHex(Math.round(hue), Math.round(rand(50, 78)), Math.round(rand(38, 72)));
  });
}

let toastTimer;
function showToast(message) {
  let toast = $("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

let statusTimer;
function setExportStatus(message) {
  $("exportStatus").textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $("exportStatus").textContent = ""; }, 2500);
}

async function copyText(value, label = "Copied") {
  let ok = false;
  try {
    await navigator.clipboard.writeText(value);
    ok = true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
  }
  showToast(ok ? `${label} copied` : "Couldn't copy. Please copy manually.");
  return ok;
}

/* ---------- Palette ---------- */

function renderPalette() {
  $("swatches").innerHTML = "";
  palette.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "swatch";
    card.innerHTML = `
      <div class="swatch-tile">
        <button class="swatch-color" style="background:${item.hex}" data-index="${index}" aria-label="Copy ${item.hex}" title="Click to copy ${item.hex}"></button>
        <button class="lock-button" data-lock="${index}" aria-pressed="${item.locked}" aria-label="${item.locked ? "Unlock" : "Lock"} color ${index + 1}">${item.locked ? "🔒" : "🔓"}</button>
      </div>
      <div class="swatch-code"><span>${item.hex}</span><button data-copy-color="${index}" aria-label="Copy ${item.hex}">COPY</button></div>`;
    $("swatches").appendChild(card);
  });
}

function generatePalette() {
  const fresh = generateColors(palette.length);
  palette.forEach((item, i) => { if (!item.locked) item.hex = fresh[i]; });
  renderPalette();
}

/* ---------- Converter ---------- */

function normalizeHex(value) {
  let clean = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) clean = clean.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(clean) ? "#" + clean.toUpperCase() : null;
}

function hexToRgb(hex) {
  const normal = normalizeHex(hex);
  if (!normal) return null;
  const clean = normal.slice(1);
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0, l = (max + min) / 2;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60; if (h < 0) h += 360;
  }
  return `${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
}

function convertColor() {
  const normal = normalizeHex($("convertHex").value);
  const rgb = normal && hexToRgb(normal);
  if (!rgb) {
    $("convertStatus").textContent = "Enter a valid HEX color, such as #8062DF or #86D.";
    return;
  }
  $("convertStatus").textContent = "";
  $("convertHex").value = normal;
  $("rgbValue").textContent = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  $("hslValue").textContent = rgbToHsl(rgb);
}

/* ---------- Gradient ---------- */

function updateGradient() {
  const a = $("gradientA").value, b = $("gradientB").value, dir = $("gradientDirection").value;
  $("gradientPreview").style.background = `linear-gradient(${dir}, ${a}, ${b})`;
}

/* ---------- Contrast ---------- */

function luminance(hex) {
  const rgb = hexToRgb(hex);
  const channels = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function updateContrast() {
  const fg = $("textColor").value, bg = $("backgroundColor").value;
  const l1 = luminance(fg), l2 = luminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  $("contrastPreview").style.color = fg;
  $("contrastPreview").style.background = bg;
  $("contrastRatio").textContent = ratio.toFixed(2) + ":1";
  $("contrastGrade").textContent =
    ratio >= 7 ? "AAA: Excellent" :
    ratio >= 4.5 ? "AA: Passes normal text" :
    ratio >= 3 ? "Passes large text only" :
    "Low contrast: needs improvement";
}

/* ---------- Export ---------- */

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function paletteValues() { return palette.map((p) => p.hex); }

function exportCss() {
  const css = ":root {\n" + paletteValues().map((c, i) => `  --color-${i + 1}: ${c};`).join("\n") + "\n}\n";
  downloadFile("velmora-palette.css", css, "text/css");
  setExportStatus("CSS variables downloaded.");
}

function exportJson() {
  const data = { name: "Velmora Color Studio palette", colors: paletteValues() };
  downloadFile("velmora-palette.json", JSON.stringify(data, null, 2), "application/json");
  setExportStatus("JSON palette downloaded.");
}

/* ---------- Events ---------- */

$("generateBtn").addEventListener("click", generatePalette);

$("swatches").addEventListener("click", async (e) => {
  const lock = e.target.closest("[data-lock]");
  if (lock) {
    const i = Number(lock.dataset.lock);
    palette[i].locked = !palette[i].locked;
    renderPalette();
    const again = document.querySelector(`[data-lock="${i}"]`);
    if (again) again.focus(); // keep keyboard focus after re-render
    return;
  }
  const copy = e.target.closest("[data-copy-color]");
  const colorArea = e.target.closest(".swatch-color");
  const i = copy ? Number(copy.dataset.copyColor) : colorArea ? Number(colorArea.dataset.index) : null;
  if (i !== null) await copyText(palette[i].hex, palette[i].hex);
});

$("convertBtn").addEventListener("click", convertColor);
$("convertHex").addEventListener("keydown", (e) => { if (e.key === "Enter") convertColor(); });

const copyPrefix = { rgbValue: "rgb", hslValue: "hsl" };
document.querySelectorAll("[data-copy]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const id = btn.dataset.copy;
    const prefix = copyPrefix[id];
    const value = $(id).textContent;
    copyText(prefix ? `${prefix}(${value})` : value, prefix ? prefix.toUpperCase() : "Value");
  })
);

["gradientA", "gradientB", "gradientDirection"].forEach((id) => $(id).addEventListener("input", updateGradient));
$("copyGradient").addEventListener("click", () =>
  copyText(`background: linear-gradient(${$("gradientDirection").value}, ${$("gradientA").value}, ${$("gradientB").value});`, "Gradient CSS")
);

["textColor", "backgroundColor"].forEach((id) => $(id).addEventListener("input", updateContrast));

$("exportCss").addEventListener("click", exportCss);
$("exportJson").addEventListener("click", exportJson);
$("copyPalette").addEventListener("click", async () => {
  const ok = await copyText(paletteValues().join(", "), "HEX values");
  setExportStatus(ok ? "HEX values copied." : "Couldn't copy HEX values.");
});

renderPalette();
convertColor();
updateGradient();
updateContrast();
