const path = require('path');

// Set SAP NW RFC SDK environment before loading native module
const sdkHome = path.resolve(__dirname, 'NW-RFC-SDK', 'nwrfcsdk');
const sdkLib = path.join(sdkHome, 'lib');
process.env.SAPNWRFC_HOME = sdkHome;
process.env.PATH = sdkLib + path.delimiter + process.env.PATH;

const { Client } = require('./mcp-abap-adt/node_modules/node-rfc');

const client = new Client({
  ashost: '10.32.21.11',
  sysnr: '00',
  client: '200',
  user: 'ITL12',
  passwd: '12345Qwert!',
  lang: 'ZH',
  saprouter: '/H/210.75.21.252'
});

console.log('Testing RFC connection...');

client.connect()
  .then(() => {
    console.log('RFC connect: OK');
    return client.call('RFC_PING', {});
  })
  .then(() => {
    console.log('RFC_PING: OK');
    return client.close();
  })
  .then(() => {
    console.log('Connection test passed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection test failed:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  });
