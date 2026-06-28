const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

const DEFAULT_CORS_ORIGINS = [
  "https://biohpc.dk",
  "https://www.biohpc.dk",
];

const REQUEST_TYPES = {
  membership: {
    label: "Project Membership Request",
    tableId: "tblNB3tT1jmDj4C1p",
    statuses: {
      pending: "Pending PI Approval",
      approved: ["Approved - Pending Provisioning", "Active"],
      rejected: "Rejected",
    },
    decisions: {
      approve: "Approve",
      reject: "Reject",
    },
    fields: {
      approvalToken: "Approval Token",
      status: "Status",
      piDecision: "PI Decision",
      processedBy: "Processed By",
      processedAt: "Processed At",
      approvalDate: "Approval Date",
      rejectedReason: "Rejected Reason",
      decisionSource: "Decision Source",
      fullName: "Full Name (from User)",
      project: "Project",
      piLookup: "PI",
      notificationNames: "Notification Recipient Names (from Project Space)",
      source: "Source",
    },
  },
};

export async function handleRoot(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, request);
  }

  return jsonResponse(
    {
      ok: true,
      service: "biohpc-approval-api",
      endpoints: ["/lookup", "/decision"],
    },
    200,
    request
  );
}

export async function handleLookup(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, request);
  }

  try {
    const payload = await parseJson(request);
    validateLookupPayload(payload);

    const requestConfig = getRequestConfig(payload.type);
    const match = await findRecordByToken(
      requestConfig,
      normalizeToken(payload.token)
    );

    if (!match.record || !isEligibleSource(match.record, requestConfig)) {
      return jsonResponse({ status: "invalid" }, 200, request);
    }

    return jsonResponse(buildLookupResponse(match.record, requestConfig), 200, request);
  } catch (error) {
    return handleError(error, request);
  }
}

export async function handleDecision(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, request);
  }

  try {
    const payload = await parseJson(request);
    validateDecisionPayload(payload);

    const requestConfig = getRequestConfig(payload.type);
    const token = normalizeToken(payload.token);
    const decision = payload.decision.trim().toLowerCase();
    const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
    const match = await findRecordByToken(requestConfig, token);

    if (!match.record || !isEligibleSource(match.record, requestConfig)) {
      return jsonResponse({ status: "invalid" }, 200, request);
    }

    const currentStatus = getFieldValue(match.record, requestConfig.fields.status);
    if (isApprovedStatus(requestConfig, currentStatus) || isRejectedStatus(requestConfig, currentStatus)) {
      return jsonResponse(buildLookupResponse(match.record, requestConfig), 200, request);
    }

    if (!isPendingStatus(requestConfig, currentStatus)) {
      throw new HttpError(409, "Request is not in a pending state.");
    }

    const approver = deriveApproverLabel(match.record);
    const nowIso = new Date().toISOString();
    const updates = {
      [requestConfig.fields.piDecision]: requestConfig.decisions[decision],
      [requestConfig.fields.processedBy]: approver,
      [requestConfig.fields.processedAt]: nowIso,
      [requestConfig.fields.approvalDate]: nowIso.slice(0, 10),
      [requestConfig.fields.decisionSource]: "biohpc-approve-page",
    };

    if (decision === "approve") {
      updates[requestConfig.fields.status] = requestConfig.statuses.approved[0];
      updates[requestConfig.fields.rejectedReason] = "";
    } else {
      updates[requestConfig.fields.status] = requestConfig.statuses.rejected;
      updates[requestConfig.fields.rejectedReason] = reason;
    }

    await updateRecord(requestConfig, match.record.id, updates);
    const refreshed = await getRecordById(requestConfig, match.record.id);
    return jsonResponse(buildLookupResponse(refreshed.record, requestConfig), 200, request);
  } catch (error) {
    return handleError(error, request);
  }
}

function validateLookupPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Request body must be JSON.");
  }
  if (!payload.type || !payload.token || payload.action !== "lookup") {
    throw new HttpError(400, "Lookup payload is invalid.");
  }
}

function validateDecisionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Request body must be JSON.");
  }
  if (!payload.type || !payload.token) {
    throw new HttpError(400, "Decision payload is invalid.");
  }
  const decision = typeof payload.decision === "string" ? payload.decision.trim().toLowerCase() : "";
  if (decision !== "approve" && decision !== "reject") {
    throw new HttpError(400, "Decision must be approve or reject.");
  }
}

function getRequestConfig(type) {
  const config = REQUEST_TYPES[type];
  if (!config) throw new HttpError(400, "Unsupported approval type.");
  return config;
}

function normalizeToken(token) {
  const normalized = String(token || "").trim();
  if (!normalized) throw new HttpError(400, "Approval token is required.");
  return normalized;
}

async function findRecordByToken(requestConfig, token) {
  const formula = `{${requestConfig.fields.approvalToken}} = "${escapeFormulaValue(token)}"`;
  const data = await airtableRequest(
    requestConfig.tableId,
    "GET",
    null,
    { filterByFormula: formula, maxRecords: "2" }
  );

  if (!Array.isArray(data.records) || data.records.length === 0) {
    return { record: null };
  }

  if (data.records.length > 1) {
    throw new HttpError(409, "Approval token is not unique.");
  }

  return { record: data.records[0] };
}

