/**
 * FUGR + FM 分步调试部署
 * Usage: node scripts/deploy_fugr_debug.js
 */
const path = require("path");
const fs = require("fs");
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");

const FUGR_NAME = "ZTEST008FG";
const FM_NAME = "ZTEST008_FM_HELLO";
const PKG = "$TMP";

const env = loadEnv();
const rfcParams = buildRfcParams(env);
const responsible = getResponsibleUser(env);
const client = createClient(rfcParams);

async function step(label, fn) {
  console.log(`\n=== STEP: ${label} ===`);
  try {
    const res = await fn();
    console.log(`[OK] ${label}`);
    if (res.body) console.log(`  body(first 500): ${res.body.substring(0, 500)}`);
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

  // ─── 1. Create Function Group ───
  const fugrXml = `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="FUGR deploy test"
  adtcore:name="${FUGR_NAME}"
  adtcore:type="FUGR/F"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${PKG}"/>
</group:abapFunctionGroup>`;

  let fugrExists = false;
  try {
    await step("1. Create FUGR", () =>
      adtRequest(client, "POST", "/sap/bc/adt/functions/groups", {
        data: fugrXml,
        headers: { "Content-Type": "application/*" },
      })
    );
  } catch (e) {
    if (e.statusCode === 409 || e.statusCode === 405 ||
        (e.body && (e.body.includes("已存在") || e.body.includes("AlreadyExists")))) {
      fugrExists = true;
      console.log("[WARN] FUGR already exists, continuing");
    } else {
      throw e;
    }
  }

  // ─── 1b. Upload FUGR main (abap) source if needed ───
  const fugrUri = `/sap/bc/adt/functions/groups/${FUGR_NAME.toLowerCase()}`;

  // ─── 2. Create Function Module ───
  const fmPayload = `<?xml version="1.0" encoding="UTF-8"?>
<fmodules:abapFunctionModule xmlns:fmodules="http://www.sap.com/adt/functions/fmodules"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="Hello FM - deploy test"
  adtcore:name="${FM_NAME}"
  adtcore:type="FUGR/FF"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${PKG}"/>
</fmodules:abapFunctionModule>`;

  let fmExists = false;
  try {
    await step("2. Create FM", () =>
      adtRequest(client, "POST", `${fugrUri}/fmodules`, {
        data: fmPayload,
        headers: {
          "Content-Type": "application/vnd.sap.adt.functions.fmodules.v2+xml",
          Accept: "application/vnd.sap.adt.functions.fmodules.v2+xml",
        },
      })
    );
  } catch (e) {
    if (e.statusCode === 409 || e.statusCode === 405 ||
        (e.body && (e.body.includes("已存在") || e.body.includes("AlreadyExists")))) {
      fmExists = true;
      console.log("[WARN] FM already exists, continuing");
    } else {
      throw e;
    }
  }

  // ─── 3. Lock FM ───
  const fmUri = `${fugrUri}/fmodules/${FM_NAME.toLowerCase()}`;
  const lockResp = await step("3. Lock FM", () =>
    adtRequest(client, "POST", `${fmUri}?_action=LOCK&accessMode=MODIFY`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );
  const fmLock = (lockResp.body.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/) || [])[1];
  console.log(`  lockHandle: ${fmLock}`);

  // ─── 4. Upload FM source (with inline parameter declarations) ───
  const fmSource = `FUNCTION ${FM_NAME.toLowerCase()}
  IMPORTING
    VALUE(iv_name) TYPE char30 DEFAULT 'World'
  EXPORTING
    VALUE(ev_greeting) TYPE char50.
  CONCATENATE 'Hello' iv_name INTO ev_greeting SEPARATED BY space.
ENDFUNCTION.`;

  await step("4. Upload FM source", () =>
    adtRequest(client, "PUT", `${fmUri}/source/main?lockHandle=${encodeURIComponent(fmLock)}`, {
      data: fmSource,
      headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
    })
  );

  // ─── 5. Unlock FM ───
  await step("5. Unlock FM", () =>
    adtRequest(client, "POST", `${fmUri}?_action=UNLOCK&lockHandle=${encodeURIComponent(fmLock)}`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );

  // ─── 6. Activate FUGR ───
  const actXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/functions/groups/${FUGR_NAME.toLowerCase()}" adtcore:name="${FUGR_NAME}"/>
</adtcore:objectReferences>`;

  console.log("\nActivate FUGR XML:");
  console.log(actXml);

  const actResp = await step("6. Activate FUGR", () =>
    adtRequest(client, "POST", "/sap/bc/adt/activation?method=activate&preauditRequested=false", {
      data: actXml,
      headers: {
        "Content-Type": "application/vnd.sap.adt.activation+xml",
        Accept: "application/xml",
      },
    })
  );

  console.log("\n=== Full activation response ===");
  console.log(actResp.body || "(empty)");

  const hasError = /type\s*=\s*"[EA]"/.test(actResp.body)
    || /severity\s*=\s*"error"/i.test(actResp.body);
  console.log(hasError ? "\n[FATAL] Errors detected" : "\n=== SUCCESS ===");
}

main().catch(e => {
  console.error("\n[FATAL]", e.message);
  process.exit(1);
}).finally(() => client.close().catch(() => {}));
