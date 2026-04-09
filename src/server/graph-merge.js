import { SOURCE_ACCENTS, SOURCE_LABELS } from "./constants.js";

export function combineSourceGraphs(sourceGraphs) {
  const nodes = new Map();
  const edges = new Map();
  const sourceStats = [];

  for (const entry of sourceGraphs) {
    const { sourceId, graph } = entry;
    if (!graph) {
      continue;
    }

    const canonicalBySourceId = new Map();
    sourceStats.push({
      id: sourceId,
      label: SOURCE_LABELS[sourceId] || sourceId,
      people: graph.stats?.people || 0,
      relationships: graph.stats?.relationships || 0,
      scanned: graph.stats?.conversationsScanned || 0
    });

    for (const node of graph.nodes || []) {
      const canonicalId = node.id === graph.me || node.kind === "self" ? "me" : canonicalPersonId(node);
      canonicalBySourceId.set(node.id, canonicalId);
      mergeNode(nodes, canonicalId, node, sourceId);
    }

    for (const edge of graph.edges || []) {
      const sourceCanonical = canonicalBySourceId.get(edge.source);
      const targetCanonical = canonicalBySourceId.get(edge.target);

      if (!sourceCanonical || !targetCanonical || sourceCanonical === targetCanonical) {
        continue;
      }

      const edgeKey = [sourceCanonical, targetCanonical].sort().join(":");
      mergeEdge(edges, edgeKey, sourceCanonical, targetCanonical, edge, sourceId);
    }
  }

  const edgeList = Array.from(edges.values())
    .map(finalizeEdge)
    .sort((a, b) => b.weight - a.weight);

  const connectedIds = new Set(["me"]);
  for (const edge of edgeList) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  const nodeList = Array.from(nodes.values())
    .filter((node) => connectedIds.has(node.id))
    .map(finalizeNode)
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    me: "me",
    availableSources: sourceStats.map((entry) => entry.id),
    sourceLabels: SOURCE_LABELS,
    sourceAccents: SOURCE_ACCENTS,
    sourceStats,
    stats: {
      people: nodeList.length,
      relationships: edgeList.length,
      conversationsScanned: sourceStats.reduce((sum, entry) => sum + entry.scanned, 0),
      activeSources: sourceStats.length
    },
    nodes: nodeList,
    edges: edgeList
  };
}

function mergeNode(nodes, canonicalId, node, sourceId) {
  const current = nodes.get(canonicalId) || {
    id: canonicalId,
    label: canonicalId === "me" ? "You" : node.label || "Unknown",
    handle: node.handle || "",
    kind: canonicalId === "me" ? "self" : "person",
    score: 0,
    aliases: new Set(),
    handles: new Set(),
    sources: new Set(),
    sourceProfiles: []
  };

  current.sources.add(sourceId);
  current.score += Number(node.score || 0);

  if (node.label) {
    current.aliases.add(node.label);
    if (!current.label || node.label.length > current.label.length) {
      current.label = node.label;
    }
  }

  if (node.handle) {
    current.handles.add(node.handle);
    if (!current.handle || isPreferredHandle(node.handle, current.handle)) {
      current.handle = node.handle;
    }
  }

  current.sourceProfiles.push({
    sourceId,
    label: node.label || "",
    handle: node.handle || ""
  });

  nodes.set(canonicalId, current);
}

function mergeEdge(edges, edgeKey, sourceCanonical, targetCanonical, edge, sourceId) {
  const current = edges.get(edgeKey) || {
    id: edgeKey,
    source: sourceCanonical,
    target: targetCanonical,
    weight: 0,
    directMessages: 0,
    mentions: 0,
    sharedChannelSignals: 0,
    channels: new Set(),
    sources: new Set(),
    sourceWeights: {},
    topicScores: new Map(),
    sourceHighlights: []
  };

  current.weight += Number(edge.weight || 0);
  current.directMessages += Number(edge.directMessages || 0);
  current.mentions += Number(edge.mentions || 0);
  current.sharedChannelSignals += Number(edge.sharedChannelSignals || 0);
  current.sources.add(sourceId);
  current.sourceWeights[sourceId] = (current.sourceWeights[sourceId] || 0) + Number(edge.weight || 0);

  for (const channel of edge.channels || []) {
    current.channels.add(channel);
  }

  for (const [index, topic] of (edge.topTopics || []).entries()) {
    current.topicScores.set(topic, (current.topicScores.get(topic) || 0) + Math.max(1, 5 - index));
  }

  current.sourceHighlights.push({
    sourceId,
    label: SOURCE_LABELS[sourceId] || sourceId,
    weight: edge.weight || 0,
    relationshipLabel: edge.relationship?.label || "Light connection",
    relationshipSummary: edge.relationship?.summary || "",
    conversationBrief: edge.conversationBrief || "",
    conversationSpacesBrief: edge.conversationSpacesBrief || "",
    reasons: edge.reasons || [],
    channels: edge.channels || [],
    topTopics: edge.topTopics || []
  });

  edges.set(edgeKey, current);
}

