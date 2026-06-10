/**
 * Final test: FM with inline params (source) + RFC processing type (metadata).
 *
 * Parameters → inline FUNCTION declaration syntax in source code
 * RFC flag   → PUT FM resource XML with fmodule:processingType="rfc"
 */

const { loadEnv, buildRfcParams, validateRfcParams } = require("./modules/env");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");
const { withLock } = require("./modules/with-lock");

const FUGR = "ZFG_CLAUDE_TEST";
const FM   = "ZFM_CLAUDE_TEST";
const FM_URI = `/sap/bc/adt/functions/groups/${FUGR.toLowerCase()}/fmodules/${FM.toLowerCase()}`;
const FUGR_URI = `/sap/bc/adt/functions/groups/${FUGR.toLowerCase()}`;

// Source: parameters declared inline (per RFC_READ_TABLE pattern)
const FM_SOURCE = `FUNCTION zfm_claude_test
  IMPORTING
    VALUE(iv_input) TYPE string
  EXPORTING
    VALUE(ev_output) TYPE string.
  ev_output = |Echo: { iv_input }|.
ENDFUNCTION.
`;

// Metadata: set processingType to "rfc" (remote-enabled)
// Parameters already defined in source, so we just set the RFC flag here
const FM_META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:name="${FM}" adtcore:type="FUGR/FF"
  adtcore:description="Test RFC FM — echo input back as output"
  adtcore:language="ZH"
  fmodule:processingType="rfc">
</fmodule:abapFunctionModule>`;

async function main() {
  const env = loadEnv();
  const rfcParams = buildRfcParams(env);
  const v = validateRfcParams(rfcParams);
  if (!v.valid) { console.error("Missing:", v.missing.join(", ")); process.exit(1); }

  const client = createClient(rfcParams);
  await client.open();
  console.log("[RFC] Connected\n");

  try {
    // ── Lock → set RFC metadata → upload source → unlock ──
    await withLock(client, FM_URI, async (lockHandle) => {
      console.log(`[LOCK] ${lockHandle.substring(0, 16)}...`);

      // Step 1: Set processingType="rfc" via PUT FM resource
      const metaUri = `${FM_URI}?lockHandle=${encodeURIComponent(lockHandle)}`;
      const r1 = await adtRequest(client, "PUT", metaUri, {
        data: FM_META_XML,
        headers: { "Content-Type": "application/*" },
      });
      console.log(`[OK] Metadata (rfc): HTTP ${r1.statusCode}`);

      // Step 2: Upload source with inline parameters
      const srcUri = `${FM_URI}/source/main?lockHandle=${encodeURIComponent(lockHandle)}`;
      const r2 = await adtRequest(client, "PUT", srcUri, {
        data: FM_SOURCE,
        headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
      });
      console.log(`[OK] Source: HTTP ${r2.statusCode}`);
    });

    // ── Activate ──
    console.log("\n── Activating ──");
    const actXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${FUGR_URI}" adtcore:name="${FUGR}"/>
  <adtcore:objectReference adtcore:uri="${FM_URI}" adtcore:name="${FM}"/>
</adtcore:objectReferences>`;
    try {
      const r = await adtRequest(client, "POST",
        "/sap/bc/adt/activation?method=activate&preauditRequested=true", {
        data: actXml,
        headers: { "Content-Type": "application/vnd.sap.adt.activation+xml", Accept: "application/xml" },
      });
      const body = r.body || "";
      if (body.includes('type="E"') || body.includes('severity="error"')) {
        console.log("[WARN]", body.substring(0, 600));
      } else {
        console.log(`[OK] Activated (HTTP ${r.statusCode})`);
      }
    } catch (e) {
      console.log(`[ERR] Activation HTTP ${e.statusCode}`);
      if (e.body) console.log(e.body.substring(0, 600));
    }

    // ── Verify state ──
    const fmResp = await adtRequest(client, "GET", FM_URI);
    const version = fmResp.body.includes('version="active"') ? "ACTIVE" : "inactive";
    const procType = (fmResp.body.match(/processingType="([^"]+)"/) || [,"unknown"])[1];
    console.log(`\nVersion: ${version} | Processing: ${procType}`);

    // ── Source ──
    console.log("\n── Source ──");
    const srcResp = await adtRequest(client, "GET", `${FM_URI}/source/main`);
    console.log(srcResp.body);

    // ── RFC Test Call ──
    console.log("── RFC Test Call ──");
    try {
      const testRes = await client.call(FM, { IV_INPUT: "Hello from ADT REST!" });
      console.log(`EV_OUTPUT = "${testRes.EV_OUTPUT}"`);
      console.log("\n========================================");
      console.log("SUCCESS: FM with import+export params + RFC via ADT REST!");
      console.log("========================================");
    } catch (e) {
      console.log(`[FAIL] ${e.message}`);
    }

  } catch (e) {
    console.error("[FATAL]", e.message);
    if (e.body) console.error("Body:", e.body.substring(0, 500));
    process.exit(1);
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

main();
