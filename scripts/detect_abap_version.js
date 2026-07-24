#!/usr/bin/env node
/**
 * ABAP 系统版本探测
 *
 * 通过 RFC_SYSTEM_INFO 读取 SAP 版本、数据库、系统 ID 等关键信息，
 * 用于在写代码前确定可用语法集合。
 *
 * 用法:
 *   node scripts/detect_abap_version.js [--env=.env.data]
 *
 * 输出 JSON 示例:
 *   {
 *     "status": "success",
 *     "system": { "sysid": "DEV", "database": "HDB", "sapReleaseRaw": "7400", "sapRelease": 740 },
 *     "versionTier": "s4hana_early",
 *     "allowedSyntax": ["🔵", "🟢"],
 *     "notes": "S4HANA 1511/1610 或 ECC EHP7/8：仅可用 🔵 与 🟢 语法"
 *   }
 */

const { loadEnv, buildRfcParams, validateRfcParams } = require('./modules/env');
const { createClient } = require('./modules/sap-connection');

const VERSION_TIERS = [
  { name: 'abap_cloud', minRelease: 0, icons: ['🔵', '🟢', '🟠', '🔴'], note: 'Cloud/Steampunk：可用现代语法，但需确认 released APIs；禁止本地-only 的 dynpro/ALV 旧模式' },
  { name: 's4hana_modern', minRelease: 750, icons: ['🔵', '🟢', '🟠'], note: 'S4HANA 1511/1610/1709+（ABAP 7.50+）：可用 🟢 与 🟠 语法' },
  { name: 's4hana_early', minRelease: 740, icons: ['🔵', '🟢'], note: 'ECC 6.0 EHP7/EHP8（ABAP 7.40）：仅可用 🔵 与 🟢 语法，禁用 🟠/🔴' },
  { name: 'ecc_legacy', minRelease: 0, icons: ['🔵'], note: 'ECC 6.0 EHP0–EHP6 或探测失败：只可用 🔵 语法，禁用内联声明、VALUE、CORRESPONDING 等' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const envArg = args.find(function(a) { return a.startsWith('--env='); });
  return { envFile: envArg ? envArg.slice(6) : '.env' };
}

function normalizeRelease(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  if (/^\d{4}$/.test(s)) return parseInt(s.slice(0, 3), 10);
  if (/^\d{3}$/.test(s)) return parseInt(s, 10);
  if (/^\d{2}$/.test(s)) return parseInt(s, 10) * 10;
  return null;
}

function determineTier(release) {
  if (release === null) return VERSION_TIERS[VERSION_TIERS.length - 1];
  for (var i = 0; i < VERSION_TIERS.length; i++) {
    const t = VERSION_TIERS[i];
    if (release >= t.minRelease) return t;
  }
  return VERSION_TIERS[VERSION_TIERS.length - 1];
}

async function main() {
  const { envFile } = parseArgs();
  const env = loadEnv(envFile);
  const rfcParams = buildRfcParams(env);
  const validation = validateRfcParams(rfcParams);
  if (!validation.valid) {
    console.error('[FATAL] ' + envFile + ' 缺少: ' + validation.missing.join(', '));
    process.exit(1);
  }

  const client = createClient(rfcParams);
  try {
    await client.open();
  } catch (err) {
    console.error('[FATAL] RFC 连接失败: ' + err.message);
    process.exit(1);
  }

  try {
    const result = await client.call('RFC_SYSTEM_INFO', {});
    const sys = (result && result.RFCSI_EXPORT) ? result.RFCSI_EXPORT : {};
    const rawRelease = sys.RFCSAPRL;
    const release = normalizeRelease(rawRelease);
    const tier = determineTier(release);

    const output = {
      status: 'success',
      envFile: envFile,
      system: {
        sysid: sys.RFCSYSID || '',
        host: sys.RFCHOST || '',
        database: sys.RFCDATAB || '',
        dbHost: sys.RFCDBHOST || '',
        dbSys: sys.RFCDBSYS || '',
        sapReleaseRaw: rawRelease,
        sapRelease: release,
      },
      versionTier: tier.name,
      allowedSyntax: tier.icons,
      notes: tier.note,
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    console.error('[ERROR] RFC_SYSTEM_INFO 调用失败: ' + err.message);
    process.exit(1);
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

main().catch(function(err) {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
