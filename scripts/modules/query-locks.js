const { adtRequest } = require("./adt-request");

/**
 * Query active ADT locks from SAP.
 *
 * Tier 1: ADT REST discovery — try GET /sap/bc/adt/locks
 *   (returns XML with lock handles, object URIs, and user info)
 * Tier 2: ADT object probe — GET the object's own URI and parse
 *   lock-related headers/elements from the response
 * Tier 3: Return empty — caller should fall back to RFC DEQUEUE_ALL
 *
 * @returns {Array<{uri: string, handle: string, user: string, time: string}>}
 */
async function queryAdtLocks(client) {
  const locks = [];

  // Tier 1: Try dedicated locks endpoint
  try {
    const resp = await adtRequest(client, "GET", "/sap/bc/adt/locks", {
      headers: { Accept: "application/xml" },
    });
    locks.push(...parseLocksXml(resp.body));
    if (locks.length > 0) return locks;
  } catch (e) {
    // 404/405: endpoint not available in this SAP version
    if (e.statusCode !== 404 && e.statusCode !== 405) {
      console.warn(`[QUERY-LOCKS] ADT /locks endpoint error: ${e.message}`);
    }
  }

  // Tier 2: Try /sap/bc/adt/objectlocks or similar variants
  const altEndpoints = [
    "/sap/bc/adt/objectlocks",
    "/sap/bc/adt/locks/locks",
  ];
  for (const ep of altEndpoints) {
    try {
      const resp = await adtRequest(client, "GET", ep, {
        headers: { Accept: "application/xml" },
      });
      const parsed = parseLocksXml(resp.body);
      if (parsed.length > 0) return parsed;
    } catch (_) {
      // continue
    }
  }

  return locks;
}

/**
 * Parse ADT locks XML response.
 * Expected format: <atom:feed> with <atom:entry> entries containing
 * lock handle, object URI, and user info.
 */
function parseLocksXml(xml) {
  const locks = [];

  // Pattern: <atom:entry> containing <LOCK_HANDLE> and URI
  const entryRegex = /<atom:entry[\s\S]*?<\/atom:entry>/g;
  let m;
  while ((m = entryRegex.exec(xml)) !== null) {
    const entry = m[0];
    const handleMatch = entry.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/);
    const uriMatch = entry.match(/adtcore:uri="([^"]*)"/)
                  || entry.match(/<adtcore:uri[^>]*>([^<]*)<\/adtcore:uri>/)
                  || entry.match(/uri="([^"]*locks[^"]*)"/);
    const userMatch = entry.match(/adtcore:user[^>]*>([^<]*)</)
                   || entry.match(/user="([^"]*)"/);
    const timeMatch = entry.match(/adtcore:created[^>]*>([^<]*)</)
                   || entry.match(/created="([^"]*)"/);

    if (handleMatch) {
      locks.push({
        handle: handleMatch[1],
        uri: uriMatch ? uriMatch[1] : "",
        user: userMatch ? userMatch[1] : "",
        time: timeMatch ? timeMatch[1] : "",
      });
    }
  }

  // Fallback: simpler <LOCK_HANDLE> pattern outside atom entries
  if (locks.length === 0) {
    const handleRegex = /<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/g;
    while ((m = handleRegex.exec(xml)) !== null) {
      locks.push({ handle: m[1], uri: "", user: "", time: "" });
    }
  }

  return locks;
}

/**
 * Query locks for a specific object by name.
 * Returns the lock handle if found, null otherwise.
 */
async function getLockHandle(client, uri) {
  const locks = await queryAdtLocks(client);
  const match = locks.find((l) => l.uri === uri || l.uri.includes(uri.split("/").pop()));
  return match ? match.handle : null;
}

module.exports = { queryAdtLocks, getLockHandle, parseLocksXml };
