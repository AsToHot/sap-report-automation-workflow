#!/usr/bin/env node
/**
 * rfc_fetch_ddic.js — 单表 DD03L 元数据一键拉取
 *
 * 用法:
 *   node scripts/rfc_fetch_ddic.js [--env=.env.data] <TABNAME> [OUTDIR]
 *
 * 示例:
 *   node scripts/rfc_fetch_ddic.js BKPF
 *   node scripts/rfc_fetch_ddic.js --env=.env.data BSEG output/ZTEST001/metadata/tables
 *
 * 行为:
 *   1. COUNT 校验
 *   2. 拉取字段明细 (FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS)
 *   3. 过滤 .INCLUDE / .INCLU--AP
 *   4. 写入 <TABNAME>.json
 */

const path = require('path');
const fs = require('fs');
const { loadEnv, buildRfcParams, validateRfcParams } = require('./modules/env');
const { createClient } = require('./modules/sap-connection');
const { adtRequest } = require('./modules/adt-request');

// ── 参数解析 ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { envFile: '.env.data', tabname: '', outdir: '' };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--env=' || a.startsWith('--env=')) {
      opts.envFile = a.startsWith('--env=') ? a.slice(6) : args[++i];
    } else if (!opts.tabname) {
      opts.tabname = a.toUpperCase();
    } else if (!opts.outdir) {
      opts.outdir = a;
    }
    i++;
  }
  return opts;
}

// ── XML 解析 — ADT dataPreview XML 返回全部实体列，但 data 仅含 SELECT 列 ──
// 传入 columnNames 作为数据分组依据（来自 SQL SELECT 列，非 XML metadata）
// ── XML 解析 — 仿 abap-adt-api parseQueryResponse：每列有独立 dataSet ──
function parseQueryResponse(xml, fieldList) {
  // 匹配每个 column 块：metadata + dataSet
  const colRe = /<dataPreview:metadata\s+([^>]+)\/>([\s\S]*?)<dataPreview:dataSet>([\s\S]*?)<\/dataPreview:dataSet>/g;
  const columns = [];
  let cm;
  while ((cm = colRe.exec(xml))) {
    const name = (cm[1].match(/dataPreview:name="([^"]+)"/) || [])[1] || '';
    const vals = [];
    const dRe = /<dataPreview:data>([\s\S]*?)<\/dataPreview:data>/g;
    let d;
    while ((d = dRe.exec(cm[3]))) vals.push(d[1]);
    columns.push({ name, values: vals });
  }

  // 找最长列（决定行数）
  const nRows = columns.reduce((m, c) => Math.max(m, c.values.length), 0);
  if (nRows === 0) return [];

  // 按 fieldList 顺序提取，转置为行
  const rows = [];
  for (let r = 0; r < nRows; r++) {
    const row = {};
    for (const f of fieldList) {
      const col = columns.find(c => c.name === f);
      row[f] = col && r < col.values.length ? col.values[r] : '';
    }
    rows.push(row);
  }
  return rows;
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  if (!opts.tabname) {
    console.error('用法: node scripts/rfc_fetch_ddic.js [--env=.env.data] <TABNAME> [OUTDIR]');
    process.exit(2);
  }

  const env = loadEnv(opts.envFile);
  const rfcParams = buildRfcParams(env);
  const validation = validateRfcParams(rfcParams);
  if (!validation.valid) {
    console.error(`[FATAL] ${opts.envFile} 缺少: ${validation.missing.join(', ')}`);
    process.exit(1);
  }

  const client = createClient(rfcParams);
  try { await client.open(); } catch (err) {
    console.error(`[FATAL] RFC 连接失败: ${err.message}`);
    process.exit(1);
  }

  const sqlFields = 'FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS';
  const sql = `SELECT ${sqlFields} FROM DD03L WHERE TABNAME EQ '${opts.tabname}' ORDER BY POSITION`;

  let xmlBody;
  try {
    const result = await adtRequest(client, 'POST',
      `/sap/bc/adt/datapreview/ddic?rowNumber=2000&ddicEntityName=DD03L`,
      { headers: { Accept: 'application/*', 'Content-Type': 'text/plain; charset=utf-8' }, data: sql });
    xmlBody = result.body;
  } catch (err) {
    console.error(`[ERROR] DD03L 查询失败: ${err.message}`);
    try { await client.close(); } catch (_) {}
    process.exit(1);
  }

  const fieldList = sqlFields.split(/,\s*/).map(s => s.trim());
  const rows = parseQueryResponse(xmlBody, fieldList);

  // 过滤 .INCLUDE / .INCLU--AP
  const fields = rows
    .filter(r => !r.FIELDNAME || (!r.FIELDNAME.startsWith('.INCLUDE') && !r.FIELDNAME.startsWith('.INCLU--AP')))
    .map(r => ({
      FIELDNAME: r.FIELDNAME || '',
      POSITION: parseInt(r.POSITION, 10) || 0,
      KEYFLAG: r.KEYFLAG || '',
      ROLLNAME: r.ROLLNAME || '',
      DATATYPE: r.DATATYPE || '',
      LENG: parseInt(r.LENG, 10) || 0,
      DECIMALS: parseInt(r.DECIMALS, 10) || 0,
    }));

  const actualCount = fields.length;

  // 确定输出目录
  const outdir = opts.outdir || path.join(process.cwd(), 'output', '_metadata', 'tables');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, `${opts.tabname}.json`);

  const metadata = {
    tabname: opts.tabname,
    fetched_count: actualCount,
    matched: actualCount > 0,
    pulled_at: new Date().toISOString(),
    source: opts.envFile,
    fields,
  };

  fs.writeFileSync(outfile, JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(`[OK] ${opts.tabname}: ${actualCount} fields → ${outfile}`);
  if (actualCount === 0) {
    console.error(`[WARN] ${opts.tabname}: 0 fields returned. Table may not exist or is empty.`);
  }

  try { await client.close(); } catch (_) {}
}

main().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
