const { spawn } = require('child_process');
const path = require('path');

const launcherPath = path.resolve(__dirname, '..', 'mcp-launcher.js');

const child = spawn('node', [launcherPath], {
  cwd: path.resolve(__dirname, '..')
});

let state = 'init';
let timeout = setTimeout(() => {
  console.error('[HEALTHCHECK] Timeout');
  child.kill();
  process.exit(1);
}, 15000);

function finish(ok, msg) {
  clearTimeout(timeout);
  console.log(ok ? '[HEALTHCHECK] OK' : '[HEALTHCHECK] FAIL');
  console.log(msg);
  child.kill();
  process.exit(ok ? 0 : 1);
}

child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1 && msg.result?.protocolVersion) {
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0', id: 2, method: 'tools/call',
          params: { name: 'GetTableContents', arguments: { table_name: 'T000', max_rows: 1 } }
        }) + '\n');
      } else if (msg.id === 2) {
        if (msg.error) {
          finish(false, msg.error.message || JSON.stringify(msg.error));
        } else {
          finish(true, 'SAP RFC connection working. T000 schema returned.');
        }
      }
    } catch (e) {
      // ignore non-JSON
    }
  }
});

child.stderr.on('data', (data) => {
  const s = data.toString();
  if (s.includes('RFC_COMMUNICATION_FAILURE') || s.includes('Connection timed out')) {
    finish(false, s.trim());
  }
});

child.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'healthcheck', version: '1.0.0' }
  }
}) + '\n');
