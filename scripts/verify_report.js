/**
 * 通用报表真实数据校验
 *
 * 用法:
 *   node scripts/verify_report.js <程序名> [参数...]
 *   node scripts/verify_report.js ZTEST001 P_BUKRS=6030 P_GJAHR=2025 S_RPMAX=001-004
 *   node scripts/verify_report.js ZTEST001 P_BUKRS=6030 P_GJAHR=2025 S_RPMAX=001-004,009-012,012-012,001-016
 *
 * 参数规则:
 *   P_xxx=值        → PARAMETERS 单值 (KIND=P, OPTION=EQ)
 *   S_xxx=低-高      → SELECT-OPTIONS 区间 (KIND=S, OPTION=BT)
 *   S_xxx=值         → SELECT-OPTIONS 单值 (KIND=S, OPTION=EQ)
 *   逗号分隔多个区间   → 例如 S_RPMAX=001-004,009-012 表示测试多个范围
 *
 * 前提:
 *   - SAPNWRFC_HOME 环境变量指向 NW-RFC-SDK/nwrfcsdk
 *   - PATH 包含 nwrfcsdk/lib
 *   - 目标报表已在 200(300) 部署激活
 *   - ZREPORT_EXEC_VERIFY FM 在目标系统可用
 */

const path = require('path');
const fs = require('fs');

// ── 加载 300 连接参数 ──────────────────────────────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  fs.readFileSync(filePath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  });
  return env;
}
const env300 = loadEnv(path.join(__dirname, '..', '.env.300'));

