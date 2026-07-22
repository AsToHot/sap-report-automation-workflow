/**
 * CLAS 分步调试部署
 * Usage: node scripts/deploy_clas_debug.js
 */
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");

const CLAS_NAME = "ZCL_TEST009";
const PKG = "$TMP";

const env = loadEnv();
const client = createClient(buildRfcParams(env));
const responsible = getResponsibleUser(env);

async function step(label, fn) {
  console.log(`\n=== STEP: ${label} ===`);
  try {
    const res = await fn();
    console.log(`[OK] ${label}`);
    if (res.body && res.body.length < 500) console.log(`  body: ${res.body}`);
    return res;
  } catch (e) {
    console.log(`[FAIL] ${label}`);
    console.log(`  statusCode: ${e.statusCode}`);
    console.log(`  message: ${e.message}`);
    if (e.body) console.log(`  body(first 500): ${e.body.substring(0, 500)}`);
    throw e;
  }
}

async function main() {
  await client.open();
  console.log("[OK] RFC connected");

  // ─── 1. Create Class ───
  const clasXml = `<?xml version="1.0" encoding="UTF-8"?>
<class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="CLAS deploy test"
  adtcore:name="${CLAS_NAME}"
  adtcore:type="CLAS/OC"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${PKG}"/>
</class:abapClass>`;

  let clasExists = false;
  try {
    await step("1. Create CLAS", () =>
      adtRequest(client, "POST", "/sap/bc/adt/oo/classes", {
        data: clasXml,
        headers: {
          "Content-Type": "application/vnd.sap.adt.oo.classes.v2+xml",
          Accept: "application/vnd.sap.adt.oo.classes.v2+xml",
        },
      })
    );
  } catch (e) {
    if (e.statusCode === 409 || e.statusCode === 405 ||
        (e.body && (e.body.includes("已存在") || e.body.includes("AlreadyExists")))) {
      clasExists = true;
      console.log("[WARN] CLAS already exists, continuing");
    } else {
      throw e;
    }
  }

  // ─── 2. Lock CLAS ───
  const clasUri = `/sap/bc/adt/oo/classes/${CLAS_NAME.toLowerCase()}`;
  const lockResp = await step("2. Lock CLAS", () =>
    adtRequest(client, "POST", `${clasUri}?_action=LOCK&accessMode=MODIFY`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );
  const lock = (lockResp.body.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/) || [])[1];
  console.log(`  lockHandle: ${lock}`);

  // ─── 3. Upload class source ───
  const source = `CLASS ${CLAS_NAME.toLowerCase()} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CLASS-METHODS: hello
      RETURNING VALUE(rv_msg) TYPE string.

  PROTECTED SECTION.
  PRIVATE SECTION.

ENDCLASS.

CLASS ${CLAS_NAME.toLowerCase()} IMPLEMENTATION.
  METHOD hello.
    rv_msg = 'Hello from ZCL_TEST009 - CLAS deploy test!'.
  ENDMETHOD.
ENDCLASS.`;

  await step("3. Upload CLAS source", () =>
    adtRequest(client, "PUT", `${clasUri}/source/main?lockHandle=${encodeURIComponent(lock)}`, {
      data: source,
      headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
    })
  );

  // ─── 4. Unlock CLAS ───
  await step("4. Unlock CLAS", () =>
    adtRequest(client, "POST", `${clasUri}?_action=UNLOCK&lockHandle=${encodeURIComponent(lock)}`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );

  // ─── 5. Activate CLAS ───
  const actXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/${CLAS_NAME.toLowerCase()}" adtcore:name="${CLAS_NAME}"/>
</adtcore:objectReferences>`;

  const actResp = await step("5. Activate CLAS", () =>
    adtRequest(client, "POST", "/sap/bc/adt/activation?method=activate&preauditRequested=false", {
      data: actXml,
      headers: {
        "Content-Type": "application/vnd.sap.adt.activation+xml",
        Accept: "application/xml",
      },
    })
  );
  console.log("\nActivation response:");
  console.log(actResp.body || "(empty)");

  // Verify status
  const checkResp = await adtRequest(client, "GET", clasUri, {
    headers: { Accept: "application/vnd.sap.adt.oo.classes.v2+xml" },
  });
  const v = checkResp.body.match(/adtcore:version="([^"]+)"/);
  console.log(`\nCLAS version: ${v ? v[1] : 'unknown'}`);

  const hasError = /type\s*=\s*"[EA]"/.test(actResp.body) || /severity\s*=\s*"error"/i.test(actResp.body);
  console.log(hasError ? "\n[FATAL] Errors detected" : "\n=== SUCCESS ===");
}

main().catch(e => {
  console.error("\n[FATAL]", e.message);
  process.exit(1);
}).finally(() => client.close().catch(() => {}));
