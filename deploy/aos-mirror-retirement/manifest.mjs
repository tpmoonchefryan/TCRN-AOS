// TCRN-AOS-STORY-134 — the declarative inventory of the mirror segment, and the
// predicates that decide whether it is gone.
//
// MIN-012 decision 7: the truth host now carries a RESIDENT cockpit, so the
// static snapshot stand-in is no longer needed. This file states what the mirror
// segment consisted of, once, so the retirement recipe removes exactly what was
// declared rather than a name list assembled at the keyboard.
//
// One thing this file deliberately is NOT: a second copy of the deployment
// manifest. The objects are removed by feeding `deploy/aos-mirror.yaml` — the
// committed bytes that created them — to `kubectl delete -f -`. The names below
// are the VERIFICATION side, read back from the cluster afterwards, and they are
// deliberately produced by a different act than the removal: a check whose two
// sides come from the same act can only ever be green.

/** The committed manifest that created the segment, and now removes it. */
export const MIRROR_MANIFEST = "deploy/aos-mirror.yaml";

export const VM_HOST = "tcrn-platform-dev";

/** The LAN name the ingress claimed. */
export const MIRROR_HOST = "aos.tcrn.lan";
/** The address that name resolves to on this LAN — the cluster's traefik. */
export const MIRROR_LAN_ADDRESS = "192.168.51.249";

/** The namespace the whole segment lived in. Nothing else was ever in it. */
export const NAMESPACE = "tcrn-aos";

/**
 * The five objects, by kind and name, as the cluster knows them.
 *
 * Read back individually rather than trusting the namespace delete to cascade:
 * a cascade that silently left one object behind and a cascade that worked look
 * identical from the exit code of the delete.
 */
export const OBJECTS = Object.freeze([
  { kind: "namespace", name: NAMESPACE, namespaced: false },
  { kind: "configmap", name: "aos-mirror-nginx", namespaced: true },
  { kind: "deployment", name: "aos-mirror", namespaced: true },
  { kind: "service", name: "aos-mirror", namespaced: true },
  { kind: "ingress", name: "aos-mirror", namespaced: true }
]);

/** The bundle's address on the VM — a hostPath mount, not cluster storage. */
export const VM_CONTENT_ROOT = "/srv/tcrn/aos-mirror";

/** The bundle's address in this repository, retired with it. */
export const REPO_BUNDLE = "apps/web/mirror";

/** The resident cockpit, which must be untouched by any of this. */
export const RESIDENT_UNIT = "tcrn-aos-cockpit.service";
export const RESIDENT_PORT = 4318;

/**
 * Whether an HTTP answer is the mirror.
 *
 * Not "did the request fail". After the ingress goes, traefik still accepts the
 * connection on port 80 and answers 404 for a host it has no rule for, so a
 * predicate written as "the request errors" would report red for the wrong
 * reason today and green the moment somebody put any other service on that
 * address. The question is whether the AOS cockpit answered, and the discriminator
 * is the server-rendered view marker the cockpit and only the cockpit emits.
 */
export function isMirrorAnswering({ status, body }) {
  return status === 200 && /data-cockpit-view="[a-z-]+"/u.test(String(body ?? ""));
}

/**
 * Whether the cluster still holds any route for a host.
 *
 * Reads the whole cluster's ingress list, not the namespace's: deleting the
 * namespace cannot answer "is this hostname claimed somewhere else", and the
 * hostname is the thing the ruling is about.
 */
export function hostClaimedByIngress(ingressJson, host) {
  const items = ingressJson?.items ?? [];
  return items.some((item) => (item?.spec?.rules ?? []).some((rule) => rule?.host === host));
}

/**
 * A `kubectl get` answer, classified.
 *
 * `NotFound` is an ANSWER and the one this retirement wants; a non-zero exit that
 * is anything else (no cluster, no permission) is NOT absence and must not be
 * read as success. Conflating the two is how a removal proof passes on a machine
 * where kubectl was simply broken.
 */
export function classifyGet({ code, stderr }) {
  const text = String(stderr ?? "");
  if (code === 0) return "present";
  if (/\bNotFound\b|not found/u.test(text)) return "absent";
  return "unknown";
}
