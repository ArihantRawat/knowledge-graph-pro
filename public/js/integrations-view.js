import { saveIntegrationConfig } from "./api.js";
import { hasBackend, isLikelyStaticHost, resolveApiUrl } from "./config.js";
import { elements } from "./dom.js";
import { state } from "./state.js";
import { setStatus } from "./status.js";
import { escapeHtml } from "./utils.js";

export function renderIntegrationsView({ refreshAppConfig }) {
  renderIntegrationSummary();
  renderIntegrationGrid(refreshAppConfig);
  renderIntegrationDetail(refreshAppConfig);
}

function renderIntegrationSummary() {
  const live = state.appConfig.integrations.filter((entry) => entry.liveSupported);
  const connected = state.appConfig.integrations.filter((entry) => entry.authenticated);
  const ready = state.appConfig.integrations.filter((entry) => entry.liveSupported && entry.configured);
  const needsSetup = live.filter((entry) => !entry.configured);

  elements.integrationSummary.innerHTML = `
    <div class="summary-stat">
      <strong>${connected.length}</strong>
      <span>Connected now</span>
    </div>
    <div class="summary-stat">
      <strong>${ready.length}</strong>
      <span>Configured connectors</span>
    </div>
    <div class="summary-stat">
      <strong>${needsSetup.length}</strong>
      <span>Need credentials</span>
    </div>
  `;
}

function renderIntegrationGrid(refreshAppConfig) {
  elements.integrationGrid.innerHTML = state.appConfig.integrations
    .map((integration) => {
      const status = integrationStatus(integration);
      const actionLabel = integration.authenticated
        ? "Connected"
        : integration.liveSupported
          ? "Integrate now"
          : "Planned connector";

      return `
        <article
          class="integration-card ${integration.id === state.selectedIntegrationId ? "is-selected" : ""}"
          data-select-integration="${escapeHtml(integration.id)}"
          tabindex="0"
          role="button"
          aria-label="Open ${escapeHtml(integration.label)} setup"
        >
          <div class="integration-card-head">
            <span class="integration-category">${escapeHtml(integration.category || "Integration")}</span>
            <span class="integration-status integration-status--${status.tone}">${escapeHtml(status.label)}</span>
          </div>
          <h3>${escapeHtml(integration.label)}</h3>
          <p>${escapeHtml(integration.description)}</p>
          <div class="integration-tags">
            ${(integration.dataPoints || [])
              .map((point) => `<span class="detail-pill">${escapeHtml(point)}</span>`)
              .join("")}
          </div>
          <div class="integration-card-foot">
            <span class="integration-action-hint">Select to configure</span>
            <span class="integration-action-chip">${escapeHtml(actionLabel)}</span>
          </div>
        </article>
      `;
    })
    .join("");

  for (const card of elements.integrationGrid.querySelectorAll("[data-select-integration]")) {
    card.addEventListener("click", () => {
      state.selectedIntegrationId = card.dataset.selectIntegration;
      renderIntegrationsView({ refreshAppConfig });
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      state.selectedIntegrationId = card.dataset.selectIntegration;
      renderIntegrationsView({ refreshAppConfig });
    });
  }
}

