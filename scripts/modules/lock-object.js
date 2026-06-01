const { adtRequest } = require("./adt-request");
const lockStore = require("./lock-store");

function parseLockHandle(xml) {
  const m = xml.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/);
  return m ? m[1] : null;
}

async function lockObject(client, uri) {
  const resp = await adtRequest(client, "POST", `${uri}?_action=LOCK&accessMode=MODIFY`, {
    headers: { Accept: "application/vnd.sap.as+xml" },
  });
  const handle = parseLockHandle(resp.body);
  if (!handle) throw new Error(`Failed to obtain lock handle for ${uri}`);

  // Persist immediately — even if caller doesn't use withLock
  lockStore.save(uri, handle);

  return handle;
}

module.exports = { lockObject, parseLockHandle };
