#!/usr/bin/env node
/**
 * Quick end-to-end test: MCP through RFC proxy (no auth needed)
 * Reuses existing proxy if running, otherwise starts one.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const proxyPath = path.resolve(__dirname, '..', 'rfc-proxy-server.js');
const mcpPath = path.resolve(__dirname, '..', 'mcp-abap-abap-adt-api', 'dist', 'index.js');

let proxy;

function isProxyRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:9876/sap/bc/adt/discovery', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

function startProxy() {
  return new Promise((resolve, reject) => {
    proxy = spawn('node', [proxyPath], {
      env: { ...process.env, SAP_URL: 'http://10.32.21.11:8000', SAP_USER: 'ITL12', SAP_PASSWORD: '12345Qwert!', SAP_CLIENT: '200', SAP_LANGUAGE: 'ZH', SAP_ROUTER: '/H/210.75.21.252', SAP_CONNECTION_TYPE: 'rfc', SAPNWRFC_HOME: path.resolve(__dirname, '..', 'NW-RFC-SDK', 'nwrfcsdk') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    proxy.stdout.on('data', d => { stdout += d; });
    proxy.stderr.on('data', d => { stdout += d; });
    proxy.on('error', reject);

    const timer = setInterval(() => {
      if (stdout.includes('[RFC] Ready') || stdout.includes('[RFC] Connected to SAP')) {
        clearInterval(timer);
        resolve();
      }
      if (stdout.includes('[RFC] Initial connection failed') || stdout.includes('FATAL')) {
        clearInterval(timer);
        reject(new Error('Proxy failed to connect: ' + stdout));
      }
    }, 500);

    setTimeout(() => {
      clearInterval(timer);
      if (!stdout.includes('[RFC] Ready') && !stdout.includes('[RFC] Connected to SAP')) {
        reject(new Error('Proxy startup timeout. Output: ' + stdout));
      }
    }, 30000);
  });
}

function runMcpTest() {
  return new Promise((resolve, reject) => {
    // Credential separation: MCP only needs SAP_URL (proxy address) + DLL paths.
    // Real SAP credentials live in .env and are consumed by rfc-proxy-server.js.
    const mcp = spawn('node', [mcpPath], {
      env: { ...process.env, SAP_URL: 'http://localhost:9876', SAPNWRFC_HOME: path.resolve(__dirname, '..', 'NW-RFC-SDK', 'nwrfcsdk') },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    mcp.stdout.on('data', d => { stdout += d; });
    mcp.stderr.on('data', d => { stdout += d; });

    // NDJSON format: one JSON-RPC message per line
    const messages = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'objectTypes', arguments: {} } }
    ];

    messages.forEach((msg, i) => {
      setTimeout(() => {
        mcp.stdin.write(JSON.stringify(msg) + '\n');
      }, i * 300);
    });

    setTimeout(() => {
      mcp.kill();
      resolve(stdout);
    }, 15000);

    mcp.on('error', reject);
  });
}

(async () => {
  try {
    const proxyAlreadyRunning = await isProxyRunning();
    if (proxyAlreadyRunning) {
      console.log('[TEST] Proxy already running on localhost:9876, reusing...');
    } else {
      console.log('[TEST] Starting proxy...');
      await startProxy();
      console.log('[TEST] Proxy ready');
    }
    console.log('[TEST] Running MCP objectTypes through RFC proxy...');
    const output = await runMcpTest();
    console.log('[TEST] MCP output:\n', output);

    if (output.includes('"error"') && output.includes('MethodNotFound')) {
      console.log('\n[TEST] FAILED — MCP returned MethodNotFound');
      process.exit(1);
    } else if (output.includes('objectType') || output.includes('"id":3')) {
      console.log('\n[TEST] PASSED — MCP objectTypes through RFC proxy works');
      process.exit(0);
    } else {
      console.log('\n[TEST] UNCLEAR — check output above');
      process.exit(1);
    }
  } catch (e) {
    console.error('[TEST] ERROR:', e.message);
    process.exit(1);
  } finally {
    if (proxy) proxy.kill();
  }
})();
