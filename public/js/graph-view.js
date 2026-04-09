import { elements } from "./dom.js";
import { RELATIONSHIP_ORDER, state } from "./state.js";
import { escapeHtml, svg, svgTitle } from "./utils.js";
import { updateZoomPill } from "./viewport.js";

export function hydrateGraph(graph) {
  state.graph = graph;
  state.selectedNodeId = null;
  state.view.scale = 1;
  state.view.x = 0;
  state.view.y = 0;
  updateZoomPill();

  syncFilterOptions(graph);
  syncWeightFilter(graph);

  elements.peopleMetric.textContent = String(graph.stats.people);
  elements.relationshipMetric.textContent = String(graph.stats.relationships);
  elements.sourceMetric.textContent = String(graph.stats.activeSources || graph.availableSources?.length || 0);
  elements.signalMetric.textContent = String(graph.stats.conversationsScanned || 0);
  renderCurrentState();
}

export function renderCurrentState() {
  if (!state.graph) {
    return;
  }

  renderSourceFilterGroup(state.graph);
  const visible = buildVisibleGraph(state.graph);
  if (state.selectedNodeId && !visible.nodes.some((node) => node.id === state.selectedNodeId)) {
    state.selectedNodeId = null;
  }

  elements.weightValue.textContent = `${state.filters.minWeight}+`;
  elements.visiblePeoplePill.textContent = `${Math.max(visible.nodes.length - 1, 0)} visible`;
  elements.visibleCountText.textContent = `${visible.nodes.length} nodes`;
  elements.selectionPill.textContent = selectedLabel(visible);

  renderGraph(visible);
  renderDetails(visible, state.selectedNodeId);
  renderVisiblePeople(visible);
}

export function focusNode(nodeId) {
  state.selectedNodeId = nodeId;
  renderCurrentState();
}

