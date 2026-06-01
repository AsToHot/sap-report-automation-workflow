const fs = require("fs");
const path = require("path");

function loadDeploymentConfig(progName) {
  const filePath = path.resolve(process.cwd(), "output", progName, "docs", "deployment-config.md");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment config not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");

  const config = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\|\s*目标包\s*\|\s*([^|]+)\s*\|/);
    if (m) config.packageName = m[1].trim();

    const m2 = line.match(/^\|\s*传输请求\s*\|\s*([^|]+)\s*\|/);
    if (m2) {
      const rawTr = m2[1].trim();
      config.transportRequest = (rawTr === '—' || rawTr === '-' || rawTr === '') ? undefined : rawTr;
    }

    const m3 = line.match(/^\|\s*程序描述\s*\|\s*([^|]+)\s*\|/);
    if (m3) config.description = m3[1].trim();
  }

  if (!config.packageName) {
    throw new Error(`Package name not found in ${filePath}`);
  }

  return config;
}

module.exports = { loadDeploymentConfig };
