const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function exists(p) {
  return fs.existsSync(path.join(root, p));
}

function countFiles(p, ext) {
  const dir = path.join(root, p);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith(ext)).length;
}

function readStageGate() {
  const f = path.join(root, 'docs', 'stage-gate.md');
  if (!fs.existsSync(f)) return {};
  const text = fs.readFileSync(f, 'utf8');
  const map = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(S[0-9.]+)=(.+?):\s*(.+)$/);
    if (m) map[m[1]] = m[3].trim();
  }
  return map;
}

const gate = readStageGate();

const stages = [
  {
    id: 'S1',
    name: 'functional-spec-ready',
    check: () => exists('spec/functional-spec-ai.md') || countFiles('spec', '.md') > 0,
  },
  {
    id: 'S2',
    name: 'metadata-ready',
    check: () => countFiles('metadata/tables', '.json') > 0,
  },
  {
    id: 'S3',
    name: 'tech-design-ready',
    check: () => exists('docs/tech-design.md'),
  },
  {
    id: 'S3.5',
    name: 'fs-coverage-ready',
    check: () => exists('docs/fs-coverage.md'),
  },
  {
    id: 'S4',
    name: 'code-generated',
    check: () => {
      const srcDir = path.join(root, 'abap', 'sources');
      if (!fs.existsSync(srcDir)) return false;
      const dirs = fs.readdirSync(srcDir).filter(d => fs.statSync(path.join(srcDir, d)).isDirectory());
      return dirs.some(d => fs.readdirSync(path.join(srcDir, d)).some(f => f.endsWith('.abap')));
    },
  },
  {
    id: 'S5',
    name: 'activated',
    check: () => gate['S5'] === 'yes',
  },
];

console.log('=== SAP Report Automation Workflow Stage Check ===\n');

let allReady = true;
for (const s of stages) {
  const ok = s.check();
  const gateStatus = gate[s.id] || 'N/A';
  const symbol = ok ? '[OK]' : '[MISSING]';
  console.log(`${symbol} ${s.id}: ${s.name} (stage-gate: ${gateStatus})`);
  if (!ok) allReady = false;
}

console.log('\n' + (allReady ? 'All stages ready.' : 'Some stages are incomplete.'));
process.exit(allReady ? 0 : 1);
