export function buildSimpleRelationshipGraph({ me, collaborators, conversationsScanned = 0 }) {
  const safeMe = normalizePerson(me, "me");
  const nodes = [
    {
      ...safeMe,
      kind: "self",
      score: 1
    }
  ];
  const edges = [];

  for (const raw of collaborators || []) {
    const person = normalizePerson(raw, "person");
    if (!person.id || person.id === safeMe.id) {
      continue;
    }

    const weight = Math.max(1, Number(raw.weight || 1));
    const mentions = Math.max(0, Number(raw.mentions || 0));
    const directMessages = Math.max(0, Number(raw.directMessages || 0));
    const sharedSignals = Math.max(0, Number(raw.sharedChannelSignals || 1));
    const channels = uniqueStrings(raw.channels || raw.contexts || []);
    const topTopics = uniqueStrings(raw.topTopics || raw.topics || []).slice(0, 5);

    nodes.push({
      ...person,
      kind: "person",
      score: weight
    });
    edges.push({
      id: [safeMe.id, person.id].sort().join(":"),
      source: safeMe.id,
      target: person.id,
      weight,
      directMessages,
      mentions,
      sharedChannelSignals: sharedSignals,
      channels,
      reasons: buildReasons({ directMessages, mentions, sharedSignals }),
      relationship: classifyRelationship(weight, directMessages, mentions, sharedSignals),
      topTopics,
      conversationBrief: raw.conversationBrief || buildConversationBrief(topTopics, channels),
      conversationSpacesBrief: raw.conversationSpacesBrief || buildConversationSpacesBrief(channels)
    });
  }

  const sortedEdges = edges.sort((left, right) => right.weight - left.weight).slice(0, 80);
  const connectedIds = new Set([safeMe.id]);
  for (const edge of sortedEdges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  const finalNodes = nodes
    .filter((node) => connectedIds.has(node.id))
    .sort((left, right) => right.score - left.score);

  return {
    generatedAt: new Date().toISOString(),
    me: safeMe.id,
    stats: {
      people: finalNodes.length,
      relationships: sortedEdges.length,
      conversationsScanned
    },
    nodes: finalNodes,
    edges: sortedEdges
  };
}

function normalizePerson(raw, prefix) {
  const label = String(raw?.label || raw?.name || raw?.handle || raw?.id || "Unknown");
  const handle = String(raw?.handle || raw?.email || "").trim();
  const fallback = `${prefix}-${slugify(label || handle || "unknown")}`;
  return {
    id: String(raw?.id || fallback),
    label,
    handle
  };
}

function buildReasons({ directMessages, mentions, sharedSignals }) {
  const reasons = [];
  if (directMessages > 0) {
    reasons.push(`${directMessages} direct-message signals`);
  }
  if (mentions > 0) {
    reasons.push(`${mentions} mentions`);
  }
  if (sharedSignals > 0) {
    reasons.push(`${sharedSignals} shared collaboration signals`);
  }
  if (reasons.length === 0) {
    reasons.push("A small number of collaboration signals were detected");
  }
  return reasons;
}

function classifyRelationship(weight, directMessages, mentions, sharedSignals) {
  let label = "Occasional collaborator";
  if (weight >= 34 || directMessages >= 24) {
    label = "Core collaborator";
  } else if (weight >= 22 || directMessages >= 12) {
    label = "Strong collaborator";
  } else if (sharedSignals >= 6) {
    label = "Team channel partner";
  } else if (mentions >= 4) {
    label = "Coordination-heavy contact";
  } else if (weight <= 6) {
    label = "Light connection";
  }

  return {
    label,
    summary: `${weight} total signals (${directMessages} direct, ${mentions} mentions, ${sharedSignals} shared contexts).`
  };
}

function buildConversationBrief(topics, channels) {
  const topicText = topics.length ? topics.slice(0, 3).join(", ") : "coordination and delivery";
  if (!channels.length) {
    return `Main themes: ${topicText}.`;
  }
  return `Main themes: ${topicText}. Seen in ${channels.slice(0, 3).join(", ")}.`;
}

function buildConversationSpacesBrief(channels) {
  if (!channels.length) {
    return "Contexts are still being inferred.";
  }
  return `Visible across ${channels.length} context${channels.length === 1 ? "" : "s"}.`;
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    )
  );
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