function syncFilterOptions(graph) {
  const labels = Array.from(
    new Set(graph.edges.map((edge) => edge.relationship?.label).filter(Boolean))
  );
  labels.sort((a, b) => RELATIONSHIP_ORDER.indexOf(a) - RELATIONSHIP_ORDER.indexOf(b));

  const currentRelationship = state.filters.relationship;
  elements.relationshipFilter.innerHTML = `<option value="all">All relationships</option>${labels
    .map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`)
    .join("")}`;
  elements.relationshipFilter.value = labels.includes(currentRelationship) ? currentRelationship : "all";
  state.filters.relationship = elements.relationshipFilter.value;

  const filterableSourceIds = getFilterableSourceIds(graph);
  state.filters.sourceIds = state.filters.sourceIds.filter((sourceId) =>
    filterableSourceIds.includes(sourceId)
  );
  if (state.filters.sourceIds.length === filterableSourceIds.length) {
    state.filters.sourceIds = [];
  }
}

function syncWeightFilter(graph) {
  const maxWeight = Math.max(...graph.edges.map((edge) => edge.weight), 1);
  elements.weightFilter.max = String(maxWeight);
  if (state.filters.minWeight > maxWeight) {
    state.filters.minWeight = 0;
    elements.weightFilter.value = "0";
  }
}

function selectedLabel(visible) {
  const selectedSourceIds = getSelectedSourceIds(state.graph);

  if (!state.selectedNodeId || state.selectedNodeId === state.graph.me) {
    if (selectedSourceIds.length === 0) {
      return state.mode === "live" ? "All connected sources" : "All demo sources";
    }

    if (selectedSourceIds.length === 1) {
      return `Source: ${sourceLabel(state.graph, selectedSourceIds[0])}`;
    }

    if (selectedSourceIds.length <= 3) {
      return `Sources: ${selectedSourceIds.map((sourceId) => sourceLabel(state.graph, sourceId)).join(", ")}`;
    }

    return `${selectedSourceIds.length} sources selected`;
  }

  const node = visible.nodes.find((entry) => entry.id === state.selectedNodeId);
  return node ? `Focus: ${node.label}` : "All connections";
}

function buildVisibleGraph(graph) {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const search = state.filters.search;
  const relationship = state.filters.relationship;
  const minWeight = state.filters.minWeight;
  const selectedSourceIds = getSelectedSourceIds(graph);

  const edges = graph.edges.filter((edge) => {
    if (edge.weight < minWeight) {
      return false;
    }

    if (relationship !== "all" && edge.relationship?.label !== relationship) {
      return false;
    }

    if (
      selectedSourceIds.length > 0 &&
      !(edge.sources || []).some((sourceId) => selectedSourceIds.includes(sourceId))
    ) {
      return false;
    }

    if (!search) {
      return true;
    }

    const otherId = edge.source === graph.me ? edge.target : edge.source;
    const node = nodeMap.get(otherId);
    const haystack = [
      node?.label || "",
      node?.handle || "",
      ...(node?.aliases || []),
      edge.relationship?.label || "",
      ...(edge.topTopics || []),
      ...(edge.channels || []),
      ...(edge.sources || []).map((sourceId) => sourceLabel(graph, sourceId))
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });

  const connectedIds = new Set([graph.me]);
  for (const edge of edges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  const nodes = graph.nodes.filter((node) => connectedIds.has(node.id));
  return {
    ...graph,
    availableSources: activeSourceIds(graph, edges),
    nodes,
    edges
  };
}

function renderSourceFilterGroup(graph) {
  const filterableSourceIds = getFilterableSourceIds(graph);
  const selectedSourceIds = getSelectedSourceIds(graph);
  const resetLabel = state.mode === "live" ? "All connected sources" : "All demo sources";

  if (!filterableSourceIds.length) {
    elements.sourceFilterGroup.innerHTML = `
      <p class="source-filter-note">No connected sources are available yet. Load the demo or connect an integration first.</p>
    `;
    return;
  }

  elements.sourceFilterGroup.innerHTML = `
    <div class="source-filter-shell">
      <button
        type="button"
        class="source-filter-chip source-filter-chip--all ${selectedSourceIds.length === 0 ? "is-active" : ""}"
        data-source-filter="all"
      >
        ${escapeHtml(resetLabel)}
      </button>
      ${filterableSourceIds
        .map(
          (sourceId) => `
            <button
              type="button"
              class="source-filter-chip ${selectedSourceIds.includes(sourceId) ? "is-active" : ""}"
              data-source-filter="${escapeHtml(sourceId)}"
              style="--source-filter-accent:${sourceAccent(graph, sourceId)}"
            >
              ${escapeHtml(sourceLabel(graph, sourceId))}
            </button>
          `
        )
        .join("")}
    </div>
    <p class="source-filter-note">${escapeHtml(sourceFilterNote(graph, filterableSourceIds, selectedSourceIds))}</p>
  `;

  for (const button of elements.sourceFilterGroup.querySelectorAll("[data-source-filter]")) {
    button.addEventListener("click", () => {
      toggleSourceFilter(graph, button.dataset.sourceFilter);
    });
  }
}

function renderGraph(graph) {
  elements.graphCanvas.innerHTML = "";

  const width = 1200;
  const height = 760;
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  const me = graph.nodes.find((node) => node.id === state.graph.me) || graph.nodes[0];
  const others = graph.nodes.filter((node) => node.id !== me.id);
  const neighbors = new Set();
  const selectedEdgeIds = new Set();

  if (state.selectedNodeId) {
    for (const edge of graph.edges) {
      if (edge.source === state.selectedNodeId || edge.target === state.selectedNodeId) {
        selectedEdgeIds.add(edge.id);
        neighbors.add(edge.source);
        neighbors.add(edge.target);
      }
    }
  }

  const maxScore = Math.max(...others.map((node) => node.score), 1);
  const placed = new Map();
  placed.set(me.id, { ...me, x: centerX, y: centerY, radius: 36 });

  const panLayer = svg("g", {
    transform: `translate(${state.view.x} ${state.view.y})`
  });
  const zoomLayer = svg("g", {
    transform: `scale(${state.view.scale})`
  });
  panLayer.append(zoomLayer);
  elements.graphCanvas.append(panLayer);

  const orbitGroup = svg("g");
  orbitGroup.append(
    orbitCircle(centerX, centerY, 150),
    orbitCircle(centerX, centerY, 248),
    orbitCircle(centerX, centerY, 344)
  );
  zoomLayer.append(orbitGroup);

  others.forEach((node, index) => {
    const strength = node.score / maxScore;
    const ring = 180 + (1 - strength) * 178 + (index % 3) * 16;
    const angle = index * 2.399963229728653;
    placed.set(node.id, {
      ...node,
      x: centerX + Math.cos(angle) * ring,
      y: centerY + Math.sin(angle) * ring * 0.72,
      radius: 16 + strength * 18
    });
  });

  const edgeLayer = svg("g");
  const labelLayer = svg("g");
  const nodeLayer = svg("g");
  zoomLayer.append(edgeLayer, labelLayer, nodeLayer);

  for (const edge of graph.edges) {
    const source = placed.get(edge.source);
    const target = placed.get(edge.target);
    if (!source || !target) {
      continue;
    }

    const active = state.selectedNodeId ? selectedEdgeIds.has(edge.id) : true;
    const faded = state.selectedNodeId ? !selectedEdgeIds.has(edge.id) : false;
    const curve = edge.source === me.id || edge.target === me.id ? 0.12 : 0.2;
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2 - Math.abs(source.x - target.x) * curve * 0.18;
    const pathData = `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`;
    const stroke = edgeColor(graph, edge);

    const path = svg("path", {
      d: pathData,
      fill: "none",
      stroke: active ? stroke : "rgba(138, 157, 156, 0.2)",
      "stroke-width": active ? 2 + edge.weight * 0.18 : 1.1 + edge.weight * 0.07,
      opacity: faded ? "0.12" : active ? "0.94" : "0.58",
      "stroke-linecap": "round"
    });
    path.append(svgTitle(`${source.label} to ${target.label}: strength ${edge.weight}`));
    edgeLayer.append(path);

    if (!faded) {
      const label = svg("text", {
        x: midX,
        y: midY - 6,
        class: "graph-edge-label",
        "text-anchor": "middle",
        opacity: edge.weight >= state.filters.minWeight + 2 ? "0.82" : "0.54"
      });
      label.textContent = edge.weight;
      labelLayer.append(label);
    }
  }

  for (const node of placed.values()) {
    const selected = node.id === state.selectedNodeId;
    const connected = neighbors.has(node.id);
    const faded = state.selectedNodeId ? !selected && !connected : false;
    const group = svg("g", {
      "data-node-id": node.id,
      tabindex: "0",
      role: "button"
    });
    group.addEventListener("click", (event) => {
      event.stopPropagation();
      focusNode(node.id);
    });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        focusNode(node.id);
      }
    });

    const accent = nodeColor(graph, node);
    const halo = svg("circle", {
      cx: node.x,
      cy: node.y,
      r: node.radius + (selected ? 18 : node.id === me.id ? 14 : 10),
      fill: node.id === me.id ? "rgba(255, 179, 71, 0.18)" : transparentAccent(graph, node),
      opacity: faded ? "0.04" : selected ? "0.62" : "0.26"
    });
    const body = svg("circle", {
      cx: node.x,
      cy: node.y,
      r: node.radius,
      fill: node.id === me.id ? "#ffb347" : accent,
      stroke: selected ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.18)",
      "stroke-width": selected ? 3 : 1.2,
      opacity: faded ? "0.16" : connected || selected || node.id === me.id ? "0.96" : "0.82"
    });
    const core = svg("circle", {
      cx: node.x,
      cy: node.y,
      r: Math.max(4, node.radius * 0.18),
      fill: "#fff6ea",
      opacity: faded ? "0.3" : "0.92"
    });
    const label = svg("text", {
      x: node.x,
      y: node.y + node.radius + 20,
      class: "graph-node-label",
      "text-anchor": "middle",
      opacity: faded ? "0.18" : "0.96"
    });
    label.textContent = node.label;

    group.append(halo, body, core, label);
    nodeLayer.append(group);
  }

  const background = svg("rect", {
    x: "0",
    y: "0",
    width: String(width),
    height: String(height),
    fill: "transparent"
  });
  zoomLayer.insertBefore(background, orbitGroup);
}

function orbitCircle(cx, cy, r) {
  return svg("circle", {
    cx: String(cx),
    cy: String(cy),
    r: String(r),
    fill: "none",
    stroke: "rgba(201, 225, 221, 0.07)",
    "stroke-width": "1"
  });
}

function renderDetails(graph, nodeId) {
  if (!graph.nodes.length) {
    elements.detailCard.innerHTML = `<p>No graph data is available for the current filters.</p>`;
    return;
  }

  const node =
    (nodeId && graph.nodes.find((entry) => entry.id === nodeId)) ||
    graph.nodes.find((entry) => entry.id === state.graph.me) ||
    graph.nodes[0];
  const neighbors = graph.edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      return graph.nodes.find((entry) => entry.id === otherId);
    })
    .filter(Boolean);

  if (node.id === state.graph.me) {
    const strongest = graph.edges.slice().sort((a, b) => b.weight - a.weight).slice(0, 4);
    elements.detailCard.innerHTML = `
      <div class="fade-in">
        <h3>${escapeHtml(node.label)}</h3>
        <p>This unified graph is centered on you. Use the source filters to isolate systems, or keep them combined to see cross-tool relationships.</p>
        <div class="detail-list">
          <div><strong>Sources in view:</strong></div>
          <div>${(graph.availableSources || []).map((sourceId) => sourcePill(graph, sourceId)).join("")}</div>
          <div><strong>Visible relationships:</strong> ${graph.edges.length}</div>
          <div><strong>Strongest visible ties:</strong></div>
          <div>${strongest
            .map((edge) => {
              const otherId = edge.source === state.graph.me ? edge.target : edge.source;
              const other = graph.nodes.find((entry) => entry.id === otherId);
              return `<span class="topic-pill">${escapeHtml(other?.label || "Unknown")} &middot; ${edge.weight}</span>`;
            })
            .join("")}</div>
        </div>
      </div>
    `;
    return;
  }

  const edge = graph.edges.find(
    (entry) =>
      (entry.source === state.graph.me && entry.target === node.id) ||
      (entry.target === state.graph.me && entry.source === node.id)
  );

  const relationship = edge?.relationship || {
    label: "Light connection",
    summary: "Not enough history yet."
  };
  const topicMarkup = (edge?.topTopics || [])
    .slice(0, 5)
    .map((topic) => `<span class="topic-pill">${escapeHtml(topic)}</span>`)
    .join("");
  const channelMarkup = (edge?.channels || [])
    .map((channel) => `<span class="detail-pill">${escapeHtml(channel)}</span>`)
    .join("");
  const connectionMarkup = neighbors
    .map((entry) => `<span class="detail-pill">${escapeHtml(entry.label)}</span>`)
    .join("");
  const reasonMarkup = (edge?.reasons || [])
    .map((reason) => `<span class="detail-pill">${escapeHtml(reason)}</span>`)
    .join("");
  const sourceMarkup = (edge?.sources || [])
    .map((sourceId) => sourcePill(graph, sourceId))
    .join("");
  const highlightMarkup = (edge?.sourceHighlights || [])
    .map(
      (highlight) => `
        <article class="source-highlight-card">
          <div class="source-highlight-head">
            <span class="source-pill" style="--source-pill:${sourceAccent(graph, highlight.sourceId)}">${escapeHtml(
              highlight.label
            )}</span>
            <strong>${escapeHtml(highlight.relationshipLabel)}</strong>
          </div>
          <p>${escapeHtml(highlight.relationshipSummary || highlight.conversationBrief || "Source-specific collaboration signal.")}</p>
          <div>${(highlight.topTopics || [])
            .slice(0, 3)
            .map((topic) => `<span class="topic-pill">${escapeHtml(topic)}</span>`)
            .join("")}</div>
        </article>
      `
    )
    .join("");

  elements.detailCard.innerHTML = `
    <div class="fade-in">
      <h3>${escapeHtml(node.label)}</h3>
      <p>${escapeHtml(node.handle || "No canonical handle available")}</p>
      <div class="detail-list">
        <div><strong>Relationship type:</strong> ${escapeHtml(relationship.label)}</div>
        <div>${escapeHtml(relationship.summary)}</div>
        <div><strong>Relationship strength:</strong> ${edge?.weight || 0}</div>
        <div><strong>Contributing sources:</strong></div>
        <div>${sourceMarkup || "No source overlap detected."}</div>
        <div><strong>Why this connection exists:</strong></div>
        <div>${reasonMarkup || "No signals were extracted."}</div>
        <div><strong>Combined themes:</strong></div>
        <div>${escapeHtml(edge?.conversationBrief || "Not enough cross-source history to summarize yet.")}</div>
        <div><strong>Top topics:</strong></div>
        <div>${topicMarkup || "Not enough text signals to infer topics yet."}</div>
        <div><strong>Contexts:</strong></div>
        <div>${escapeHtml(edge?.conversationSpacesBrief || "Contexts are still being inferred.")}</div>
        <div>${channelMarkup || "No contexts recorded."}</div>
        <div><strong>Per-source breakdown:</strong></div>
        <div class="source-highlight-list">${highlightMarkup || "No source-specific breakdown is available."}</div>
        <div><strong>Visible connections from this node:</strong></div>
        <div>${connectionMarkup || "No visible linked nodes under the current filters."}</div>
      </div>
    </div>
  `;
}

function renderVisiblePeople(graph) {
  const people = graph.nodes.filter((node) => node.id !== state.graph.me);
  elements.visiblePeopleList.innerHTML = people
    .map(
      (node) => `
        <button class="person-chip ${node.id === state.selectedNodeId ? "is-selected" : ""}" data-node-chip="${escapeHtml(
          node.id
        )}">
          ${escapeHtml(node.label)} <span class="chip-meta">${node.sources?.length || 0} src</span>
        </button>
      `
    )
    .join("");

  for (const chip of elements.visiblePeopleList.querySelectorAll("[data-node-chip]")) {
    chip.addEventListener("click", () => focusNode(chip.dataset.nodeChip));
  }
}

function edgeColor(graph, edge) {
  const selectedSourceIds = getSelectedSourceIds(graph);
  if (selectedSourceIds.length === 1) {
    return sourceAccent(graph, selectedSourceIds[0]);
  }
  if ((edge.sources || []).length > 1) {
    return "rgba(255, 179, 71, 0.92)";
  }
  const matchingSourceId =
    edge.sources?.find((sourceId) => selectedSourceIds.includes(sourceId)) ||
    edge.primarySource ||
    edge.sources?.[0];
  return sourceAccent(graph, matchingSourceId);
}

function nodeColor(graph, node) {
  const selectedSourceIds = getSelectedSourceIds(graph);
  if (selectedSourceIds.length === 1) {
    return sourceAccent(graph, selectedSourceIds[0]);
  }
  if ((node.sources || []).length > 1) {
    return "#14b8a6";
  }
  const sourceId = node.sources?.find((entry) => selectedSourceIds.includes(entry)) || node.sources?.[0];
  return sourceAccent(graph, sourceId);
}

function sourceLabel(graph, sourceId) {
  return graph.sourceLabels?.[sourceId] || sourceId;
}

function sourceAccent(graph, sourceId) {
  return graph.sourceAccents?.[sourceId] || "#ffb347";
}

function transparentAccent(graph, node) {
  const selectedSourceIds = getSelectedSourceIds(graph);
  const sourceId =
    selectedSourceIds[0] ||
    node.sources?.find((entry) => selectedSourceIds.includes(entry)) ||
    node.sources?.[0];
  const accent = sourceAccent(graph, sourceId);
  if (accent.startsWith("#")) {
    const [red, green, blue] = hexToRgb(accent);
    return `rgba(${red}, ${green}, ${blue}, 0.16)`;
  }
  return "rgba(255, 179, 71, 0.16)";
}

function sourcePill(graph, sourceId, active = false) {
  return `<span class="source-pill ${active ? "is-active" : ""}" style="--source-pill:${sourceAccent(
    graph,
    sourceId
  )}">${escapeHtml(sourceLabel(graph, sourceId))}</span>`;
}

