const { lockObject } = require("./lock-object");
const { unlockObject } = require("./unlock-object");
const lockStore = require("./lock-store");

/**
 * Execute a function while holding an ADT lock.
 * - Persists lock handle to .locks/ immediately after acquisition
 * - Guarantees unlock + store cleanup in finally block
 * - If fn throws, the lock handle remains in .locks/ for manual recovery
 */
async function withLock(client, uri, fn) {
  const handle = await lockObject(client, uri);

  // Persist immediately: survives process crash between lock and unlock
  lockStore.save(uri, handle);

  try {
    return await fn(handle);
  } finally {
    try {
      await unlockObject(client, uri, handle);
    } finally {
      // Clean store record after unlock (success or failure)
      lockStore.remove(uri);
    }
  }
}

module.exports = { withLock };
