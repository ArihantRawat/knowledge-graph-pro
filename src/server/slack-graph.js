export async function buildSlackGraph({ token, historyLimit, slackApi }) {
  const [auth, usersResponse, conversationsResponse] = await Promise.all([
    slackApi("auth.test", token),
    slackApi("users.list", token),
    slackApi("conversations.list", token, {
      types: "im,mpim,public_channel,private_channel",
      exclude_archived: "true",
      limit: "200"
    })
  ]);

  if (!auth.ok) {
    throw new Error(auth.error || "Unable to authenticate Slack user.");
  }

  const users = new Map();
  for (const user of usersResponse.members || []) {
    if (user.deleted || user.is_bot || user.id === "USLACKBOT") {
      continue;
    }
    users.set(user.id, {
      id: user.id,
      label: user.profile?.real_name || user.real_name || user.name,
      handle: user.name
    });
  }

  const me = users.get(auth.user_id) || {
    id: auth.user_id,
    label: auth.user,
    handle: auth.user
  };

  const nodes = new Map([[me.id, { ...me, kind: "self", score: 1 }]]);
  const edges = new Map();
  const personSignals = new Map();

  for (const channel of conversationsResponse.channels || []) {
    const history = await slackApi("conversations.history", token, {
      channel: channel.id,
      limit: String(historyLimit)
    });

    if (!history.ok) {
      continue;
    }

    processConversation({
      me,
      channel,
      history: history.messages || [],
      users,
      nodes,
      edges,
      personSignals
    });
  }

  const edgeList = Array.from(edges.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40)
    .map((edge) => {
      const signal = personSignals.get(otherPersonIdForEdge(edge, me.id));
      const topTopics = extractTopTopics(signal, 5);
      return {
        ...edge,
        channels: Array.from(edge.channels),
        reasons: summarizeReasons(edge),
        relationship: classifyRelationship(edge, signal),
        topTopics,
        conversationBrief: summarizeConversation(signal, topTopics),
        conversationSpacesBrief: summarizeConversationSpaces(edge)
      };
    });

  const connectedIds = new Set([me.id]);
  for (const edge of edgeList) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  const nodeList = Array.from(nodes.values())
    .filter((node) => connectedIds.has(node.id))
    .map((node) => ({
      ...node,
      score: node.id === me.id ? 1 : totalEdgeWeightForNode(node.id, edgeList)
    }))
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    me: me.id,
    stats: {
      people: nodeList.length,
      relationships: edgeList.length,
      conversationsScanned: (conversationsResponse.channels || []).length
    },
    nodes: nodeList,
    edges: edgeList
  };
}

function processConversation({ me, channel, history, users, nodes, edges, personSignals }) {
  const participantCounts = new Map();
  let selfMessages = 0;

  for (const message of history) {
    if (!message.user || !users.has(message.user)) {
      continue;
    }

    participantCounts.set(message.user, (participantCounts.get(message.user) || 0) + 1);
    if (message.user === me.id) {
      selfMessages += 1;
      for (const mentionedId of parseMentions(message.text || "")) {
        if (mentionedId !== me.id && users.has(mentionedId)) {
          ensureNode(nodes, users.get(mentionedId));
          addEdge(edges, me.id, mentionedId, {
            weight: 2,
            directMessages: 0,
            mentions: 1,
            sharedChannelSignals: 0,
            channelName: readableChannelName(channel, users)
          });
          const mentionSignal = getOrCreateSignal(personSignals, mentionedId);
          mentionSignal.mentions += 1;
          ingestMessageText(mentionSignal, message.text || "");
        }
      }
    }
  }

  if (channel.is_im) {
    const otherId = channel.user;
    if (otherId && users.has(otherId)) {
      const signal = getOrCreateSignal(personSignals, otherId);
      ensureNode(nodes, users.get(otherId));
      addEdge(edges, me.id, otherId, {
        weight: history.length + 3,
        directMessages: history.length,
        mentions: 0,
        sharedChannelSignals: 0,
        channelName: readableChannelName(channel, users)
      });

      for (const message of history) {
        if (!message.user || (message.user !== me.id && message.user !== otherId)) {
          continue;
        }
        signal.totalMessages += 1;
        if (message.user === me.id) {
          signal.myMessages += 1;
        } else {
          signal.theirMessages += 1;
        }
        signal.dmMessages += 1;
        ingestMessageText(signal, message.text || "");
      }
    }
    return;
  }

  if (!participantCounts.has(me.id) || selfMessages === 0) {
    return;
  }

  for (const [userId, messageCount] of participantCounts.entries()) {
    if (userId === me.id || !users.has(userId)) {
      continue;
    }
    const signal = getOrCreateSignal(personSignals, userId);
    ensureNode(nodes, users.get(userId));
    addEdge(edges, me.id, userId, {
      weight: Math.max(1, Math.min(selfMessages, messageCount)),
      directMessages: 0,
      mentions: 0,
      sharedChannelSignals: 1,
      channelName: readableChannelName(channel, users)
    });
    signal.sharedChannelSignals += 1;

    for (const message of history) {
      if (!message.user || (message.user !== me.id && message.user !== userId)) {
        continue;
      }
      signal.totalMessages += 1;
      if (message.user === me.id) {
        signal.myMessages += 1;
      } else {
        signal.theirMessages += 1;
      }
      signal.channelMessages += 1;
      ingestMessageText(signal, message.text || "");
    }
  }
}

