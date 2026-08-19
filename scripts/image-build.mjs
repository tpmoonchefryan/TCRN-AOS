#!/usr/bin/env node
// Build the image and put it where the cluster can actually see it.
//
// The tarball step is not belt and braces. With Docker Desktop's containerd image store,
// `k3d image import <name:tag>` reports success and the image never arrives — the pod then
// sits in ImagePullBackOff, which reads like a wrong image name rather than a failed
// import. Saving first and importing the file works in both configurations.

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.env.AOS_IMAGE_TAG ?? "tcrn-aos:dev";
const cluster = process.env.AOS_K3D_CLUSTER ?? "aos";
const tarball = process.env.AOS_IMAGE_TARBALL ?? "/tmp/tcrn-aos-image.tar";

const run = (command, args) => {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: repoRoot, stdio: "inherit" });
};

run("docker", ["build", "-t", tag, "."]);
run("docker", ["save", tag, "-o", tarball]);

let imported = false;
try {
  execFileSync("k3d", ["cluster", "list", cluster], { stdio: "pipe" });
  run("k3d", ["image", "import", tarball, "-c", cluster]);
  imported = true;
} catch {
  console.log(
    JSON.stringify({
      level: "info",
      message: `no k3d cluster named ${cluster}; the image is built and saved but not imported`,
      tarball,
    }),
  );
}

console.log(JSON.stringify({ ok: true, tag, tarball, importedIntoCluster: imported ? cluster : null }));
