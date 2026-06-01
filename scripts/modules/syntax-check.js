const { adtRequest } = require("./adt-request");

/**
 * Run ADT syntax check for a program or include.
 * ADT endpoint: POST /sap/bc/adt/programs/{type}/{name}/source/main?method=check
 * Must POST the source code as the body.
 */
async function syntaxCheck(client, name, type = "programs") {
  const lower = name.toLowerCase();
  const sourceUri = `/sap/bc/adt/programs/${type}/${lower}/source/main`;

  // 1. Fetch current source
  const srcResp = await adtRequest(client, "GET", sourceUri, {
    headers: { Accept: "text/plain" },
  });
  const source = srcResp.body;

  // 2. POST source for syntax check
  const checkUri = `${sourceUri}?method=check`;
  try {
    const resp = await adtRequest(client, "POST", checkUri, {
      data: source,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Accept: "application/xml",
      },
    });
    return parseSyntaxResult(resp.body);
  } catch (e) {
    if (e.statusCode === 405) {
      // Endpoint does not support standalone syntax check in this SAP version
      return { hasErrors: false, errors: [], unavailable: true, raw: e.body || "" };
    }
    throw e;
  }
}

function parseSyntaxResult(xml) {
  if (!xml || xml.trim().length === 0) {
    return { hasErrors: false, errors: [], raw: xml || "" };
  }

  const errors = [];

  // Format 1: <atom:entry> with category term="error" / "abapSyntaxError"
  const errorRegex = /<atom:entry[\s\S]*?<\/atom:entry>/g;
  let m;
  while ((m = errorRegex.exec(xml)) !== null) {
    const entry = m[0];
    const severityMatch = entry.match(/<atom:category[^>]*term="(\w+)"/);
    const severity = severityMatch ? severityMatch[1] : "unknown";
    const msgMatch = entry.match(/<atom:title[^>]*>([^<]*)<\/atom:title>/);
    const message = msgMatch ? msgMatch[1] : "";
    const lineMatch = entry.match(/line="(\d+)"/);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 0;

    if (severity === "error" || severity === "abapSyntaxError") {
      errors.push({ severity, message, line });
    }
  }

  // Format 2: <chkl:messages> with <msg type="E|A"> (same XML as activation)
  const msgRegex = /<msg\b[^>]*type="([EA])"[^>]*>([\s\S]*?)<\/msg>/g;
  while ((m = msgRegex.exec(xml)) !== null) {
    const msgBody = m[2];
    const txtMatch = msgBody.match(/<txt>([^<]*)<\/txt>/);
    const message = txtMatch ? txtMatch[1] : m[0].substring(0, 200);
    const lineMatch = msgBody.match(/line="(\d+)"/i);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 0;
    errors.push({ severity: "error", message, line });
  }

  // Format 3: <adtcore:message> or any XML element with severity="error"
  const adtMsgRegex = /<[a-zA-Z:]*message[^>]*severity\s*=\s*"error"[^>]*>([\s\S]*?)<\/[a-zA-Z:]*message>/gi;
  while ((m = adtMsgRegex.exec(xml)) !== null) {
    const msgBody = m[1];
    const txtMatch = msgBody.match(/<[a-zA-Z:]*text[^>]*>([^<]*)<\/[a-zA-Z:]*text>/i)
                  || msgBody.match(/<[a-zA-Z:]*title[^>]*>([^<]*)<\/[a-zA-Z:]*title>/i);
    const message = txtMatch ? txtMatch[1] : "Syntax error (severity=error)";
    const lineMatch = msgBody.match(/line=["'](\d+)["']/i);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 0;
    if (!errors.some(e => e.message === message && e.line === line)) {
      errors.push({ severity: "error", message, line });
    }
  }

  // Format 4: <abap:abapSyntaxError> elements
  const abapErrRegex = /<[a-zA-Z:]*abap\w*[Ss]yntax[Ee]rror[^>]*>([\s\S]*?)<\/[a-zA-Z:]*abap\w*[Ss]yntax[Ee]rror>/g;
  while ((m = abapErrRegex.exec(xml)) !== null) {
    const errBody = m[1];
    const txtMatch = errBody.match(/<[a-zA-Z:]*text[^>]*>([^<]*)<\/[a-zA-Z:]*text>/i)
                  || errBody.match(/<[a-zA-Z:]*title[^>]*>([^<]*)<\/[a-zA-Z:]*title>/i);
    const message = txtMatch ? txtMatch[1] : "ABAP syntax error";
    const lineMatch = errBody.match(/line=["'](\d+)["']/i);
    const line = lineMatch ? parseInt(lineMatch[1], 10) : 0;
    if (!errors.some(e => e.message === message && e.line === line)) {
      errors.push({ severity: "error", message, line });
    }
  }

  // Broad error fingerprint detection (catches formats we haven't seen yet):
  // Look for error indicators in the raw XML that regexes above may have missed
  const hasErrorFingerprint =
    /\bseverity\s*=\s*"(?:error|abap\w*)"|type\s*=\s*"[EA]"|abap\w*SyntaxError/gi.test(xml)
    || /<category\b[^>]*term\s*=\s*"error"/gi.test(xml)
    || /\berror\b/i.test(xml) && /\bseverity\b/i.test(xml)
    || /syntax.?error/i.test(xml)
    || /<err\b/i.test(xml);

  const hasErrors = errors.length > 0 || hasErrorFingerprint;

  return { hasErrors, errors, raw: xml };
}

module.exports = { syntaxCheck, parseSyntaxResult };
