const path = require("path");
const fs = require("fs");
const noderfc = require("node-rfc");

const envPath = path.resolve(__dirname, "..", ".env");
const env = {};
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
}

const url = env.SAP_URL || "";
const urlMatch = url.match(/^(?:https?:\/\/)?([^:\/]+)(?::(\d+))?/);
const ashost = urlMatch ? urlMatch[1] : "";
const port = urlMatch ? parseInt(urlMatch[2] || "8000", 10) : 8000;
const sysnr = env.SAP_SYSNR || String(port).slice(-2);

const rfcParams = {
  ashost: ashost, sysnr: sysnr, client: env.SAP_CLIENT || "200",
  user: env.SAP_USERNAME || env.SAP_USER || "",
  passwd: env.SAP_PASSWORD || env.SAP_PASS || "",
  lang: env.SAP_LANGUAGE || "ZH",
};
if (env.SAP_ROUTER) rfcParams.saprouter = env.SAP_ROUTER;

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

    const locks = [
      { name: "zsap_fi086at01", handle: "F68A30A5F84BC72EE610A0F2B85E8FF408BBAA53" },
      { name: "zsap_fi086asel", handle: "1472C518091F3B3BBD2A04166D931990EB9043D4" },
      { name: "zsap_fi086af01", handle: "A16ADB63ECF92E8180D9C7BC27983FB16DFEEC04" },
    ];

    for (const { name, handle } of locks) {
      // Try unlock on /programs/includes/ with lockHandle
      try {
        const resp = await adtRequest("POST", `/sap/bc/adt/programs/includes/${name}?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`, {
          headers: { Accept: "application/vnd.sap.as+xml" },
        });
        console.log(`[OK] Unlock ${name} (includes): ${resp.statusCode} ${resp.statusText}`);
      } catch (e) {
        console.log(`[INFO] Unlock ${name} (includes): ${e.statusCode || e.message}`);
      }

      // Also try on /programs/programs/ with lockHandle (in case lock is under programs endpoint)
      try {
        const resp = await adtRequest("POST", `/sap/bc/adt/programs/programs/${name}?_action=UNLOCK&lockHandle=${encodeURIComponent(handle)}`, {
          headers: { Accept: "application/vnd.sap.as+xml" },
        });
        console.log(`[OK] Unlock ${name} (programs): ${resp.statusCode} ${resp.statusText}`);
      } catch (e) {
        console.log(`[INFO] Unlock ${name} (programs): ${e.statusCode || e.message}`);
      }
    }

    await client.close();
  } catch (e) {
    console.error("[ERR]", e.message);
    try { await client.close(); } catch(_) {}
  }
}

run();
