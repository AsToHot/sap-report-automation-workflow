/**
 * 分步调试部署脚本 — 逐步执行 REPORT+INCLUDE 部署，每步打印详细日志
 * Usage: node scripts/deploy_debug_step.js ZTEST006
 */
const path = require("path");
const fs = require("fs");
const { loadEnv, buildRfcParams, getResponsibleUser } = require("./modules/env");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");

const progName = process.argv[2] || "ZTEST006";
const srcDir = path.resolve(process.cwd(), "output", progName, "abap");

if (!fs.existsSync(srcDir)) {
  console.error(`[FATAL] Source dir not found: ${srcDir}`);
  process.exit(1);
}

const env = loadEnv();
const rfcParams = buildRfcParams(env);
const responsible = getResponsibleUser(env);
const pkg = "$TMP";

const client = createClient(rfcParams);

function readSrc(name) {
  const p = path.join(srcDir, `${name}.abap`);
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  return null;
}

async function step(label, fn) {
  console.log(`\n=== STEP: ${label} ===`);
  try {
    const res = await fn();
    console.log(`[OK] ${label} =>`, JSON.stringify(res).substring(0, 200));
    return res;
  } catch (e) {
    console.log(`[FAIL] ${label}`);
    console.log(`  statusCode: ${e.statusCode}`);
    console.log(`  message: ${e.message}`);
    if (e.body) console.log(`  body (first 500): ${e.body.substring(0, 500)}`);
    throw e;
  }
}