function renderIntegrationDetail(refreshAppConfig) {
  const integration = integrationById(state.selectedIntegrationId) || state.appConfig.integrations[0];
  if (!integration) {
    elements.integrationDetail.innerHTML = "<p>No integration is selected.</p>";
    return;
  }

  const status = integrationStatus(integration);
  const isLive = integration.liveSupported;
  const canConnect = hasBackend && isLive && (integration.configured || integration.authenticated);
  const connectDisabled = isLive ? !canConnect : false;
  const connectLabel = isLive
    ? integration.authenticated
      ? `Reconnect ${integration.label}`
      : `Connect ${integration.label}`
    : `Integrate ${integration.label}`;
  const redirectUri =
    integration.redirectUri || `${state.appConfig.appOrigin || window.location.origin}/auth/${integration.id}/callback`;
  const connectedUser = integration.user?.name || integration.user?.team || integration.user?.siteName || "";
  const pagesPreviewMode = !hasBackend && isLikelyStaticHost();
  const integrationCopy = isLive
    ? pagesPreviewMode
      ? "GitHub Pages is running in preview mode. Add your backend URL in runtime-config.js to enable credential saving and OAuth for this source."
      : "Save credentials, then connect this source to pull live collaboration signals."
    : "This connector is in the roadmap. You can still include it in demo mode while we ship live API support.";
  const setupNote = pagesPreviewMode
    ? "Preview mode is active. Live setup is disabled until a backend API base URL is configured."
    : "Connect is enabled after credentials are saved.";

  elements.integrationDetail.innerHTML = `
    <div class="fade-in integration-detail-copy">
      <div class="integration-detail-head">
        <div>
          <h3>${escapeHtml(integration.label)}</h3>
          <p>${escapeHtml(integration.description)}</p>
        </div>
        <span class="integration-status integration-status--${status.tone}">${escapeHtml(status.label)}</span>
      </div>

      <div class="detail-list">
        <div><strong>Source category:</strong> ${escapeHtml(integration.category || "Integration")}</div>
        <div><strong>Data added:</strong> ${(integration.dataPoints || []).join(", ")}</div>
        <div><strong>Connected account:</strong> ${escapeHtml(connectedUser || "Not connected yet")}</div>
        <div><strong>Setup notes:</strong> ${escapeHtml(integrationCopy)}</div>
      </div>

      <div class="integration-tags">
        ${(integration.dataPoints || [])
          .map((point) => `<span class="detail-pill">${escapeHtml(point)}</span>`)
          .join("")}
      </div>

      <div class="integration-actions">
        <button
          type="button"
          class="primary-button"
          data-connect-source="${escapeHtml(integration.id)}"
          ${connectDisabled ? "disabled" : ""}
        >
          ${escapeHtml(connectLabel)}
        </button>
        <button type="button" class="secondary-button" data-toggle-config="true">Configure ${escapeHtml(
          integration.label
        )}</button>
      </div>

      <form id="integrationConfigForm" class="setup-card">
        <div class="setup-grid">
          <label class="setup-field">
            <span>Client ID</span>
            <input id="integrationClientId" name="clientId" type="text" autocomplete="off" ${!hasBackend ? "disabled" : ""} />
          </label>
          <label class="setup-field">
            <span>Client Secret</span>
            <input id="integrationClientSecret" name="clientSecret" type="password" autocomplete="off" ${
              !hasBackend ? "disabled" : ""
            } />
          </label>
          <label class="setup-field setup-field--full">
            <span>Redirect URI</span>
            <input id="integrationRedirectUri" name="redirectUri" type="text" value="${escapeHtml(redirectUri)}" ${
              !hasBackend ? "disabled" : ""
            } />
          </label>
        </div>
        <p class="setup-note">${escapeHtml(setupNote)}</p>
        <div class="integration-actions">
          <button type="submit" class="secondary-button" ${!hasBackend ? "disabled" : ""}>Save Credentials</button>
        </div>
      </form>
    </div>
  `;

  const form = elements.integrationDetail.querySelector("#integrationConfigForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!hasBackend) {
        setStatus("Static mode cannot save credentials. Point runtime-config.js to your backend first.", "warning");
        return;
      }

      const clientId = elements.integrationDetail.querySelector("#integrationClientId").value;
      const clientSecret = elements.integrationDetail.querySelector("#integrationClientSecret").value;
      const redirectValue = elements.integrationDetail.querySelector("#integrationRedirectUri").value;

      try {
        setStatus(`Saving ${integration.label} credentials...`, "setup");
        await saveIntegrationConfig(integration.id, {
          clientId,
          clientSecret,
          redirectUri: redirectValue
        });
        await refreshAppConfig();
        setStatus(`${integration.label} credentials saved. Use Connect to finish OAuth.`, "ready");
      } catch (error) {
        setStatus(error.message, "warning");
      }
    });
  }

  const connectButton = elements.integrationDetail.querySelector("[data-connect-source]");
  if (connectButton) {
    connectButton.addEventListener("click", () => {
      if (!hasBackend) {
        setStatus("Static mode cannot open live OAuth flows. Point runtime-config.js to your backend first.", "warning");
        return;
      }

      if (!integration.configured && !integration.authenticated) {
        setStatus(`Save ${integration.label} credentials first, then connect this source.`, "setup");
        return;
      }

      window.location.href =
        resolveApiUrl(`/auth/${integration.id}/start`) || `/auth/${integration.id}/start`;
    });
  }

  const configButton = elements.integrationDetail.querySelector("[data-toggle-config]");
  if (configButton) {
    configButton.addEventListener("click", () => {
      const firstField = elements.integrationDetail.querySelector("#integrationClientId");
      if (firstField) {
        firstField.focus();
      }
    });
  }
}

function integrationById(sourceId) {
  return state.appConfig?.integrations.find((entry) => entry.id === sourceId) || null;
}

function integrationStatus(integration) {
  if (integration.authenticated) {
    return { label: "Connected", tone: "connected" };
  }
  if (integration.liveSupported && integration.configured) {
    return { label: "Ready to connect", tone: "ready" };
  }
  if (integration.liveSupported) {
    return { label: "Needs credentials", tone: "setup" };
  }
  return { label: "Unavailable", tone: "planned" };
}
