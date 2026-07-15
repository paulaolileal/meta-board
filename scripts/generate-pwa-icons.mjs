import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const iconsDir = join(publicDir, "icons");
const source = join(publicDir, "logo-mb.png");

await mkdir(iconsDir, { recursive: true });

await sharp(source).resize(192, 192).png().toFile(join(iconsDir, "icon-192.png"));
await sharp(source).resize(512, 512).png().toFile(join(iconsDir, "icon-512.png"));

// Maskable icons need safe-area padding (~20%) since platforms crop to a
// circle/squircle — a full-bleed logo would get its edges cut off.
const maskableSize = 512;
const logoSize = Math.round(maskableSize * 0.6);
await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: "#7c3aed",
  },
})
  .composite([
    {
      input: await sharp(source).resize(logoSize, logoSize).toBuffer(),
      gravity: "center",
    },
  ])
  .png()
  .toFile(join(iconsDir, "icon-512-maskable.png"));

console.log("PWA icons generated at public/icons/");
