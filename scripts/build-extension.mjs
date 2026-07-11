import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sourceDir = resolve(rootDir, "extension");
const outputDir = resolve(rootDir, "public");
const outputPath = resolve(outputDir, "extension.zip");

mkdirSync(outputDir, { recursive: true });

const output = createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`extension.zip criado (${archive.pointer()} bytes)`);
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
