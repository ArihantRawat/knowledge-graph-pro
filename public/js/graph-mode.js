import { fetchGraph } from "./api.js";
import { elements } from "./dom.js";
import { hydrateGraph } from "./graph-view.js";
import { state } from "./state.js";
import { setStatus, setStatusBadge } from "./status.js";

export async function loadCombinedGraph({ mode, appConfig, integrationById, onMissingLiveSources }) {
  const liveSources = connectedSourceIds(appConfig);
  if (mode === "live" && liveSources.length === 0) {
    setStatus("Connect at least one integration source first. Demo mode is still available.", "setup");
    onMissingLiveSources?.();
    return;
  }

  state.mode = mode;
  syncPreviewToggle();
  const sources = mode === "live" ? liveSources : appConfig.integrations.map((entry) => entry.id);

  try {
    const graph = await fetchGraph({ mode, sources });
    hydrateGraph(graph);
    const labels = sources
      .map((sourceId) => integrationById(sourceId)?.label || sourceId)
      .join(", ");

    if (mode === "live") {
      setStatus(`Live graph updated from ${labels}.`, "live");
    } else {
      setStatus(
        "Combined demo loaded across Slack, Jira, Google Workspace, Notion, Zoom, Trello, GitHub, Linear, Confluence, Gmail / Calendar, and Figma.",
        "preview"
      );
    }
  } catch (error) {
    setStatus(error.message, "warning");
    if (mode === "live" && !state.graph) {
      await loadCombinedGraph({ mode: "demo", appConfig, integrationById, onMissingLiveSources });
    }
  }
}

export async function removePreviewMode({ appConfig, integrationById, onMissingLiveSources }) {
  if (state.mode !== "demo") {
    return;
  }

  if (connectedSourceIds(appConfig).length > 0) {
    await loadCombinedGraph({
      mode: "live",
      appConfig,
      integrationById,
      onMissingLiveSources
    });
    return;
  }

  state.mode = "live";
  syncPreviewToggle();
  hydrateGraph(emptyGraph());
  setStatusBadge("Setup required", "setup");
  setStatus("Preview mode removed. Connect at least one source to view a live graph.", "setup");
  onMissingLiveSources?.();
}

export async function enablePreviewMode({ appConfig, integrationById, onLoaded }) {
  await loadCombinedGraph({
    mode: "demo",
    appConfig,
    integrationById,
    onMissingLiveSources: undefined
  });
  onLoaded?.();
}

export function connectedSourceIds(appConfig) {
  if (!appConfig) {
    return [];
  }

  const ids = appConfig.authenticatedSources?.length
    ? appConfig.authenticatedSources
    : appConfig.integrations.filter((entry) => entry.authenticated).map((entry) => entry.id);

  return ids.filter(Boolean);
}

export function syncPreviewToggle() {
  const isPreview = state.mode === "demo";
  elements.previewModeToggle.classList.toggle("is-active", isPreview);
  elements.previewModeToggle.setAttribute("aria-pressed", String(isPreview));
  elements.previewModeToggleText.textContent = isPreview ? "On" : "Off";
}

function emptyGraph() {
  return {
    generatedAt: new Date().toISOString(),
    me: "me",
    availableSources: [],
    sourceLabels: {},
    sourceAccents: {},
    stats: {
      people: 1,
      relationships: 0,
      activeSources: 0,
      conversationsScanned: 0
    },
    nodes: [
      {
        id: "me",
        label: "You",
        handle: "",
        kind: "self",
        score: 1,
        aliases: [],
        handles: [],
        sources: [],
        sourceCount: 0
      }
    ],
    edges: []
  };
}
