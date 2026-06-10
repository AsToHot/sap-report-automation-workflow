/**
 * FM 完整参数实战：IMPORTING + EXPORTING + TABLES
 *
 * 源码格式（ABAP 原生声明，禁止 *"*" 注释块）：
 *   FUNCTION <name>
 *     IMPORTING VALUE(<p>) TYPE <t>
 *     EXPORTING VALUE(<p>) TYPE <t>
 *     TABLES <p> LIKE <ddic_struct> OPTIONAL.
 *     ... implementation ...
 *   ENDFUNCTION.
 *
 * RFC 标记通过 PUT FM resource XML 设置 fmodule:processingType="rfc"
 */

const { loadEnv, buildRfcParams, validateRfcParams } = require("./modules/env");
const { createClient } = require("./modules/sap-connection");
const { adtRequest } = require("./modules/adt-request");
const { withLock } = require("./modules/with-lock");

const FUGR = "ZFG_CLAUDE_TEST";
const FM   = "ZFM_CLAUDE_COMPLEX";  // new FM with full parameter types
const FM_URI = `/sap/bc/adt/functions/groups/${FUGR.toLowerCase()}/fmodules/${FM.toLowerCase()}`;
const FUGR_URI = `/sap/bc/adt/functions/groups/${FUGR.toLowerCase()}`;

// ── 源码：IMPORTING + EXPORTING + TABLES（内联声明） ──
const FM_SOURCE = `FUNCTION zfm_claude_complex
  IMPORTING
    VALUE(iv_filter) TYPE string
  EXPORTING
    VALUE(ev_count) TYPE int4
    VALUE(ev_message) TYPE string
  TABLES
    it_data LIKE rfc_db_opt OPTIONAL
    et_result LIKE rfc_db_fld OPTIONAL.
  DATA: lv_line  TYPE string,
        ls_in    LIKE LINE OF it_data,
        ls_out   LIKE LINE OF et_result.

  ev_count = 0.
  DESCRIBE TABLE it_data LINES ev_count.

  LOOP AT it_data INTO ls_in.
    CLEAR ls_out.
    CONCATENATE 'Echo:' ls_in-text INTO lv_line.
    ls_out-fieldname = ls_in-text.
    ls_out-offset = ev_count.
    ls_out-length = strlen( ls_in-text ).
    APPEND ls_out TO et_result.
  ENDLOOP.

  ev_message = |Processed { ev_count } items, returned { lines( et_result ) } rows.|.
ENDFUNCTION.
`;

// ── 元数据：标记为 RFC ──
const FM_META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:name="${FM}" adtcore:type="FUGR/FF"
  adtcore:description="Complex FM test: IMP+EXP+TABLES via ADT REST"
  adtcore:language="ZH"
  fmodule:processingType="rfc">
