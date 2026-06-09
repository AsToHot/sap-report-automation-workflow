/**
 * 报表真实数据校验
 * 用法: node scripts/verify_ztest001.js BUKRS=6030 GJAHR=2025 RP_LOW=001 RP_HIGH=016
 *
 * 步骤:
 * 1. 通过 MCP (300 proxy) 查询源表 FAGLFLEXT
 * 2. 手工计算期望值
 * 3. 通过 node-rfc 调用 ZREPORT_EXEC_VERIFY 执行报表
 * 4. 比对报表输出 vs 期望值
 */

const http = require('http');

// ── 解析命令行参数 ──────────────────────────────────
const args = {};
process.argv.slice(2).forEach(a => {
  const m = a.match(/^(\w+)=(.+)$/);
  if (m) args[m[1].toLowerCase()] = m[2];
});
const P_BUKRS  = args.bukrs  || '6030';
const P_GJAHR  = args.gjahr  || '2025';
const RP_LOW   = args.rp_low  || '001';
const RP_HIGH  = args.rp_high || '016';

// ── MCP 查询 (300 proxy) ─────────────────────────────
function mcpCall(tool, toolArgs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0', method: 'tools/call',
      params: { name: tool, arguments: toolArgs }, id: 1
    });
    const req = http.request({
      hostname: 'localhost', port: 9877, path: '/mcp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 60000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.substring(0,200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function runQuery(sql, rowNumber) {
  return mcpCall('runQuery', { sqlQuery: sql, rowNumber: rowNumber || 500 });
}

// ── 期间列求和 ──────────────────────────────────────
const HSL_COLS = Array.from({length:16}, (_, i) => `HSL${String(i+1).padStart(2,'0')}`);
function sumPeriods(row, from, to) {
  let s = 0;
  for (let i = from - 1; i <= to - 1 && i < 16; i++) {
    s += (row[HSL_COLS[i]] || 0);
  }
  return s;
}

// ── 主流程 ──────────────────────────────────────────
async function main() {
  console.log(`=== ZTEST001 数据校验 (300) ===`);
  console.log(`参数: BUKRS=${P_BUKRS} GJAHR=${P_GJAHR} RPMAX=${RP_LOW}~${RP_HIGH}\n`);

  // Step 1: 查询 ZSAP_BUKRS
  console.log('[1/5] 查询 ZSAP_BUKRS...');
  const zRes = await runQuery(
    `SELECT BUKRS, ZFGS, ZZGS, PRCTR FROM ZSAP_BUKRS WHERE BUKRS='${P_BUKRS}'`);
  const zData = parseQueryResult(zRes);
  if (!zData.length) { console.log('[FAIL] 公司代码未维护'); return; }
  const zRow = zData[0];
  const lv_rbukrs = (zRow.ZFGS === '' || zRow.ZFGS === ' ') ? zRow.BUKRS : zRow.ZZGS;
  console.log(`  BUKRS=${zRow.BUKRS} ZFGS=${zRow.ZFGS} → RBUKRS=${lv_rbukrs}\n`);

  // Step 2: 查询源表 FAGLFLEXT
  console.log('[2/5] 查询 FAGLFLEXT 聚合...');
  const hslSum = HSL_COLS.map(c => `SUM(${c.toLowerCase()}) AS ${c.toLowerCase()}`).join(',');
  const sql = `SELECT RACCT, DRCRK, SUM(HSLVT) AS HSLVT, ${hslSum} ` +
    `FROM FAGLFLEXT WHERE RYEAR='${P_GJAHR}' AND RBUKRS='${lv_rbukrs}' ` +
    `AND RLDNR='0L' AND RRCTY='0' ` +
    `GROUP BY RACCT, DRCRK ORDER BY RACCT, DRCRK`;
  const fRes = await runQuery(sql, 1000);
  const sourceRows = parseQueryResult(fRes);
  console.log(`  聚合行数: ${sourceRows.length}\n`);

  // Step 3: 手工计算期望值
  console.log('[3/5] 手工计算期望值...');
  const start = parseInt(RP_LOW, 10), end = parseInt(RP_HIGH, 10);

  const byAcct = {};
  for (const r of sourceRows) {
    if (!byAcct[r.RACCT]) byAcct[r.RACCT] = {};
    byAcct[r.RACCT][r.DRCRK] = r;
  }

  const expected = [];
  for (const [racct, rows] of Object.entries(byAcct)) {
    const S = rows.S || {}, H = rows.H || {};

    let openHsl = (S.HSLVT || 0) + (H.HSLVT || 0);
    if (start > 1) {
      openHsl += sumPeriods(S, 1, start - 1);
      openHsl += sumPeriods(H, 1, start - 1);
    }
    const curS = sumPeriods(S, start, end);
    const curH = sumPeriods(H, start, end);
    const ytdS = sumPeriods(S, 1, end);
    const ytdH = sumPeriods(H, 1, end);
    const closing = openHsl + curS - curH;

    expected.push({
      RACCT: racct, ZYJKM: racct.substring(0,4),
      ZQCJF: openHsl >= 0 ? openHsl : 0,
      ZQCDF: openHsl < 0  ? -openHsl : 0,
      ZBQJF: curS, ZBQDF: curH,
      ZBNJF: ytdS, ZBNDF: ytdH,
      ZQMJF: closing >= 0 ? closing : 0,
      ZQMDF: closing < 0  ? -closing : 0,
    });
  }
  console.log(`  科目数: ${expected.length}\n`);

  // 显示前 5 行期望值
  console.log('  期望值 (前5行):');
  expected.slice(0, 5).forEach(r => {
    console.log(`  ${r.RACCT.padEnd(12)} 期D=${r.ZQCJF.toFixed(2).padStart(12)} 期C=${r.ZQCDF.toFixed(2).padStart(12)} 本D=${r.ZBQJF.toFixed(2).padStart(12)} 本C=${r.ZBQDF.toFixed(2).padStart(12)} 末D=${r.ZQMJF.toFixed(2).padStart(12)} 末C=${r.ZQMDF.toFixed(2).padStart(12)}`);
  });

  // Step 4: 调用 ZREPORT_EXEC_VERIFY
  console.log('\n[4/5] 调用 ZREPORT_EXEC_VERIFY...');

  // 构建 RSPARAMS 并调用 RFC
  const rfcResult = await callVerifyFM({
    IV_REPORT: 'ZTEST001',
    IT_RSPARAMS: [
      { SELNAME: 'P_BUKRS', KIND: 'P', SIGN: 'I', OPTION: 'EQ', LOW: P_BUKRS, HIGH: '' },
      { SELNAME: 'P_GJAHR', KIND: 'P', SIGN: 'I', OPTION: 'EQ', LOW: P_GJAHR, HIGH: '' },
      { SELNAME: 'S_RPMAX', KIND: 'S', SIGN: 'I', OPTION: 'BT', LOW: RP_LOW, HIGH: RP_HIGH },
    ]
  });

  if (!rfcResult) {
    console.log('[SKIP] 无法调用 RFC — 请手动在 SA38 执行 ZTEST001_VFY 或 SE37 执行 ZREPORT_EXEC_VERIFY\n');
  } else {
    console.log(`  EV_SUCCESS: ${rfcResult.EV_SUCCESS}`);
    console.log(`  EV_ROW_COUNT: ${rfcResult.EV_ROW_COUNT}\n`);

    // Step 5: 比对
    console.log('[5/5] 比对...');
    let reportRows = [];
    if (rfcResult.EV_DATA_JSON) {
      try {
        const json = JSON.parse(rfcResult.EV_DATA_JSON);
        reportRows = Array.isArray(json) ? json : (json.DATA || []);
      } catch (e) { /* ignore */ }
    }

    console.log(`  期望行数: ${expected.length}, 报表行数: ${reportRows.length}`);
    const rptMap = {};
    for (const r of reportRows) rptMap[r.RACCT || ''] = r;

    let ok = 0, fail = 0;
    for (const exp of expected) {
      const act = rptMap[exp.RACCT];
      if (!act) { fail++; continue; }
      const match =
        Math.abs((exp.ZQCJF||0) - (act.ZQCJF||0)) < 0.01 &&
        Math.abs((exp.ZBQJF||0) - (act.ZBQJF||0)) < 0.01 &&
        Math.abs((exp.ZBQDF||0) - (act.ZBQDF||0)) < 0.01;
      if (match) ok++; else {
        fail++;
        if (fail <= 5) {
          console.log(`  [MISMATCH] ${exp.RACCT}: 期借${exp.ZQCJF}/${act.ZQCJF} 本借${exp.ZBQJF}/${act.ZBQJF} 本贷${exp.ZBQDF}/${act.ZBQDF}`);
        }
      }
    }
    console.log(`  匹配: ${ok}, 不匹配/缺失: ${fail}`);
  }

  // ── 输出手工验证结论 ──────────────────────────────
  console.log('\n=== 手工验证摘要 ===');
  console.log(`源表科目数: ${expected.length}`);
  if (expected.length > 0) {
    const total = expected.reduce((a, r) => ({
      qcjf: a.qcjf + r.ZQCJF, qcdf: a.qcdf + r.ZQCDF,
      bqjf: a.bqjf + r.ZBQJF, bqdf: a.bqdf + r.ZBQDF,
      qmjf: a.qmjf + r.ZQMJF, qmdf: a.qmdf + r.ZQMDF,
    }), { qcjf: 0, qcdf: 0, bqjf: 0, bqdf: 0, qmjf: 0, qmdf: 0 });
    console.log(`合计 期初借=${total.qcjf.toFixed(2)} 期初贷=${total.qcdf.toFixed(2)}`);
    console.log(`合计 本期借=${total.bqjf.toFixed(2)} 本期贷=${total.bqdf.toFixed(2)}`);
    console.log(`合计 期末借=${total.qmjf.toFixed(2)} 期末贷=${total.qmdf.toFixed(2)}`);
  }
}

// ── 通过 node-rfc 调用 ZREPORT_EXEC_VERIFY ───────────
async function callVerifyFM(params) {
  try {
    const rfc = require('node-rfc');
    const CONN300 = {
      ashost: '10.32.21.11', sysnr: '00', client: '300',
      user: 'ITL12', passwd: '12345Qwert!', lang: 'ZH',
      saprouter: '/H/210.75.21.252',
    };
    const client = new rfc.Client(CONN300);
    await client.open();
    const res = await client.call('ZREPORT_EXEC_VERIFY', params);
    await client.close();
    return res;
  } catch (e) {
    console.error(`  [RFC ERR] ${e.message}`);
    console.error(`  [FIX] 确保 SAPNWRFC_HOME 指向 NW-RFC-SDK/nwrfcsdk 且 PATH 包含 nwrfcsdk/lib`);
    console.error(`  [ALT] 在 SAP GUI SE37 中执行 ZREPORT_EXEC_VERIFY`);
    return null;
  }
}

// ── 解析 runQuery 返回 ────────────────────────────
function parseQueryResult(mcpResponse) {
  try {
    const body = mcpResponse?.result?.content?.[0]?.text;
    if (!body) return [];
    const data = JSON.parse(body);
    if (data.status !== 'success') return [];
    const { columns, values } = data.result;
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col.name.toUpperCase()] = row[i];
      });
      // 数字转换
      for (const c of ['HSLVT', ...HSL_COLS]) {
        if (obj[c] !== undefined && typeof obj[c] === 'string') {
          obj[c] = parseFloat(obj[c]) || 0;
        }
      }
      return obj;
    });
  } catch (e) {
    return [];
  }
}

main().catch(e => { console.error(e); process.exit(1); });
