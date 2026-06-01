const path = require("path");
const fs = require("fs");
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { loadDeploymentConfig } = require("./modules/load-deployment-config");
const { createClient } = require("./modules/sap-connection");
const { createInclude } = require("./modules/create-include");
const { uploadIncludeSource } = require("./modules/upload-include-source");
const { withLock } = require("./modules/with-lock");
const { syntaxCheck } = require("./modules/syntax-check");
const { activateObjects } = require("./modules/activate-objects");

const progName = process.argv[2] || "";
if (!progName) {
  console.error("[FATAL] Program name required");
  process.exit(1);
}

const srcDir = path.resolve(process.cwd(), "output", progName, "abap", "sources");
const env = loadEnv();
const rfcParams = buildRfcParams(env);
const responsible = getResponsibleUser(env);

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

    const t01Src = fs.readFileSync(path.join(srcDir, `${progName}T01.abap`), "utf8");
    const selSrc = fs.readFileSync(path.join(srcDir, `${progName}SEL.abap`), "utf8");
    const f01Src = fs.readFileSync(path.join(srcDir, `${progName}F01.abap`), "utf8");

    const includes = [
      [`${progName}T01`, t01Src],
      [`${progName}SEL`, selSrc],
      [`${progName}F01`, f01Src],
    ];

    for (const [incName, src] of includes) {
      console.log(`[DEP] Creating include ${incName}...`);
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

    // Syntax check all
    const allObjects = [
      { name: progName, type: "programs" },
      { name: `${progName}T01`, type: "includes" },
      { name: `${progName}SEL`, type: "includes" },
      { name: `${progName}F01`, type: "includes" },
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
        syntaxErrors.push({ name: obj.name, errors: result.errors });
        console.error(`[ERR] Syntax errors in ${obj.name}:`);
        for (const err of result.errors) {
          console.error(`      Line ${err.line}: ${err.message}`);
        }
      } else {
        console.log(`[OK] Syntax check passed: ${obj.name}`);
      }
    }

    if (syntaxErrors.length > 0) {
      console.error("\n[FATAL] Syntax check failed. Fix errors before activation.");
      process.exit(1);
    }
    if (syntaxUnavailable) {
      console.log("[INFO] Syntax check unavailable; activation will validate syntax");
    }

    // Activate
    const actResult = await activateObjects(client, [progName, `${progName}T01`, `${progName}SEL`, `${progName}F01`]);
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
    process.exit(1);
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

deploy();
