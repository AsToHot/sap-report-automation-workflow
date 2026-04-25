const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '_dist');
const outZip = path.join(root, 'sap-report-automation-workflow-skill.zip');

// Clean previous build
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true });
}
if (fs.existsSync(outZip)) {
  fs.unlinkSync(outZip);
}
fs.mkdirSync(outDir, { recursive: true });

const entries = [
  // Skill core
  '.claude/skills/sap-report-automation-workflow',
  // Scripts
  '脚本',
  '脚本/write-config.js',
  // Templates & examples
  'spec',
  'docs',
  'metadata',
  'abap',
  'templates/reference',
  // Config & launcher
  '.env.example',
  '.mcp.json',
  'mcp-launcher.js',
  // NW-RFC-SDK (unpacked, ready to use)
  'NW-RFC-SDK/nwrfcsdk',
  'NW-RFC-SDK/nwrfc750P_6-70002755.zip',
  'NW-RFC-SDK/SIGNATURE.SMF',
  // Docs
  'README.md',
  'docs/skill-packaging.md',
  'docs/mcp-analysis.md',
];

function copy(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copy(path.join(src, child), path.join(dst, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

for (const entry of entries) {
  const src = path.join(root, entry);
  const dst = path.join(outDir, entry);
  if (!fs.existsSync(src)) {
    console.warn(`[WARN] Skip missing: ${entry}`);
    continue;
  }
  copy(src, dst);
  console.log(`[COPY] ${entry}`);
}

// Generate a manifest
const manifest = {
  name: 'sap-report-automation-workflow-skill',
  version: '1.0.0',
  builtAt: new Date().toISOString(),
  includes: {
    skillDocs: true,
    scripts: true,
    examples: true,
    nwRfcSdk: true,
    mcpAbapAdt: false, // fetched via git clone + npm install
  },
  postUnpack: [
    'git clone https://github.com/fr0ster/mcp-abap-adt.git',
    'cd mcp-abap-adt && npm install && npm run build',
    'cp .env.example .env && # edit with real SAP credentials',
    'node scripts/setup.js',
    'node scripts/healthcheck.js',
  ],
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('[GEN] manifest.json');

// Zip it up using PowerShell Compress-Archive
const ps = spawn('powershell.exe', [
  '-Command',
  `Compress-Archive -Path "${outDir}\*" -DestinationPath "${outZip}" -Force`,
], { stdio: 'inherit' });

ps.on('close', (code) => {
  if (code === 0) {
    const stats = fs.statSync(outZip);
    console.log(`\n[OK] Packaged: ${outZip}`);
    console.log(`     Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`     Contains NW-RFC-SDK + skill docs + scripts + examples`);
    console.log(`     Receiver still needs: git clone mcp-abap-adt + npm install + fill .env`);
  } else {
    console.error(`[ERR] Zip failed with code ${code}`);
    process.exit(1);
  }
});
