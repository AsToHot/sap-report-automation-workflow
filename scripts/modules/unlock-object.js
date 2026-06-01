const { adtRequest } = require("./adt-request");
const lockStore = require("./lock-store");

/**
 * Unlock an ADT object.
 *
 * Resolution order when lockHandle is missing:
 *   1. Try lock-store on disk (.locks/<name>.json)
 *   2. If still no handle → log warning and skip (must not throw:
 *      a lost handle is a transient infrastructure issue, not a code bug)
 */
async function unlockObject(client, uri, lockHandle) {
  let handle = lockHandle;

  if (!handle) {
    handle = lockStore.load(uri);
    if (handle) {
      console.log(`[UNLOCK] Recovered lock handle from store for ${uri}`);
    }
  }

  if (!handle) {
    console.warn(`[UNLOCK] No lock handle available for ${uri} — skipping (may need manual release)`);
    return;
  }

  try {
    await adtRequest(client, "POST",
      `${uri}?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`,
      { headers: { Accept: "application/vnd.sap.as+xml" } }
    );
    console.log(`[UNLOCK] Released: ${uri}`);
  } catch (e) {
    console.warn(`[UNLOCK] Failed to release ${uri}: ${e.message || e} (handle may already be released)`);
  }
}

module.exports = { unlockObject };
