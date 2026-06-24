const path = require("path");
const fs = require("fs");
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { loadDeploymentConfig } = require("./modules/load-deployment-config");
const { createClient } = require("./modules/sap-connection");
const { createProgram } = require("./modules/create-program");
const { createInclude } = require("./modules/create-include");
const { uploadProgramSource } = require("./modules/upload-program-source");
const { uploadIncludeSource } = require("./modules/upload-include-source");
const { withLock } = require("./modules/with-lock");
const { syntaxCheck } = require("./modules/syntax-check");
const { activateObjects } = require("./modules/activate-objects");

const lockStore = require("./modules/lock-store");

const progName = process.argv[2] || process.env.SAP_PROGRAM || "";
if (!progName) {
  console.error("[FATAL] Program name required. Usage: node scripts/deploy_rfc.js <program>");
  process.exit(1);
}

const srcDir = path.resolve(process.cwd(), "output", progName, "abap", "sources");
if (!fs.existsSync(srcDir)) {
  console.error(`[FATAL] Source directory not found: ${srcDir}`);
  process.exit(1);
}

const env = loadEnv();
const rfcParams = buildRfcParams(env);
const responsible = getResponsibleUser(env);

// Program-level config from deployment-config.md (NOT .env)
let deployConfig;
try {
  deployConfig = loadDeploymentConfig(progName);
} catch (e) {
  console.error(`[FATAL] Failed to load deployment config for ${progName}: ${e.message}`);
  process.exit(1);
}

const client = createClient(rfcParams);

