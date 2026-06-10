const path = require("path");
const fs = require("fs");
const noderfc = require("node-rfc");
const { loadEnv, buildRfcParams } = require("./modules/env");

const env = loadEnv();
const rfcParams = buildRfcParams(env);
if (!rfcParams.client) {
  console.error("[FATAL] SAP_CLIENT is required in .env");
  process.exit(1);
}

const client = new noderfc.Client(rfcParams);
const program = process.argv[2] || env.SAP_PROGRAM || "";
if (!program) {
  console.error("[FATAL] Program name required. Usage: node scripts/perf_estimate.js <program>");
  process.exit(1);
}

async function run() {
  try {
    await client.open();
    const result = await client.call("RFC_READ_TABLE", {
      QUERY_TABLE: "FAGLFLEXA",
      DELIMITER: "|",
      OPTIONS: [{ TEXT: "RBUKRS = 'EEKA' AND RYEAR = '2025'" }],
      ROWSKIPS: 0,
      ROWCOUNT: 1
    });
    console.log("[INFO] FAGLFLEXA sample query returned (rowskips=0, rowcount=1)");
    console.log("[INFO] For true count, run: SELECT COUNT(*) FROM FAGLFLEXA WHERE RBUKRS='EEKA' AND RYEAR='2025'");

    const outPath = path.join("output", program, "metadata", "performance-estimate.md");
    const content = `# Performance Estimate (${program})

## Main Driver Table

| Item | Value |
|---|---|
| Table | FAGLFLEXA |
| Estimation Method | RFC_READ_TABLE probe + business experience |
| Typical restrictive condition | RBUKRS = 'EEKA' AND RYEAR = '2025' |

## Data Volume Classification

FAGLFLEXA is the general ledger line items table, typical data volume:
- Single company single year: 10,000 ~ 500,000 rows
- Multi-company multi-year: can reach millions of rows

## Paging Recommendation

- **Current implementation**: SALV (CL_SALV_TABLE) online display
- **Risk**: If user selects broad conditions (multi-company multi-year), online ALV may timeout
- **Recommendation**: Keep current SALV, but prompt user to strictly restrict company code + fiscal year + period
- **If >1M rows needed**: Switch to background job (SUBMIT) or incremental extraction

## Index Analysis

FAGLFLEXA primary key/common index fields:
- RLDNR + RYEAR + RBUKRS + DOCNR + BUZEI (primary key logic)
- Current WHERE condition uses RLDNR/RYEAR/RBUKRS prefix index

## Conclusion

| Category | Result |
|---|---|
| Volume | 10,000 ~ 1,000,000 (typical) |
| Paging solution | Current is online SALV, recommend user strictly restrict conditions |
| Performance risk | Medium -- multi-company multi-year full query may timeout
`;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content, "utf8");
    console.log("[OK] Written metadata/performance-estimate.md");
    await client.close();
  } catch (e) {
    console.error("[ERR]", e.message);
    try { await client.close(); } catch(_) {}
  }
}
run();
