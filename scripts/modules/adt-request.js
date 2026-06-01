async function adtRequest(client, method, uri, opts = {}) {
  const headerFields = [];
  if (opts.headers) {
    for (const [name, value] of Object.entries(opts.headers)) {
      headerFields.push({ NAME: name, VALUE: value });
    }
  }
  const body = opts.data !== undefined && opts.data !== null ? String(opts.data) : "";
  if (body && !headerFields.some(h => h.NAME.toLowerCase() === "content-type")) {
    headerFields.push({ NAME: "Content-Type", VALUE: "text/plain; charset=utf-8" });
  }

  const result = await client.call("SADT_REST_RFC_ENDPOINT", {
    REQUEST: {
      REQUEST_LINE: { METHOD: method.toUpperCase(), URI: uri, VERSION: "HTTP/1.1" },
      HEADER_FIELDS: headerFields,
      MESSAGE_BODY: body ? Buffer.from(body, "utf-8") : Buffer.alloc(0),
    },
  });

  const resp = result.RESPONSE || result;
  const statusCode = parseInt(resp.STATUS_LINE?.STATUS_CODE || resp.STATUS_LINE?.CODE || "0", 10);
  const statusText = resp.STATUS_LINE?.REASON_PHRASE || resp.STATUS_LINE?.REASON || "";
  const respBody = resp.MESSAGE_BODY
    ? (Buffer.isBuffer(resp.MESSAGE_BODY) ? resp.MESSAGE_BODY.toString("utf-8") : String(resp.MESSAGE_BODY))
    : "";

  if (statusCode >= 400) {
    const err = new Error(`ADT ${method} ${uri} failed: ${statusCode} ${statusText}`);
    err.statusCode = statusCode;
    err.statusText = statusText;
    err.body = respBody;
    throw err;
  }
  return { statusCode, statusText, body: respBody, headers: resp.HEADER_FIELDS || [] };
}

module.exports = { adtRequest };
