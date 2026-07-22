#!/usr/bin/env node
/**
 * deploy_report_include.js — 部署 REPORT + INCLUDE（T01/SEL/F01/O01 等全部 INCLUDE）
 *
 * ## 入参
 *   node scripts/deploy_report_include.js <程序名>
 *
 * ## 出参 (JSON)
 *   { status: "success" | "failed", objects: [{name, type, version}], errors: [...] }
 *
 * ## 真实示例
 *
 * ### 示例 1：新程序 + 3 个 INCLUDE 首次部署
 *   $ node scripts/deploy_report_include.js ZTEST006
 *   [OK] RFC connected
 *   [CFG] Package: $TMP, Transport: (none)
 *   [OK] Program ZTEST006 created in $TMP
 *   [OK] Main source uploaded
 *   [OK] Include ZTEST006T01 created + source uploaded
 *   [OK] Include ZTEST006SEL created + source uploaded
 *   [OK] Include ZTEST006F01 created + source uploaded
 *   [ACT] Activating 4 object(s)...
 *   [OK] Activation successful
 *   === DEPLOY SUCCESS ===
 *   {"status":"success","objects":[
 *     {"name":"ZTEST006","type":"PROG/P","version":"active"},
 *     {"name":"ZTEST006T01","type":"PROG/I","version":"active"},
 *     {"name":"ZTEST006SEL","type":"PROG/I","version":"active"},
 *     {"name":"ZTEST006F01","type":"PROG/I","version":"active"}
 *   ]}
 *
 * ### 示例 2：增量更新（只改 F01 源码）
 *   $ node scripts/deploy_report_include.js ZTEST006
 *   [WARN] Program ZTEST006 already exists; will overwrite source
 *   [OK] Main source uploaded
 *   [WARN] Include ZTEST006T01 already exists; will overwrite source
 *   [OK] Include ZTEST006T01 source uploaded
 *   [WARN] Include ZTEST006F01 already exists; will overwrite source
 *   [OK] Include ZTEST006F01 source uploaded
 *   [ACT] Activating 4 object(s)...
 *   [OK] Activation successful
 *   === DEPLOY SUCCESS ===
 *
 * ### 示例 3：INCLUDE 中有语法错误的程序（ZTEST007）
 *   $ node scripts/deploy_report_include.js ZTEST007
 *   [OK] Source uploaded
 *   [ACT] Activating 4 object(s)...
 *   [ERR] Activation failed:
 *         unknown: 未指定语句 "WRITEE"。正确的相似语句为 "WRITE".
 *   {"status":"failed","errors":[{"name":"unknown","message":"..."}]}
 *   exit code 1
 *
 * ## 目录约定与 INCLUDE 自动发现
 *   源码文件: output/<程序名>/abap/
 *   主程序: <程序名>.abap（必须）
 *   部署配置: output/<程序名>/docs/deployment-config.md
 *
 *   INCLUDE 文件按命名模式自动发现：
 *   主程序源码中扫描 INCLUDE <名> 指令 → 在 abap/ 目录查找对应的 .abap 文件
 *   支持任意 INCLUDE 名（不限于 T01/SEL/F01/O01）
 *
 * ## 关键行为
 *   - 先创建主程序，再逐个创建/上传 INCLUDE，最后一起激活
 *   - 激活时必须把主程序 + 所有 INCLUDE 放入同一个 activation 请求
 *   - 每个 INCLUDE 独立 Lock → Upload → Unlock
 *   - 已存在对象自动跳过创建步骤，仅覆盖源码
 *
 * ## 故障排查
 *   - 激活返回空 body（HTTP 200）→ 正常，此系统激活成功不返回 XML
 *   - Syntax check 405 → 正常，此系统不支持独立语法检查
 *   - 创建返回 405 而非 409 → 正常，此系统的"已存在"响应码
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
  console.error("[FATAL] Usage: node scripts/deploy_report_include.js <program>");
  console.error("Example: node scripts/deploy_report_include.js ZTEST006");
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

/**
 * 从主程序源码中提取所有 INCLUDE 名称
 * 匹配形式: INCLUDE ztest006t01.
 */
