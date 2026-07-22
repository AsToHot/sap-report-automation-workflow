#!/usr/bin/env node
/**
 * deploy_fugr.js — 部署 FUGR（函数组）+ FM（Function Modules）
 *
 * ## 入参
 *   node scripts/deploy_fugr.js <函数组名>
 *
 * ## 出参 (JSON)
 *   { status: "success" | "failed", objects: [{name, type, version}], errors: [...] }
 *
 * ## 真实示例
 *
 * ### 示例 1：新 FUGR + 1 个 FM
 *   $ node scripts/deploy_fugr.js ZTEST008FG
 *   [OK] RFC connected
 *   [CFG] Package: $TMP
 *   [OK] FUGR ZTEST008FG created in $TMP
 *   [OK] FM ZTEST008_FM_HELLO created
 *   [OK] FM source uploaded
 *   [ACT] Activating 2 object(s)...
 *   [OK] Activation successful
 *   === DEPLOY SUCCESS ===
 *   {"status":"success","objects":[
 *     {"name":"ZTEST008FG","type":"FUGR/F","version":"active"},
 *     {"name":"ZTEST008_FM_HELLO","type":"FUGR/FF","version":"active"}
 *   ]}
 *
 * ### 示例 2：已存在 FUGR + 覆盖 FM
 *   $ node scripts/deploy_fugr.js ZTEST008FG
 *   [WARN] FUGR ZTEST008FG already exists
 *   [WARN] FM ZTEST008_FM_HELLO already exists; will overwrite source
 *   [OK] FM source uploaded
 *   [ACT] Activating 2 object(s)...
 *   [OK] Activation successful
 *
 * ## 目录约定
 *   函数组源码: output/<函数组名>/abap/<函数组名>.fugr.abap（函数组 include 源码，可选）
 *   每个 FM 源码: output/<函数组名>/abap/<FM名>.fm.abap（必须）
 *   部署配置: output/<函数组名>/docs/deployment-config.md
 *
 * ## CRITICAL 行为说明
 *   - 创建 FM 时必须使用 fmodules 命名空间（不是 groups）
 *   - 激活时必须同时包含 FUGR 和所有 FM，只激活 FUGR 不会自动激活 FM
 *   - FM 参数在 ABAP 源码中用原生语法声明（FUNCTION ... IMPORTING/EXPORTING ... ENDFUNCTION），
 *     SAP 自动解析接口参数，不需要单独的"参数创建"API
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
const fugrName = process.argv[2];
if (!fugrName) {
  console.error("[FATAL] Usage: node scripts/deploy_fugr.js <fugr_name>");
  console.error("Example: node scripts/deploy_fugr.js ZTEST008FG");
  process.exit(1);
}

const srcDir = path.resolve(process.cwd(), "output", fugrName, "abap");
if (!fs.existsSync(srcDir)) {
  console.error(`[FATAL] Source dir not found: ${srcDir}`);
  process.exit(1);
}

/**
 * 扫描 abap/ 目录，发现所有 .fm.abap 文件
 * 返回 Map<fmName, source>
 */
function discoverFMs(dir) {
  const fms = new Map();
  const re = /^(.+)\.fm\.abap$/i;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(re);
    if (m) fms.set(m[1].toUpperCase(), fs.readFileSync(path.join(dir, f), "utf8"));
  }
  return fms;
}

