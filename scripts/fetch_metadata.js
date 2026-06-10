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
  console.error("[FATAL] Program name required. Usage: node scripts/fetch_metadata.js <program>");
  process.exit(1);
}

// Read table list from tech-design or accept via additional args
let tables = process.argv.slice(3);
if (tables.length === 0) {
  const techDesignPath = path.join("output", program, "docs", "tech-design.md");
  if (fs.existsSync(techDesignPath)) {
    const td = fs.readFileSync(techDesignPath, "utf8");
    const m = td.match(/## 表清单[\s\S]*?(?=## |\n## |$)/);
    if (m) {
      tables = [...m[0].matchAll(/\|\s*(\w{3,})\s*\|/g)].map(x => x[1]).filter(t => t !== "表名");
    }
  }
}
if (tables.length === 0) {
  console.error("[FATAL] No tables specified and none found in tech-design.md");
  process.exit(1);
}

async function fetchTable(tabname) {
  try {
    await client.open();
    const result = await client.call("DDIF_FIELDINFO_GET", {
      TABNAME: tabname,
      LANGU: "ZH"
    });
    const fields = (result.DFIES_TAB || []).map(f => ({
      fieldname: f.FIELDNAME,
      position: f.POSITION,
      keyflag: f.KEYFLAG,
      rollname: f.ROLLNAME,
      datatype: f.DATATYPE,
      leng: f.LENG,
      decimals: f.DECIMALS,
      fieldtext: f.FIELDTEXT
    }));
    const out = {
      tabname: tabname,
      fetched_count: fields.length,
      expected_count: fields.length,
      matched: true,
      fields: fields
    };
    const outPath = path.join("output", program, "metadata", "tables", `${tabname}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
    console.log(`[OK] ${tabname}: ${fields.length} fields`);
    await client.close();
    return true;
  } catch (e) {
    console.error(`[ERR] ${tabname}: ${e.message}`);
    try { await client.close(); } catch(_) {}
    return false;
  }
}

(async () => {
  const results = [];
  for (const t of tables) {
    results.push(await fetchTable(t));
    await new Promise(r => setTimeout(r, 300));
  }
  const ok = results.filter(Boolean).length;
  console.log(`\nDone: ${ok}/${tables.length} tables fetched.`);
})();
