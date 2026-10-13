// The pricing, validation and status rules live once, in the app's `src/domain`
// and `src/models`. Copy them next to the functions so both sides compute the
// same numbers (and so Cloud Build, which only sees this folder, can compile).
import {cpSync, mkdirSync, rmSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const target = join(here, "..", "src", "shared");

rmSync(target, {recursive: true, force: true});
mkdirSync(target, {recursive: true});

for (const folder of ["domain", "models"]) {
    cpSync(join(root, "src", folder), join(target, folder), {
        recursive: true,
        filter: (source) => !/\.test\.tsx?$/.test(source),
    });
}
console.log("shared domain + models copied to functions/src/shared");
