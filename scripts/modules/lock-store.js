const fs = require("fs");
const path = require("path");

const STORE_DIR = path.resolve(process.cwd(), ".locks");

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

/**
 * Derive a stable filename from an ADT URI.
 * e.g. /sap/bc/adt/programs/programs/zsap_fi244 → zsap_fi244.json
 *      /sap/bc/adt/programs/includes/zsap_fi244t01 → zsap_fi244t01.json
 */
function uriToFile(uri) {
  const name = uri.replace(/\/$/, "").split("/").pop().toLowerCase();
  return path.join(STORE_DIR, `${name}.json`);
}

/**
 * Persist a lock handle immediately after acquisition.
 */
function save(uri, handle) {
  ensureDir();
  const record = {
    uri,
    handle,
    time: new Date().toISOString(),
    pid: process.pid,
  };
  fs.writeFileSync(uriToFile(uri), JSON.stringify(record, null, 2), "utf-8");
}

/**
 * Try to retrieve a lock handle from the store.
 * Returns null if not found or file is unreadable.
 */
function load(uri) {
  const f = uriToFile(uri);
  if (!fs.existsSync(f)) return null;
  try {
    const record = JSON.parse(fs.readFileSync(f, "utf-8"));
    return record.handle || null;
  } catch (_) {
    return null;
  }
}

/**
 * Load the full lock record (uri + handle + time).
 */
function loadRecord(uri) {
  const f = uriToFile(uri);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf-8"));
  } catch (_) {
    return null;
  }
}

/**
 * Remove a persisted lock record after successful unlock.
 */
function remove(uri) {
  const f = uriToFile(uri);
  try {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch (_) {
    // best-effort
  }
}

/**
 * List all persisted lock records.
 */
function listAll() {
  ensureDir();
  const files = fs.readdirSync(STORE_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(STORE_DIR, f), "utf-8"));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Derive ADT URI from object name and type.
 */
function buildUri(name, type) {
  const seg = type === "include" ? "includes" : "programs";
  return `/sap/bc/adt/programs/${seg}/${name.toLowerCase()}`;
}

module.exports = { save, load, loadRecord, remove, listAll, buildUri, STORE_DIR };