function finalizeNode(node) {
  return {
    ...node,
    aliases: Array.from(node.aliases),
    handles: Array.from(node.handles),
    sources: Array.from(node.sources),
    sourceCount: node.sources.size
  };
}

function finalizeEdge(edge) {
  const topTopics = Array.from(edge.topicScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
  const sources = Array.from(edge.sources);
  const strongestSources = sources
    .slice()
    .sort((left, right) => (edge.sourceWeights[right] || 0) - (edge.sourceWeights[left] || 0));

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    weight: edge.weight,
    directMessages: edge.directMessages,
    mentions: edge.mentions,
    sharedChannelSignals: edge.sharedChannelSignals,
    channels: Array.from(edge.channels),
    sources,
    sourceWeights: edge.sourceWeights,
    sourceHighlights: edge.sourceHighlights.sort((a, b) => b.weight - a.weight),
    reasons: buildReasonList(edge),
    relationship: classifyCombinedRelationship(edge),
    topTopics,
    conversationBrief: buildConversationBrief(edge, topTopics),
    conversationSpacesBrief: buildConversationSpacesBrief(edge),
    primarySource: strongestSources[0] || null
  };
}

function buildReasonList(edge) {
  const reasons = [];
  if (edge.directMessages) {
    reasons.push(`${edge.directMessages} direct-message signals`);
  }
  if (edge.mentions) {
    reasons.push(`${edge.mentions} mentions`);
  }
  if (edge.sharedChannelSignals) {
    reasons.push(`${edge.sharedChannelSignals} shared collaboration signals`);
  }
  reasons.push(`${edge.sources.size} contributing source${edge.sources.size === 1 ? "" : "s"}`);
  return reasons;
}

function classifyCombinedRelationship(edge) {
  const sourceCount = edge.sources.size;
  const total = edge.weight;

  let label = "Occasional collaborator";
  if (total >= 34 || sourceCount >= 4) {
    label = "Core collaborator";
  } else if (total >= 22 || sourceCount >= 3) {
    label = "Strong collaborator";
  } else if (edge.sharedChannelSignals >= 6) {
    label = "Team channel partner";
  } else if (edge.mentions >= 4) {
    label = "Coordination-heavy contact";
  } else if (total <= 6) {
    label = "Light connection";
  }

  const sourceNames = Array.from(edge.sources)
    .map((sourceId) => SOURCE_LABELS[sourceId] || sourceId)
    .join(", ");

  return {
    label,
    summary: `${total} total collaboration signals across ${sourceCount} source${sourceCount === 1 ? "" : "s"}: ${sourceNames}.`
  };
}

function buildConversationBrief(edge, topTopics) {
  const sourceNames = edge.sourceHighlights.map((entry) => entry.label).join(", ");
  const topicText = topTopics.length ? topTopics.slice(0, 3).join(", ") : "coordination and delivery";
  return `Combined from ${sourceNames}. Strongest themes: ${topicText}.`;
}

function buildConversationSpacesBrief(edge) {
  return `Visible in ${edge.sources.size} source${edge.sources.size === 1 ? "" : "s"} across ${edge.channels.size} context${edge.channels.size === 1 ? "" : "s"}.`;
}

function canonicalPersonId(node) {
  const candidates = [node.handle, node.label, node.id];
  for (const candidate of candidates) {
    const normalized = normalizeIdentity(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return `person-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPreferredHandle(nextHandle, currentHandle) {
  return nextHandle.includes("@") && !currentHandle.includes("@");
}
