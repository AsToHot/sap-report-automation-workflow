const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function check(p, label) {
  const ok = fs.existsSync(path.join(root, p));
  console.log(`${ok ? '[OK]' : '[MISSING]'} ${label}: ${p}`);
  return ok;
}

function readEnv(key) {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return null;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].trim();
  }
  return null;
}

function isPlaceholder(v) {
  if (!v) return true;
  const lower = v.toLowerCase();
  return lower.includes('your-') || lower.includes('placeholder') || lower.includes('xxx');
}

console.log('=== SAP Report Automation Workflow Setup Check ===\n');

let ok = true;

// Core files
ok = check('.env', 'SAP connection config') && ok;
ok = check('.mcp.json', 'MCP server config') && ok;
ok = check('mcp-abap-adt/dist/server/launcher.js', 'MCP ADT server built') && ok;
ok = check('NW-RFC-SDK/nwrfcsdk/lib/sapnwrfc.dll', 'SAP NW RFC SDK') && ok;
ok = check('mcp-abap-adt/node_modules/node-rfc/package.json', 'node-rfc installed') && ok;

// Read env values
const sapUrl = readEnv('SAP_URL');
const sapRouter = readEnv('SAP_ROUTER');
const sapConnType = readEnv('SAP_CONNECTION_TYPE');
const sapSid = readEnv('SAP_SID');
const sapSysnr = readEnv('SAP_SYSNR');

console.log('\n=== SAP Connection Profile ===');
console.log(`SAP_URL:             ${sapUrl || '(not set)'}`);
console.log(`SAP_CLIENT:          ${readEnv('SAP_CLIENT') || '(not set)'}`);
console.log(`SAP_CONNECTION_TYPE: ${sapConnType || '(not set)'}`);
console.log(`SAP_ROUTER:          ${sapRouter || '(not set)'}`);
console.log(`SAP_SID:             ${sapSid || '(not set)'}`);
console.log(`SAP_SYSNR:           ${sapSysnr || '(not set)'}`);

// Validation
const missing = [];
if (!sapUrl || isPlaceholder(sapUrl)) missing.push('SAP_URL');
if (!readEnv('SAP_USERNAME') || isPlaceholder(readEnv('SAP_USERNAME'))) missing.push('SAP_USERNAME');
if (!readEnv('SAP_PASSWORD') || isPlaceholder(readEnv('SAP_PASSWORD'))) missing.push('SAP_PASSWORD');
if (!readEnv('SAP_CLIENT')) missing.push('SAP_CLIENT');

if (missing.length > 0) {
  console.log(`\n[WARNING] Missing or placeholder values in .env: ${missing.join(', ')}`);
  console.log('[HINT] Run: node scripts/write-config.js');
  ok = false;
}

if (sapUrl && sapUrl.includes('your-sap-host')) {
  console.log('\n[WARNING] SAP_URL contains placeholder. Run: node scripts/write-config.js');
  ok = false;
}

console.log('\n' + (ok ? 'Setup check passed.' : 'Setup check failed. Please fix missing items above.'));
process.exit(ok ? 0 : 1);
