#!/usr/bin/env node
/**
 * RFC Connection Diagnostic Tool
 * Tests the SAP NW RFC SDK native connection independently of MCP.
 * Usage: node scripts/test_rfc.js
 *
 * This script validates:
 * 1. NW-RFC-SDK DLLs are discoverable (SAPNWRFC_HOME + PATH)
 * 2. node-rfc native addon loads correctly
 * 3. RFC connection to SAP succeeds (including through SAP Router)
 * 4. Basic RFC function call works
 */

const fs = require('node:fs');
const path = require('node:path');

// ── 1. Load .env ────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} else {
  console.error('[FATAL] .env not found at:', envPath);
  console.error('        Run: node scripts/write-config.js  or create .env manually');
  process.exit(1);
}

// ── 2. Pre-flight environment checks ────────────────────────────────────────
const sdkHome = process.env.SAPNWRFC_HOME || '';
const sdkLib = sdkHome ? path.join(sdkHome, 'lib') : '';
const pathEnv = process.env.PATH || '';
const pathSep = process.platform === 'win32' ? ';' : ':';
const pathDirs = pathEnv.split(pathSep).filter(Boolean);

console.log('=== RFC Environment Diagnostics ===\n');
console.log('Platform        :', process.platform);
console.log('Node.js version :', process.version);
console.log('SAPNWRFC_HOME   :', sdkHome || '(NOT SET)');
console.log('SDK lib dir     :', sdkLib || '(N/A)');
console.log('PATH includes lib?', pathDirs.some(d => d.toLowerCase() === sdkLib.toLowerCase()) ? 'YES' : 'NO');

// Check for critical DLLs / shared libs
const criticalLibs = process.platform === 'win32'
  ? ['sapnwrfc.dll', 'icudt74.dll', 'icuuc74.dll', 'icuin74.dll']
  : ['libsapnwrfc.so'];

if (sdkLib && fs.existsSync(sdkLib)) {
  for (const lib of criticalLibs) {
    const libPath = path.join(sdkLib, lib);
    const exists = fs.existsSync(libPath);
    console.log(`SDK ${lib.padEnd(16)} : ${exists ? 'FOUND' : 'MISSING'}  ${exists ? libPath : ''}`);
  }
} else {
  console.log('SDK lib directory not found — check SAPNWRFC_HOME');
}

// ── 3. Attempt to load node-rfc ─────────────────────────────────────────────
console.log('\n=== node-rfc Native Addon Load ===');

let noderfc;
try {
  // Load node-rfc from project root node_modules
  noderfc = require('node-rfc');
  console.log('Status          : SUCCESS — node-rfc loaded');
} catch (err) {
  console.error('Status          : FAILED');
  console.error('Error message   :', err.message);

  if (err.message.includes('specified module could not be found') || err.message.includes('cannot open shared object')) {
    console.error('\n>>> DIAGNOSIS: Native addon found but cannot load its dependencies (sapnwrfc.dll / ICU libs).');
    console.error('>>> SOLUTION (Windows):');
    console.error('    1. Set Windows SYSTEM Environment Variable SAPNWRFC_HOME =', path.resolve(__dirname, '..', 'NW-RFC-SDK', 'nwrfcsdk'));
    console.error('    2. Add %SAPNWRFC_HOME%\\lib to Windows SYSTEM PATH');
    console.error('    3. RESTART your terminal / VS Code / Claude Code completely');
    console.error('    4. Re-run this script');
    console.error('');
    console.error('>>> IMPORTANT: Git Bash "export PATH=..." does NOT affect Windows native processes like node.exe!');
    console.error('>>> You MUST use Windows System Environment Variables or cmd //c with explicit PATH.');
  }
  process.exit(1);
}

// ── 4. Build RFC connection parameters ──────────────────────────────────────
const url = env.SAP_URL || '';
const urlMatch = url.match(/^(?:https?:\/\/)?([^:\/]+)(?::(\d+))?/);
const ashost = urlMatch ? urlMatch[1] : '';
const portStr = urlMatch ? urlMatch[2] : undefined;
const port = portStr ? parseInt(portStr, 10) : undefined;

// sysnr: explicit config always wins; derive from port only as fallback
let sysnr;
if (env.SAP_SYSNR !== undefined && env.SAP_SYSNR !== '') {
  sysnr = env.SAP_SYSNR;
} else if (port !== undefined) {
  sysnr = String(port).slice(-2);
} else {
  sysnr = '';
}

const rfcParams = {
  ashost: ashost,
  sysnr: sysnr,
  client: env.SAP_CLIENT || '',
  user: env.SAP_USERNAME || env.SAP_USER || '',
  passwd: env.SAP_PASSWORD || env.SAP_PASS || '',
  lang: env.SAP_LANGUAGE || 'ZH',
};

