const http = require('http');

const TABLES = [
  'LFA1','KNA1','SKA1','SKAT','CEPC','CEPCT','CSKT','MAKT',
  'T077X','T023T','ANLA','ANKT','ZSAP_BUKRS','ZFI032_DOC','ZSAP_FI054'
];

const OUTPUT_DIR = process.argv[2] || 'output/ZTEST101/metadata/tables';

function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "tools/call",
      params: {
        name: "runQuery",
        arguments: { sqlQuery: sql, rowNumber: 2000 }
      }
    });
    const req = http.request({
      hostname: '127.0.0.1', port: 9876,
      path: '/sap/bc/adt/discovery',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const tab of TABLES) {
    const sql = `SELECT FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS FROM DD03L WHERE TABNAME = '${tab}' AND AS4LOCAL = 'A' ORDER BY POSITION`;
    console.log(`Fetching ${tab}...`);
    try {
      const resp = await runQuery(sql);
      // The proxy returns the discovery page for this path, not JSON-RPC
      // Let's use a different approach - direct http to the proxy
      console.log(`  ${tab}: HTTP ${resp.status}, body=${resp.body.substring(0,100)}`);
    } catch(e) {
      console.error(`  ${tab}: ERROR ${e.message}`);
    }
  }
}
main();
