#!/usr/bin/env node
/**
 * RFC ADT Proxy Server
 * Receives HTTP ADT REST requests from abap-adt-api (or any ADT client)
 * and forwards them to SAP via SADT_REST_RFC_ENDPOINT over node-rfc.
 *
 * Architecture:
 *   abap-adt-api (HTTP) → localhost:PROXY_PORT → this proxy → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// ── Ensure NW-RFC-SDK is discoverable ───────────────────────────────────────
const sdkHome = path.resolve(__dirname, 'NW-RFC-SDK', 'nwrfcsdk');
process.env.SAPNWRFC_HOME = sdkHome;
const sdkLib = path.join(sdkHome, 'lib');
if (!(process.env.PATH || '').includes(sdkLib)) {
  process.env.PATH = sdkLib + path.delimiter + (process.env.PATH || '');
}

const noderfc = require('node-rfc');

// ── Load .env ───────────────────────────────────────────────────────────────
const envFileArg = process.argv.find(a => a.startsWith('--env='));
const envFileName = envFileArg ? envFileArg.split('=')[1] : '.env';
const envPath = path.resolve(__dirname, envFileName);
const env = {};
if (fs.existsSync(envPath)) {
  console.log(`[CFG] Loading env from: ${envFileName}`);
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} else {
  console.error('[FATAL] .env not found at', envPath);
  process.exit(1);
}

// ── Build RFC connection params ─────────────────────────────────────────────
const url = env.SAP_URL || '';
const urlMatch = url.match(/^(?:https?:\/\/)?([^:\/]+)(?::(\d+))?/);
const ashost = urlMatch ? urlMatch[1] : '';
const port = urlMatch ? parseInt(urlMatch[2] || '8000', 10) : 8000;
const sysnr = env.SAP_SYSNR || String(port).slice(-2);

const rfcParams = {
  ashost,
  sysnr,
  client: env.SAP_CLIENT || '200',
  user: env.SAP_USERNAME || env.SAP_USER || '',
  passwd: env.SAP_PASSWORD || env.SAP_PASS || '',
  lang: env.SAP_LANGUAGE || 'ZH',
};
if (env.SAP_ROUTER) rfcParams.saprouter = env.SAP_ROUTER;

const PROXY_PORT = parseInt(env.RFC_PROXY_PORT || '9876', 10);

// ── RFC Client pool (single client, stateful) ───────────────────────────────
let rfcClient = null;
let isConnected = false;

async function ensureConnection() {
  if (isConnected && rfcClient) return rfcClient;
  rfcClient = new noderfc.Client(rfcParams);
  await rfcClient.open();
  isConnected = true;
  console.log('[RFC] Connected to SAP');
  return rfcClient;
}

// ── Forward HTTP request to SAP via SADT_REST_RFC_ENDPOINT ──────────────────
async function forwardViaRfc(reqMethod, reqUri, reqHeaders, reqBody) {
  const client = await ensureConnection();

  const headerFields = [];
  for (const [name, value] of Object.entries(reqHeaders)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) headerFields.push({ NAME: name, VALUE: String(v) });
    } else {
      headerFields.push({ NAME: name, VALUE: String(value) });
    }
  }

  const bodyBuffer = reqBody ? Buffer.from(reqBody, 'utf-8') : Buffer.alloc(0);

  const result = await client.call('SADT_REST_RFC_ENDPOINT', {
    REQUEST: {
      REQUEST_LINE: {
        METHOD: reqMethod.toUpperCase(),
        URI: reqUri,
        VERSION: 'HTTP/1.1',
      },
      HEADER_FIELDS: headerFields,
      MESSAGE_BODY: bodyBuffer,
    },
  });

  const resp = result.RESPONSE || result;
  const statusCode = parseInt(
    resp.STATUS_LINE?.STATUS_CODE || resp.STATUS_LINE?.CODE || '0', 10
  );
  const statusText = resp.STATUS_LINE?.REASON_PHRASE || resp.STATUS_LINE?.REASON || '';
  const respBody = resp.MESSAGE_BODY
    ? (Buffer.isBuffer(resp.MESSAGE_BODY)
        ? resp.MESSAGE_BODY.toString('utf-8')
        : String(resp.MESSAGE_BODY))
    : '';

  const respHeaders = {};
  for (const field of resp.HEADER_FIELDS || []) {
    if (field.NAME && field.VALUE !== undefined) {
      const key = field.NAME.toLowerCase();
      if (respHeaders[key]) {
        if (Array.isArray(respHeaders[key])) respHeaders[key].push(field.VALUE);
        else respHeaders[key] = [respHeaders[key], field.VALUE];
      } else {
        respHeaders[key] = field.VALUE;
      }
    }
  }

  return { statusCode, statusText, headers: respHeaders, body: respBody };
}

// ── HTTP Proxy Server ───────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const reqUri = req.url || '/';

  // Collect request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const reqBody = Buffer.concat(chunks).toString('utf-8');

  // Clone headers (node lowercases them)
  const reqHeaders = { ...req.headers };

  console.log(`[PROXY] ${req.method} ${reqUri} | body=${reqBody.length}B`);

  try {
    const { statusCode, statusText, headers, body } = await forwardViaRfc(
      req.method,
      reqUri,
      reqHeaders,
      reqBody
    );

    // Write HTTP response
    res.statusCode = statusCode || 200;
    if (statusText && statusCode) res.statusMessage = statusText;

    for (const [key, value] of Object.entries(headers)) {
      if (key === 'content-encoding' || key === 'transfer-encoding') continue;
      if (Array.isArray(value)) {
        for (const v of value) res.setHeader(key, v);
      } else {
        res.setHeader(key, String(value));
      }
    }

    res.end(body);
    console.log(`[PROXY] ← ${statusCode} ${statusText} | body=${body.length}B | ${Date.now() - start}ms`);
  } catch (err) {
    console.error(`[PROXY] ERROR ${req.method} ${reqUri}:`, err.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'RFC proxy error',
      message: err.message,
      code: err.code || undefined,
    }));
  }
});

server.on('error', (err) => {
  console.error('[PROXY] Server error:', err.message);
  process.exit(1);
});

server.listen(PROXY_PORT, '127.0.0.1', async () => {
  console.log(`[PROXY] RFC ADT Proxy listening on http://127.0.0.1:${PROXY_PORT}`);
  console.log(`[PROXY] Forwarding to SAP ${ashost}:${port} via SADT_REST_RFC_ENDPOINT`);
  console.log(`[RFC] Connecting...`);
  try {
    await ensureConnection();
    console.log('[RFC] Ready');
  } catch (err) {
    console.error('[RFC] Initial connection failed:', err.message);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[PROXY] Shutting down...');
  if (rfcClient && isConnected) {
    try { await rfcClient.close(); } catch (_) {}
  }
  server.close(() => process.exit(0));
});
