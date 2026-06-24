const { adtRequest } = require("./adt-request");

async function activateObjects(client, objectNames) {
  const refs = objectNames.map((n) => {
    // {name, type} — type: 'P'=PROG/P (program), 'I'=PROG/I (include)
    const name = typeof n === "string" ? n : n.name;
    const objType = typeof n === "string" ? "P" : (n.type || "P");
    const lower = name.toLowerCase();
    const uri = objType === "I"
      ? `/sap/bc/adt/programs/includes/${lower}`
      : `/sap/bc/adt/programs/programs/${lower}`;
    return `<adtcore:objectReference adtcore:uri="${uri}" adtcore:name="${name}"/>`;
  }).join("\n  ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  ${refs}
</adtcore:objectReferences>`;

  const resp = await adtRequest(client, "POST", "/sap/bc/adt/activation?method=activate&preauditRequested=false", {
    data: xml,
    headers: {
      "Content-Type": "application/vnd.sap.adt.activation+xml",
      Accept: "application/xml",
    },
  });
  return parseActivationResult(resp.body);
}

function parseActivationResult(xml) {
  if (!xml || xml.trim().length === 0) {
    return { hasErrors: false, errors: [], raw: xml || "" };
  }

  const errors = [];

  // Format 1: <chkl:messages> with <msg type="E|A">
  const msgRegex = /<msg\b[^>]*type="([EA])"[^>]*>([\s\S]*?)<\/msg>/g;
  let m;
  while ((m = msgRegex.exec(xml)) !== null) {
    const msgBody = m[2];
    const objDescrMatch = msgBody.match(/objDescr="([^"]*)"/) || msgBody.match(/objName="([^"]*)"/);
    const objDescr = objDescrMatch ? objDescrMatch[1] : "unknown";
    const txtMatch = msgBody.match(/<txt>([^<]*)<\/txt>/);
    const message = txtMatch ? txtMatch[1] : m[0].substring(0, 200);
    errors.push({ name: objDescr, message });
  }

  // Format 2: <atom:entry> with category term="error"
  const entryRegex = /<atom:entry[\s\S]*?<\/atom:entry>/g;
  while ((m = entryRegex.exec(xml)) !== null) {
    const entry = m[0];
    const severityMatch = entry.match(/term="(error|abapSyntaxError)"/);
    if (severityMatch) {
      const titleMatch = entry.match(/<atom:title[^>]*>([^<]*)<\/atom:title>/);
      const nameMatch = entry.match(/name="([^"]*)"/);
      errors.push({
        name: nameMatch ? nameMatch[1] : "unknown",
        message: titleMatch ? titleMatch[1] : "Activation error",
      });
    }
  }

  // Format 3: simple <entry> tags (legacy)
  const simpleEntryRegex = /<entry[\s\S]*?<\/entry>/g;
  while ((m = simpleEntryRegex.exec(xml)) !== null) {
    const entry = m[0];
    const success = entry.includes('success="true"');
    const nameMatch = entry.match(/name="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : "unknown";
    if (!success) {
      const msgMatch = entry.match(/<title[^>]*>([^<]*)<\/title>/);
      if (msgMatch) {
        errors.push({ name, message: msgMatch[1] });
      } else if (entry.includes("error") || entry.includes("fail")) {
        errors.push({ name, message: "Activation failed (legacy entry)" });
      }
    }
  }

  // Format 4: <adtcore:message> with severity="error"
  const adtMsgRegex = /<[a-zA-Z:]*message[^>]*severity\s*=\s*"error"[^>]*>([\s\S]*?)<\/[a-zA-Z:]*message>/gi;
  let m2;
  while ((m2 = adtMsgRegex.exec(xml)) !== null) {
    const msgBody = m2[1];
    const nameMatch = msgBody.match(/obj(?:Name|Descr)="([^"]*)"/i)
                   || msgBody.match(/name="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : "unknown";
    const txtMatch = msgBody.match(/<[a-zA-Z:]*text[^>]*>([^<]*)<\/[a-zA-Z:]*text>/i)
                  || msgBody.match(/<[a-zA-Z:]*title[^>]*>([^<]*)<\/[a-zA-Z:]*title>/i)
                  || msgBody.match(/<[a-zA-Z:]*message[^>]*>([^<]*)<\/[a-zA-Z:]*message>/i);
    const message = txtMatch ? txtMatch[1] : "Activation error (severity=error)";
    if (!errors.some(e => e.name === name && e.message === message)) {
      errors.push({ name, message });
    }
  }

  // Deduplicate by key
  const seen = new Set();
  const uniqueErrors = [];
  for (const err of errors) {
    const key = `${err.name}|${err.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueErrors.push(err);
    }
  }

  // Broad error fingerprint detection
  const hasErrorFingerprint =
    /\btype\s*=\s*"[EA]"/.test(xml)
    || /\bseverity\s*=\s*"error"/i.test(xml)
    || /abap\w*SyntaxError/i.test(xml)
    || /returncode\s*[><]\s*0/i.test(xml)
    || /<err\b/i.test(xml);

  const hasErrors = uniqueErrors.length > 0 || hasErrorFingerprint;

  return { hasErrors, errors: uniqueErrors, raw: xml };
}

module.exports = { activateObjects, parseActivationResult };
