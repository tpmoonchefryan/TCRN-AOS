import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();

const removedPaths = [
  "apps/web",
  "dist/apps/web",
  "scripts/aos-design-system-component-registry-proof.mjs",
  "scripts/aos-design-system-consumer-slice-1-proof.mjs",
  "scripts/aos-design-system-consumer-slice-2-proof.mjs",
  "scripts/aos-design-system-package-runtime-proof.mjs",
  "scripts/aos-design-system-parent-surface-inventory-proof.mjs",
  "scripts/aos-owner-trial-service-backed-frontend-proof.mjs",
  "scripts/slice-4-proof.mjs",
  "scripts/slice-4b-style-proof.mjs",
  "scripts/slice-9b-visible-readiness-proof.mjs",
  "scripts/slice-10-aos-wide-product-design-proof.mjs",
  "evidence/aos-design-system-browser-readback",
  "evidence/aos-design-system-consumer-slice-1-browser",
  "evidence/aos-design-system-consumer-slice-2-browser",
  "evidence/aos-owner-trial-service-backed-frontend",
  "evidence/product-design-browser-acceptance",
  "evidence/slice-9b-visible-readiness-browser",
  "evidence/slice-10-aos-wide-product-design-browser",
  "docs/frontend-style-baseline.md",
  "docs/operations-cockpit-functional-contract.md",
  "docs/aos-wide-product-design-surface-set.md"
];

const forbiddenPackageNames = [
  "@tcrn/ui-copy-state",
  "@tcrn/ui-react",
  "@tcrn/ui-tokens",
  "@types/react",
  "@types/react-dom",
  "react",
  "react-dom"
];

const forbiddenTextTokens = [
  "apps/web",
  "dist/apps/web",
  "ds-aos-",
  "tcrn-design-system-patterns--aos",
  "aos-served-surface-standard",
  "data-aos-component-registration",
  "aos.owner_trial_service_frontend.v1",
  "@tcrn/ui-react",
  "@tcrn/ui-tokens",
  "@tcrn/ui-copy-state",
  "from \"react\"",
  "from \"react-dom",
  "react-dom/server"
];

const scanRoots = [
  "apps",
  "packages",
  "scripts",
  "docs",
  "evidence",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json"
];

const allowedTokenFiles = new Set([
  "scripts/aos-frontend-reset-proof.mjs",
  "evidence/aos-frontend-reset-proof.md"
]);

const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const dependencyNames = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
  ...Object.keys(packageJson.optionalDependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {})
];
const packageScripts = packageJson.scripts ?? {};

const removedPathFailures = removedPaths.filter((path) => existsSync(join(repoRoot, path)));
const forbiddenDependencies = dependencyNames.filter((name) => forbiddenPackageNames.includes(name));
const forbiddenScriptNames = Object.keys(packageScripts).filter((name) => /design-system|slice4|slice9b|slice10|owner-trial-service-backed|project-workspace|initiative-detail|gate-queue|ai-employee|conference-proof|dependency-console|rebuild-baseline/.test(name));
const forbiddenScriptCommands = Object.entries(packageScripts)
  .filter(([, command]) => /apps\/web|dist\/apps\/web|design-system|slice-4|slice-4b|slice-9b|slice-10|frontend-proof|project-workspace-proof|initiative-detail-proof|gate-queue-proof|ai-employee-proof|conference-proof|dependency-console-proof|rebuild-baseline-proof/.test(command))
  .map(([name]) => name)
  .filter((name) => name !== "aos:frontend-reset-proof");

const textHits = [];
for (const file of listScanFiles()) {
  const rel = relative(repoRoot, file);
  if (allowedTokenFiles.has(rel)) continue;
  const source = readFileSync(file, "utf8");
  for (const token of forbiddenTextTokens) {
    if (source.includes(token)) {
      textHits.push({ file: rel, token });
    }
  }
}

const ok = removedPathFailures.length === 0
  && forbiddenDependencies.length === 0
  && forbiddenScriptNames.length === 0
  && forbiddenScriptCommands.length === 0
  && textHits.length === 0;

const result = {
  ok,
  frontendCodeDisposition: "removed_pending_owner_led_design_restart",
  ownerReviewRequiredBeforeNewFrontend: true,
  replacementSurfaceAvailable: false,
  productUiAcceptance: false,
  releaseReadiness: false,
  checks: {
    removedPathFailures,
    forbiddenDependencies,
    forbiddenScriptNames,
    forbiddenScriptCommands,
    textHits
  }
};

console.log(JSON.stringify(result, null, 2));
if (!ok) {
  process.exit(1);
}

function listScanFiles() {
  const files = [];
  for (const root of scanRoots) {
    const absolute = join(repoRoot, root);
    if (!existsSync(absolute)) continue;
    collectTextFiles(absolute, files);
  }
  return files;
}

function collectTextFiles(path, files) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      collectTextFiles(join(path, entry), files);
    }
    return;
  }
  if (/\.(ts|tsx|js|mjs|json|md|yaml|yml|html|css)$/.test(path)) {
    files.push(path);
  }
}