// 从 .env.300 读取连接参数 — 所有字段必须显式配置，不使用硬编码默认值
if (!env300.SAP_URL) {
  console.error('[FATAL] .env.300 缺少 SAP_URL — 无法连接 300 系统');
  process.exit(1);
}
const CONN300 = {
  ashost: env300.SAP_URL.replace(/^https?:\/\//, '').replace(/:\d+$/, ''),
  sysnr: env300.SAP_SYSNR || String(parseInt(
    env300.SAP_URL.match(/:(\d+)$/)?.[1] || '8000'
  ) % 100).padStart(2, '0'),
  client: env300.SAP_CLIENT || '300',
  user:   env300.SAP_USERNAME || '',
  passwd: env300.SAP_PASSWORD || '',
  lang:   env300.SAP_LANGUAGE || 'ZH',
  ...(env300.SAP_ROUTER ? { saprouter: env300.SAP_ROUTER } : {}),
};

// ── 命令行解析 ─────────────────────────────────────
const progName = process.argv[2];
if (!progName) {
  console.error('用法: node scripts/verify_report.js <程序名> [P_xxx=值] [S_xxx=低-高] [...]');
  console.error('示例: node scripts/verify_report.js ZTEST001 P_BUKRS=6030 P_GJAHR=2025 S_RPMAX=001-004,009-012');
  process.exit(1);
}

// 解析参数
const params = [];
const multiRanges = []; // S_xxx=range1,range2,...
for (let i = 3; i < process.argv.length; i++) {
  const arg = process.argv[i];
  const m = arg.match(/^([PS])_(\w+)=(.+)$/);
  if (!m) { console.warn('[WARN] 忽略无效参数:', arg); continue; }

  const kind = m[1]; // P or S
  const name = m[1] + '_' + m[2];
  const value = m[3];

  if (value.includes(',')) {
    // 多个范围
    multiRanges.push({ kind, name, ranges: value.split(',').map(s => s.trim()) });
  } else {
    params.push({ kind, name, value });
  }
}

// ── 构建单组 RSPARAMS ─────────────────────────────
function buildRsparams(paramSet) {
  const table = [];
  for (const p of paramSet) {
    const entry = { SELNAME: p.name, KIND: p.kind, SIGN: 'I' };
    if (p.kind === 'P') {
      entry.OPTION = 'EQ';
      entry.LOW = p.value;
      entry.HIGH = '';
    } else {
      // SELECT-OPTIONS
      if (p.value.includes('-')) {
        const [lo, hi] = p.value.split('-');
        entry.OPTION = 'BT';
        entry.LOW = lo;
        entry.HIGH = hi;
      } else {
        entry.OPTION = 'EQ';
        entry.LOW = p.value;
        entry.HIGH = '';
      }
    }
    table.push(entry);
  }
  return table;
}

// ── 调用 ZREPORT_EXEC_VERIFY ──────────────────────
async function runVerify(report, rsparams, label) {
  let client;
  try {
    const rfc = require('node-rfc');
    client = new rfc.Client(CONN300);
    await client.open();

    const res = await client.call('ZREPORT_EXEC_VERIFY', {
      IV_REPORT: report.toUpperCase(),
      IT_RSPARAMS: rsparams
    });

    await client.close();

    let rows = [];
    if (res.EV_DATA_JSON) {
      try {
        const d = JSON.parse(res.EV_DATA_JSON);
        rows = d.DATA || (Array.isArray(d) ? d : []);
      } catch (_) {}
    }

    return {
      label,
      success: res.EV_SUCCESS === 'X',
      message: res.EV_MESSAGE,
      rowCount: rows.length,
      rows,
      rsparams
    };
  } catch (e) {
    if (client) try { client.close(); } catch (_) {}
    return { label, error: e.message };
  }
}

// ── 输出格式化 ─────────────────────────────────────
function printResults(result) {
  const { label, success, message, rowCount, rows, error, rsparams } = result;

  const paramStr = rsparams
    ? rsparams.map(p => `${p.SELNAME}=${p.KIND==='P'?p.LOW:p.LOW+'~'+p.HIGH}`).join(' ')
    : '';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${label}] ${paramStr}`);
  console.log(`${'='.repeat(60)}`);

  if (error) {
    console.log(`[ERR] ${error}`);
    console.log('[FIX] 确保: 1) NW-RFC-SDK 已安装 2) 300 VPN 已连接 3) 报表已激活');
    return;
  }

  console.log(`执行: ${success ? 'OK' : 'FAIL'} | ${message} | 输出 ${rowCount} 行`);

  if (rows.length === 0) {
    console.log('[WARN] 0 行 — 检查 WHERE 条件或源表数据');
    return;
  }

  // 展示前 8 行（动态匹配全部字段）
  console.log(`\n前 ${Math.min(rows.length, 8)} 行:`);
  const allKeys = Object.keys(rows[0]);
  // 数字列（用于合计）
  const numCols = allKeys.filter(k => typeof rows[0][k] === 'number');
  // 非数字列（用于标识）
  const idCols = allKeys.filter(k => typeof rows[0][k] !== 'number');

  rows.slice(0, 8).forEach(r => {
    const id = idCols.map(k => `${k}=${r[k]}`).join(' ');
    const amts = numCols.map(k => `${k}=${r[k]}`).join(' ');
    console.log(`  ${id}`);
    if (amts) console.log(`    ${amts}`);
  });

  // 总计
  if (rows.length > 0 && numCols.length > 0) {
    const totals = {};
    numCols.forEach(k => { totals[k] = 0; });
    rows.forEach(r => numCols.forEach(k => { totals[k] += (r[k] || 0); }));
    console.log(`\n  合计: ${numCols.map(k => `${k}=${totals[k].toFixed(2)}`).join(' ')}`);
  }
}

// ── 主流程 ──────────────────────────────────────────
async function main() {
  console.log(`=== ${progName.toUpperCase()} 真实数据校验 (300) ===`);
  console.log(`连接: client=${CONN300.client}\n`);

  const tasks = [];

  // 基础参数（不含多范围的）
  if (multiRanges.length === 0) {
    // 单一参数集
    const rsparams = buildRsparams(params);
    tasks.push({ label: 'default', rsparams });
  } else {
    // 有 S_xxx=range1,range2,... 生成多组测试
    const mr = multiRanges[0]; // 取第一个多范围参数
    for (const range of mr.ranges) {
      const paramSet = [
        ...params,
        { kind: mr.kind, name: mr.name, value: range }
      ];
      const rsparams = buildRsparams(paramSet);
      tasks.push({
        label: `${mr.name}=${range}`,
        rsparams
      });
    }
  }

  // 执行所有测试
  for (const task of tasks) {
    const result = await runVerify(progName, task.rsparams, task.label);
    printResults(result);
  }

  console.log(`\n=== 完成: ${tasks.length} 组参数测试 ===`);
  console.log('提示: 用 MCP runQuery (300) 查询源表对照验证');
}

main().catch(e => { console.error(e); process.exit(1); });
