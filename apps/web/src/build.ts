import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderAosShellHtml } from "./app.js";

const root = process.cwd();
const outputRoot = join(root, "apps/web/dist");
const assetsRoot = join(outputRoot, "assets");
const designSystemRoot = join(root, "..", "TCRN-DESIGN-SYSTEM");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(assetsRoot, { recursive: true });
await writeFile(join(outputRoot, "index.html"), renderAosShellHtml(), "utf8");
await copyFile(join(designSystemRoot, "apps/storybook/assets/tcrn-brand-mark.svg"), join(assetsRoot, "tcrn-brand-mark.svg"));

console.log(JSON.stringify({
  ok: true,
  artifact: "aos_frontend_shell",
  output: "apps/web/dist/index.html",
  assets: [
    "apps/web/dist/assets/tcrn-brand-mark.svg"
  ],
  brandSurface: "registered_ds_brand_mark_via_shell_brand_lockup",
  forbiddenAosWordmarkAssetsEmitted: false,
  productAcceptance: false,
  releaseReadiness: false,
  finalCockpitAggregation: false
}, null, 2));
