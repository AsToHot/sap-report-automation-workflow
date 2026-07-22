#!/usr/bin/env node
/**
 * deploy_clas.js — 部署 CLAS（全局类）
 *
 * ## 入参
 *   node scripts/deploy_clas.js <类名>
 *
 * ## 出参 (JSON)
 *   { status: "success" | "failed", objects: [{name, type, version}], errors: [...] }
 *
 * ## 真实示例
 *
 * ### 示例 1：新类首次部署
 *   $ node scripts/deploy_clas.js ZCL_TEST009
 *   [OK] RFC connected
 *   [CFG] Package: $TMP
 *   [OK] CLAS ZCL_TEST009 created in $TMP
 *   [OK] Source uploaded
 *   [ACT] Activating 1 object(s)...
 *   [OK] Activation successful
 *   === DEPLOY SUCCESS ===
 *   {"status":"success","objects":[{"name":"ZCL_TEST009","type":"CLAS/OC","version":"active"}]}
 *
 * ### 示例 2：覆盖已有类
 *   $ node scripts/deploy_clas.js ZCL_TEST009
 *   [WARN] CLAS ZCL_TEST009 already exists; will overwrite source
 *   [OK] Source uploaded
 *   [ACT] Activating 1 object(s)...
 *   [OK] Activation successful
 *
 * ## 目录约定
 *   源码文件: output/<类名>/abap/<类名>.clas.abap
 *   部署配置: output/<类名>/docs/deployment-config.md
 *
 *   ABAP 类源码包含 CLASS ... DEFINITION + CLASS ... IMPLEMENTATION 两部分，
 *   在同一个 .clas.abap 文件中
 */
const path = require("path");
const fs = require("fs");
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { loadDeploymentConfig } = require("./modules/load-deployment-config");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");
const { withLock, isAlreadyExists, isConflict } = require("./modules/deploy-utils");

// ── 参数 ──
const clasName = process.argv[2];
if (!clasName) {
  console.error("[FATAL] Usage: node scripts/deploy_clas.js <class_name>");
  console.error("Example: node scripts/deploy_clas.js ZCL_TEST009");
  process.exit(1);
}

const srcDir = path.resolve(process.cwd(), "output", clasName, "abap");
if (!fs.existsSync(srcDir)) {
  console.error(`[FATAL] Source dir not found: ${srcDir}`);
  process.exit(1);
}

function readSrc(name) {
  const p = path.join(srcDir, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// ── 初始化 ──
const env = loadEnv();
const rfcParams = buildRfcParams(env);
const responsible = getResponsibleUser(env);
const client = createClient(rfcParams);

// Try .clas.abap first, then .abap as fallback
let mainSrc = readSrc(`${clasName}.clas.abap`) || readSrc(`${clasName}.abap`);
if (!mainSrc) {
  console.error(`[FATAL] Source not found: ${srcDir}/${clasName}.clas.abap or ${clasName}.abap`);
  process.exit(1);
}

let deployConfig;
try {
  deployConfig = loadDeploymentConfig(clasName);
} catch (e) {
  console.error(`[FATAL] Failed to load deployment config: ${e.message}`);
  process.exit(1);
}

// ── 主流程 ──
async function deploy() {
  await client.open();
  console.log("[OK] RFC connected");
  console.log(`[CFG] Package: ${deployConfig.packageName}, Transport: ${deployConfig.transportRequest || "(none)"}`);

  const query = deployConfig.transportRequest ? `?corrNr=${deployConfig.transportRequest}` : "";

  // ── 1. Create CLAS ──
  const clasXml = `<?xml version="1.0" encoding="UTF-8"?>
<class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${deployConfig.description || clasName + " Class"}"
  adtcore:name="${clasName}"
  adtcore:type="CLAS/OC"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${deployConfig.packageName}"/>
</class:abapClass>`;

  try {
    await adtRequest(client, "POST", `/sap/bc/adt/oo/classes${query}`, {
      data: clasXml,
      headers: {
        "Content-Type": "application/vnd.sap.adt.oo.classes.v2+xml",
        Accept: "application/vnd.sap.adt.oo.classes.v2+xml",
      },
    });
    console.log(`[OK] CLAS ${clasName} created in ${deployConfig.packageName}`);
  } catch (e) {
    if (isConflict(e.statusCode) || isAlreadyExists(e.body)) {
      console.log(`[WARN] CLAS ${clasName} already exists; will overwrite source`);
    } else {
      throw e;
    }
  }

  // ── 2. Lock → upload → unlock ──
  const clasUri = `/sap/bc/adt/oo/classes/${clasName.toLowerCase()}`;
  await withLock(client, clasUri, async (lockHandle) => {
    const suffix = deployConfig.transportRequest ? `&corrNr=${deployConfig.transportRequest}` : "";
    await adtRequest(client, "PUT",
      `${clasUri}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${suffix}`, {
        data: mainSrc,
        headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
      });
    console.log("[OK] Source uploaded");
  });

  // ── 3. Activate (direct call — activateObjects only supports P/I types) ──
  console.log("[ACT] Activating 1 object(s)...");
  const actXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/${clasName.toLowerCase()}" adtcore:name="${clasName}"/>
</adtcore:objectReferences>`;

  const actResp = await adtRequest(client, "POST",
    "/sap/bc/adt/activation?method=activate&preauditRequested=false", {
      data: actXml,
      headers: {
        "Content-Type": "application/vnd.sap.adt.activation+xml",
        Accept: "application/xml",
      },
    });

  // Parse activation errors
  const errors = [];
  if (actResp.body) {
    const msgRegex = /<msg\b[^>]*type="([EA])"[^>]*>([\s\S]*?)<\/msg>/g;
    let m;
    while ((m = msgRegex.exec(actResp.body)) !== null) {
      const msgBody = m[2];
      const objMatch = msgBody.match(/objDescr="([^"]*)"/) || msgBody.match(/objName="([^"]*)"/);
      const txtMatch = msgBody.match(/<txt>([^<]*)<\/txt>/);
      errors.push({
        name: objMatch ? objMatch[1] : "unknown",
        message: txtMatch ? txtMatch[1] : m[0].substring(0, 200),
      });
    }
  }

  if (errors.length > 0) {
    console.error("[ERR] Activation failed:");
    for (const err of errors) {
      console.error(`      ${err.name}: ${err.message}`);
    }
    return { status: "failed", objects: [], errors };
  }
  console.log("[OK] Activation successful");

  // ── 4. Verify ──
  const checkResp = await adtRequest(client, "GET", clasUri, {
    headers: { Accept: "application/vnd.sap.adt.oo.classes.v2+xml" },
  });
  const version = (checkResp.body.match(/adtcore:version="([^"]+)"/) || [])[1] || "unknown";

  return {
    status: "success",
    objects: [{ name: clasName, type: "CLAS/OC", version }],
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
    process.exit(1);
  })
  .finally(() => client.close().catch(() => {}));