function discoverIncludes(mainSource) {
  const includes = [];
  const re = /^\s*INCLUDE\s+(\w+)\s*\./gim;
  let m;
  while ((m = re.exec(mainSource)) !== null) {
    includes.push(m[1].toUpperCase());
  }
  return includes;
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

// 从主程序源码自动发现 INCLUDE 名
const includeNames = discoverIncludes(mainSrc);
console.log(`[INFO] Discovered ${includeNames.length} INCLUDE(s) from source: ${includeNames.join(", ") || "none"}`);

// 验证每个 INCLUDE 源文件都存在
const includeMap = new Map(); // incName → source
for (const incName of includeNames) {
  const src = readSrc(incName);
  if (!src) {
    console.error(`[FATAL] INCLUDE ${incName} referenced in main source but ${incName}.abap not found in ${srcDir}`);
    process.exit(1);
  }
  includeMap.set(incName, src);
}

// ── 主流程 ──
async function deploy() {
  await client.open();
  console.log("[OK] RFC connected");
  console.log(`[CFG] Package: ${deployConfig.packageName}, Transport: ${deployConfig.transportRequest || "(none)"}`);

  const query = deployConfig.transportRequest ? `?corrNr=${deployConfig.transportRequest}` : "";

  // ── 1. Create main program ──
  const progXml = `<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${deployConfig.description || progName + " Report"}"
  adtcore:name="${progName}"
  adtcore:type="PROG/P"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${deployConfig.packageName}"/>
</program:abapProgram>`;

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

  // ── 2. Upload main source (lock → upload → unlock) ──
  const mainUri = `/sap/bc/adt/programs/programs/${progName.toLowerCase()}`;
  await withLock(client, mainUri, async (lockHandle) => {
    const suffix = deployConfig.transportRequest ? `&corrNr=${deployConfig.transportRequest}` : "";
    await adtRequest(client, "PUT",
      `${mainUri}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${suffix}`, {
        data: mainSrc,
        headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
      });
    console.log("[OK] Main source uploaded");
  });

  // ── 3. Create and upload each INCLUDE ──
  for (const [incName, incSrc] of includeMap) {
    // 3a. Create INCLUDE
    const incXml = `<?xml version="1.0" encoding="UTF-8"?>
<include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="Include ${incName}"
  adtcore:name="${incName}"
  adtcore:type="PROG/I"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${deployConfig.packageName}"/>
</include:abapInclude>`;

    try {
      await adtRequest(client, "POST", `/sap/bc/adt/programs/includes${query}`, {
        data: incXml,
        headers: {
          "Content-Type": "application/*",
          Accept: "application/vnd.sap.adt.programs.programs.v4+xml",
        },
      });
    } catch (e) {
      if (isConflict(e.statusCode) || isAlreadyExists(e.body)) {
        console.log(`[WARN] Include ${incName} already exists; will overwrite source`);
      } else {
        throw e;
      }
    }

    // 3b. Lock → upload → unlock
    const incUri = `/sap/bc/adt/programs/includes/${incName.toLowerCase()}`;
    await withLock(client, incUri, async (lockHandle) => {
      const suffix = deployConfig.transportRequest ? `&corrNr=${deployConfig.transportRequest}` : "";
      await adtRequest(client, "PUT",
        `${incUri}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${suffix}`, {
          data: incSrc,
          headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
        });
    });
    console.log(`[OK] Include ${incName} uploaded`);
  }

  // ── 4. Activate all (main + all includes in ONE request) ──
  // CRITICAL: Every object must be in the activation list, or it stays inactive
  const actObjs = [
    { name: progName, type: "P" },
    ...[...includeMap.keys()].map(n => ({ name: n, type: "I" })),
  ];

  console.log(`[ACT] Activating ${actObjs.length} object(s)...`);
  const actResult = await activateObjects(client, actObjs);
  if (actResult.hasErrors) {
    console.error("[ERR] Activation failed:");
    for (const err of actResult.errors) {
      console.error(`      ${err.name}: ${err.message}`);
    }
    return { status: "failed", objects: [], errors: actResult.errors };
  }
  console.log("[OK] Activation successful");

  // ── 5. Verify all object versions ──
  const objects = [];
  // Main program
  const mainCheck = await adtRequest(client, "GET", mainUri, {
    headers: { Accept: "application/vnd.sap.adt.programs.programs.v4+xml" },
  });
  objects.push({
    name: progName,
    type: "PROG/P",
    version: (mainCheck.body.match(/adtcore:version="([^"]+)"/) || [])[1] || "unknown",
  });

  // Each include
  for (const incName of includeMap.keys()) {
    const incUri = `/sap/bc/adt/programs/includes/${incName.toLowerCase()}`;
    const incCheck = await adtRequest(client, "GET", incUri, {
      headers: { Accept: "application/vnd.sap.adt.programs.programs.v4+xml" },
    });
    objects.push({
      name: incName,
      type: "PROG/I",
      version: (incCheck.body.match(/adtcore:version="([^"]+)"/) || [])[1] || "unknown",
    });
  }

  return { status: "success", objects, errors: [] };
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
