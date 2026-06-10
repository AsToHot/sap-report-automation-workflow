const { adtRequest } = require("./adt-request");

/**
 * Upload Function Module source code via ADT REST.
 *
 * The source MUST contain the complete FUNCTION ... ENDFUNCTION block
 * including IMPORTING/EXPORTING/CHANGING/TABLES/EXCEPTIONS declarations.
 * SAP parses the interface from the source code automatically.
 *
 * @param {object} client  - node-rfc client
 * @param {string} fugrName - function group name
 * @param {string} fmName   - function module name
 * @param {string} source   - ABAP source code (FUNCTION ... ENDFUNCTION)
 * @param {string} lockHandle
 * @param {string} [transportRequest]
 */
async function uploadFmSource(client, fugrName, fmName, source, lockHandle, transportRequest) {
  const suffix = transportRequest ? `&corrNr=${transportRequest}` : "";
  const uri = `/sap/bc/adt/functions/groups/${fugrName.toLowerCase()}/fmodules/${fmName.toLowerCase()}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${suffix}`;
  await adtRequest(client, "PUT", uri, {
    data: source,
    headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
  });
}

module.exports = { uploadFmSource };
