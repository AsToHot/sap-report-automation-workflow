const { adtRequest } = require("./adt-request");

/**
 * Create a Function Module (FUGR/FF) within a Function Group via ADT REST.
 *
 * @param {object} client - node-rfc client
 * @param {string} fugrName - parent function group name (e.g. ZFG_REPORT_VERIFY)
 * @param {string} fmName   - function module name (e.g. ZREPORT_EXEC_VERIFY)
 * @param {object} config   - { description, responsible, transportRequest? }
 */
async function createFm(client, fugrName, fmName, config) {
  const fugrUri = `/sap/bc/adt/functions/groups/${fugrName.toLowerCase()}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${config.description || fmName + " Function Module"}"
  adtcore:name="${fmName}" adtcore:type="FUGR/FF">
  <adtcore:containerRef adtcore:name="${fugrName}"
    adtcore:type="FUGR/F"
    adtcore:uri="${fugrUri}" />
</fmodule:abapFunctionModule>`;

  const query = config.transportRequest ? `&corrNr=${config.transportRequest}` : "";
  const uri = `/sap/bc/adt/functions/groups/${fugrName.toLowerCase()}/fmodules${query ? "?" + query.slice(1) : ""}`;

  try {
    await adtRequest(client, "POST", uri, {
      data: xml,
      headers: {
        "Content-Type": "application/*",
      },
    });
    return { created: true };
  } catch (e) {
    if (e.statusCode === 409 || (e.statusCode === 500 && e.body && e.body.includes("已存在"))) {
      return { created: false, exists: true };
    }
    throw e;
  }
}

module.exports = { createFm };
