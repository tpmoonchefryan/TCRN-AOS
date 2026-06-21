import { existsSync, readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const runtimeDeps = Object.keys(rootPackage.dependencies ?? {});
const devDeps = Object.keys(rootPackage.devDependencies ?? {});
const expectedDevDeps = new Set(["typescript", "@types/node"]);
const allowedRuntimeDeps = new Map([
  ["@tcrn/ui-copy-state", "file:../TCRN-Design-System/packages/ui-copy-state"],
  ["@tcrn/ui-tokens", "file:../TCRN-Design-System/packages/ui-tokens"]
]);
const unexpected = devDeps.filter((name) => !expectedDevDeps.has(name));
const missingDev = [...expectedDevDeps].filter((name) => !devDeps.includes(name));
const packageLicenses = [];
const runtimePackageReadbacks = [];

for (const name of runtimeDeps) {
  const expectedSpecifier = allowedRuntimeDeps.get(name);
  const actualSpecifier = rootPackage.dependencies[name];
  const packageUrl = new URL(`../node_modules/${name}/package.json`, import.meta.url);
  if (existsSync(packageUrl)) {
    const packageJson = JSON.parse(readFileSync(packageUrl, "utf8"));
    runtimePackageReadbacks.push({
      name,
      version: packageJson.version,
      specifier: actualSpecifier,
      expectedSpecifier: expectedSpecifier ?? "not_allowed",
      localDesignSystemPackage: actualSpecifier === expectedSpecifier,
      license: packageJson.license ?? "local_private_tcrn_design_system_package",
      dependencies: Object.keys(packageJson.dependencies ?? {})
    });
  } else {
    runtimePackageReadbacks.push({
      name,
      version: "not_installed",
      specifier: actualSpecifier,
      expectedSpecifier: expectedSpecifier ?? "not_allowed",
      localDesignSystemPackage: false,
      license: "evidence_missing",
      dependencies: []
    });
  }
}

for (const name of devDeps) {
  const packageUrl = new URL(`../node_modules/${name}/package.json`, import.meta.url);
  if (existsSync(packageUrl)) {
    const packageJson = JSON.parse(readFileSync(packageUrl, "utf8"));
    packageLicenses.push({
      name,
      version: packageJson.version,
      license: packageJson.license ?? "evidence_missing"
    });
  } else {
    packageLicenses.push({ name, version: "not_installed", license: "evidence_missing" });
  }
}

const blockers = [
  runtimePackageReadbacks.some((entry) => !entry.localDesignSystemPackage)
    ? `unexpected runtime dependencies: ${runtimePackageReadbacks.filter((entry) => !entry.localDesignSystemPackage).map((entry) => entry.name).join(",")}`
    : "",
  runtimePackageReadbacks.some((entry) => entry.version !== "0.0.0-private")
    ? "local Design System runtime dependency version mismatch"
    : "",
  runtimePackageReadbacks.some((entry) => entry.dependencies.length > 0)
    ? "local Design System runtime dependency has transitive runtime dependencies"
    : "",
  unexpected.length > 0 ? `unexpected dev dependencies: ${unexpected.join(",")}` : "",
  missingDev.length > 0 ? `missing dev dependencies: ${missingDev.join(",")}` : "",
  packageLicenses.some((entry) => ["GPL", "AGPL", "evidence_missing"].some((blocked) => String(entry.license).includes(blocked)))
    ? "blocked or missing license evidence in dev dependencies"
    : ""
].filter(Boolean);

const result = {
  ok: blockers.length === 0,
  runtimeDependencies: runtimeDeps,
  allowedRuntimeDependencies: [...allowedRuntimeDeps.keys()],
  runtimePackageReadbacks,
  devDependencies: devDeps,
  packageLicenses,
  queuePosture: "no_external_queue_no_redis_runtime",
  postureLanguage: "review_required/evidence_missing/accepted_with_residual_risk/blocked reserved for AOS records",
  blockers
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  process.exit(1);
}
