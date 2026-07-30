// The judgements the resident deployment turns on, as pure functions.
//
// TCRN-AOS-INC-038, applied again: the recipes in this directory need a VM, a
// systemd, an SSH tunnel and a live chain, so they run by hand. A predicate that
// only ever runs by hand rots between runs. Everything below decides from data
// alone — a string of `ss` output, three unit texts, two exports — so it lives
// in the automated test roster and the recipes IMPORT it. Imported, never copied:
// a second copy drifts the first time somebody fixes one of them.

/**
 * The bound address of every listener on `port`, read from the LOCAL column of
 * `ss -ltnH` output.
 *
 * Column-parsed, never searched. The peer column of a listening socket is
 * literally `0.0.0.0:*`, so a predicate written as "does this line mention
 * 0.0.0.0" is red on a perfectly loopback-bound service and green on nothing —
 * it measures the wrong text. `ss` emits, in order: State, Recv-Q, Send-Q,
 * Local Address:Port, Peer Address:Port; index 3 is the only column that answers
 * the question being asked.
 */
export function listenersOnPort(ssOutput, port) {
  const suffix = `:${String(port)}`;
  const found = [];
  for (const line of String(ssOutput).split("\n")) {
    const columns = line.trim().split(/\s+/u).filter(Boolean);
    if (columns.length < 4) continue;
    const local = columns[3];
    if (!local.endsWith(suffix)) continue;
    found.push({ local, address: local.slice(0, local.length - suffix.length) });
  }
  return found;
}

/**
 * The access-boundary tripwire, at the resident deployment's own address.
 *
 * CONF-007 D7 rules that the write face binds 127.0.0.1 and that every path onto
 * it from off the host is an SSH tunnel. The predicate is the address the KERNEL
 * reports for the socket, asked of the machine the service runs on — not the
 * source text of service.ts, and not a claim the service makes about itself.
 *
 * Named refusals, because they mean different things to whoever reads the receipt:
 *   NO_LISTENER              nothing is listening; a stopped service is not a safe one
 *   MULTIPLE_LISTENERS       more than one socket answers on this port
 *   BOUND_OFF_LOOPBACK       something is listening somewhere an address can reach
 */
export function judgeLoopbackBind(ssOutput, { port, expectedAddress = "127.0.0.1" } = {}) {
  const listeners = listenersOnPort(ssOutput, port);
  const reasonCode = listeners.length === 0 ? "NO_LISTENER"
    : listeners.length > 1 ? "MULTIPLE_LISTENERS"
      : listeners[0].address !== expectedAddress ? "BOUND_OFF_LOOPBACK"
        : "BOUND_TO_LOOPBACK_ONLY";
  return {
    ok: reasonCode === "BOUND_TO_LOOPBACK_ONLY",
    reasonCode,
    port,
    expectedAddress,
    listeners,
    boundAddress: listeners.length === 1 ? listeners[0].address : null,
    predicate: "ss -ltnH 的本地地址列(第 4 列)全值等于 127.0.0.1;不是「文本里出现过 127.0.0.1」——监听 socket 的对端列写着 0.0.0.0:*,按包含判会同时骗过两个方向"
  };
}

/**
 * Are the unit in the repository, the unit this run rendered, and the unit
 * installed on the machine the same bytes?
 *
 * Three-way rather than two: repo-vs-rendered catches a manifest edit nobody
 * committed, rendered-vs-installed catches a hand-edit on the VM, and only both
 * together mean the committed file describes what is actually running. A
 * two-way check always leaves one pair free to differ.
 */
