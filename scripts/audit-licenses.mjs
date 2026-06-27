import { existsSync, readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const runtimeDeps = Object.keys(rootPackage.dependencies ?? {});
const devDeps = Object.keys(rootPackage.devDependencies ?? {});
const expectedDevDeps = new Map([
  ["@types/node", { version: "24.0.3", license: "MIT" }],
  ["typescript", { version: "5.8.3", license: "Apache-2.0" }]
]);
const allowedRuntimeDeps = new Map();
const unexpected = devDeps.filter((name) => !expectedDevDeps.has(name));
const missingDev = [...expectedDevDeps.keys()].filter((name) => !devDeps.includes(name));
const packageLicenses = [];
const runtimePackageReadbacks = [];

for (const name of runtimeDeps) {
  const expectation = allowedRuntimeDeps.get(name);
  const actualSpecifier = rootPackage.dependencies[name];
  const packageUrl = new URL(`../node_modules/${name}/package.json`, import.meta.url);
  if (existsSync(packageUrl)) {
    const packageJson = JSON.parse(readFileSync(packageUrl, "utf8"));
    const license = packageJson.license ?? "local_private_tcrn_design_system_package";
    const dependencies = Object.keys(packageJson.dependencies ?? {});
    runtimePackageReadbacks.push({
      name,
      version: packageJson.version,
      specifier: actualSpecifier,
      expectedSpecifier: expectation?.specifier ?? "not_allowed",
      allowedSpecifier: actualSpecifier === expectation?.specifier,
      expectedVersion: expectation?.version ?? "not_allowed",
      allowedVersion: packageJson.version === expectation?.version,
      license,
      expectedLicense: expectation?.license ?? "not_allowed",
      allowedLicense: license === expectation?.license,
      dependencies,
      allowedDependencies: expectation?.allowedDependencies ?? [],
      unexpectedDependencies: dependencies.filter((dependency) => !(expectation?.allowedDependencies ?? []).includes(dependency))
    });
  } else {
    runtimePackageReadbacks.push({
      name,
      version: "not_installed",
      specifier: actualSpecifier,
      expectedSpecifier: expectation?.specifier ?? "not_allowed",
      allowedSpecifier: false,
      expectedVersion: expectation?.version ?? "not_allowed",
      allowedVersion: false,
      license: "evidence_missing",
      expectedLicense: expectation?.license ?? "not_allowed",
      allowedLicense: false,
      dependencies: []
    });
  }
}

for (const name of devDeps) {
  const expectation = expectedDevDeps.get(name);
  const packageUrl = new URL(`../node_modules/${name}/package.json`, import.meta.url);
  if (existsSync(packageUrl)) {
    const packageJson = JSON.parse(readFileSync(packageUrl, "utf8"));
    const license = packageJson.license ?? "evidence_missing";
    packageLicenses.push({
      name,
      version: packageJson.version,
      expectedVersion: expectation?.version ?? "not_allowed",
      allowedVersion: packageJson.version === expectation?.version,
      license,
      expectedLicense: expectation?.license ?? "not_allowed",
      allowedLicense: license === expectation?.license
    });
  } else {
    packageLicenses.push({
      name,
      version: "not_installed",
      expectedVersion: expectation?.version ?? "not_allowed",
      allowedVersion: false,
      license: "evidence_missing",
      expectedLicense: expectation?.license ?? "not_allowed",
      allowedLicense: false
    });
  }
}

const blockers = [
  runtimePackageReadbacks.some((entry) => !allowedRuntimeDeps.has(entry.name))
    ? `unexpected runtime dependencies: ${runtimePackageReadbacks.filter((entry) => !allowedRuntimeDeps.has(entry.name)).map((entry) => entry.name).join(",")}`
    : "",
  runtimePackageReadbacks.some((entry) => !entry.allowedSpecifier)
    ? `runtime dependency specifier mismatch: ${runtimePackageReadbacks.filter((entry) => !entry.allowedSpecifier).map((entry) => entry.name).join(",")}`
    : "",
  runtimePackageReadbacks.some((entry) => !entry.allowedVersion)
    ? `runtime dependency version mismatch: ${runtimePackageReadbacks.filter((entry) => !entry.allowedVersion).map((entry) => entry.name).join(",")}`
    : "",
  runtimePackageReadbacks.some((entry) => !entry.allowedLicense)
    ? `runtime dependency license mismatch: ${runtimePackageReadbacks.filter((entry) => !entry.allowedLicense).map((entry) => entry.name).join(",")}`
    : "",
  runtimePackageReadbacks.some((entry) => entry.unexpectedDependencies?.length > 0)
    ? `unexpected transitive runtime dependencies: ${runtimePackageReadbacks.filter((entry) => entry.unexpectedDependencies?.length > 0).map((entry) => `${entry.name}:${entry.unexpectedDependencies.join("|")}`).join(",")}`
    : "",
  unexpected.length > 0 ? `unexpected dev dependencies: ${unexpected.join(",")}` : "",
  missingDev.length > 0 ? `missing dev dependencies: ${missingDev.join(",")}` : "",
  packageLicenses.some((entry) => !entry.allowedVersion)
    ? `dev dependency version mismatch: ${packageLicenses.filter((entry) => !entry.allowedVersion).map((entry) => entry.name).join(",")}`
    : "",
  packageLicenses.some((entry) => !entry.allowedLicense || ["GPL", "AGPL", "evidence_missing"].some((blocked) => String(entry.license).includes(blocked)))
    ? "blocked, unexpected, or missing license evidence in dev dependencies"
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
