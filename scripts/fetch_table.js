#!/usr/bin/env node
/**
 * fetch_table.js — 通用 SAP 表取数脚本
 *
 * 走 DDIC 端点 (/sap/bc/adt/datapreview/ddic)，WHERE 可靠过滤。
 * 替代 data_sampler.js（freestyle SQL WHERE 不可靠）。
 *
 * 用法:
 *   node scripts/fetch_table.js --table=FAGLFLEXT \
 *     --where="RYEAR = '2026' AND RBUKRS = '80K0' AND RACCT = '1002000001'" \
 *     --fields=RYEAR,RBUKRS,RACCT,RPMAX,DRCRK,HSLVT,HSL01,HSL02 \
 *     --rows=100
 *
 * 输出: JSON { table, where, rowCount, columns, rows, _validation: { passed, failures[] } }
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// ── 参数解析 ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { rows: 100 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--table' || a === '-t') opts.table = args[++i];
  else if (a.startsWith('--table=')) opts.table = a.substring(a.indexOf('=') + 1);
  else if (a === '--where' || a === '-w') opts.where = args[++i];
  else if (a.startsWith('--where=')) opts.where = a.substring(a.indexOf('=') + 1);
  else if (a === '--fields' || a === '-f') opts.fields = args[++i];
  else if (a.startsWith('--fields=')) opts.fields = a.substring(a.indexOf('=') + 1);
  else if (a === '--rows' || a === '-r') opts.rows = parseInt(args[++i]);
  else if (a.startsWith('--rows=')) opts.rows = parseInt(a.substring(a.indexOf('=') + 1));
  else if (a === '--env' || a === '-e') opts.env = args[++i];
  else if (a.startsWith('--env=')) opts.env = a.substring(a.indexOf('=') + 1);
  else if (a === '--help' || a === '-h') {
    console.error('fetch_table.js — 通用 SAP 表取数 (DDIC 端点, WHERE 可靠)');
    console.error('');
    console.error('用法: node scripts/fetch_table.js --table=<T> --where=<W> [选项]');
    console.error('');
    console.error('必选:');
    console.error('  --table=<T>    表名 (FAGLFLEXT, BKPF, ...)');
    console.error('  --where=<W>    WHERE 条件 (不含 WHERE 关键字)');
    console.error('选项:');
    console.error('  --fields=<F>   逗号分隔字段列表 (默认全部)');
    console.error('  --rows=<N>     返回行数 (默认 100)');
    console.error('  --env=<file>   配置文件 (默认 .env.data)');
    process.exit(0);
  }
}

if (!opts.table) {
  console.error('[FATAL] --table 必填');
  process.exit(1);
}
if (!opts.where) {
  console.error('[WARN] 未提供 --where，将取全表数据');
}

const envFile = opts.env || '.env.data';
const fields = opts.fields ? opts.fields.split(',').map(f => f.trim()) : ['*'];
const fieldsStr = fields.join(', ');
const whereClause = opts.where ? ` WHERE ${opts.where}` : '';
const sql = `SELECT ${fieldsStr} FROM ${opts.table}${whereClause}`;

// ── 调用 rfc_client.js ──────────────────────────────────────────────────────
const rfcClientPath = path.join(__dirname, 'rfc_client.js');

// 使用 child_process.spawn 传参，避免 shell 吃掉引号
const spawnArgs = [
  rfcClientPath,
  `--env=${envFile}`,
  '--table', opts.table,
  '--rows', String(opts.rows),
  '--sql', sql,
];

console.error(`[FETCH] ${opts.table} | where: ${opts.where || '(none)'} | rows: ${opts.rows}`);
let raw;
try {
  const result = spawnSync('node', spawnArgs, { encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  raw = (result.stdout || '') + (result.stderr || '');
  if (result.status !== 0) {
    // Non-zero exit — check if the output is still valid JSON
    const jsonStart = raw.indexOf('{');
    if (jsonStart >= 0) {
      raw = raw.substring(jsonStart);
    } else {
      console.error(`[FATAL] rfc_client.js exited with ${result.status}`);
      console.error(raw.substring(0, 1000));
      process.exit(2);
    }
  }
} catch (e) {
  console.error(`[FATAL] spawn 失败: ${e.message}`);
  process.exit(2);
}

// ── 解析 XML 响应 ──────────────────────────────────────────────────────────
let rfcResult;
try {
  rfcResult = JSON.parse(raw);
} catch (_) {
  console.error('[FATAL] rfc_client.js 输出不是有效 JSON');
  console.error(raw.substring(0, 1000));
  process.exit(3);
}

if (rfcResult.status !== 'success') {
  console.error(`[FATAL] RFC 返回错误: ${rfcResult.statusCode}`);
  process.exit(4);
}

const xml = rfcResult.body || '';

// 解析列名
const cols = [];
const colRe = /dataPreview:name="([^"]+)"/g;
let cm;
while ((cm = colRe.exec(xml)) !== null) cols.push(cm[1]);

// 解析每列数据
const colData = {};
for (const col of cols) {
  const blockRe = new RegExp(`dataPreview:name="${col}"[^>]*>([\\s\\S]*?)<\\/dataPreview:columns>`);
  const m = blockRe.exec(xml);
  if (m) {
    const vals = [];
    const vRe = /<dataPreview:data>([^<]*)<\/dataPreview:data>/g;
    let vm;
    while ((vm = vRe.exec(m[1])) !== null) vals.push(vm[1].trim());
    colData[col] = vals;
  }
}

// 组合为行数组
const nRows = colData[cols[0]] ? colData[cols[0]].length : 0;
const rows = [];
for (let i = 0; i < nRows; i++) {
  const row = {};
  for (const col of cols) {
    let val = colData[col] ? (colData[col][i] || '') : '';
    // 尝试转换数字
    if (val.endsWith('-')) val = '-' + val.slice(0, -1);
    if (/^-?\d+\.?\d*$/.test(val)) val = parseFloat(val);
    row[col] = val;
  }
  rows.push(row);
}

// ── WHERE 校验 ─────────────────────────────────────────────────────────────
const failures = [];
if (opts.where && rows.length > 0) {
  // 解析 WHERE 条件，提取 字段 = '值' 形式
  const condRe = /(\w+)\s*=\s*'([^']+)'/g;
  let condMatch;
  while ((condMatch = condRe.exec(opts.where)) !== null) {
    const [, field, expected] = condMatch;
    const upperField = field.toUpperCase();
    if (cols.includes(upperField)) {
      const mismatchRows = [];
      rows.forEach((r, i) => {
        const actual = String(r[upperField] ?? '');
        if (actual !== expected) {
          mismatchRows.push({ row: i, expected, actual });
        }
      });
      if (mismatchRows.length > 0) {
        failures.push({
          field: upperField,
          expected,
          mismatchCount: mismatchRows.length,
          samples: mismatchRows.slice(0, 3),
        });
      }
    }
  }
}

// ── 输出 ────────────────────────────────────────────────────────────────────
const result = {
  table: opts.table,
  where: opts.where || null,
  rowCount: rows.length,
  columns: cols,
  rows,
  _validation: {
    passed: failures.length === 0,
    failures,
  },
};

console.log(JSON.stringify(result, null, 2));

if (!result._validation.passed) {
  console.error(`\n[VALIDATE] FAIL — ${failures.length} field(s) mismatch WHERE conditions:`);
  failures.forEach(f => {
    console.error(`  ${f.field}: expected='${f.expected}', ${f.mismatchCount}/${rows.length} rows mismatch`);
    f.samples.forEach(s => console.error(`    row ${s.row}: got '${s.actual}'`));
  });
  process.exit(5);
}

console.error(`[OK] ${rows.length} rows, validation passed`);