function getOrCreateSignal(personSignals, userId) {
  if (!personSignals.has(userId)) {
      personSignals.set(userId, {
        totalMessages: 0,
        myMessages: 0,
        theirMessages: 0,
        dmMessages: 0,
        channelMessages: 0,
        mentions: 0,
        sharedChannelSignals: 0,
        topicScores: new Map(),
        messageSnippets: []
      });
  }
  return personSignals.get(userId);
}

function ensureNode(nodes, user) {
  if (!nodes.has(user.id)) {
    nodes.set(user.id, { ...user, kind: "person", score: 0 });
  }
}

function addEdge(edges, source, target, contribution) {
  const key = [source, target].sort().join(":");
  const current = edges.get(key) || {
    id: key,
    source,
    target,
    weight: 0,
    directMessages: 0,
    mentions: 0,
    sharedChannelSignals: 0,
    channels: new Set()
  };

  current.weight += contribution.weight;
  current.directMessages += contribution.directMessages;
  current.mentions += contribution.mentions;
  current.sharedChannelSignals += contribution.sharedChannelSignals;
  current.channels.add(contribution.channelName);
  edges.set(key, current);
}

function summarizeReasons(edge) {
  const parts = [];
  if (edge.directMessages) {
    parts.push(`${edge.directMessages} direct messages`);
  }
  if (edge.mentions) {
    parts.push(`${edge.mentions} mentions`);
  }
  if (edge.sharedChannelSignals) {
    parts.push(`${edge.sharedChannelSignals} shared-channel signals`);
  }
  return parts;
}

function classifyRelationship(edge, signal) {
  if (!signal) {
    return {
      label: "Light connection",
      summary: "There are only a few interaction signals so far."
    };
  }

  const total = Math.max(signal.totalMessages, edge.directMessages);
  const dmRatio = total > 0 ? signal.dmMessages / total : 0;
  const balance =
    signal.myMessages + signal.theirMessages > 0
      ? 1 - Math.abs(signal.myMessages - signal.theirMessages) / (signal.myMessages + signal.theirMessages)
      : 0;

  let label = "Occasional collaborator";
  if (total >= 40 && dmRatio >= 0.45) {
    label = "Core collaborator";
  } else if (total >= 24 && dmRatio >= 0.25) {
    label = "Strong collaborator";
  } else if (signal.sharedChannelSignals >= 6) {
    label = "Team channel partner";
  } else if (signal.mentions >= 4) {
    label = "Coordination-heavy contact";
  }

  const summary = `${total} recent messages, ${signal.dmMessages} in DMs, and ${signal.sharedChannelSignals} shared channel signals. Reciprocity score: ${Math.round(
    balance * 100
  )}%.`;

  return { label, summary };
}

function otherPersonIdForEdge(edge, meId) {
  return edge.source === meId ? edge.target : edge.source;
}

function extractTopTopics(signal, limit) {
  if (!signal) {
    return [];
  }
  const ranked = Array.from(signal.topicScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([topic, score]) => ({ topic, score }));

  const selected = [];
  for (const candidate of ranked) {
    if (selected.length >= limit) {
      break;
    }
    const isRedundant = selected.some((picked) =>
      picked.topic.includes(candidate.topic) || candidate.topic.includes(picked.topic)
    );
    if (!isRedundant) {
      selected.push(candidate);
    }
  }

  return selected.map(({ topic }) => titleCase(topic));
}