function getFilterableSourceIds(graph) {
  const graphSourceIds = graph.availableSources || [];
  if (state.mode !== "live") {
    return graphSourceIds;
  }

  const connectedSourceIds = state.appConfig?.authenticatedSources || [];
  if (!connectedSourceIds.length) {
    return graphSourceIds;
  }

  return graphSourceIds.filter((sourceId) => connectedSourceIds.includes(sourceId));
}

function getSelectedSourceIds(graph) {
  const filterableSourceIds = getFilterableSourceIds(graph);
  return state.filters.sourceIds.filter((sourceId) => filterableSourceIds.includes(sourceId));
}

function activeSourceIds(graph, edges) {
  const selectedSourceIds = getSelectedSourceIds(graph);
  if (selectedSourceIds.length > 0) {
    return selectedSourceIds;
  }

  const visibleSourceIds = Array.from(new Set(edges.flatMap((edge) => edge.sources || [])));
  return visibleSourceIds.length > 0 ? visibleSourceIds : getFilterableSourceIds(graph);
}

function sourceFilterNote(graph, filterableSourceIds, selectedSourceIds) {
  if (selectedSourceIds.length === 0) {
    return state.mode === "live"
      ? `Showing every connected source in this workspace (${filterableSourceIds.length} total).`
      : `Showing every source included in the demo graph (${filterableSourceIds.length} total).`;
  }

  const labels = selectedSourceIds.map((sourceId) => sourceLabel(graph, sourceId));
  if (labels.length <= 3) {
    return `Visible relationships must come from: ${labels.join(", ")}.`;
  }

  return `Visible relationships must come from ${labels.length} selected sources.`;
}

function toggleSourceFilter(graph, sourceId) {
  const filterableSourceIds = getFilterableSourceIds(graph);
  if (sourceId === "all") {
    state.filters.sourceIds = [];
    renderCurrentState();
    return;
  }

  const nextSelected = new Set(getSelectedSourceIds(graph));
  if (nextSelected.has(sourceId)) {
    nextSelected.delete(sourceId);
  } else {
    nextSelected.add(sourceId);
  }

  state.filters.sourceIds = filterableSourceIds.filter((entry) => nextSelected.has(entry));
  if (state.filters.sourceIds.length === 0 || state.filters.sourceIds.length === filterableSourceIds.length) {
    state.filters.sourceIds = [];
  }

  renderCurrentState();
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  const chunk = cleaned.length === 3
    ? cleaned
        .split("")
        .map((part) => part + part)
        .join("")
    : cleaned;
  const value = Number.parseInt(chunk, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
