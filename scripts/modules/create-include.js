const { adtRequest } = require("./adt-request");

async function createInclude(client, name, config) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${config.description || "Include " + name}"
  adtcore:name="${name}"
  adtcore:type="PROG/I"
  adtcore:responsible="${config.responsible}">
  <adtcore:packageRef adtcore:name="${config.packageName}"/>
</include:abapInclude>`;

  const query = config.transportRequest ? `?corrNr=${config.transportRequest}` : "";
  try {
    await adtRequest(client, "POST", `/sap/bc/adt/programs/includes${query}`, {
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

module.exports = { createInclude };
