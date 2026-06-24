#!/usr/bin/env node
/**
 * RFC ADT Client — 统一 SAP 连接客户端
 *
 * 通过 node-rfc → SADT_REST_RFC_ENDPOINT 直连 SAP，替代 MCP 全部查询操作。
 *
 * 用法:
 *   # 连通性检查
 *   node scripts/rfc_client.js --discovery
 *   node scripts/rfc_client.js --env=.env.data --discovery
 *
 *   # 搜索对象
 *   node scripts/rfc_client.js --search "ZSAP_FI086"
 *   node scripts/rfc_client.js --search "BKPF" --type TABL
 *
 *   # SQL 查询（用 ABAP EQ 语法，非 =）
 *   node scripts/rfc_client.js --sql "SELECT FIELDNAME, DATATYPE, LENG FROM DD03L WHERE TABNAME EQ 'BKPF'" --table DD03L
 *
 *   # COUNT 查询
 *   node scripts/rfc_client.js --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR'" --table TADIR
 *
 *   # 拉取源码
 *   node scripts/rfc_client.js --source "/sap/bc/adt/programs/programs/zsap_fi086/source/main"
 *
 *   # 通用 ADT REST 请求
 *   node scripts/rfc_client.js GET /sap/bc/adt/discovery
 *   echo "<body>" | node scripts/rfc_client.js POST /sap/bc/adt/... --body -
 *
 * 输出: JSON 到 stdout（status + statusCode + body/data）
 * 错误: 到 stderr，exit(1)
 */

const path = require('path');
const fs = require('fs');
const { loadEnv, buildRfcParams, validateRfcParams } = require('./modules/env');
const { createClient } = require('./modules/sap-connection');
const { adtRequest } = require('./modules/adt-request');

// ── 参数解析 ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    envFile: '.env',
    method: null,
    uri: null,
    body: null,
    discovery: false,
    search: null,
    searchType: null,
    sql: null,
    table: null,
    source: null,
    rowNumber: 100,
    inactive: false,
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--env=' || a.startsWith('--env=')) {
      opts.envFile = a.startsWith('--env=') ? a.slice(6) : args[++i];
    } else if (a === '--discovery') {
      opts.discovery = true;
    } else if (a === '--search') {
      opts.search = args[++i];
    } else if (a === '--type') {
      opts.searchType = args[++i];
    } else if (a === '--sql') {
      opts.sql = args[++i];
    } else if (a === '--table') {
      opts.table = args[++i];
    } else if (a === '--source') {
      opts.source = args[++i];
    } else if (a === '--body') {
      const bodyArg = args[++i];
      opts.body = bodyArg === '-' ? null : bodyArg; // null = read from stdin later
    } else if (a === '--rows') {
      opts.rowNumber = parseInt(args[++i], 10);
    } else if (a === '--inactive') {
      opts.inactive = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (!opts.method) {
      opts.method = a.toUpperCase();
    } else if (!opts.uri) {
      opts.uri = a;
    }
    i++;
  }
  return opts;
}