async function main() {
  await client.open();
  console.log("[OK] RFC connected");

  const mainSrc = readSrc(progName);
  const t01Src = readSrc(`${progName}T01`);
  const selSrc = readSrc(`${progName}SEL`);
  const f01Src = readSrc(`${progName}F01`);

  console.log(`\nSources found:`);
  console.log(`  ${progName}.abap    : ${mainSrc ? mainSrc.split("\n").length + " lines" : "MISSING"}`);
  console.log(`  ${progName}T01.abap : ${t01Src ? t01Src.split("\n").length + " lines" : "MISSING"}`);
  console.log(`  ${progName}SEL.abap : ${selSrc ? selSrc.split("\n").length + " lines" : "MISSING"}`);
  console.log(`  ${progName}F01.abap : ${f01Src ? f01Src.split("\n").length + " lines" : "MISSING"}`);

  // ─── 1. Create main program ───
  const progXml = `<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="Deploy debug test - ${progName}"
  adtcore:name="${progName}"
  adtcore:type="PROG/P"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${pkg}"/>
</program:abapProgram>`;

  let progExists = false;
  try {
    await step("1. Create program", () =>
      adtRequest(client, "POST", "/sap/bc/adt/programs/programs", {
        data: progXml,
        headers: {
          "Content-Type": "application/*",
          Accept: "application/vnd.sap.adt.programs.programs.v4+xml",
        },
      })
    );
  } catch (e) {
    if (e.statusCode === 409 || (e.body && e.body.includes("已存在"))) {
      progExists = true;
      console.log("[WARN] Program already exists, will overwrite");
    } else {
      throw e;
    }
  }

  // ─── 2. Lock main program ───
  const mainUri = `/sap/bc/adt/programs/programs/${progName.toLowerCase()}`;
  const lockResp = await step("2. Lock main program", () =>
    adtRequest(client, "POST", `${mainUri}?_action=LOCK&accessMode=MODIFY`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );
  const mainLock = (lockResp.body.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/) || [])[1];
  if (!mainLock) throw new Error("Failed to parse lock handle");
  console.log(`  lockHandle: ${mainLock}`);

  // ─── 3. Upload main source ───
  await step("3. Upload main source", () =>
    adtRequest(client, "PUT", `${mainUri}/source/main?lockHandle=${encodeURIComponent(mainLock)}`, {
      data: mainSrc,
      headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
    })
  );

  // ─── 4. Unlock main program ───
  await step("4. Unlock main program", () =>
    adtRequest(client, "POST", `${mainUri}?_action=UNLOCK&lockHandle=${encodeURIComponent(mainLock)}`, {
      headers: { Accept: "application/vnd.sap.as+xml" },
    })
  );

  // ─── 5. Create and upload each INCLUDE ───
  const includes = [
    [`${progName}T01`, t01Src],
    [`${progName}SEL`, selSrc],
    [`${progName}F01`, f01Src],
  ].filter(([, src]) => src);

  for (const [incName, src] of includes) {
    console.log(`\n--- Include: ${incName} ---`);

    // 5a. Create include
    const incXml = `<?xml version="1.0" encoding="UTF-8"?>
<include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="Include ${incName}"
  adtcore:name="${incName}"
  adtcore:type="PROG/I"
  adtcore:responsible="${responsible}">
  <adtcore:packageRef adtcore:name="${pkg}"/>
</include:abapInclude>`;

    let incExists = false;
    try {
      await step(`5a. Create include ${incName}`, () =>
        adtRequest(client, "POST", "/sap/bc/adt/programs/includes", {
          data: incXml,
          headers: {
            "Content-Type": "application/*",
            Accept: "application/vnd.sap.adt.programs.programs.v4+xml",
          },
        })
      );
    } catch (e) {
      if (e.statusCode === 409 || (e.body && e.body.includes("已存在"))) {
        incExists = true;
        console.log(`[WARN] Include ${incName} already exists, will overwrite`);
      } else {
        throw e;
      }
    }

    // 5b. Lock include
    const incUri = `/sap/bc/adt/programs/includes/${incName.toLowerCase()}`;
    const incLockResp = await step(`5b. Lock include ${incName}`, () =>
      adtRequest(client, "POST", `${incUri}?_action=LOCK&accessMode=MODIFY`, {
        headers: { Accept: "application/vnd.sap.as+xml" },
      })
    );
    const incLock = (incLockResp.body.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/) || [])[1];
    if (!incLock) throw new Error(`Failed to parse lock handle for ${incName}`);
    console.log(`  lockHandle: ${incLock}`);

    // 5c. Upload include source
    await step(`5c. Upload include source ${incName}`, () =>
      adtRequest(client, "PUT", `${incUri}/source/main?lockHandle=${encodeURIComponent(incLock)}`, {
        data: src,
        headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" },
      })
    );

    // 5d. Unlock include
    await step(`5d. Unlock include ${incName}`, () =>
      adtRequest(client, "POST", `${incUri}?_action=UNLOCK&lockHandle=${encodeURIComponent(incLock)}`, {
        headers: { Accept: "application/vnd.sap.as+xml" },
      })
    );
  }

  // ─── 6. Syntax check all objects ───
  console.log("\n=== SYNTAX CHECKS ===");
  const allObjects = [
    { name: progName, type: "programs" },
    ...[...includes].map(([n]) => ({ name: n, type: "includes" })),
  ];

  for (const obj of allObjects) {
    const lower = obj.name.toLowerCase();
    const srcUri = `/sap/bc/adt/programs/${obj.type}/${lower}/source/main`;

    try {
      // Fetch source
      const srcResp = await adtRequest(client, "GET", srcUri, {
        headers: { Accept: "text/plain" },
      });
      const source = srcResp.body;

      // Syntax check
      const checkUri = `${srcUri}?method=check`;
      const checkResp = await adtRequest(client, "POST", checkUri, {
        data: source,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Accept: "application/xml",
        },
      });
      console.log(`[OK] Syntax: ${obj.name}`);
    } catch (e) {
      if (e.statusCode === 405) {
        console.log(`[WARN] Syntax endpoint N/A for ${obj.name}`);
      } else {
        console.log(`[ERR] Syntax ${obj.name}: statusCode=${e.statusCode}`);
        if (e.body) console.log(`  body: ${e.body.substring(0, 500)}`);
      }
    }
  }

  // ─── 7. Activate all objects ───
  console.log("\n=== ACTIVATION ===");
  const actRefs = [
    { name: progName, type: "P" },
    ...[...includes].map(([n]) => ({ name: n, type: "I" })),
  ];

  const refXml = actRefs.map(({ name, type }) => {
    const lower = name.toLowerCase();
    const uri = type === "I"
      ? `/sap/bc/adt/programs/includes/${lower}`
      : `/sap/bc/adt/programs/programs/${lower}`;
    return `<adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}"/>`;
  }).join("\n  ");

  const actXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  ${refXml}
</adtcore:objectReferences>`;

  console.log("Activation XML:");
  console.log(actXml);

  const actResp = await step("7. Activate all", () =>
    adtRequest(client, "POST", "/sap/bc/adt/activation?method=activate&preauditRequested=false", {
      data: actXml,
      headers: {
        "Content-Type": "application/vnd.sap.adt.activation+xml",
        Accept: "application/xml",
      },
    })
  );

  console.log("\nActivation response:");
  console.log(actResp.body.substring(0, 2000));

  // Parse response for errors
  const hasError = /type\s*=\s*"[EA]"/.test(actResp.body)
    || /severity\s*=\s*"error"/i.test(actResp.body)
    || /abap\w*SyntaxError/i.test(actResp.body);

  if (hasError) {
    console.log("\n[FATAL] Activation errors detected!");
  } else {
    console.log("\n=== SUCCESS ===");
  }
}

main().catch(e => {
  console.error("\n[FATAL]", e.message);
  process.exit(1);
}).finally(() => client.close().catch(() => {}));
