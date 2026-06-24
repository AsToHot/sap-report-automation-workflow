/**
 * 通用数据抽样助手 — 透明表取数
 *
 * 已重构为 fetch_table.js 的薄包装，走 DDIC 端点（WHERE 可靠）。
 * 保留原参数名兼容性，内部委托给 fetch_table.js。
 *
 * 用法:
 *   node scripts/data_sampler.js "--table=FAGLFLEXT" "--where=RYEAR = '2026'" "--fields=RACCT,DRCRK" "--rows=100"
 *
 * 输出: JSON { table, where, rowCount, columns, rows, _validation }
 */

const { spawnSync } = require('child_process');
const path = require('path');

// ── 参数解析 ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { env: '.env.data', rows: 100 };

for (const a of args) {
  if (a === '--help' || a === '-h') {
    console.error('data_sampler.js — 委托 fetch_table.js 取数 (DDIC 端点, WHERE 可靠)');
    console.error('');
    console.error('用法: node scripts/data_sampler.js "--table=<T>" "--where=<W>" [选项]');
    console.error('');
    console.error('必选:');
    console.error('  --table=<T>    表名');
    console.error('  --where=<W>    WHERE 条件 (含单引号时建议用双引号包裹)');
    console.error('选项:');
    console.error('  --fields=<F>   逗号分隔字段列表');
    console.error('  --rows=<N>     返回行数 (默认 100)');
    console.error('  --env=<file>   配置文件 (默认 .env.data)');
    process.exit(0);
  }
  // Support both --key=value and --key value formats
  const m = a.match(/^--(\w+)=(.+)$/);
  if (m) {
    const [, key, val] = m;
    if (key === 'rows') opts.rows = parseInt(val);
    else opts[key] = val;
  } else {
    const idx = args.indexOf(a);
    if (a.startsWith('--') && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
      const key = a.slice(2);
      if (key === 'rows') opts.rows = parseInt(args[idx + 1]);
      else opts[key] = args[idx + 1];
    }
  }
}

if (!opts.table) {
  console.error('[FATAL] --table 必填');
  process.exit(1);
}

// ── 委托 fetch_table.js ─────────────────────────────────────────────────────
const fetchPath = path.join(__dirname, 'fetch_table.js');
const spawnArgs = [fetchPath];
if (opts.table) spawnArgs.push('--table=' + opts.table);
if (opts.where) spawnArgs.push('--where=' + opts.where);
if (opts.fields) spawnArgs.push('--fields=' + opts.fields);
if (opts.rows) spawnArgs.push('--rows=' + opts.rows);
if (opts.env) spawnArgs.push('--env=' + opts.env);

console.error(`[SAMPLER] → fetch_table.js | ${opts.table} | ${opts.where || '(no filter)'}`);

const result = spawnSync('node', spawnArgs, { encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

// Pass through output
const stdout = result.stdout || '';
const jsonStart = stdout.indexOf('{');
if (jsonStart >= 0) {
  process.stdout.write(stdout.substring(jsonStart));
} else {
  process.stdout.write(stdout);
}
if (result.stderr) process.stderr.write(result.stderr);

process.exit(result.status || 0);
