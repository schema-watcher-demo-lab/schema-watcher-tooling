import { lookup } from "node:dns/promises";
import type { SchemaChange } from './types.js';

export interface PostSchemaChangesInput {
  apiEndpoint: string;
  apiKey: string;
  repo: string;
  pr: number;
  organizationId?: string;
  changes: SchemaChange[];
}

type LookupFn = typeof lookup;
let lookupFn: LookupFn = lookup;

export function setLookupForTests(nextLookup: LookupFn | null): void {
  lookupFn = nextLookup ?? lookup;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") {
    return true;
  }
  if (normalized.endsWith(".local") || normalized.endsWith(".internal")) {
    return true;
  }
  if (normalized.startsWith("10.") || normalized.startsWith("192.168.") || normalized.startsWith("169.254.")) {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  const parts = normalized.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    if (first === 172 && second >= 16 && second <= 31) return true;
    // RFC 6598 carrier-grade NAT space
    if (first === 100 && second >= 64 && second <= 127) return true;
  }
  return false;
}

function isDomainLikeHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (!normalized) return false;
  if (normalized === "localhost") return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) return false;
  if (normalized.includes(":")) return false;
  return /[a-z]/.test(normalized);
}

async function assertNoPrivateResolvedAddress(hostname: string, allowPrivate: boolean): Promise<void> {
  if (allowPrivate || !isDomainLikeHost(hostname)) return;

  let addresses: Array<{ address: string }> = [];
  try {
    addresses = await lookupFn(hostname, { all: true, verbatim: true });
  } catch {
    // Best-effort DNS rebinding mitigation; let fetch handle network failures.
    return;
  }

  for (const result of addresses) {
    if (isPrivateHostname(result.address)) {
      throw new Error(`Disallowed private resolved address for host ${hostname}: ${result.address}`);
    }
  }
}

async function validateApiEndpoint(endpoint: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(`Invalid API endpoint: ${endpoint}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported API endpoint protocol: ${parsed.protocol}`);
  }
  const isPrivateHost = isPrivateHostname(parsed.hostname);
  const allowPrivate = process.env.ALLOW_PRIVATE_API_ENDPOINTS === "1";

  if (isPrivateHost && !allowPrivate) {
    throw new Error(`Disallowed private API endpoint host: ${parsed.hostname}`);
  }
  await assertNoPrivateResolvedAddress(parsed.hostname, allowPrivate);
  if (parsed.protocol === "http:" && !isPrivateHost) {
    throw new Error("Insecure API endpoint protocol: http (use https)");
  }
  return parsed;
}

export async function postSchemaChanges(input: PostSchemaChangesInput): Promise<void> {
  const validated = await validateApiEndpoint(input.apiEndpoint);
  const url = `${normalizeEndpoint(validated.toString())}/api/changes`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': input.apiKey,
    },
    body: JSON.stringify({
      repo: input.repo,
      pr: input.pr,
      organizationId: input.organizationId,
      changes: input.changes,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Schema API request failed (${response.status}): ${body}`);
  }
}