function ingestMessageText(signal, text) {
  const cleanText = normalizeMessageText(text);
  captureMessageSnippet(signal, cleanText);
  const tokens = tokenizeSlackText(cleanText);
  if (tokens.length === 0) {
    return;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const term = tokens[index];
    scoreTopic(signal.topicScores, term, 1);
    if (index < tokens.length - 1) {
      const bigram = `${term} ${tokens[index + 1]}`;
      scoreTopic(signal.topicScores, bigram, 1.25);
    }
  }
}

function scoreTopic(map, term, value) {
  if (term.length < 3 || stopwords.has(term)) {
    return;
  }
  map.set(term, (map.get(term) || 0) + value);
}

function tokenizeSlackText(text) {
  const normalized = normalizeMessageText(text).toLowerCase();

  return normalized
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !stopwords.has(part) && !/^\d+$/.test(part));
}

function normalizeMessageText(text) {
  return String(text)
    .replaceAll(/<@[a-z0-9]+>/gi, " ")
    .replaceAll(/<#[a-z0-9]+\|([^>]+)>/gi, " $1 ")
    .replaceAll(/<https?:\/\/[^>|]+(?:\|([^>]+))?>/gi, " $1 ")
    .replaceAll(/:[a-z0-9_+-]+:/gi, " ")
    .replaceAll(/[`*_~]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function captureMessageSnippet(signal, cleanText) {
  if (!cleanText) {
    return;
  }
  if (signal.messageSnippets.length < 80) {
    signal.messageSnippets.push(cleanText.slice(0, 200));
  }
}

function summarizeConversation(signal, topTopics) {
  if (!signal || signal.totalMessages < 3) {
    return "Not enough message history yet to infer a reliable summary.";
  }

  const keywords = topTopics.length
    ? topTopics.slice(0, 3).join(", ")
    : "general updates and coordination";
  const example = summarizeMessageSamples(signal.messageSnippets);
  return `You mostly discuss ${keywords}.${example ? ` ${example}` : ""}`;
}

function summarizeMessageSamples(snippets) {
  if (!snippets || snippets.length === 0) {
    return "";
  }
  const sample = snippets
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((text) => text.split(" ").length >= 6);
  if (!sample) {
    return "";
  }
  return `Typical context: "${sample.slice(0, 110)}${sample.length > 110 ? "..." : ""}"`;
}

function summarizeConversationSpaces(edge) {
  const channels = Array.from(edge.channels || []);
  if (channels.length === 0) {
    return "No conversation spaces detected yet.";
  }

  const dmCount = channels.filter((entry) => entry.startsWith("DM with")).length;
  const channelCount = channels.length - dmCount;
  if (dmCount > 0 && channelCount > 0) {
    return `Mix of DMs and shared channels (${dmCount} DM, ${channelCount} channel).`;
  }
  if (dmCount > 0) {
    return "Mostly direct-message conversations.";
  }
  return "Mostly shared-channel conversations.";
}

function titleCase(value) {
  return value
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

const stopwords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "our",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "but",
  "not",
  "can",
  "will",
  "just",
  "about",
  "into",
  "out",
  "let",
  "lets",
  "how",
  "what",
  "when",
  "where",
  "who",
  "why",
  "then",
  "than",
  "there",
  "their",
  "they",
  "them",
  "here",
  "also",
  "need",
  "really",
  "should",
  "would",
  "could",
  "like",
  "today",
  "tomorrow",
  "yesterday",
  "please",
  "thanks",
  "thank",
  "okay",
  "ok",
  "yes",
  "no",
  "lol",
  "https",
  "http",
  "www",
  "com",
  "slack"
]);

function totalEdgeWeightForNode(nodeId, edges) {
  return edges.reduce((sum, edge) => {
    if (edge.source === nodeId || edge.target === nodeId) {
      return sum + edge.weight;
    }
    return sum;
  }, 0);
}

function parseMentions(text) {
  return Array.from(text.matchAll(/<@([A-Z0-9]+)>/g), (match) => match[1]);
}

function readableChannelName(channel, users) {
  if (channel.is_im && users.has(channel.user)) {
    return `DM with ${users.get(channel.user).label}`;
  }
  if (channel.name) {
    return `#${channel.name}`;
  }
  return channel.id;
}
