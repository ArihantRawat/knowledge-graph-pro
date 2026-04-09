import { loadAppConfig } from "./js/api.js";
import { hasBackend, isLikelyStaticHost } from "./js/config.js";
import { elements } from "./js/dom.js";
import {
  connectedSourceIds,
  enablePreviewMode,
  loadCombinedGraph,
  removePreviewMode,
  syncPreviewToggle
} from "./js/graph-mode.js";
import { focusNode, renderCurrentState } from "./js/graph-view.js";
import { renderIntegrationsView } from "./js/integrations-view.js";
import { state } from "./js/state.js";
import { setStatus, setStatusBadge } from "./js/status.js";
import { setActiveTab } from "./js/tabs.js";
import { initTheme } from "./js/theme.js";
import { normalizeError } from "./js/utils.js";
import {
  applyZoom,
  onCanvasClick,
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  resetView,
  setRenderHandler,
  updateZoomPill
} from "./js/viewport.js";

setRenderHandler(renderCurrentState);
bindEvents();
init();

function bindEvents() {
  elements.openIntegrationsButton.addEventListener("click", () => setActiveTab("integrations"));
  elements.graphTabButton.addEventListener("click", () => setActiveTab("graph"));
  elements.integrationsTabButton.addEventListener("click", () => setActiveTab("integrations"));

  elements.refreshButton.addEventListener("click", async () => {
    await refreshGraph("live");
    setActiveTab("graph");
  });

  elements.previewModeToggle.addEventListener("click", async () => {
    if (state.mode === "demo") {
      await removePreviewMode({
        appConfig: state.appConfig,
        integrationById,
        onMissingLiveSources: openIntegrationSetup
      });
      return;
    }

    await enablePreviewMode({
      appConfig: state.appConfig,
      integrationById,
      onLoaded: () => setActiveTab("graph")
    });
  });

  elements.clearSelectionButton.addEventListener("click", () => {
    state.selectedNodeId = null;
    renderCurrentState();
  });

  elements.zoomInButton.addEventListener("click", () => applyZoom(1.14));
  elements.zoomOutButton.addEventListener("click", () => applyZoom(0.88));
  elements.resetViewButton.addEventListener("click", resetView);

  elements.searchInput.addEventListener("input", () => {
    state.filters.search = elements.searchInput.value.trim().toLowerCase();
    renderCurrentState();
  });

  elements.relationshipFilter.addEventListener("change", () => {
    state.filters.relationship = elements.relationshipFilter.value;
    renderCurrentState();
  });

  elements.weightFilter.addEventListener("input", () => {
    state.filters.minWeight = Number(elements.weightFilter.value);
    renderCurrentState();
  });

  elements.graphCanvas.addEventListener("pointerdown", onPointerDown);
  elements.graphCanvas.addEventListener("pointermove", onPointerMove);
  elements.graphCanvas.addEventListener("pointerup", onPointerUp);
  elements.graphCanvas.addEventListener("pointerleave", onPointerUp);
  elements.graphCanvas.addEventListener("wheel", onWheel, { passive: false });
  elements.graphCanvas.addEventListener("click", onCanvasClick);
  elements.graphCanvas.addEventListener("dblclick", onDoubleClick);
}

async function init() {
  initTheme({
    toggleButton: elements.themeToggleButton,
    toggleText: elements.themeToggleText
  });
  updateZoomPill();
  setActiveTab("graph");
  syncPreviewToggle();

  const pageUrl = new URL(window.location.href);
  const pageError = normalizeError(pageUrl.searchParams.get("error"));
  if (pageUrl.searchParams.has("error")) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  }

  await refreshAppConfig();

  if (pageError) {
    setStatus(pageError, "warning");
    setActiveTab("integrations");
  }

  if (hasConnectedSources()) {
    await refreshGraph("live");
    return;
  }

  if (!pageError) {
    if (!hasBackend && isLikelyStaticHost()) {
      setStatusBadge("GitHub Pages mode", "preview");
      setStatus(
        "Running in GitHub Pages preview mode. Set public/runtime-config.js with your backend URL when you want live integrations.",
        "preview"
      );
    } else {
      setStatusBadge("Preview mode", "preview");
      setStatus(
        "Previewing a combined graph. Connect any integration in Integrations when you want live data.",
        "preview"
      );
    }
  }
  await refreshGraph("demo");
}

async function refreshAppConfig() {
  state.appConfig = await loadAppConfig();
  syncSelectedIntegration();
  syncRefreshAction();
  renderIntegrationsView({ refreshAppConfig });
}

async function refreshGraph(mode) {
  await loadCombinedGraph({
    mode,
    appConfig: state.appConfig,
    integrationById,
    onMissingLiveSources: openIntegrationSetup
  });
}

function syncSelectedIntegration() {
  const integrationIds = state.appConfig.integrations.map((entry) => entry.id);
  if (!integrationIds.includes(state.selectedIntegrationId)) {
    state.selectedIntegrationId = integrationIds[0] || null;
  }
}

function syncRefreshAction() {
  elements.refreshButton.disabled = !hasConnectedSources();
}

function hasConnectedSources() {
  return connectedSourceIds(state.appConfig).length > 0;
}

function openIntegrationSetup() {
  setActiveTab("integrations");
}

function integrationById(sourceId) {
  return state.appConfig?.integrations.find((entry) => entry.id === sourceId) || null;
}

window.focusGraphNode = focusNode;
