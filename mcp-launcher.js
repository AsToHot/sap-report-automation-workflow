#!/usr/bin/env node
/**
 * MCP ABAP ADT Launcher Wrapper
 * Ensures SAP NW RFC SDK environment variables are set before loading native modules.
 * Forwards CLI arguments to mcp-abap-adt launcher.
 */

const path = require('node:path');

// SAP NW RFC SDK home directory
const sdkHome = path.resolve(__dirname, 'NW-RFC-SDK', 'nwrfcsdk');
const sdkLib = path.join(sdkHome, 'lib');

process.env.SAPNWRFC_HOME = sdkHome;

// Prepend SDK lib to PATH so native addon can find DLLs
const currentPath = process.env.PATH || '';
if (!currentPath.includes(sdkLib)) {
  process.env.PATH = sdkLib + path.delimiter + currentPath;
}

// Forward CLI args to launcher.js
const launcherPath = require.resolve('./mcp-abap-adt/dist/server/launcher.js');
process.argv = [process.argv[0], launcherPath, ...process.argv.slice(2)];
require(launcherPath);
