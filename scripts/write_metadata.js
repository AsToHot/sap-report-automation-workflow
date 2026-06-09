// Read JSON from stdin, filter .INCLUDE/.INCLU--AP, write to <outdir>/metadata/tables/<table>.json
// Usage: echo '{"tabname":"BKPF",...}' | node scripts/write_metadata.js <outdir>
const fs = require('fs');
const path = require('path');

const outdir = process.argv[2] || process.env.OUTDIR;
if (!outdir) {
  console.error('[FATAL] Output directory required. Usage: node scripts/write_metadata.js <outdir>');
  console.error('        or set OUTDIR env var');
  process.exit(1);
}
const tablesDir = path.join(outdir, 'metadata', 'tables');
fs.mkdirSync(tablesDir, { recursive: true });

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const vals = data.result?.values || data.values || [];
  const filtered = vals.filter(v =>
    v.FIELDNAME !== '.INCLUDE' && v.FIELDNAME !== '.INCLU--AP' && !(v.FIELDNAME||'').startsWith('.INCLU')
  );
  const tabname = data.tabname || data.result?.tabname || 'UNKNOWN';
  const expected = data.expected_count || vals.length;
  const json = { tabname, expected_count: expected, fetched_count: vals.length, matched: filtered.length, fields: filtered };
  fs.writeFileSync(path.join(tablesDir, `${tabname}.json`), JSON.stringify(json, null, 2));
  console.log(`${tabname}: ${filtered.length} fields`);
});
