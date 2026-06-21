// Generates all PWA + iOS icons and a splash screen from a branded SVG.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(__dirname, "..", "public");
const ICONS = resolve(PUB, "icons");
mkdirSync(ICONS, { recursive: true });

// Branded gauge mark on a dark gradient tile. `pad` carves the maskable safe area.
function iconSVG(size, pad = 0.12) {
  const s = size;
  const c = s / 2;
  const r = s * (0.34 - pad * 0.3);
  const needleLen = r * 0.92;
  // needle pointing up-right (~ -38deg from center)
  const a = (-38 * Math.PI) / 180;
  const nx = c + needleLen * Math.cos(a);
  const ny = c + needleLen * Math.sin(a);
  const dash = 2 * Math.PI * r;
  const on = dash * 0.75;
  const off = dash * 0.25;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#15123a"/>
        <stop offset="1" stop-color="#07070f"/>
      </linearGradient>
      <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8b7bff"/>
        <stop offset="1" stop-color="#2ee6c6"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
        <stop offset="0" stop-color="rgba(139,123,255,0.35)"/>
        <stop offset="1" stop-color="rgba(139,123,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#bg)"/>
    <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#glow)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#ring)"
      stroke-width="${s * 0.05}" stroke-linecap="round"
      stroke-dasharray="${on} ${off}" transform="rotate(135 ${c} ${c})"/>
    <line x1="${c}" y1="${c}" x2="${nx}" y2="${ny}" stroke="#2ee6c6"
      stroke-width="${s * 0.045}" stroke-linecap="round"/>
    <circle cx="${c}" cy="${c}" r="${s * 0.058}" fill="#2ee6c6"/>
    <circle cx="${c}" cy="${c}" r="${s * 0.025}" fill="#07070f"/>
  </svg>`);
}

function splashSVG(w, h) {
  const c = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2 - c * 0.04;
  const r = c * 0.16;
  const a = (-38 * Math.PI) / 180;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0d0b1f"/><stop offset="1" stop-color="#07070f"/>
      </linearGradient>
      <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8b7bff"/><stop offset="1" stop-color="#2ee6c6"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.42" r="0.5">
        <stop offset="0" stop-color="rgba(139,123,255,0.25)"/><stop offset="1" stop-color="rgba(139,123,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#ring)" stroke-width="${c * 0.022}"
      stroke-linecap="round" stroke-dasharray="${2 * Math.PI * r * 0.75} ${2 * Math.PI * r * 0.25}" transform="rotate(135 ${cx} ${cy})"/>
    <line x1="${cx}" y1="${cy}" x2="${cx + r * 0.9 * Math.cos(a)}" y2="${cy + r * 0.9 * Math.sin(a)}" stroke="#2ee6c6" stroke-width="${c * 0.02}" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="${c * 0.026}" fill="#2ee6c6"/>
    <text x="${cx}" y="${cy + r + c * 0.16}" text-anchor="middle" fill="#ecedf6"
      font-family="Helvetica, Arial, sans-serif" font-size="${c * 0.075}" font-weight="700" letter-spacing="1">Gas Guru</text>
    <text x="${cx}" y="${cy + r + c * 0.23}" text-anchor="middle" fill="#6f7095"
      font-family="Helvetica, Arial, sans-serif" font-size="${c * 0.032}" letter-spacing="3">FREDERICTON · NB FUEL</text>
  </svg>`);
}

async function png(svg, size, out, opaque = false) {
  let img = sharp(svg).resize(size, size);
  if (opaque) img = img.flatten({ background: "#07070f" });
  await img.png().toFile(out);
  console.log("✓", out.split(/[\\/]/).pop());
}

await png(iconSVG(192, 0), 192, resolve(ICONS, "icon-192.png"));
await png(iconSVG(512, 0), 512, resolve(ICONS, "icon-512.png"));
await png(iconSVG(512, 0.16), 512, resolve(ICONS, "icon-maskable-512.png"));
await png(iconSVG(180, 0), 180, resolve(PUB, "apple-touch-icon.png"), true);

// Splash (portrait); iOS will scale/letterbox to fit any device.
await sharp(splashSVG(1284, 2778)).png().toFile(resolve(ICONS, "apple-splash.png"));
console.log("✓ apple-splash.png");
