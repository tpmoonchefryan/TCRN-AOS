import { runPersistentRuntimeStorageProof } from "../dist/packages/db/src/index.js";

const args = new Set(process.argv.slice(2));
const runtimeRootArg = readArg("--runtime-root");
const useTempRuntimeRoot = args.has("--use-temp-runtime-root") || !runtimeRootArg;

const proof = await runPersistentRuntimeStorageProof({
  runtimeRoot: runtimeRootArg,
  useTempRuntimeRoot
});

console.log(JSON.stringify(proof, null, 2));

if (!proof.ok) {
  process.exit(1);
}

function readArg(name) {
  const prefix = `${name}=`;
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return undefined;
}