</fmodule:abapFunctionModule>`;

async function log(label, fn) {
  try {
    const r = await fn();
    console.log(`  [OK] ${label}: HTTP ${r.statusCode}`);
    return r;
  } catch (e) {
    console.log(`  [ERR] ${label}: HTTP ${e.statusCode}`);
    if (e.body) console.log(`        ${e.body.substring(0, 300)}`);
    throw e;
  }
}

async function main() {
  const env = loadEnv();
  const rfcParams = buildRfcParams(env);
  const v = validateRfcParams(rfcParams);
  if (!v.valid) { console.error("Missing:", v.missing.join(", ")); process.exit(1); }

  const client = createClient(rfcParams);
  await client.open();
  const responsible = rfcParams.user.toUpperCase();
  console.log(`[RFC] Connected as ${responsible}\n`);

  try {
    // ── 1. Create FM in existing FUGR ──
    console.log("1. Create FM");
    const fmCreateXml = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="Complex FM: IMP+EXP+TABLES" adtcore:name="${FM}" adtcore:type="FUGR/FF">
  <adtcore:containerRef adtcore:name="${FUGR}" adtcore:type="FUGR/F" adtcore:uri="${FUGR_URI}"/>
</fmodule:abapFunctionModule>`;

    await log("Create FM", () =>
      adtRequest(client, "POST",
        `/sap/bc/adt/functions/groups/${FUGR.toLowerCase()}/fmodules`,
        { data: fmCreateXml, headers: { "Content-Type": "application/*" } })
    );

    // ── 2. Lock → set RFC metadata → upload source → unlock ──
    console.log("2. Lock + metadata + source");
    await withLock(client, FM_URI, async (lockHandle) => {
      const metaUri = `${FM_URI}?lockHandle=${encodeURIComponent(lockHandle)}`;
      await log("  RFC metadata", () =>
        adtRequest(client, "PUT", metaUri,
          { data: FM_META_XML, headers: { "Content-Type": "application/*" } })
      );

      const srcUri = `${FM_URI}/source/main?lockHandle=${encodeURIComponent(lockHandle)}`;
      await log("  Source upload", () =>
        adtRequest(client, "PUT", srcUri,
          { data: FM_SOURCE, headers: { "Content-Type": "text/plain; charset=utf-8", Accept: "text/plain" } })
      );
    });

    // ── 3. Activate ──
    console.log("3. Activate");
    const actXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${FUGR_URI}" adtcore:name="${FUGR}"/>
  <adtcore:objectReference adtcore:uri="${FM_URI}" adtcore:name="${FM}"/>
</adtcore:objectReferences>`;
    await log("Activate", () =>
      adtRequest(client, "POST",
        "/sap/bc/adt/activation?method=activate&preauditRequested=true",
        { data: actXml, headers: { "Content-Type": "application/vnd.sap.adt.activation+xml", Accept: "application/xml" } })
    );

    // ── 4. Verify ──
    console.log("\n4. Verify");
    const fmResp = await adtRequest(client, "GET", FM_URI);
    const version = fmResp.body.includes('version="active"') ? "ACTIVE ✓" : "INACTIVE ✗";
    const procType = (fmResp.body.match(/processingType="([^"]+)"/) || [,"?"])[1];
    console.log(`  Version: ${version}`);
    console.log(`  Processing: ${procType}`);

    // Show source
    console.log("\n── Deployed Source ──");
    const srcResp = await adtRequest(client, "GET", `${FM_URI}/source/main`);
    console.log(srcResp.body);

    // ── 5. RFC Test Call ──
    console.log("── RFC Test Call ──");

    // Build test input table (RFC_DB_OPT structure has: text(72))
    const itData = [
      { TEXT: "Item_Alpha" },
      { TEXT: "Item_Beta" },
      { TEXT: "Item_Gamma" },
    ];

    const result = await client.call(FM, {
      IV_FILTER: "test",
      IT_DATA: itData,
      ET_RESULT: [],
    });

    console.log(`  EV_COUNT   = ${result.EV_COUNT}`);
    console.log(`  EV_MESSAGE = ${result.EV_MESSAGE}`);
    console.log(`  ET_RESULT  = ${result.ET_RESULT?.length || 0} rows`);
    if (result.ET_RESULT) {
      for (const row of result.ET_RESULT) {
        console.log(`    FIELNAME=${row.FIELDNAME} OFFSET=${row.OFFSET} LENGTH=${row.LENGTH}`);
      }
    }

    if (result.EV_COUNT === 3 && result.ET_RESULT?.length === 3) {
      console.log("\n========================================");
      console.log("SUCCESS: Full FM parameter types verified!");
      console.log("  IMP:  IV_FILTER (STRING)");
      console.log("  EXP:  EV_COUNT (INT4) + EV_MESSAGE (STRING)");
      console.log("  TAB:  IT_DATA (LIKE RFC_DB_OPT) → ET_RESULT (LIKE RFC_DB_FLD)");
      console.log("========================================");
    }

  } catch (e) {
    console.error("\n[FATAL]", e.message);
    if (e.body) console.error("Body:", e.body.substring(0, 500));
    process.exit(1);
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

main();