async function deploy() {
  try {
    await client.open();
    console.log("[OK] RFC connected");
    console.log(`[CFG] Package: ${deployConfig.packageName}, Transport: ${deployConfig.transportRequest || "(none)"}`);

    const mainSrc = fs.readFileSync(path.join(srcDir, `${progName}.abap`), "utf8");
    const t01Src = fs.readFileSync(path.join(srcDir, `${progName}T01.abap`), "utf8");
    const selSrc = fs.readFileSync(path.join(srcDir, `${progName}SEL.abap`), "utf8");
    let f01Src = "";
    try { f01Src = fs.readFileSync(path.join(srcDir, `${progName}F01.abap`), "utf8"); } catch (_) {}
    let f02Src = "";
    try { f02Src = fs.readFileSync(path.join(srcDir, `${progName}F02.abap`), "utf8"); } catch (_) {}
    let o01Src = "";
    try { o01Src = fs.readFileSync(path.join(srcDir, `${progName}O01.abap`), "utf8"); } catch (_) {}

    // Use F02 if F01 is locked, or F01 otherwise
    const fSrc = f02Src || f01Src;
    const fIncName = f02Src ? `${progName}F02` : `${progName}F01`;

    // 1) Create program (skip if exists)
    let progExists = false;
    try {
      const progResult = await createProgram(client, progName, {
        description: deployConfig.description,
        responsible,
        packageName: deployConfig.packageName,
        transportRequest: deployConfig.transportRequest,
      });
      console.log(`[OK] Program ${progName} created in ${deployConfig.packageName}`);
    } catch (e) {
      if (e.statusCode === 409 || (e.body && e.body.includes("已存在"))) {
        progExists = true;
        console.log(`[WARN] Program ${progName} already exists; will overwrite source`);
      } else {
        throw e;
      }
    }

    // 2) Upload main source with lock
    const mainUri = `/sap/bc/adt/programs/programs/${progName.toLowerCase()}`;
    await withLock(client, mainUri, async (lockHandle) => {
      await uploadProgramSource(client, progName, mainSrc, lockHandle, deployConfig.transportRequest);
      console.log("[OK] Main source uploaded");
    });

    // 3) Create and upload includes with lock
    const includes = [
        [`${progName}T01`, t01Src],
        [`${progName}SEL`, selSrc],
        ...(fSrc ? [[fIncName, fSrc]] : []),
        [`${progName}O01`, o01Src],
      ].filter(([, src]) => src);

      for (const [incName, src] of includes) {
        await createInclude(client, incName, {
          description: `Include ${incName}`,
          responsible,
          packageName: deployConfig.packageName,
          transportRequest: deployConfig.transportRequest,
        });
        const incUri = `/sap/bc/adt/programs/includes/${incName.toLowerCase()}`;
        await withLock(client, incUri, async (lockHandle) => {
          await uploadIncludeSource(client, incName, src, lockHandle, deployConfig.transportRequest);
        });
        console.log(`[OK] Include ${incName} uploaded & unlocked`);
      }

    // 4) Syntax check all objects before activation
    const allObjects = [
      { name: progName, type: "programs" },
      { name: `${progName}T01`, type: "includes" },
      { name: `${progName}SEL`, type: "includes" },
      ...(fSrc ? [{ name: fIncName, type: "includes" }] : []),
      ...(o01Src ? [{ name: `${progName}O01`, type: "includes" }] : []),
    ];

    let syntaxErrors = [];
    let syntaxUnavailable = false;
    for (const obj of allObjects) {
      console.log(`[CHK] Syntax check ${obj.name}...`);
      const result = await syntaxCheck(client, obj.name, obj.type);
      if (result.unavailable) {
        syntaxUnavailable = true;
        console.log(`[WARN] Syntax check endpoint unavailable for ${obj.name}; relying on activation`);
      } else if (result.hasErrors) {
        syntaxErrors.push({ name: obj.name, errors: result.errors, raw: result.raw });
        console.error(`[ERR] Syntax errors in ${obj.name}:`);
        if (result.errors.length === 0) {
          console.error(`      (parser found error fingerprint but could not extract details)`);
          console.error(`      Raw XML (first 500 chars): ${(result.raw || "").substring(0, 500)}`);
        }
        for (const err of result.errors) {
          console.error(`      Line ${err.line || "?"}: ${err.message}`);
        }
      } else {
        console.log(`[OK] Syntax check passed: ${obj.name}`);
      }
    }

    if (syntaxErrors.length > 0) {
      console.error("\n[FATAL] Syntax check failed. Deployment aborted. Fix errors before activation.");
      for (const se of syntaxErrors) {
        if (se.errors && se.errors.length > 0) {
          for (const err of se.errors) {
            console.error(`  ${se.name}: Line ${err.line || "?"} - ${err.message}`);
          }
        } else {
          console.error(`  ${se.name}: error detected but parser could not extract details`);
          if (se.raw) console.error(`  Raw XML (first 500 chars): ${se.raw.substring(0, 500)}`);
        }
      }
      process.exit(1);
    }
    if (syntaxUnavailable) {
      console.log("[INFO] Syntax check unavailable; activation will validate syntax");
    }

    // 5) Activate main + all includes in one request (preauditRequested=false)
    const actObjs = [{ name: progName, type: "P" }];
    if (t01Src) actObjs.push({ name: `${progName}T01`, type: "I" });
    if (selSrc) actObjs.push({ name: `${progName}SEL`, type: "I" });
    if (fSrc) actObjs.push({ name: fIncName, type: "I" });
    if (o01Src) actObjs.push({ name: `${progName}O01`, type: "I" });

    console.log(`[ACT] Activating ${actObjs.length} object(s)...`);
    const actResult = await activateObjects(client, actObjs);
    if (actResult.hasErrors) {
      console.error("[ERR] Activation failed:");
      for (const err of actResult.errors) {
        console.error(`      ${err.name}: ${err.message}`);
      }
      process.exit(1);
    }
    console.log("[OK] Activation successful");

    console.log("\n=== DEPLOY SUCCESS ===");
  } catch (e) {
    console.error("[ERR]", e.statusCode || "", e.message);
    if (e.body) console.error("Response body:", e.body.substring(0, 500));

    // Report any locks that may be left behind
    const remaining = lockStore.listAll();
    if (remaining.length > 0) {
      console.error(`\n[LOCK] ${remaining.length} lock(s) may still be held:`);
      for (const rec of remaining) {
        console.error(`  - ${rec.uri} (handle persisted in .locks/)`);
      }
      console.error("[LOCK] Run: node scripts/release_locks.js  to clean up");
    }

    process.exit(1);
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

deploy();
