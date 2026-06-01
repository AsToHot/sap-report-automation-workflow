const { adtRequest } = require("./adt-request");

async function createProgram(client, name, config) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${config.description || name + " Report"}"
  adtcore:name="${name}"
  adtcore:type="PROG/P"
  adtcore:responsible="${config.responsible}">
  <adtcore:packageRef adtcore:name="${config.packageName}"/>
</program:abapProgram>`;

  const query = config.transportRequest ? `?corrNr=${config.transportRequest}` : "";
  try {
    await adtRequest(client, "POST", `/sap/bc/adt/programs/programs${query}`, {
      data: xml,
      headers: {
        "Content-Type": "application/*",
        Accept: "application/vnd.sap.adt.programs.programs.v4+xml",
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

module.exports = { createProgram };
