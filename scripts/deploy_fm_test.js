/**
 * Quick FM creation test: create FUGR + FM with input/output parameters.
 *
 * Usage: node scripts/deploy_fm_test.js [--cleanup]
 *   --cleanup  Delete the FM and FUGR after verification
 */

const { loadEnv, buildRfcParams, validateRfcParams } = require("./modules/env");
const { createClient } = require("./modules/sap-connection");
const { createFugr } = require("./modules/create-fugr");
const { createFm } = require("./modules/create-fm");
const { uploadFmSource } = require("./modules/upload-fm-source");
const { withLock } = require("./modules/with-lock");
const { adtRequest } = require("./modules/adt-request");
const { activateObjects } = require("./modules/activate-objects");

const FUGW_NAME = "ZFG_CLAUDE_TEST";
const FM_NAME = "ZFM_CLAUDE_TEST";
const CLEANUP = process.argv.includes("--cleanup");

// IMPORTANT: ADT REST rejects parameter comment blocks in source.
// Parameters must be set via the FM's parameter endpoint, NOT embedded in source.
// The source contains ONLY the implementation code between FUNCTION ... ENDFUNCTION.
const FM_SOURCE = `FUNCTION zfm_claude_test.
  ev_output = |Echo from ABAP: { iv_input }|.
ENDFUNCTION.
`;

// FM parameter definition (XML payload for ADT REST parameter endpoint)
const FM_PARAMS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"
  xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="${FM_NAME}" adtcore:type="FUGR/FF">
  <fmodule:importingParameters>
    <fmodule:parameter adtcore:name="IV_INPUT" fmodule:passByValue="true" fmodule:type="STRING"/>
  </fmodule:importingParameters>
  <fmodule:exportingParameters>
    <fmodule:parameter adtcore:name="EV_OUTPUT" fmodule:passByValue="true" fmodule:type="STRING"/>
  </fmodule:exportingParameters>
