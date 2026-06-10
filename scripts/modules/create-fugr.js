const { adtRequest } = require("./adt-request");

/**
 * Create a Function Group (FUGR/F) via ADT REST.
 *
 * @param {object} client - node-rfc client
 * @param {string} name - function group name (e.g. ZFG_REPORT_VERIFY)
 * @param {object} config - { description, responsible, packageName, transportRequest? }
 */
async function createFugr(client, name, config) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${config.description || name + " Function Group"}"
  adtcore:name="${name}"
  adtcore:type="FUGR/F"
  adtcore:responsible="${config.responsible}">
  <adtcore:packageRef adtcore:name="${config.packageName}"/>
</group:abapFunctionGroup>`;

  const query = config.transportRequest ? `?corrNr=${config.transportRequest}` : "";
  try {
    await adtRequest(client, "POST", `/sap/bc/adt/functions/groups${query}`, {
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

module.exports = { createFugr };
