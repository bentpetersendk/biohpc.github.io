(function () {
  const approvalConfig = siteConfig?.approvals || {};
  const requestTypes = approvalConfig.requestTypes || {};
  const messages = approvalConfig.messages || {};

  const state = {
    requestType: null,
    token: "",
    request: null,
    lookupInFlight: false,
    submitInFlight: false,
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", initApprovalPage);

  function initApprovalPage() {
    cacheElements();
    bindEvents();

    const params = new URLSearchParams(window.location.search);
    const requestType = params.get("type");
    const token = params.get("token");
    const requestDefinition = requestType && requestTypes[requestType];

    if (!requestDefinition || !isPresent(token)) {
      renderTerminalState("invalid", messages.invalidLink || "Invalid approval link.");
      return;
    }

    state.requestType = requestType;
    state.token = token.trim();
    updateCardHeading(requestDefinition.label, "Retrieving request...");
    lookupRequest();
  }

  function cacheElements() {
    elements.title = document.getElementById("approval-title");
    elements.subtitle = document.getElementById("approval-subtitle");
    elements.feedback = document.getElementById("approval-feedback");
    elements.details = document.getElementById("approval-details");
    elements.actions = document.getElementById("approval-actions");
    elements.approveButton = document.getElementById("approve-button");
    elements.rejectToggleButton = document.getElementById("reject-toggle-button");
    elements.rejectForm = document.getElementById("reject-form");
    elements.rejectReason = document.getElementById("reject-reason");
    elements.rejectButton = document.getElementById("reject-button");
    elements.rejectCancelButton = document.getElementById("reject-cancel-button");
    elements.retry = document.getElementById("approval-retry");
    elements.retryButton = document.getElementById("retry-button");
  }

  function bindEvents() {
    elements.approveButton?.addEventListener("click", () => submitDecision("approve"));
    elements.rejectToggleButton?.addEventListener("click", showRejectForm);
    elements.rejectCancelButton?.addEventListener("click", hideRejectForm);
    elements.retryButton?.addEventListener("click", () => {
      if (state.request) {
        submitDecision(null, true);
        return;
      }

      lookupRequest();
    });

    elements.rejectForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitDecision("reject");
    });
  }

  async function lookupRequest() {
    if (state.lookupInFlight) return;

    const endpoint = approvalConfig?.endpoints?.lookup;
    if (!isPresent(endpoint)) {
      renderError(
        "Configuration missing. Add `siteConfig.approvals.endpoints.lookup` before deploying this page.",
        false
      );
      return;
    }

    state.lookupInFlight = true;
    hideRetry();
    setFeedback("Retrieving request...", "default");
    setButtonsDisabled(true);
    hideRejectForm();

    try {
      const requestDefinition = requestTypes[state.requestType];
      const response = await fetchJson(endpoint, {
        type: requestDefinition.lookupPayloadType,
        token: state.token,
        action: "lookup",
      });

      handleLookupResponse(response);
    } catch (error) {
      renderError(messages.requestUnavailable || "We could not retrieve this approval request right now.", true);
    } finally {
      state.lookupInFlight = false;
    }
  }

  function handleLookupResponse(response) {
    const status = normalizeStatus(response?.status);
    const request = response?.request;

    if (status === "invalid") {
      renderTerminalState("invalid", messages.invalidLink || "Invalid approval link.");
      return;
    }

    if (status === "expired") {
      renderTerminalState("expired", messages.expiredLink || "This approval link has expired.");
      return;
    }

    if (!request) {
      renderError(messages.requestUnavailable || "We could not retrieve this approval request right now.", true);
      return;
    }

    state.request = request;
    state.request.status = status;
    updateCardHeading(request.title || requestTypes[state.requestType].label, request.subtitle || "Review the request below.");
    renderDetails(request);

    if (status === "approved" || status === "rejected") {
      renderProcessedState(status, request);
      return;
    }

    if (status !== "pending") {
      renderError("Unknown server response.", true);
      return;
    }

    showPendingState(request);
  }

  function showPendingState(request) {
    setFeedback(request.statusMessage || "Status: Pending Approval", "default");
    elements.actions.hidden = false;
    elements.details.hidden = false;
    hideRetry();
    setButtonsDisabled(false);
  }

  async function submitDecision(decision, isRetry) {
    if (state.submitInFlight || !state.request) return;

    const endpoint = approvalConfig?.endpoints?.decision;
    if (!isPresent(endpoint)) {
      renderError(
        "Configuration missing. Add `siteConfig.approvals.endpoints.decision` before deploying this page.",
        false
      );
      return;
    }

    const requestedDecision = isRetry ? state.request.lastAttemptedDecision : decision;
    if (!requestedDecision) return;

    state.submitInFlight = true;
    hideRetry();
    state.request.lastAttemptedDecision = requestedDecision;

    const activeButton = requestedDecision === "approve" ? elements.approveButton : elements.rejectButton;
    setButtonBusy(activeButton, true);
    setButtonsDisabled(true);
    setFeedback("Processing...", "default");

    try {
      const requestDefinition = requestTypes[state.requestType];
      const response = await fetchJson(endpoint, {
        type: requestDefinition.decisionPayloadType,
        token: state.token,
        decision: requestedDecision,
        reason: requestedDecision === "reject" ? elements.rejectReason.value.trim() : "",
      });

      handleDecisionResponse(response, requestedDecision);
    } catch (error) {
      renderError(messages.decisionUnavailable || "We could not submit your decision right now.", true);
    } finally {
      setButtonBusy(activeButton, false);
      state.submitInFlight = false;
    }
  }

  function handleDecisionResponse(response, fallbackDecision) {
    const status = normalizeStatus(response?.status);
    const request = response?.request || state.request;

    if (status === "invalid") {
      renderTerminalState("invalid", messages.invalidLink || "Invalid approval link.");
      return;
    }

    if (status === "expired") {
      renderTerminalState("expired", messages.expiredLink || "This approval link has expired.");
      return;
    }

    if (status === "approved" || status === "rejected") {
      state.request = request;
      state.request.status = status;
      updateCardHeading(request.title || requestTypes[state.requestType].label, request.subtitle || "Request processed.");
      renderDetails(request);
      renderProcessedState(status, request, fallbackDecision === status);
      return;
    }

    renderError("Unknown server response.", true);
  }

  function renderDetails(request) {
    const fields = [
      ["User", request.userName],
      ["Project", request.projectName],
      ["Principal Investigator", request.principalInvestigator],
      ["Technical Contact", request.technicalContact],
      ["Status", request.statusLabel || request.status],
    ].filter((field) => isPresent(field[1]));

    elements.details.innerHTML = fields
      .map(
        ([label, value]) =>
          `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`
      )
      .join("");
    elements.details.hidden = false;
  }

  function renderProcessedState(status, request, justProcessed) {
    elements.actions.hidden = true;
    hideRejectForm();
    setButtonsDisabled(true);
    hideRetry();

    const actor = request.processedBy || request.approvedBy || request.rejectedBy;
    const date = request.processedAt || request.approvalDate || request.rejectionDate;
    const normalizedDate = formatDisplayDate(date);
    const resultWord = status === "approved" ? "approved" : "rejected";
    const intro = justProcessed
      ? `This request has been ${resultWord}.`
      : `${messages.processedPrefix || "This request has already been"} ${resultWord}.`;
    const metaLines = [];

    if (isPresent(actor)) metaLines.push(`${status === "approved" ? "Approved" : "Rejected"} by: ${actor}`);
    if (isPresent(normalizedDate)) metaLines.push(normalizedDate);
    if (status === "rejected" && isPresent(request.rejectionReason)) {
      metaLines.push(`Reason: ${request.rejectionReason}`);
    }
    metaLines.push(messages.noFurtherAction || "No further action is required.");

    setFeedback(
      [status === "approved" ? "Approved" : "Rejected", intro],
      status === "approved" ? "success" : "warning",
      metaLines
    );
  }

  function renderTerminalState(kind, message) {
    const requestLabel = state.requestType && requestTypes[state.requestType]
      ? requestTypes[state.requestType].label
      : "Approval request";
    updateCardHeading(requestLabel, "Review unavailable");
    elements.details.hidden = true;
    elements.actions.hidden = true;
    hideRejectForm();
    hideRetry();
    setButtonsDisabled(true);
    setFeedback(message, kind === "expired" ? "warning" : "error");
  }

  function renderError(message, allowRetry) {
    const hasPendingRequest = Boolean(state.request) && normalizeStatus(state.request.status) === "pending";
    elements.actions.hidden = !hasPendingRequest;
    setButtonsDisabled(!hasPendingRequest);
    if (!hasPendingRequest) {
      hideRejectForm();
    }
    setFeedback(message, "error");
    if (allowRetry) {
      elements.retry.hidden = false;
    } else {
      hideRetry();
    }
  }

  function updateCardHeading(title, subtitle) {
    if (elements.title) elements.title.textContent = title;
    if (elements.subtitle) elements.subtitle.textContent = subtitle;
  }

  function setFeedback(message, tone, metaLines) {
    elements.feedback.className = "approval-feedback";
    if (tone === "success") elements.feedback.classList.add("is-success");
    if (tone === "error") elements.feedback.classList.add("is-error");
    if (tone === "warning") elements.feedback.classList.add("is-warning");

    const lines = Array.isArray(message) ? message : [message];
    const fragments = lines.map((line) => `<p>${escapeHtml(line)}</p>`);
    if (Array.isArray(metaLines) && metaLines.length > 0) {
      fragments.push(
        `<div class="approval-meta">${metaLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>`
      );
    }
    elements.feedback.innerHTML = fragments.join("");
  }

  function showRejectForm() {
    elements.rejectForm.hidden = false;
    elements.actions.hidden = true;
    elements.rejectReason.focus();
  }

  function hideRejectForm() {
    elements.rejectForm.hidden = true;
    if (!state.submitInFlight && state.request && normalizeStatus(state.request.status) === "pending") {
      elements.actions.hidden = false;
    }
  }

  function setButtonsDisabled(disabled) {
    [elements.approveButton, elements.rejectToggleButton, elements.rejectButton, elements.rejectCancelButton]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = disabled;
      });
  }

  function setButtonBusy(button, isBusy) {
    if (!button) return;
    button.classList.toggle("is-busy", isBusy);
    button.setAttribute("aria-busy", isBusy ? "true" : "false");
  }

  function hideRetry() {
    elements.retry.hidden = true;
  }

  async function fetchJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return response.json();
  }

  function normalizeStatus(status) {
    return String(status || "").trim().toLowerCase();
  }

  function formatDisplayDate(value) {
    if (!isPresent(value)) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function isPresent(value) {
    return typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined;
  }
})();
