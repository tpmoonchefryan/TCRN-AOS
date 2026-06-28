import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderAosShellHtml } from "./app.js";

const root = process.cwd();
const outputRoot = join(root, "apps/web/dist");
const assetsRoot = join(outputRoot, "assets");

await mkdir(assetsRoot, { recursive: true });
await writeFile(join(outputRoot, "index.html"), renderAosShellHtml(), "utf8");
await copyFile(join(root, "docs/brand/tcrn-aos-wordmark-geometric-dark.png"), join(assetsRoot, "tcrn-aos-wordmark-geometric-dark.png"));
await copyFile(join(root, "docs/brand/favicon.ico"), join(assetsRoot, "favicon.ico"));

console.log(JSON.stringify({
  ok: true,
  artifact: "aos_frontend_shell",
  output: "apps/web/dist/index.html",
  assets: [
    "apps/web/dist/assets/tcrn-aos-wordmark-geometric-dark.png",
    "apps/web/dist/assets/favicon.ico"
  ],
  productAcceptance: false,
  releaseReadiness: false,
  finalCockpitAggregation: false
}, null, 2));
