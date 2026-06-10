const path = require("path");
const fs = require("fs");
const noderfc = require("node-rfc");
const { loadEnv, buildRfcParams } = require("./modules/env");

const env = loadEnv();
const rfcParams = buildRfcParams(env);

const client = new noderfc.Client(rfcParams);

async function adtRequest(method, uri, opts = {}) {
  const headerFields = [];
  if (opts.headers) {
    for (const [name, value] of Object.entries(opts.headers)) {
      headerFields.push({ NAME: name, VALUE: value });
    }
  }
  const body = opts.data !== undefined && opts.data !== null ? String(opts.data) : "";
  if (body && !headerFields.some(h => h.NAME.toLowerCase() === "content-type")) {
    headerFields.push({ NAME: "Content-Type", VALUE: "text/plain; charset=utf-8" });
  }

  const result = await client.call("SADT_REST_RFC_ENDPOINT", {
    REQUEST: {
      REQUEST_LINE: { METHOD: method.toUpperCase(), URI: uri, VERSION: "HTTP/1.1" },
      HEADER_FIELDS: headerFields,
      MESSAGE_BODY: body ? Buffer.from(body, "utf-8") : Buffer.alloc(0),
    },
  });

  const resp = result.RESPONSE || result;
  const statusCode = parseInt(resp.STATUS_LINE?.STATUS_CODE || resp.STATUS_LINE?.CODE || "0", 10);
  const statusText = resp.STATUS_LINE?.REASON_PHRASE || resp.STATUS_LINE?.REASON || "";
  const respBody = resp.MESSAGE_BODY
    ? (Buffer.isBuffer(resp.MESSAGE_BODY) ? resp.MESSAGE_BODY.toString("utf-8") : String(resp.MESSAGE_BODY))
    : "";

  return { statusCode, statusText, body: respBody, headers: resp.HEADER_FIELDS || [] };
}

async function run() {
  try {
    await client.open();
    console.log("[OK] RFC connected");

    const handle = "1807D76BAB1ED28FD5F9DA4B37C53072453E7E7C";
    const resp = await adtRequest("POST", `/sap/bc/adt/programs/programs/zsap_fi086a?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    });
    console.log(`[OK] Unlock: ${resp.statusCode} ${resp.statusText}`);

    await client.close();
  } catch (e) {
    console.error("[ERR]", e.statusCode || e.message);
    try { await client.close(); } catch(_) {}
  }
}

run();
