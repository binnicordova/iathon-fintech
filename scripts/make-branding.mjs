// Renders the app icon, adaptive icon, splash and favicon from scripts/logo.svg.
//   node scripts/make-branding.mjs
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "scripts", "logo.svg"), "utf8");

// The same arrows on a transparent ground, for the adaptive icon and splash.
const markOnly = source
    .replace(/<rect width="1024" height="1024" fill="url\(#ground\)" \/>/, "")
    .replace(
        /<g id="mark"/,
        '<g id="mark" transform="translate(512 512) scale(0.78) translate(-512 -512)"'
    );

const out = (name) => join(root, "assets", name);

await sharp(Buffer.from(source))
    .resize(1024, 1024)
    .png()
    .toFile(out("icon.png"));
await sharp(Buffer.from(markOnly))
    .resize(1024, 1024)
    .png()
    .toFile(out("adaptive-icon.png"));
await sharp(Buffer.from(markOnly))
    .resize(1024, 1024)
    .png()
    .toFile(out("splash.png"));
await sharp(Buffer.from(source))
    .resize(64, 64)
    .png()
    .toFile(out("favicon.png"));
console.log(
    "icon.png, adaptive-icon.png, splash.png, favicon.png written to assets/"
);