// ── 组装请求 ─────────────────────────────────────────────────────────────────
function buildRequest(opts) {
  if (opts.discovery) {
    return { method: 'GET', uri: '/sap/bc/adt/discovery', headers: { Accept: 'application/atomsvc+xml' } };
  }
  if (opts.search) {
    const qs = [`operation=quickSearch`, `query=${encodeURIComponent(opts.search)}`, `maxResults=50`];
    if (opts.searchType) qs.push(`objectType=${encodeURIComponent(opts.searchType)}`);
    return { method: 'GET', uri: `/sap/bc/adt/repository/informationsystem/search?${qs.join('&')}`, headers: { Accept: 'application/*' } };
  }
  if (opts.sql) {
    if (opts.table) {
      // ddic 端点：body 是完整 SELECT 语句
      const qs = [`rowNumber=${opts.rowNumber}`, `ddicEntityName=${opts.table}`];
      return { method: 'POST', uri: `/sap/bc/adt/datapreview/ddic?${qs.join('&')}`, headers: { Accept: 'application/*', 'Content-Type': 'text/plain; charset=utf-8' }, body: opts.sql };
    }
    const qs = [`rowNumber=${opts.rowNumber}`];
    return { method: 'POST', uri: `/sap/bc/adt/datapreview/freestyle?${qs.join('&')}`, headers: { Accept: 'application/*', 'Content-Type': 'text/plain; charset=utf-8' }, body: opts.sql };
  }
  if (opts.source) {
    // 修复 Windows bash 路径污染：确保 URI 以 /sap/bc/adt/ 开头
    let uri = opts.source;
    const m = uri.match(/(\/sap\/bc\/adt\/.*)$/);
    if (m) uri = m[1];
    if (!uri.startsWith('/')) uri = '/' + uri;
    return { method: 'GET', uri, headers: { Accept: 'text/plain' } };
  }
  if (opts.inactive) {
    return { method: 'GET', uri: '/sap/bc/adt/inactiveobjects', headers: { Accept: 'application/*' } };
  }
  if (opts.method && opts.uri) {
    return { method: opts.method, uri: opts.uri, headers: { Accept: 'application/*' }, body: opts.body };
  }
  return null;
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  if (opts.help || (!opts.discovery && !opts.search && !opts.sql && !opts.source && !opts.inactive && !opts.method)) {
    console.error('RFC ADT Client — 直连 SAP SADT_REST_RFC_ENDPOINT');
    console.error('');
    console.error('用法:');
    console.error('  node scripts/rfc_client.js [--env=.env.data] <模式> [参数]');
    console.error('');
    console.error('模式（互斥）:');
    console.error('  --discovery              连通性检查 (GET /sap/bc/adt/discovery)');
    console.error('  --search <query>         搜索对象 (--type TABL/PROG/CLAS/...)');
    console.error('  --sql <query> --table <T> SQL查询 (ddic端点, 稳定; freestyle兜底)');
    console.error('  --source <uri>           拉取源码');
    console.error('  --inactive               列出未激活对象');
    console.error('  <METHOD> <URI>           通用 ADT REST 请求');
    console.error('');
    console.error('选项:');
    console.error('  --env=<file>  配置文件 (默认 .env; 数据系统用 .env.data)');
    console.error('  --rows=<n>    SQL 返回行数 (默认 100)');
    console.error('  --body <str>  请求体 (传 "-" 从 stdin 读取)');
    console.error('  --type <t>    搜索对象类型');
    process.exit(2);
  }

  // 加载配置
  const env = loadEnv(opts.envFile);
  const rfcParams = buildRfcParams(env);
  const validation = validateRfcParams(rfcParams);
  if (!validation.valid) {
    console.error(`[FATAL] ${opts.envFile} 缺少: ${validation.missing.join(', ')}`);
    console.error(`  所需字段: SAP_URL, SAP_CLIENT, SAP_SYSNR, SAP_USERNAME, SAP_PASSWORD`);
    process.exit(1);
  }

  // 组装请求
  const req = buildRequest(opts);
  if (!req) {
    console.error('[FATAL] 无法确定请求模式。用 --help 查看用法。');
    process.exit(1);
  }

  // body 从 stdin 读取
  if (req.body === null && opts.body === null) {
    req.body = fs.readFileSync(0, 'utf-8').trim();
  }

  // 连接 SAP
  const client = createClient(rfcParams);
  try {
    await client.open();
  } catch (err) {
    console.error(`[FATAL] RFC 连接失败: ${err.message}`);
    console.error(`  ashost=${rfcParams.ashost} sysnr=${rfcParams.sysnr} client=${rfcParams.client} user=${rfcParams.user}`);
    if (rfcParams.saprouter) console.error(`  router=${rfcParams.saprouter}`);
    process.exit(1);
  }

  // 执行请求
  try {
    const result = await adtRequest(client, req.method, req.uri, {
      headers: req.headers,
      data: req.body || undefined,
    });

    const output = {
      status: 'success',
      statusCode: result.statusCode,
      body: result.body || '',
    };

    // 尝试解析 XML/JSON 响应体
    if (result.body && result.body.trim().startsWith('<')) {
      output.dataType = 'xml';
    } else if (result.body && result.body.trim().startsWith('{')) {
      try { output.data = JSON.parse(result.body); output.dataType = 'json'; } catch (_) {}
    }

    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    console.error(`[ERROR] ADT ${req.method} ${req.uri}: ${err.message}`);
    if (err.body) {
      const preview = typeof err.body === 'string' ? err.body.slice(0, 500) : JSON.stringify(err.body).slice(0, 500);
      console.error(`[ERROR] Response body (first 500 chars):\n${preview}`);
    }
    process.exit(1);
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
