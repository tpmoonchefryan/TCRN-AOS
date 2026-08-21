export interface LoginRateLimitOptions {
  readonly maxFailures?: number;
  readonly windowMs?: number;
}

type Bucket = number[];

/** A small process-local shield for the expensive password endpoint. */
export class LoginRateLimiter {
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly failures = new Map<string, Bucket>();

  constructor(options: LoginRateLimitOptions = {}) {
    this.maxFailures = options.maxFailures ?? 5;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
  }

  isBlocked(source: string, handle: string, now = Date.now()): boolean {
    return this.pruneAndCount(this.key("source", source), now) >= this.maxFailures
      || this.pruneAndCount(this.key("handle", handle), now) >= this.maxFailures;
  }

  recordFailure(source: string, handle: string, now = Date.now()): void {
    this.record(this.key("source", source), now);
    this.record(this.key("handle", handle), now);
  }

  recordSuccess(source: string, handle: string): void {
    this.failures.delete(this.key("source", source));
    this.failures.delete(this.key("handle", handle));
  }

  private key(kind: "source" | "handle", value: string): string {
    return `${kind}:${value.trim().toLowerCase()}`;
  }

  private record(key: string, now: number): void {
    const bucket = this.failures.get(key) ?? [];
    bucket.push(now);
    this.failures.set(key, bucket);
    this.pruneAndCount(key, now);
  }

  private pruneAndCount(key: string, now: number): number {
    const cutoff = now - this.windowMs;
    const bucket = (this.failures.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (bucket.length === 0) {
      this.failures.delete(key);
      return 0;
    }
    this.failures.set(key, bucket);
    return bucket.length;
  }
}

export function isLocalRedirect(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}