function readOptional(name) {
  const p = path.join(srcDir, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// ── 初始化 ──
const env = loadEnv();
const rfcParams = buildRfcParams(env);
const responsible = getResponsibleUser(env);
const client = createClient(rfcParams);

let deployConfig;
try {
  deployConfig = loadDeploymentConfig(fugrName);
} catch (e) {
  console.error(`[FATAL] Failed to load deployment config: ${e.message}`);
  process.exit(1);
}

const fmMap = discoverFMs(srcDir);
console.log(`[INFO] Discovered ${fmMap.size} FM(s): ${[...fmMap.keys()].join(", ") || "none"}`);

if (fmMap.size === 0) {
  console.error("[FATAL] No .fm.abap files found. Expected: output/<fugr>/abap/<FM_NAME>.fm.abap");
  process.exit(1);
}

// ── 主流程 ──
async function deploy() {
  await client.open();
  console.log("[OK] RFC connected");
  console.log(`[CFG] Package: ${deployConfig.packageName}, Transport: ${deployConfig.transportRequest || "(none)"}`);

  const query = deployConfig.transportRequest ? `?corrNr=${deployConfig.transportRequest}` : "";

  // ── 1. Create FUGR ──
  const fugrXml = `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${deployConfig.description || fugrName + " Function Group"}"
  adtcore:name="${fugrName}"
  adtcore:type="FUGR/F"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${deployConfig.packageName}"/>
</group:abapFunctionGroup>`;

  try {
    await adtRequest(client, "POST", `/sap/bc/adt/functions/groups${query}`, {
      data: fugrXml,
      headers: { "Content-Type": "application/*" },
    });
    console.log(`[OK] FUGR ${fugrName} created in ${deployConfig.packageName}`);
  } catch (e) {
    if (isConflict(e.statusCode) || isAlreadyExists(e.body)) {
      console.log(`[WARN] FUGR ${fugrName} already exists`);
    } else {
      throw e;
    }
  }

  const fugrUri = `/sap/bc/adt/functions/groups/${fugrName.toLowerCase()}`;

  // ── 2. For each FM: create → lock → upload → unlock ──
  for (const [fmName, fmSrc] of fmMap) {
    // 2a. Create FM (CRITICAL: fmodules namespace, NOT groups)
    const fmXml = `<?xml version="1.0" encoding="UTF-8"?>
<fmodules:abapFunctionModule xmlns:fmodules="http://www.sap.com/adt/functions/fmodules"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="FM ${fmName}"
  adtcore:name="${fmName}"
  adtcore:type="FUGR/FF"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${deployConfig.packageName}"/>
</fmodules:abapFunctionModule>`;

    try {
      await adtRequest(client, "POST", `${fugrUri}/fmodules${query}`, {
        data: fmXml,
        headers: {
          "Content-Type": "application/vnd.sap.adt.functions.fmodules.v2+xml",
          Accept: "application/vnd.sap.adt.functions.fmodules.v2+xml",
        },
      });
      console.log(`[OK] FM ${fmName} created`);
    } catch (e) {
      if (isConflict(e.statusCode) || isAlreadyExists(e.body)) {
        console.log(`[WARN] FM ${fmName} already exists; will overwrite source`);
      } else {
        throw e;
      }
    }

    // 2b. Lock → upload → unlock
    const fmUri = `${fugrUri}/fmodules/${fmName.toLowerCase()}`;
    await withLock(client, fmUri, async (lockHandle) => {
      const suffix = deployConfig.transportRequest ? `&corrNr=${deployConfig.transportRequest}` : "";
      await adtRequest(client, "PUT",
        `${fmUri}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${suffix}`, {
          data: fmSrc,
          headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
        });
    });
    console.log(`[OK] FM ${fmName} source uploaded`);
  }

  // ── 3. Activate FUGR + ALL FMs in ONE request ──
  // CRITICAL: FUGR alone does NOT activate its FMs. ALL must be in the list.
  const actObjs = [
    { name: fugrName, type: "FUGR" },
    ...[...fmMap.keys()].map(n => ({ name: n, type: "FM", parentUri: fugrUri })),
  ];

  console.log(`[ACT] Activating ${actObjs.length} object(s) (FUGR + ${fmMap.size} FM(s))...`);
  const actResult = await activateFugrObjects(client, fugrName, fugrUri, [...fmMap.keys()]);
  if (actResult.hasErrors) {
    console.error("[ERR] Activation failed:");
    for (const err of actResult.errors) {
      console.error(`      ${err.name}: ${err.message}`);
    }
    return { status: "failed", objects: [], errors: actResult.errors };
  }
  console.log("[OK] Activation successful");

  // ── 4. Verify ──
  const objects = [];
  const fugrCheck = await adtRequest(client, "GET", fugrUri, {
    headers: { Accept: "application/vnd.sap.adt.functions.groups.v2+xml" },
  });
  objects.push({
    name: fugrName,
    type: "FUGR/F",
    version: (fugrCheck.body.match(/adtcore:version="([^"]+)"/) || [])[1] || "unknown",
  });

  for (const fmName of fmMap.keys()) {
    const fmUri = `${fugrUri}/fmodules/${fmName.toLowerCase()}`;
    const fmCheck = await adtRequest(client, "GET", fmUri, {
      headers: { Accept: "application/vnd.sap.adt.functions.fmodules.v2+xml" },
    });
    objects.push({
      name: fmName,
      type: "FUGR/FF",
      version: (fmCheck.body.match(/adtcore:version="([^"]+)"/) || [])[1] || "unknown",
    });
  }

  return { status: "success", objects, errors: [] };
}

/**
 * FUGR 专用激活 —— build activation XML with correct URIs
 */
async function activateFugrObjects(client, fugrName, fugrUri, fmNames) {
  const fugrLower = fugrName.toLowerCase();
  const uri = `/sap/bc/adt/functions/groups/${fugrLower}`;

  let refs = `<adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${fugrName}"/>`;

  for (const fmName of fmNames) {
    const fmLower = fmName.toLowerCase();
    refs += `\n  <adtcore:objectReference adtcore:uri="${uri}/fmodules/${fmLower}" adtcore:name="${fmName}"/>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  ${refs}
</adtcore:objectReferences>`;

  const resp = await adtRequest(client, "POST", "/sap/bc/adt/activation?method=activate&preauditRequested=false", {
    data: xml,
    headers: {
      "Content-Type": "application/vnd.sap.adt.activation+xml",
      Accept: "application/xml",
    },
  });
  return parseActivationResult(resp.body);
}

function parseActivationResult(xml) {
  if (!xml || xml.trim().length === 0) return { hasErrors: false, errors: [] };

  const errors = [];
  const msgRegex = /<msg\b[^>]*type="([EA])"[^>]*>([\s\S]*?)<\/msg>/g;
  let m;
  while ((m = msgRegex.exec(xml)) !== null) {
    const msgBody = m[2];
    const objMatch = msgBody.match(/objDescr="([^"]*)"/) || msgBody.match(/objName="([^"]*)"/);
    const txtMatch = msgBody.match(/<txt>([^<]*)<\/txt>/);
    errors.push({
      name: objMatch ? objMatch[1] : "unknown",
      message: txtMatch ? txtMatch[1] : m[0].substring(0, 200),
    });
  }
  return { hasErrors: errors.length > 0, errors };
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
