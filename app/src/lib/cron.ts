// Sync job: creates UDM DNS records from NPM proxy hosts under the target access list.

import { getProxyHostsByAccessList } from "@/lib/npm";
import { listDnsPolicies, createDnsPolicy } from "@/lib/unifi";
import { DnsRecord } from "@/lib/types";

const ACCESS_LIST_NAME = process.env.NPM_ACCESS_LIST_NAME ?? "Local Net or Basic";
const SYNC_TTL = 60;

function getNpmIp(): string {
  const ip = process.env.NPM_IP;
  if (!ip) throw new Error("NPM_IP is not set");
  return ip;
}

const INTERVAL_MS =
  (parseInt(process.env.CRON_INTERVAL_MINUTES ?? "10", 10) || 10) * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let lastRun: { timestamp: string; ok: boolean; message: string } | null = null;
let running = false;

export async function runJob(): Promise<{ ok: boolean; message: string }> {
  console.log("[sync] Job started at", new Date().toISOString());

  // 1. Get NPM proxy hosts filtered by access list
  const npmHosts = await getProxyHostsByAccessList(ACCESS_LIST_NAME);
  console.log(`[sync] Found ${npmHosts.length} NPM proxy hosts under "${ACCESS_LIST_NAME}"`);

  const npmIp = getNpmIp();

  // 2. Collect all domains from NPM hosts
  const npmDomains: string[] = [];
  for (const host of npmHosts) {
    for (const domain of host.domain_names) {
      npmDomains.push(domain.toLowerCase());
    }
  }

  // 3. Get existing UDM DNS records
  const existing = await listDnsPolicies();
  const records: DnsRecord[] = Array.isArray(existing) ? existing : existing.data ?? [];
  const existingDomains = new Set(records.map((r) => r.domain.toLowerCase()));

  // 4. Create missing DNS records — all point to NPM_IP as A_RECORD
  let created = 0;
  const errors: string[] = [];
  for (const domain of npmDomains) {
    if (existingDomains.has(domain)) continue;

    const body: Record<string, unknown> = {
      type: "A_RECORD",
      enabled: true,
      domain,
      ipv4Address: npmIp,
      ttlSeconds: SYNC_TTL,
    };

    try {
      await createDnsPolicy(body);
      created++;
      console.log(`[sync] Created A_RECORD for ${domain} → ${npmIp}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${domain}: ${msg}`);
      console.error(`[sync] Failed to create record for ${domain}:`, msg);
    }
  }

  const summary = `NPM hosts: ${npmDomains.length}, already exist: ${npmDomains.length - created - errors.length}, created: ${created}${errors.length ? `, errors: ${errors.length}` : ""}`;
  console.log(`[sync] Done — ${summary}`);
  if (errors.length) {
    return { ok: false, message: `${summary}. Errors: ${errors.join("; ")}` };
  }
  return { ok: true, message: summary };
}

/** Execute the job, track status, and prevent overlapping runs. */
export async function executeJob(): Promise<typeof lastRun> {
  if (running) {
    return { timestamp: new Date().toISOString(), ok: false, message: "Job already running" };
  }
  running = true;
  try {
    const result = await runJob();
    lastRun = { timestamp: new Date().toISOString(), ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] Job error:", message);
    lastRun = { timestamp: new Date().toISOString(), ok: false, message };
  } finally {
    running = false;
  }
  return lastRun;
}

/** Start the interval timer. Safe to call multiple times. */
export function startCron() {
  if (timer) return;
  console.log(`[cron] Starting — interval: ${INTERVAL_MS / 1000}s`);
  // Run once immediately, then on interval
  executeJob();
  timer = setInterval(executeJob, INTERVAL_MS);
}

/** Stop the interval timer. */
export function stopCron() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Return the last run status. */
export function getLastRun() {
  return { lastRun, running, intervalMs: INTERVAL_MS, npmIp: process.env.NPM_IP ?? null };
}