</fmodule:abapFunctionModule>`;

async function main() {
  const env = loadEnv();
  const rfcParams = buildRfcParams(env);
  const validation = validateRfcParams(rfcParams);
  if (!validation.valid) {
    console.error(`[FATAL] Missing: ${validation.missing.join(", ")}`);
    process.exit(1);
  }

  const responsible = env.SAP_USERNAME?.toUpperCase() || "";
  console.log(`[CFG] Connecting to ${rfcParams.ashost} client=${rfcParams.client} user=${responsible}`);

  const client = createClient(rfcParams);
  await client.open();
  console.log("[RFC] Connected");

  try {
    if (CLEANUP) {
      // ── Delete FM and FUGR ──────────────────────────────────
      console.log("\n[CLEANUP] Deleting FM and FUGR...");
      const fmUri = `/sap/bc/adt/functions/groups/${FUGW_NAME.toLowerCase()}/fmodules/${FM_NAME.toLowerCase()}`;
      try {
        await adtRequest(client, "DELETE", fmUri);
        console.log(`[OK] Deleted FM ${FM_NAME}`);
      } catch (e) {
        if (e.statusCode === 404) console.log(`[WARN] FM ${FM_NAME} not found`);
        else throw e;
      }
      const fugrUri = `/sap/bc/adt/functions/groups/${FUGW_NAME.toLowerCase()}`;
      try {
        await adtRequest(client, "DELETE", fugrUri);
        console.log(`[OK] Deleted FUGR ${FUGW_NAME}`);
      } catch (e) {
        if (e.statusCode === 404) console.log(`[WARN] FUGR ${FUGW_NAME} not found`);
        else throw e;
      }
      console.log("[CLEANUP] Done");
      return;
    }

    // ── 1. Create Function Group ────────────────────────────
    console.log(`\n[1/5] Creating function group ${FUGW_NAME}...`);
    let fugrExists = false;
    try {
      const result = await createFugr(client, FUGW_NAME, {
        description: "Claude FM creation test",
        responsible,
        packageName: "$TMP",
      });
      if (result.created) {
        console.log(`[OK] FUGR ${FUGW_NAME} created`);
      } else if (result.exists) {
        fugrExists = true;
        console.log(`[WARN] FUGR ${FUGW_NAME} already exists`);
      }
    } catch (e) {
      console.error(`[ERR] Create FUGR failed: ${e.statusCode} ${e.message}`);
      if (e.body) console.error("Body:", e.body.substring(0, 300));
      throw e;
    }

    // ── 2. Create Function Module ──────────────────────────
    console.log(`\n[2/5] Creating FM ${FM_NAME}...`);
    try {
      const result = await createFm(client, FUGW_NAME, FM_NAME, {
        description: "Test FM — input string → output string",
        responsible,
      });
      if (result.created) {
        console.log(`[OK] FM ${FM_NAME} created`);
      } else if (result.exists) {
        console.log(`[WARN] FM ${FM_NAME} already exists, will update source`);
      }
    } catch (e) {
      console.error(`[ERR] Create FM failed: ${e.statusCode} ${e.message}`);
      if (e.body) console.error("Body:", e.body.substring(0, 300));
      throw e;
    }

    // ── 3. Set FM parameters (IMPORTING/EXPORTING) ─────────
    // FM interface is metadata, not source code. ADT REST sets it via PUT to FM URI.
    console.log(`\n[3/6] Setting FM parameters...`);
    const fmUri = `/sap/bc/adt/functions/groups/${FUGW_NAME.toLowerCase()}/fmodules/${FM_NAME.toLowerCase()}`;
    try {
      await adtRequest(client, "PUT", fmUri, {
        data: FM_PARAMS_XML,
        headers: { "Content-Type": "application/*" },
      });
      console.log(`[OK] FM parameters set: IV_INPUT(STRING) -> EV_OUTPUT(STRING)`);
    } catch (e) {
      console.error(`[ERR] Set FM params: ${e.statusCode} ${e.message}`);
      if (e.body) console.error("Body:", e.body.substring(0, 300));
      // Continue - maybe the creation already had params
    }

    // ── 4. Upload FM source (with lock) ────────────────────
    console.log(`\n[4/6] Uploading FM source...`);
    await withLock(client, fmUri, async (lockHandle) => {
      await uploadFmSource(client, FUGW_NAME, FM_NAME, FM_SOURCE, lockHandle);
      console.log(`[OK] FM source uploaded with lock handle`);
    });

    // ── 5. Activate ────────────────────────────────────────
    console.log(`\n[5/6] Activating FUGR + FM...`);
    const actResult = await activateObjects(client, [FUGW_NAME, FM_NAME]);
    if (actResult.hasErrors) {
      console.error("[ERR] Activation failed:");
      for (const err of actResult.errors) {
        console.error(`  ${err.name}: ${err.message}`);
      }
      if (actResult.raw) console.error(`  Raw: ${actResult.raw.substring(0, 500)}`);
      throw new Error("Activation failed");
    }
    console.log("[OK] Activation successful");

    // ── 6. Test: Call the FM via RFC ────────────────────────
    console.log(`\n[6/6] Testing FM: CALL ${FM_NAME}...`);
    const testResult = await client.call(FM_NAME, {
      IV_INPUT: "Hello from Node.js RFC!",
    });
    console.log(`[RFC] Result: EV_OUTPUT = "${testResult.EV_OUTPUT}"`);
    console.log(`[RFC] Full result keys:`, Object.keys(testResult).join(", "));

    if (testResult.EV_OUTPUT?.includes("Hello from Node.js RFC!")) {
      console.log("\n=== SUCCESS: FM created, deployed, and executed correctly ===");
      console.log("Import param IV_INPUT (STRING) → Export param EV_OUTPUT (STRING) are working.");
      console.log("The ADT REST API for FM creation is VERIFIED.");
      console.log(`\nFM is deployed on system. Run with --cleanup to delete: node scripts/deploy_fm_test.js --cleanup`);
    } else {
      console.log("\n=== WARNING: FM executed but output was unexpected ===");
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
