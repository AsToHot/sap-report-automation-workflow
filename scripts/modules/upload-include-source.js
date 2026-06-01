const { adtRequest } = require("./adt-request");

async function uploadIncludeSource(client, name, source, lockHandle, transportRequest) {
  const suffix = transportRequest ? `&corrNr=${transportRequest}` : "";
  const uri = `/sap/bc/adt/programs/includes/${name.toLowerCase()}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${suffix}`;
  await adtRequest(client, "PUT", uri, {
    data: source,
    headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
  });
}

module.exports = { uploadIncludeSource };
