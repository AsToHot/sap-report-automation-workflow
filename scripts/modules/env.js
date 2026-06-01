const fs = require("fs");
const path = require("path");

function loadEnv(envPath) {
  const target = envPath || path.resolve(process.cwd(), ".env");
  const env = {};
  if (fs.existsSync(target)) {
    const raw = fs.readFileSync(target, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

function buildRfcParams(env) {
  const url = env.SAP_URL || "";
  const urlMatch = url.match(/^(?:https?:\/\/)?([^:\/]+)(?::(\d+))?/);
  const ashost = urlMatch ? urlMatch[1] : "";
  const port = urlMatch ? parseInt(urlMatch[2] || "8000", 10) : 8000;
  const sysnr = env.SAP_SYSNR || String(port).slice(-2);

  const params = {
    ashost,
    sysnr,
    client: env.SAP_CLIENT || "200",
    user: env.SAP_USERNAME || env.SAP_USER || "",
    passwd: env.SAP_PASSWORD || env.SAP_PASS || "",
    lang: env.SAP_LANGUAGE || "ZH",
  };
  if (env.SAP_ROUTER) params.saprouter = env.SAP_ROUTER;

  return params;
}

function getResponsibleUser(env) {
  return (env.SAP_USERNAME || env.SAP_USER || "").toUpperCase();
}

module.exports = { loadEnv, buildRfcParams, getResponsibleUser };
