import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const iconsDir = join(publicDir, "icons");
const source = join(publicDir, "logo-mb.png");

// Black vignette background: subtle charcoal center fading to pure black at
// the edges, so a soft drop shadow underneath the logo has something to read
// against (a pure-black shadow on a pure-black background would be invisible).
const BACKGROUND_CENTER = "#161616";
const BACKGROUND_EDGE = "#000000";

await mkdir(iconsDir, { recursive: true });

function vignetteBackground(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stop-color="${BACKGROUND_CENTER}"/>
          <stop offset="100%" stop-color="${BACKGROUND_EDGE}"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>
  `);
}

// Renders the logo centered on a black vignette with a soft drop shadow cast
// from its own silhouette, so the icon reads as floating above the background.
async function makeShadowedIcon({ size, logoScale, outFile }) {
  const logoSize = Math.round(size * logoScale);
  const pad = Math.round((size - logoSize) / 2);
  const logo = await sharp(source).resize(logoSize, logoSize).toBuffer();

  const alpha = await sharp(logo).ensureAlpha().extractChannel("alpha").toBuffer();
  const shadowBlur = Math.max(1, Math.round(size * 0.032));
  const shadowOffset = Math.round(size * 0.028);
  const shadow = await sharp({
    create: { width: logoSize, height: logoSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: alpha, blend: "dest-in" }])
    .blur(shadowBlur)
    .png()
    .toBuffer();

  const background = await sharp(vignetteBackground(size)).png().toBuffer();

  await sharp(background)
    .composite([
      { input: shadow, left: pad, top: pad + shadowOffset },
      { input: logo, left: pad, top: pad },
    ])
    .png()
    .toFile(join(iconsDir, outFile));
}

await makeShadowedIcon({ size: 192, logoScale: 0.82, outFile: "icon-192.png" });
await makeShadowedIcon({ size: 512, logoScale: 0.82, outFile: "icon-512.png" });

// Maskable needs extra safe-area padding (~20%) since platforms crop to a
// circle/squircle — a full-bleed logo would get its edges cut off.
await makeShadowedIcon({ size: 512, logoScale: 0.6, outFile: "icon-512-maskable.png" });

console.log("PWA icons generated at public/icons/");
