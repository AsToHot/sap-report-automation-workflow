#!/usr/bin/env node
/**
 * rfc_dual_check.js — 双系统连通性一键检测
 *
 * 用法:
 *   node scripts/rfc_dual_check.js
 *
 * 输出: 开发系统 + 数据系统连通状态 JSON
 */

const path = require('path');
const { loadEnv, buildRfcParams, validateRfcParams } = require('./modules/env');
const { createClient } = require('./modules/sap-connection');
const { adtRequest } = require('./modules/adt-request');

async function checkOne(label, envFile) {
  const result = { label, envFile, ok: false, error: '', client: '', sysnr: '', ashost: '' };
  const env = loadEnv(envFile);
  const params = buildRfcParams(env);
  result.client = params.client;
  result.sysnr = params.sysnr;
  result.ashost = params.ashost;

  const validation = validateRfcParams(params);
  if (!validation.valid) {
    result.error = `缺少: ${validation.missing.join(', ')}`;
    return result;
  }

  const client = createClient(params);
  try {
    await client.open();
  } catch (err) {
    result.error = `RFC 连接失败: ${err.message}`;
    return result;
  }

  try {
    const resp = await adtRequest(client, 'GET', '/sap/bc/adt/discovery',
      { headers: { Accept: 'application/atomsvc+xml' } });
    result.ok = resp.statusCode === 200;
    if (!result.ok) result.error = `HTTP ${resp.statusCode}`;
  } catch (err) {
    result.error = `ADT 请求失败: ${err.message}`;
  }

  try { await client.close(); } catch (_) {}
  return result;
}

async function main() {
  const results = await Promise.all([
    checkOne('开发系统', '.env'),
    checkOne('数据系统', '.env.data'),
  ]);

  const allOk = results.every(r => r.ok);
  const summary = {
    status: allOk ? 'ALL_OK' : 'PARTIAL_FAILURE',
    timestamp: new Date().toISOString(),
    systems: results,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
