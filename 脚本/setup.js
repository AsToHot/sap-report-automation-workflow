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

console.log('=== SAP Report Automation Workflow Setup Check ===\n');

let ok = true;
ok = check('.env', 'SAP connection config') && ok;
ok = check('.mcp.json', 'MCP server config') && ok;
ok = check('mcp-abap-adt/dist/server/launcher.js', 'MCP ADT server built') && ok;
ok = check('NW-RFC-SDK/nwrfcsdk/lib/sapnwrfc.dll', 'SAP NW RFC SDK') && ok;
ok = check('mcp-abap-adt/node_modules/node-rfc/package.json', 'node-rfc installed') && ok;

const sapUrl = readEnv('SAP_URL');
const sapRouter = readEnv('SAP_ROUTER');
const sapConnType = readEnv('SAP_CONNECTION_TYPE');

console.log('\n=== SAP Connection Profile ===');
console.log(`SAP_URL:            ${sapUrl || '(not set)'}`);
console.log(`SAP_CLIENT:         ${readEnv('SAP_CLIENT') || '(not set)'}`);
console.log(`SAP_CONNECTION_TYPE: ${sapConnType || '(not set)'}`);
console.log(`SAP_ROUTER:         ${sapRouter || '(not set)'}`);

if (sapUrl && sapUrl.includes('your-sap-host')) {
  console.log('\n[WARNING] SAP_URL contains placeholder. Edit .env with real values.');
  ok = false;
}

console.log('\n' + (ok ? 'Setup check passed.' : 'Setup check failed. Please fix missing items above.'));
process.exit(ok ? 0 : 1);
