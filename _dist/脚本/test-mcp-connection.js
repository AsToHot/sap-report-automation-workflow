const { spawn } = require('child_process');

const child = spawn('node', ['mcp-launcher.js', '--env-path=mcp-abap-adt/.env'], {
  cwd: __dirname
});

let state = 'init';
let timeout;

function done(success, msg) {
  clearTimeout(timeout);
  if (success) {
    console.log('\n[SAP CONNECTION TEST] PASSED');
    console.log(msg);
  } else {
    console.log('\n[SAP CONNECTION TEST] FAILED');
    console.log(msg);
  }
  child.kill();
  process.exit(success ? 0 : 1);
}

timeout = setTimeout(() => done(false, 'Timeout waiting for MCP response'), 30000);

child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1 && msg.result?.protocolVersion) {
        // Initialize OK
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
        // Call a SAP-connected tool
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'GetTableContents',
            arguments: { table_name: 'T000', max_rows: 1 }
          }
        }) + '\n');
      } else if (msg.id === 2) {
        if (msg.error) {
          done(false, JSON.stringify(msg.error, null, 2));
        } else if (msg.result?.content) {
          const text = msg.result.content.find(c => c.type === 'text')?.text || JSON.stringify(msg.result.content);
          if (text.includes('error') || text.includes('Error') || text.includes('exception')) {
            done(false, text);
          } else {
            done(true, text.substring(0, 500));
          }
        } else {
          done(false, 'Unexpected response: ' + JSON.stringify(msg.result));
        }
      }
    } catch (e) {
      // ignore non-JSON stdout
    }
  }
});

child.stderr.on('data', (data) => {
  const s = data.toString();
  if (s.includes('Connection') || s.includes('ERROR') || s.includes('exception')) {
    console.error('[SAP]', s.trim());
  }
});

// Send initialize
child.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  }
}) + '\n');
