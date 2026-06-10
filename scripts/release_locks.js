/**
 * Release all known ADT locks for the current user.
 *
 * Strategy (cascading fallback):
 *   Tier 1 — Lock Store (.locks/): use persisted lock handles to unlock via ADT REST
 *   Tier 2 — ADT query (/sap/bc/adt/locks): find active locks and unlock with handles
 *   Tier 3 — RFC DEQUEUE_ALL: nuclear option — releases ALL enqueue locks for current user
 *
 * Usage: node scripts/release_locks.js [--force]
 *         --force  Skip ADT tiers, go straight to DEQUEUE_ALL
 */

const path = require("path");
const fs = require("fs");
const noderfc = require("node-rfc");
const { loadEnv, buildRfcParams } = require("./modules/env");

// ── ENV loading ──────────────────────────────────────────────────────────────
const env = loadEnv();
const rfcParams = buildRfcParams(env);
if (!rfcParams.client) {
  console.error("[FATAL] SAP_CLIENT is required in .env");
  process.exit(1);
}

const forceRfc = process.argv.includes("--force");

// ── Modules ──────────────────────────────────────────────────────────────────
const lockStore = require("./modules/lock-store");
const { createClient } = require("./modules/sap-connection");

// ── Tier 1: Lock Store ───────────────────────────────────────────────────────
async function tier1StoreUnlock(client) {
  const records = lockStore.listAll();
  if (records.length === 0) {
    console.log("[T1] No persisted lock records found");
    return { released: 0, remaining: 0 };
  }

  console.log(`[T1] Found ${records.length} persisted lock record(s)`);
  let released = 0;
  let failed = 0;

  for (const rec of records) {
    if (!rec.uri || !rec.handle) {
      lockStore.remove(rec.uri || "");
      failed++;
      continue;
    }
    try {
      await client.call("SADT_REST_RFC_ENDPOINT", {
        REQUEST: {
          REQUEST_LINE: {
            METHOD: "POST",
            URI: `${rec.uri}?_action=UNLOCK&lockHandle=${encodeURIComponent(rec.handle)}`,
            VERSION: "HTTP/1.1",
          },
          HEADER_FIELDS: [
            { NAME: "Accept", VALUE: "application/vnd.sap.as+xml" },
          ],
          MESSAGE_BODY: Buffer.alloc(0),
        },
      });
      console.log(`[T1] Released: ${rec.uri}`);
      lockStore.remove(rec.uri);
      released++;
    } catch (e) {
      console.warn(`[T1] Failed to release ${rec.uri}: ${e.message}`);
      failed++;
    }
  }

  console.log(`[T1] Result: ${released} released, ${failed} failed`);
  return { released, remaining: failed };
}

// ── Tier 2: ADT Lock Query ───────────────────────────────────────────────────
async function tier2AdtQuery(client) {
  const { queryAdtLocks } = require("./modules/query-locks");
  let locks;
  try {
    locks = await queryAdtLocks(client);
  } catch (e) {
    console.warn(`[T2] ADT lock query failed: ${e.message}`);
    return { released: 0 };
  }

  if (!locks || locks.length === 0) {
    console.log("[T2] No locks found via ADT query");
    return { released: 0 };
  }

  console.log(`[T2] Found ${locks.length} lock(s) via ADT query`);
  let released = 0;
  for (const lock of locks) {
    if (!lock.uri || !lock.handle) continue;
    try {
      await client.call("SADT_REST_RFC_ENDPOINT", {
        REQUEST: {
          REQUEST_LINE: {
            METHOD: "POST",
            URI: `${lock.uri}?_action=UNLOCK&lockHandle=${encodeURIComponent(lock.handle)}`,
            VERSION: "HTTP/1.1",
          },
          HEADER_FIELDS: [
            { NAME: "Accept", VALUE: "application/vnd.sap.as+xml" },
          ],
          MESSAGE_BODY: Buffer.alloc(0),
        },
      });
      console.log(`[T2] Released: ${lock.uri}`);
      lockStore.remove(lock.uri);
      released++;
    } catch (e) {
      console.warn(`[T2] Failed to release ${lock.uri}: ${e.message}`);
    }
  }
  console.log(`[T2] Result: ${released} released`);
  return { released };
}

// ── Tier 3: RFC DEQUEUE_ALL ──────────────────────────────────────────────────
async function tier3RfcDequeue() {
  const nwClient = new noderfc.Client(rfcParams);
  try {
    await nwClient.open();
    console.log("[T3] RFC connected, executing DEQUEUE_ALL...");

    // First, list what we're about to release
    try {
      const thResult = await nwClient.call("TH_ENQUEUE", {});
      const entries = thResult.ENTRIES || [];
      console.log(`[T3] TH_ENQUEUE returned ${entries.length} lock table entries`);
      for (const entry of entries.slice(0, 20)) {
        console.log(`  - ${entry.GARG || entry.GNAME || entry.OBJNAME || JSON.stringify(entry).substring(0, 120)}`);
      }
      if (entries.length > 20) console.log(`  ... and ${entries.length - 20} more`);
    } catch (e) {
      console.warn(`[T3] TH_ENQUEUE failed: ${e.message}`);
    }

    // Execute DEQUEUE_ALL
    try {
      await nwClient.call("DEQUEUE_ALL", {});
      console.log("[T3] DEQUEUE_ALL executed — all user locks released");
    } catch (e) {
      console.error(`[T3] DEQUEUE_ALL failed: ${e.message}`);
      console.error("[T3] You may need to contact Basis to release locks manually (SM12)");
      throw e;
    }
  } finally {
    try { await nwClient.close(); } catch (_) {}
  }

  // Clean up all persisted records since DEQUEUE_ALL released everything
  const records = lockStore.listAll();
  for (const rec of records) {
    lockStore.remove(rec.uri);
  }
  console.log(`[T3] Cleaned ${records.length} persisted lock record(s)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const client = createClient(rfcParams);

  try {
    await client.open();
    console.log("[OK] RFC connected");

    if (forceRfc) {
      console.log("[--force] Skipping ADT tiers, going straight to DEQUEUE_ALL");
      await tier3RfcDequeue();
      console.log("\n=== DONE (force) ===");
      return;
    }

    // Tier 1: try persisted handles
    const t1 = await tier1StoreUnlock(client);
    if (t1.remaining === 0) {
      console.log("\n=== DONE (T1: store) ===");
      return;
    }

    // Tier 2: query SAP for lock info
    const t2 = await tier2AdtQuery(client);
    if (t2.released > 0) {
      console.log("\n=== DONE (T2: ADT query) ===");
      return;
    }

    // Tier 3: nuclear
    console.log("[WARN] Tiers 1-2 insufficient, falling back to DEQUEUE_ALL");
    console.log("[WARN] This will release ALL enqueue locks for your user on this system");
    await tier3RfcDequeue();
    console.log("\n=== DONE (T3: DEQUEUE_ALL) ===");

  } catch (e) {
    console.error("[ERR]", e.message);
    try { await client.close(); } catch (_) {}
    process.exit(1);
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

run();
