const noderfc = require("node-rfc");

function createClient(rfcParams) {
  return new noderfc.Client(rfcParams);
}

module.exports = { createClient };