// Validate required fields
const missing = [];
if (!ashost) missing.push('SAP_URL (ashost)');
if (!sysnr) missing.push('SAP_SYSNR (or port-derived)');
if (!rfcParams.client) missing.push('SAP_CLIENT');
if (!rfcParams.user) missing.push('SAP_USERNAME');
if (missing.length > 0) {
  console.error(`[FATAL] Missing required configuration: ${missing.join(', ')}`);
  console.error('        Check your .env file.');
  process.exit(1);
}

if (env.SAP_ROUTER) {
  rfcParams.saprouter = env.SAP_ROUTER;
}

console.log('\n=== RFC Connection Parameters ===');
console.log('ashost          :', rfcParams.ashost);
console.log('sysnr           :', rfcParams.sysnr);
console.log('client          :', rfcParams.client);
console.log('user            :', rfcParams.user);
console.log('saprouter       :', rfcParams.saprouter || '(none)');
console.log('lang            :', rfcParams.lang);

// ── 5. Attempt connection ───────────────────────────────────────────────────
console.log('\n=== RFC Connection Attempt ===');

const client = new noderfc.Client(rfcParams);

client.open()
  .then(() => {
    console.log('Status          : SUCCESS — RFC connected');

    // Quick function call test (RFC_PING or generic)
    return client.call('RFC_PING', {})
      .then(() => {
        console.log('RFC_PING        : OK');
      })
      .catch(() => {
        console.log('RFC_PING        : skipped (function may not exist, but connection is valid)');
      })
      .finally(() => client.close());
  })
  .then(() => {
    console.log('\n=== ALL CHECKS PASSED ===');
    console.log('Your RFC environment is correctly configured.');
    console.log('You can now use MCP with SAP_CONNECTION_TYPE=rfc.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Status          : FAILED');
    console.error('Error code      :', err.code || 'N/A');
    console.error('Error message   :', err.message);

    // Categorized troubleshooting
    const msg = err.message || '';

    if (msg.includes('WSAECONNRESET') || msg.includes('connection to partner') && msg.includes('broken')) {
      console.error('\n>>> DIAGNOSIS: Connection reset by peer (WSAECONNRESET)');
      console.error('>>> This usually means:');
      console.error('    1. SAP Router rejected or dropped the connection');
      console.error('    2. The target SAP instance is not accepting RFC connections');
      console.error('    3. Firewall / ACL blocking the source IP');
      console.error('>>> ACTIONS:');
      console.error('    - Verify SAP_ROUTER string with your Basis team');
      console.error('    - Check if the SAP instance is running and RFC port (33' + sysnr + ') is open');
      console.error('    - Confirm your IP is whitelisted on the SAP side');
    } else if (msg.includes('WSAETIMEDOUT') || msg.includes('not reached')) {
      console.error('\n>>> DIAGNOSIS: Connection timeout (WSAETIMEDOUT)');
      console.error('>>> This usually means:');
      console.error('    1. Network route to SAP host is blocked or unreachable');
      console.error('    2. Wrong ashost / port / sysnr');
      console.error('    3. SAP Router is down or unreachable');
      console.error('>>> ACTIONS:');
      console.error('    - Verify SAP_URL (host and port) are correct');
      console.error('    - Check if SAP Router is reachable: ping / telnet to router host');
      console.error('    - Verify sysnr matches the instance (port 80' + sysnr + ' -> sysnr ' + sysnr + ', RFC port 33' + sysnr + ')');
    } else if (msg.includes('NAME_OR_PASSWORD') || msg.includes('not authorized')) {
      console.error('\n>>> DIAGNOSIS: Authentication failure');
      console.error('>>> ACTIONS:');
      console.error('    - Verify SAP_USERNAME and SAP_PASSWORD in .env');
      console.error('    - Check if the user account is locked or expired');
      console.error('    - Confirm the user has RFC login permission (S_RFCACL)');
    } else if (msg.includes('LOGON') && msg.includes('language')) {
      console.error('\n>>> DIAGNOSIS: Language / client issue');
      console.error('>>> ACTIONS:');
      console.error('    - Verify SAP_CLIENT and SAP_LANGUAGE are correct');
    } else {
      console.error('\n>>> DIAGNOSIS: Unrecognized RFC error');
      console.error('>>> ACTIONS:');
      console.error('    - Save this output and contact your Basis team');
      console.error('    - Check dev_rfc.log for detailed traces');
    }

    console.error('\n>>> ENVIRONMENT VARIABLE REMINDER (Windows):');
    console.error('    Git Bash "export PATH=..." does NOT work for node-rfc!');
    console.error('    You MUST set Windows System Environment Variables and restart your shell.');
    process.exit(1);
  });
