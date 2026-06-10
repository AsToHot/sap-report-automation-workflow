const fs = require("fs");
const path = require("path");

/**
 * Load .env file and return key-value object.
 *
 * Profile support:
 *   loadEnv()           → .env (default)
 *   loadEnv(".env.data") → .env.data (companion profile, e.g. data system)
 *
 * The file name is just an identifier; it does NOT encode the client number.
 * Users name their profiles however they like (.env.dev, .env.test, .env.prd, …).
 */
function loadEnv(envPath) {
  const target = envPath
    ? (path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath))
    : path.resolve(process.cwd(), ".env");
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

/**
 * Build node-rfc connection parameters from env object.
 *
 * Hard rules:
 * - SAP_CLIENT, SAP_USERNAME, SAP_PASSWORD, SAP_URL are required; script MUST
 *   validate before calling this function — buildRfcParams does NOT supply
 *   defaults that mask missing configuration.
 * - SAP_SYSNR: if set in env, use it verbatim (no derivation). Only derive from
 *   SAP_URL port when SAP_SYSNR is absent.
 */
function buildRfcParams(env) {
  const url = env.SAP_URL || "";
  const urlMatch = url.match(/^(?:https?:\/\/)?([^:\/]+)(?::(\d+))?/);
  const ashost = urlMatch ? urlMatch[1] : "";
  const portStr = urlMatch ? urlMatch[2] : undefined;
  const port = portStr ? parseInt(portStr, 10) : undefined;

  // sysnr: explicit config always wins; derive from port only as fallback
  let sysnr;
  if (env.SAP_SYSNR !== undefined && env.SAP_SYSNR !== "") {
    sysnr = env.SAP_SYSNR;
  } else if (port !== undefined) {
    // standard SAP convention: HTTP port 80<sysnr>, RFC port 33<sysnr>
    sysnr = String(port).slice(-2);
  } else {
    sysnr = ""; // caller must validate
  }

  const params = {
    ashost,
    sysnr,
    client: (env.SAP_CLIENT || ""),
    user: (env.SAP_USERNAME || env.SAP_USER || ""),
    passwd: (env.SAP_PASSWORD || env.SAP_PASS || ""),
    lang: (env.SAP_LANGUAGE || "ZH"),
  };
  if (env.SAP_ROUTER) params.saprouter = env.SAP_ROUTER;

  return params;
}

/**
 * Validate that required RFC parameters are present (non-empty).
 * Returns { valid: boolean, missing: string[] }.
 */
function validateRfcParams(params) {
  const required = ["ashost", "sysnr", "client", "user", "passwd"];
  const missing = required.filter(k => !params[k]);
  return { valid: missing.length === 0, missing };
}

function getResponsibleUser(env) {
  return (env.SAP_USERNAME || env.SAP_USER || "").toUpperCase();
}

module.exports = { loadEnv, buildRfcParams, validateRfcParams, getResponsibleUser };
