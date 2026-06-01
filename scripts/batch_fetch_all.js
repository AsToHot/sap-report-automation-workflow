// Batch-fetch DD03L metadata for all remaining tables via MCP HTTP proxy
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUTPUT = process.argv[2] || 'output/ZTEST101/metadata/tables';
const TABLES = [
  'SKA1','SKAT','CEPC','CEPCT','CSKT','MAKT',
  'T077X','T023T','ANLA','ANKT','ZSAP_BUKRS',
  'ZFI032_DOC','ZSAP_FI054','ZSAP_FI180'
];

function mcpCall(tool, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } });
    const req = http.request({
      hostname: '127.0.0.1', port: 9876,
      path: '/mcp', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve({ raw: body, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function fetchTable(tab) {
  const sql = `SELECT FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS FROM DD03L WHERE TABNAME = '${tab}' ORDER BY POSITION`;
  console.log(`[${tab}] Querying...`);
  const result = await mcpCall('runQuery', { sqlQuery: sql, rowNumber: 2000 });
  if (result.error) {
    console.error(`[${tab}] ERROR: ${result.error.message || JSON.stringify(result.error)}`);
    return { error: result.error };
  }
  // Parse nested response
  let data;
  try {
    const inner = JSON.parse(result.content?.[0]?.text || result.raw || '{}');
    data = inner.result || inner;
  } catch(e) {
    console.error(`[${tab}] Parse error: ${e.message}`);
    return { error: e.message };
  }
  if (!data || !data.values) {
    console.error(`[${tab}] No values in response`);
    return { error: 'no values' };
  }
  const fields = data.values.filter(v => v.FIELDNAME && v.FIELDNAME !== '.INCLUDE' && !v.FIELDNAME.startsWith('.INCLU'));
  const out = {
    tabname: tab,
    fetched_count: fields.length,
    fields: fields
  };
  const file = path.join(OUTPUT, `${tab}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`[${tab}] OK: ${fields.length} fields → ${file}`);
  return out;
}

async function main() {
  if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true });

  const errors = [];
  for (const tab of TABLES) {
    try {
      const r = await fetchTable(tab);
      if (r.error) errors.push({ table: tab, error: r.error });
    } catch(e) {
      console.error(`[${tab}] Exception: ${e.message}`);
      errors.push({ table: tab, error: e.message });
    }
  }
  if (errors.length) {
    const errFile = path.join(OUTPUT, '_errors.md');
    fs.writeFileSync(errFile, `# Metadata Fetch Errors\n\n| Table | Error |\n|-------|-------|\n${errors.map(e => `| ${e.table} | ${e.error} |`).join('\n')}\n`);
    console.log(`\n${errors.length} errors written to ${errFile}`);
  }
  console.log('\nDone.');
}
main();
