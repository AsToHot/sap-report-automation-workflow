#!/usr/bin/env node
/**
 * deploy_report.js — 部署纯 REPORT（无 INCLUDE）
 *
 * ## 入参
 *   node scripts/deploy_report.js <程序名>
 *
 * ## 出参 (JSON)
 *   { status: "success" | "failed", objects: [{name, type, version}], errors: [...] }
 *
 * ## 真实示例
 *
 * ### 示例 1：新程序首次部署
 *   $ node scripts/deploy_report.js ZTEST006
 *   [OK] RFC connected
 *   [OK] Program ZTEST006 created in $TMP
 *   [OK] Source uploaded
 *   [ACT] Activating 1 object(s)...
 *   [OK] Activation successful
 *   === DEPLOY SUCCESS ===
 *   {"status":"success","objects":[{"name":"ZTEST006","type":"PROG/P","version":"active"}]}
 *
 * ### 示例 2：覆盖已有程序
 *   $ node scripts/deploy_report.js ZTEST006
 *   [WARN] Program ZTEST006 already exists; will overwrite source
 *   [OK] Source uploaded
 *   [ACT] Activating 1 object(s)...
 *   [OK] Activation successful
 *   === DEPLOY SUCCESS ===
 *
 * ### 示例 3：语法错误
 *   $ node scripts/deploy_report.js ZTEST007
 *   [OK] Source uploaded
 *   [ACT] Activating 1 object(s)...
 *   [ERR] Activation failed:
 *         unknown: 未指定语句 "WRITEE"
 *   {"status":"failed","errors":[{"name":"unknown","message":"未指定语句..."}]}
 *
 * ## 目录约定
 *   源码文件: output/<程序名>/abap/<程序名>.abap
 *   部署配置: output/<程序名>/docs/deployment-config.md
 */
const path = require("path");
const fs = require("fs");
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { loadDeploymentConfig } = require("./modules/load-deployment-config");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");
const { activateObjects } = require("./modules/activate-objects");
const { withLock, isAlreadyExists, isConflict } = require("./modules/deploy-utils");

// ── 参数 ──
const progName = process.argv[2];
if (!progName) {
  console.error("[FATAL] Usage: node scripts/deploy_report.js <program>");
  console.error("Example: node scripts/deploy_report.js ZTEST006");
  process.exit(1);
}

const srcDir = path.resolve(process.cwd(), "output", progName, "abap");
if (!fs.existsSync(srcDir)) {
  console.error(`[FATAL] Source dir not found: ${srcDir}`);
  process.exit(1);
}

function readSrc(name) {
  const p = path.join(srcDir, `${name}.abap`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// ── 初始化 ──
const env = loadEnv();
const rfcParams = buildRfcParams(env);
const responsible = getResponsibleUser(env);
const client = createClient(rfcParams);

const mainSrc = readSrc(progName);
if (!mainSrc) {
  console.error(`[FATAL] Main source not found: ${srcDir}/${progName}.abap`);
  process.exit(1);
}

let deployConfig;
try {
  deployConfig = loadDeploymentConfig(progName);
} catch (e) {
  console.error(`[FATAL] Failed to load deployment config: ${e.message}`);
  process.exit(1);
}

// ── 主流程 ──
async function deploy() {
  await client.open();
  console.log("[OK] RFC connected");
  console.log(`[CFG] Package: ${deployConfig.packageName}, Transport: ${deployConfig.transportRequest || "(none)"}`);

  // ── 1. Create program ──
  const progXml = `<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${deployConfig.description || progName + " Report"}"
  adtcore:name="${progName}"
  adtcore:type="PROG/P"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${deployConfig.packageName}"/>
</program:abapProgram>`;

  const query = deployConfig.transportRequest ? `?corrNr=${deployConfig.transportRequest}` : "";

  try {
    await adtRequest(client, "POST", `/sap/bc/adt/programs/programs${query}`, {
      data: progXml,
      headers: {
        "Content-Type": "application/*",
        Accept: "application/vnd.sap.adt.programs.programs.v4+xml",
      },
    });
    console.log(`[OK] Program ${progName} created in ${deployConfig.packageName}`);
  } catch (e) {
    if (isConflict(e.statusCode) || isAlreadyExists(e.body)) {
      console.log(`[WARN] Program ${progName} already exists; will overwrite source`);
    } else {
      throw e;
    }
  }

  // ── 2. Lock → upload → unlock main source ──
  const mainUri = `/sap/bc/adt/programs/programs/${progName.toLowerCase()}`;
  await withLock(client, mainUri, async (lockHandle) => {
    const suffix = deployConfig.transportRequest ? `&corrNr=${deployConfig.transportRequest}` : "";
    await adtRequest(client, "PUT",
      `${mainUri}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${suffix}`, {
        data: mainSrc,
        headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
      });
    console.log("[OK] Source uploaded");
  });

  // ── 3. Activate ──
  console.log("[ACT] Activating 1 object(s)...");
  const actResult = await activateObjects(client, [{ name: progName, type: "P" }]);
  if (actResult.hasErrors) {
    console.error("[ERR] Activation failed:");
    for (const err of actResult.errors) {
      console.error(`      ${err.name}: ${err.message}`);
    }
    return { status: "failed", objects: [], errors: actResult.errors };
  }
  console.log("[OK] Activation successful");

  // ── 4. Verify ──
  const checkResp = await adtRequest(client, "GET", mainUri, {
    headers: { Accept: "application/vnd.sap.adt.programs.programs.v4+xml" },
  });
  const version = (checkResp.body.match(/adtcore:version="([^"]+)"/) || [])[1] || "unknown";

  return {
    status: "success",
    objects: [{ name: progName, type: "PROG/P", version }],
    errors: [],
  };
}

// ── 执行 ──
deploy()
  .then(result => {
    console.log("\n=== DEPLOY SUCCESS ===");
    console.log(JSON.stringify(result));
  })
  .catch(e => {
    console.error(`\n[FATAL] ${e.statusCode || ""} ${e.message}`);
    if (e.body) console.error("Response:", e.body.substring(0, 500));
    const remaining = require("./modules/lock-store").listAll();
    if (remaining.length) {
      console.error(`\n[LOCK] ${remaining.length} lock(s) still held — run: node scripts/release_locks.js`);
    }
    process.exit(1);
  })
  .finally(() => client.close().catch(() => {}));