async function updateRecord(requestConfig, recordId, fields) {
  return airtableRequest(`${requestConfig.tableId}/${recordId}`, "PATCH", { fields });
}

async function getRecordById(requestConfig, recordId) {
  const record = await airtableRequest(`${requestConfig.tableId}/${recordId}`, "GET");
  return { record };
}

function isEligibleSource(record, requestConfig) {
  return getFieldValue(record, requestConfig.fields.source) === "User Form";
}

function buildLookupResponse(record, requestConfig) {
  const statusName = getFieldValue(record, requestConfig.fields.status);
  const status = classifyStatus(requestConfig, statusName);
  const reason = getFieldValue(record, requestConfig.fields.rejectedReason);

  return {
    status,
    request: {
      title: requestConfig.label,
      subtitle: "Review the request below.",
      userName: firstValue(getFieldValue(record, requestConfig.fields.fullName)),
      projectName: firstValue(getFieldValue(record, requestConfig.fields.project)),
      principalInvestigator: derivePiLabel(record, requestConfig),
      technicalContact: deriveTechnicalContact(record, requestConfig),
      status,
      statusLabel: buildStatusLabel(statusName, status),
      processedBy: getFieldValue(record, requestConfig.fields.processedBy),
      processedAt:
        getFieldValue(record, requestConfig.fields.processedAt) ||
        getFieldValue(record, requestConfig.fields.approvalDate),
      rejectionReason: reason,
      reason,
    },
  };
}

function deriveApproverLabel(record) {
  const override = (process.env.APPROVAL_PROCESSED_BY_LABEL || "").trim();
  if (override) return override;

  const requestConfig = REQUEST_TYPES.membership;
  const technicalContact = deriveTechnicalContact(record, requestConfig);
  const principalInvestigator = derivePiLabel(record, requestConfig);

  if (technicalContact && principalInvestigator) {
    return `${principalInvestigator} / ${technicalContact} via approval link`;
  }
  if (principalInvestigator) {
    return `${principalInvestigator} via approval link`;
  }
  return "PI/Technical Contact via approval link";
}

function derivePiLabel(record, requestConfig) {
  const pi = firstValue(getFieldValue(record, requestConfig.fields.piLookup));
  const recipientNames = firstValue(getFieldValue(record, requestConfig.fields.notificationNames));
  if (pi) return pi;
  if (recipientNames) return String(recipientNames).split(" and ")[0].trim();
  return "";
}

function deriveTechnicalContact(record, requestConfig) {
  const recipientNames = firstValue(getFieldValue(record, requestConfig.fields.notificationNames));
  if (!recipientNames || !String(recipientNames).includes(" and ")) return "";
  return String(recipientNames).split(" and ").slice(1).join(" and ").trim();
}

function buildStatusLabel(statusName, status) {
  if (status === "pending") return "Pending Approval";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return statusName || "";
}

function classifyStatus(requestConfig, statusName) {
  if (isPendingStatus(requestConfig, statusName)) return "pending";
  if (isApprovedStatus(requestConfig, statusName)) return "approved";
  if (isRejectedStatus(requestConfig, statusName)) return "rejected";
  return "invalid";
}

function isPendingStatus(requestConfig, statusName) {
  return statusName === requestConfig.statuses.pending;
}

function isApprovedStatus(requestConfig, statusName) {
  return requestConfig.statuses.approved.includes(statusName);
}

function isRejectedStatus(requestConfig, statusName) {
  return statusName === requestConfig.statuses.rejected;
}

async function airtableRequest(path, method, body, query = {}) {
  const baseId = requiredEnv("AIRTABLE_BASE_ID");
  const token = requiredEnv("AIRTABLE_TOKEN");
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  url.searchParams.set("cellFormat", "string");
  url.searchParams.set("timeZone", process.env.AIRTABLE_TIME_ZONE || "Europe/Copenhagen");
  url.searchParams.set("userLocale", process.env.AIRTABLE_USER_LOCALE || "en-gb");

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : {};

  if (!response.ok) {
    const detail = data?.error?.message || text || "Airtable request failed.";
    throw new HttpError(response.status, detail);
  }

  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function getFieldValue(record, fieldName) {
  return record?.fields?.[fieldName];
}

function firstValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function escapeFormulaValue(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function requiredEnv(key) {
  const value = process.env[key];
  if (!value) throw new HttpError(500, `Missing required environment variable: ${key}`);
  return value;
}

function jsonResponse(payload, status, request) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request),
    },
  });
}

function corsHeaders(request) {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = configured.length > 0 ? configured : DEFAULT_CORS_ORIGINS;
  const origin = request.headers.get("origin");
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function handleError(error, request) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : "Unexpected server error.";
  return jsonResponse({ error: message }, status, request);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
