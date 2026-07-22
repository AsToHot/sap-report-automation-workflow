/**
 * INTF 分步调试部署
 * Usage: node scripts/deploy_intf_debug.js
 */
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");

const INTF_NAME = "ZIF_TEST010";
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

  // ─── 1. Create Interface ───
  const intfXml = `<?xml version="1.0" encoding="UTF-8"?>
<intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="INTF deploy test"
  adtcore:name="${INTF_NAME}"
  adtcore:type="INTF/OI"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${PKG}"/>
</intf:abapInterface>`;

  let intfExists = false;
  try {
    await step("1. Create INTF", () =>
      adtRequest(client, "POST", "/sap/bc/adt/oo/interfaces", {
        data: intfXml,
        headers: {
          "Content-Type": "application/vnd.sap.adt.oo.interfaces.v2+xml",
          Accept: "application/vnd.sap.adt.oo.interfaces.v2+xml",
        },
      })
    );
  } catch (e) {
    if (e.statusCode === 409 || e.statusCode === 405 ||
        (e.body && (e.body.includes("已存在") || e.body.includes("AlreadyExists")))) {
      intfExists = true;
      console.log("[WARN] INTF already exists, continuing");
    } else {
      throw e;
    }
  }

  // ─── 2. Lock INTF ───
  const intfUri = `/sap/bc/adt/oo/interfaces/${INTF_NAME.toLowerCase()}`;
  const lockResp = await step("2. Lock INTF", () =>
    adtRequest(client, "POST", `${intfUri}?_action=LOCK&accessMode=MODIFY`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );
  const lock = (lockResp.body.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/) || [])[1];
  console.log(`  lockHandle: ${lock}`);

  // ─── 3. Upload interface source ───
  const source = `INTERFACE ${INTF_NAME.toLowerCase()}
  PUBLIC.

  METHODS hello
    RETURNING VALUE(rv_msg) TYPE string.

ENDINTERFACE.`;

  await step("3. Upload INTF source", () =>
    adtRequest(client, "PUT", `${intfUri}/source/main?lockHandle=${encodeURIComponent(lock)}`, {
      data: source,
      headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
    })
  );

  // ─── 4. Unlock INTF ───
  await step("4. Unlock INTF", () =>
    adtRequest(client, "POST", `${intfUri}?_action=UNLOCK&lockHandle=${encodeURIComponent(lock)}`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );

  // ─── 5. Activate INTF ───
  const actXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/interfaces/${INTF_NAME.toLowerCase()}" adtcore:name="${INTF_NAME}"/>
</adtcore:objectReferences>`;

  const actResp = await step("5. Activate INTF", () =>
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
  const checkResp = await adtRequest(client, "GET", intfUri, {
    headers: { Accept: "application/vnd.sap.adt.oo.interfaces.v2+xml" },
  });
  const v = checkResp.body.match(/adtcore:version="([^"]+)"/);
  console.log(`\nINTF version: ${v ? v[1] : 'unknown'}`);

  const hasError = /type\s*=\s*"[EA]"/.test(actResp.body) || /severity\s*=\s*"error"/i.test(actResp.body);
  console.log(hasError ? "\n[FATAL] Errors detected" : "\n=== SUCCESS ===");
}

main().catch(e => {
  console.error("\n[FATAL]", e.message);
  process.exit(1);
}).finally(() => client.close().catch(() => {}));
