import { existsSync, readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const runtimeDeps = Object.keys(rootPackage.dependencies ?? {});
const devDeps = Object.keys(rootPackage.devDependencies ?? {});
const expectedDevDeps = new Set(["typescript", "@types/node"]);
const unexpected = devDeps.filter((name) => !expectedDevDeps.has(name));
const missingDev = [...expectedDevDeps].filter((name) => !devDeps.includes(name));
const packageLicenses = [];

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
  runtimeDeps.length > 0 ? `runtime dependencies present: ${runtimeDeps.join(",")}` : "",
  unexpected.length > 0 ? `unexpected dev dependencies: ${unexpected.join(",")}` : "",
  missingDev.length > 0 ? `missing dev dependencies: ${missingDev.join(",")}` : "",
  packageLicenses.some((entry) => ["GPL", "AGPL", "evidence_missing"].some((blocked) => String(entry.license).includes(blocked)))
    ? "blocked or missing license evidence in dev dependencies"
    : ""
].filter(Boolean);

const result = {
  ok: blockers.length === 0,
  runtimeDependencies: runtimeDeps,
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
