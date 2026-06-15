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
  if (typeof value === "string") {
    return restrictedPatterns.reduce((text, pattern) => text.replace(pattern.regex, `<redacted:${pattern.kind}>`), value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactForAudit(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactForAudit(item)]));
  }
  return value;
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
