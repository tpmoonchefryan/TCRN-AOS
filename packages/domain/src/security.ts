import { createHash } from "node:crypto";

export interface SensitiveFinding {
  kind:
    | "secret"
    | "private_key"
    | "raw_secret_scan_output"
    | "shell_history"
    | "browser_or_keychain"
    | "raw_source"
    | "machine_local_absolute_path"
    | "private_evidence_payload";
  path: string;
  sample: string;
}

const restrictedPatterns: Array<{ kind: SensitiveFinding["kind"]; regex: RegExp }> = [
  { kind: "private_key", regex: /BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY/ },
  { kind: "secret", regex: /\b(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,}|xox[baprs]-[0-9A-Za-z-]{20,})\b/ },
  { kind: "raw_secret_scan_output", regex: /\b(?:gitleaks|trufflehog|secretlint)\b.*\b(?:finding|secret|detector)\b/i },
  { kind: "shell_history", regex: /(?:^|\n)\s*(?:export\s+\w*(?:SECRET|TOKEN|PASSWORD)|history\s+\d+|aws_secret_access_key)/i },
  { kind: "browser_or_keychain", regex: /\b(?:Cookies|Login Data|Keychain|Local State|browser profile)\b/i },
  { kind: "raw_source", regex: /(?:^|\n)(?:diff --git|@@ .* @@|import\s+.+from\s+['"].+['"];?\n[\s\S]*function\s+)/ },
  { kind: "machine_local_absolute_path", regex: /(?:^|["'\s])(?:\/Users\/[^\s"'`]+|\/Volumes\/[^\s"'`]+|\/private\/var\/[^\s"'`]+|[A-Za-z]:\\Users\\[^\s"'`]+)/ },
  { kind: "private_evidence_payload", regex: /\bprivate evidence payload\b/i }
];

const sensitiveAuditKeyPatterns = [
  /^(?:auth|authorization|clientEnv|client_env|env)$/i,
  /(?:token|secret|password|passwd|cookie|private[-_]?key|api[-_]?key|bearer)/i,
  /^(?:body|summary|readback|outputSummary|output_summary|message|messages|prompt|prompts)$/i,
  /^(?:source|sources|sourceText|source_text|sourceBody|source_body|transcript|transcripts|transcriptBody|transcript_body|raw|rawPayload|raw_payload|rawMessage|raw_message|rawSource|raw_source)$/i,
  /(?:path|filePath|file_path|root|dir|directory)$/i
];

export function scanForRestrictedContent(value: unknown, rootPath = "$"): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  walkStrings(value, rootPath, (path, text) => {
    for (const pattern of restrictedPatterns) {
      const match = pattern.regex.exec(text);
      if (match) {
        findings.push({
          kind: pattern.kind,
          path,
          sample: match[0].slice(0, 80)
        });
      }
    }
  });
  return findings;
}

export function assertNoRestrictedContent(value: unknown, context: string): void {
  const findings = scanForRestrictedContent(value);
  if (findings.length > 0) {
    const first = findings[0]!;
    throw new Error(`${context} rejected restricted ${first.kind} at ${first.path}`);
  }
}

export function redactForAudit(value: unknown): unknown {
  return redactAuditValue(value);
}

export function summarizePayloadForAudit(value: unknown): Record<string, unknown> {
  const topLevelEntries = value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
    : [];
  const keys = topLevelEntries.map(([key]) => key).sort((left, right) => left.localeCompare(right));
  const sensitiveKeys = keys.filter(isSensitiveAuditKey);
  const fieldClasses = Object.fromEntries(
    topLevelEntries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, {
        valueClass: auditValueClass(item),
        sensitiveKey: isSensitiveAuditKey(key),
        rawValueStored: false
      }])
  );
  return {
    valueClass: auditValueClass(value),
    valueDigest: auditDigest(value),
    keyCount: keys.length,
    keys,
    sensitiveKeys,
    fieldClasses,
    rawValuesStored: false
  };
}

function redactAuditValue(value: unknown, key = ""): unknown {
  if (key && isSensitiveAuditKey(key)) {
    return {
      redacted: true,
      reason: "sensitive_audit_key",
      valueClass: auditValueClass(value),
      valueDigest: auditDigest(value),
      rawValueStored: false
    };
  }
  if (typeof value === "string") {
    return restrictedPatterns.reduce((text, pattern) => text.replace(pattern.regex, `<redacted:${pattern.kind}>`), value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, item]) => [entryKey, redactAuditValue(item, entryKey)]));
  }
  return value;
}

function isSensitiveAuditKey(key: string): boolean {
  return sensitiveAuditKeyPatterns.some((pattern) => pattern.test(key));
}

function auditValueClass(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function auditDigest(value: unknown): string {
  return createHash("sha256").update(stableAuditStringify(value)).digest("hex");
}

function stableAuditStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableAuditStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableAuditStringify(item)}`).join(",")}}`;
}

function walkStrings(value: unknown, path: string, visit: (path: string, text: string) => void): void {
  if (typeof value === "string") {
    visit(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, `${path}[${index}]`, visit));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walkStrings(item, `${path}.${key}`, visit));
  }
}