export function judgeUnitBytes({ rendered, committed, installed, requiredEnvKeys = [], environment = {} }) {
  const committedMatches = committed === rendered;
  const installedMatches = installed === rendered;
  const missingEnv = requiredEnvKeys.filter((key) => {
    const value = environment[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
  const reasonCode = !committedMatches ? "COMMITTED_UNIT_DIFFERS_FROM_RENDERED"
    : !installedMatches ? "INSTALLED_UNIT_DIFFERS_FROM_RENDERED"
      : missingEnv.length > 0 ? "UNIT_ENVIRONMENT_INCOMPLETE"
        : "UNIT_BYTES_AGREE_THREE_WAYS";
  return {
    ok: reasonCode === "UNIT_BYTES_AGREE_THREE_WAYS",
    reasonCode,
    committedMatches,
    installedMatches,
    missingEnv
  };
}

/**
 * Did the domain store arrive whole?
 *
 * Two independent judges over the same migration, and they can disagree:
 *   - the LOGICAL export, compared full-value as text. It reads through the
 *     store's own schema, so it survives a different SQLite build and it is what
 *     tells you the rows mean the same thing on both sides;
 *   - raw `COUNT(*)` per table on the destination. The export comparison is one
 *     code path reading itself on two hosts; if `exportAll` silently dropped a
 *     family, both sides would agree and this would stay green. A count issued
 *     straight at the table cannot share that blind spot.
 *
 * The byte digest of the file is a third, weaker check: equal bytes prove the
 * transfer, they do not prove the destination can read them.
 *
 * This judgement belongs to the TRANSFER only — the moment the copy is made and
 * neither side has been written to since. For re-reading an already-migrated
 * store, see `judgeArchiveRetained`: equality is the wrong invariant by then,
 * because the migrated store is the live one and the archive is frozen.
 */
export function judgeDomainMigration({
  localExportText, remoteExportText, remoteSqlCounts, localFileSha256, remoteFileSha256,
  expectedTables
}) {
  const mode = "transfer";
  const exportsEqual = typeof localExportText === "string"
    && localExportText.length > 0
    && localExportText === remoteExportText;
  const bytesEqual = typeof localFileSha256 === "string"
    && /^[0-9a-f]{64}$/u.test(localFileSha256)
    && localFileSha256 === remoteFileSha256;
  let counts = null;
  let countsAgree = false;
  if (exportsEqual) {
    const parsed = JSON.parse(localExportText);
    counts = Object.fromEntries(expectedTables.map(({ family }) => [family, (parsed[family] ?? []).length]));
    countsAgree = expectedTables.every(({ family, table }) => remoteSqlCounts?.[table] === counts[family]);
  }
  const whole = "DOMAIN_STORE_MIGRATED_WHOLE";
  const reasonCode = !bytesEqual ? "DOMAIN_STORE_BYTES_DIVERGENT"
    : !exportsEqual ? "DOMAIN_STORE_LOGICAL_EXPORT_DIVERGENT"
      : !countsAgree ? "DOMAIN_STORE_ROW_COUNTS_DIVERGENT"
        : whole;
  return {
    ok: reasonCode === whole,
    reasonCode,
    mode,
    bytesEqual,
    bytesJudged: true,
    exportsEqual,
    countsAgree,
    exportedCounts: counts,
    remoteSqlCounts: remoteSqlCounts ?? null
  };
}

/**
 * Is this directory a PAIR — and did both of its halves prove themselves?
 *
 * TCRN-AOS-INC-045. The incident was not "a backup failed"; it was that the two
 * halves had come to live on different machines, so the thing the runbook calls a
 * pair could not be taken at all, and nothing in any artifact said so. Every
 * predicate below therefore reads a fact the pair manifest now RECORDS, and each
 * one can go false:
 *
 *   - liveness per half. Both halves still exist at their old addresses too: the
 *     vacated workspace is intact on the laptop and so is the archived store beside
 *     its sentinel. "The files are there" is satisfied by a pair of two dead halves;
 *   - one host. The literal INC-045 condition — a chain read on one machine and a
 *     store read on another is two snapshots sharing a directory;
 *   - one instant, cross-checked against the domain snapshot manifest's own
 *     `createdAt` rather than against the directory name;
 *   - the mutual digests, recomputed from the bytes actually present;
 *   - the cross-reference: the chain manifest's own `headEventHash` and the domain
 *     manifest's own `snapshotDigest` must agree with what `pairing` claims. This is
 *     what catches a directory assembled from two different pairs, where every
 *     individual file is intact and the set is still not a pair;
 *   - and the two proofs — SNAPSHOT_VERIFIED on the chain copy, a completed restore
 *     drill on the domain export.
 *
 * The timestamp is deliberately NOT the binding. Two files written in the same
 * second do not prove they belong together; the digests do.
 */
export function judgePairing({ pairManifest, observed }) {
  const halves = pairManifest?.halves ?? {};
  const pairing = pairManifest?.pairing ?? {};
  const checks = {
    chainHalfLive: halves.chain?.live === true,
    domainHalfLive: halves.domain?.live === true,
    oneHost: typeof halves.chain?.host === "string"
      && halves.chain.host.length > 0
      && halves.chain.host === halves.domain?.host,
    coInstant: typeof pairManifest?.pairedAt === "string"
      && pairManifest.pairedAt === observed?.domainSnapshotManifestCreatedAt,
    domainSnapshotDigest: observed?.domainSnapshotSha256 === pairing.domainSnapshotDigest,
    domainExportDigest: observed?.domainExportSha256 === pairing.domainExportDigest,
    chainManifestDigest: observed?.chainManifestSha256 === pairing.chainManifestDigest,
    crossReference: observed?.chainManifestHeadEventHash === pairing.chainHeadEventHash
      && observed?.chainManifestVersion === pairing.chainVersion
      && observed?.domainSnapshotManifestSnapshotDigest === pairing.domainSnapshotDigest,
    attestationSetDigest: observed?.attestationSetDigest === pairing.attestationSetDigest,
    chainVerified: observed?.chainVerifyReasonCode === "SNAPSHOT_VERIFIED",
    restoreDrilled: observed?.restoreDrillOk === true
  };
  const reasonCode = !checks.chainHalfLive ? "PAIR_CHAIN_HALF_WAS_NOT_LIVE"
    : !checks.domainHalfLive ? "PAIR_DOMAIN_HALF_WAS_NOT_LIVE"
      : !checks.oneHost ? "PAIR_HALVES_ON_DIFFERENT_HOSTS"
        : !checks.coInstant ? "PAIR_HALVES_NOT_CO_INSTANT"
          : !(checks.domainSnapshotDigest && checks.domainExportDigest) ? "PAIR_DOMAIN_DIGEST_MISMATCH"
            : !checks.chainManifestDigest ? "PAIR_CHAIN_DIGEST_MISMATCH"
              : !checks.crossReference ? "PAIR_CROSS_REFERENCE_BROKEN"
                : !checks.attestationSetDigest ? "PAIR_ATTESTATION_SET_DIGEST_MISMATCH"
                  : !checks.chainVerified ? "PAIR_CHAIN_COPY_NOT_VERIFIED"
                    : !checks.restoreDrilled ? "PAIR_RESTORE_DRILL_FAILED"
                      : "PAIR_BOUND_AND_BOTH_HALVES_PROVEN";
  return {
    ok: reasonCode === "PAIR_BOUND_AND_BOTH_HALVES_PROVEN",
    reasonCode,
    checks,
    hosts: { chain: halves.chain?.host ?? null, domain: halves.domain?.host ?? null },
    pairedAt: pairManifest?.pairedAt ?? null,
    binding: "同刻 + 互指摘要;时间戳不是绑定——同一秒写下的两个文件仍不证明它们属于同一对"
  };
}

/**
 * Did the off-site copy arrive whole, somewhere that is actually off-site?
 *
 * The first predicate is the one worth naming: a copy on the same host as the
 * truth is a second file, not an off-site backup. Under the previous topology
 * that could not go wrong by accident — the truth was on the laptop and the copy
 * went to the VM — but the direction has now reversed, and the host that takes
 * the pair is the host that holds the truth. So "is the off-site host a different
 * host" is a check with two sides that can genuinely be equal.
 *
 * The ledger comparison is full-value in both directions and each side digests
 * its OWN bytes with its own tool. The re-proof is separate and stronger: the
 * off-site host re-runs the pair judgement with its own engine, so restorability
 * is established twice, independently, over the same bytes.
 */
export function judgeOffsiteCopy({ primaryHost, offsiteHost, ledger, offsitePairVerdict }) {
  const differentHost = typeof primaryHost === "string" && typeof offsiteHost === "string"
    && primaryHost.length > 0 && offsiteHost.length > 0 && primaryHost !== offsiteHost;
  const setMatches = ledger?.ok === true;
  const reProven = offsitePairVerdict?.ok === true;
  const reasonCode = !differentHost ? "OFFSITE_COPY_IS_ON_THE_PRIMARY_HOST"
    : !setMatches ? "OFFSITE_FILE_SET_DIVERGENT"
      : !reProven ? "OFFSITE_COPY_NOT_INDEPENDENTLY_REPROVEN"
        : "OFFSITE_COPY_ARRIVED_AND_WAS_REPROVEN";
  return {
    ok: reasonCode === "OFFSITE_COPY_ARRIVED_AND_WAS_REPROVEN",
    reasonCode,
    differentHost,
    primaryHost: primaryHost ?? null,
    offsiteHost: offsiteHost ?? null,
    fileSetDigest: ledger?.fileSetDigest ?? null,
    discrepancies: {
      missing: ledger?.missingOnVm ?? ledger?.missing ?? [],
      extra: ledger?.extraOnVm ?? ledger?.extra ?? [],
      mismatched: ledger?.mismatched ?? []
    },
    offsiteReasonCode: offsitePairVerdict?.reasonCode ?? null
  };
}

/**
 * May the interim "every backup must be marked NOT-PAIRED" discipline be lifted?
 *
 * INC-045 imposed that discipline and stated its own release criterion: the domain
 * store rides along to the VM with the resident cockpit, the paired backup is
 * re-wired for the new topology, and ONE real co-instant pair plus a restore drill
 * is demonstrated. A discipline retired by assertion would be a discipline retired
 * by whoever was writing the sentence; this derives the answer from the run's own
 * verdicts, so a red anywhere upstream leaves it in force.
 *
 * The off-site leg is part of the criterion and not an extra: while the two halves
 * were split across hosts there was no pair to put anywhere, so "the pair reached
 * somewhere that is not the machine holding the truth" is the first moment the
 * cadence is whole rather than merely takeable.
 */
export function judgeUnpairedDisciplineRetired({
  halvesShareOneHost, pairVerdict, offsiteVerdict, restoreDrillOk
}) {
  const conditions = {
    domainStoreRelocatedBesideTheChain: halvesShareOneHost === true,
    pairedBackupRewiredAndProven: pairVerdict?.ok === true,
    coInstantPairingDemonstrated: pairVerdict?.checks?.coInstant === true
      && pairVerdict?.checks?.crossReference === true,
    restoreDrilled: restoreDrillOk === true,
    offsiteCopyLandedOffTheTruthHost: offsiteVerdict?.ok === true
  };
  const unmet = Object.entries(conditions).filter(([, met]) => !met).map(([name]) => name);
  return {
    retired: unmet.length === 0,
    reasonCode: unmet.length === 0 ? "UNPAIRED_DISCIPLINE_MAY_BE_LIFTED" : "UNPAIRED_DISCIPLINE_STILL_IN_FORCE",
    conditions,
    unmet,
    discipline: "在配对前提恢复之前,每次备份须如实标注「非配对」(TCRN-AOS-INC-045)",
    derivedFrom: "本次运行自己的判词,不是一句声明——上游任一处红,纪律继续生效"
  };
}

/** How each family is identified across the two readings. */
const IDENTITY = Object.freeze({
  // An annotation is keyed by what it annotates. Its VALUE is mutable — the
  // cockpit changes labels, assignees and priorities — so a value comparison here
  // would report every legitimate edit as data loss.
  annotations: (row) => `${row.partitionId} ${row.recordId}`,
  comments: (row) => String(row.id),
  relations: (row) => String(row.id),
  // The write log is append-only by construction, so its rows are compared at
  // full value: a changed row is not an edit, it is corruption.
  chainWriteLog: (row) => String(row.seq)
});
const IMMUTABLE_FAMILIES = new Set(["chainWriteLog"]);

/**
 * Is everything the archive held still present in the live store?
 *
 * This is the invariant a re-verification can actually hold, and the one that
 * matters. Once the store is migrated, the copy on the VM is the LIVE one: the
 * resident cockpit writes to it, so it grows and its mutable rows change. The
 * frozen archive can therefore never be byte-equal or export-equal to it again,
 * and a re-check written as equality fails on the first successful write — which
 * is what the first version of this recipe did, reporting a working deployment as
 * a divergent store.
 *
 * What migration promises is that nothing was LOST. So:
 *   - every archived row is still identifiable in the live store;
 *   - archived write-log rows are identical at full value, because that table is
 *     append-only and a change to an existing row is corruption, not an edit;
 *   - the live store's own `COUNT(*)` agrees with the live store's own export, so
 *     two independent readers of the same file confirm each other.
 */
export function judgeArchiveRetained({ archiveExportText, liveExportText, remoteSqlCounts, expectedTables }) {
  const archive = JSON.parse(archiveExportText);
  const live = JSON.parse(liveExportText);

  const families = [];
  for (const { family, table } of expectedTables) {
    const identify = IDENTITY[family];
    if (!identify) throw new Error(`no identity rule for family ${family}`);
    const archiveRows = archive[family] ?? [];
    const liveRows = live[family] ?? [];
    const liveById = new Map(liveRows.map((row) => [identify(row), row]));
    const missing = archiveRows.filter((row) => !liveById.has(identify(row))).map(identify);
    const altered = IMMUTABLE_FAMILIES.has(family)
      ? archiveRows
        .filter((row) => liveById.has(identify(row))
          && JSON.stringify(liveById.get(identify(row))) !== JSON.stringify(row))
        .map(identify)
      : [];
    families.push({
      family,
      table,
      archivedRows: archiveRows.length,
      liveRows: liveRows.length,
      missingFromLive: missing,
      alteredInLive: altered,
      grewBy: liveRows.length - archiveRows.length,
      liveSqlCount: remoteSqlCounts?.[table] ?? null,
      liveExportAgreesWithLiveSql: remoteSqlCounts?.[table] === liveRows.length,
      valueComparison: IMMUTABLE_FAMILIES.has(family) ? "full value (append-only table)" : "identity only (mutable rows)"
    });
  }

  const anyMissing = families.some((entry) => entry.missingFromLive.length > 0);
  const anyAltered = families.some((entry) => entry.alteredInLive.length > 0);
  const anyShrank = families.some((entry) => entry.liveRows < entry.archivedRows);
  const readersDisagree = families.some((entry) => entry.liveExportAgreesWithLiveSql !== true);
  const reasonCode = anyMissing ? "ARCHIVE_ROWS_MISSING_FROM_LIVE_STORE"
    : anyAltered ? "ARCHIVE_APPEND_ONLY_ROWS_ALTERED"
      : anyShrank ? "LIVE_STORE_SHRANK_BELOW_THE_ARCHIVE"
        : readersDisagree ? "LIVE_STORE_READERS_DISAGREE"
          : "ARCHIVE_FULLY_RETAINED_IN_THE_LIVE_STORE";
  return {
    ok: reasonCode === "ARCHIVE_FULLY_RETAINED_IN_THE_LIVE_STORE",
    reasonCode,
    families,
    invariant: "迁置承诺的是「没丢」,不是「相等」——迁后 VM 那份就是活的,可变行本该变、行数本该长;"
      + "相等式的复核会在第一笔成功写入时转红,把正常工作的部署报成分叉"
  };
}
