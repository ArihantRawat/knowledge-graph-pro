import { fetchJiraProfile, jiraApi } from "./jira-client.js";

export async function buildJiraGraph({ token, cloudId, issueLimit }) {
  const meProfile = await fetchJiraProfile(token);
  const me = {
    id: meProfile.id,
    label: meProfile.name,
    handle: meProfile.handle
  };

  const issues = await fetchIssueBatch(token, cloudId, issueLimit);

  const nodes = new Map([[me.id, { ...me, kind: "self", score: 1 }]]);
  const edges = new Map();
  const personSignals = new Map();

  for (const issue of issues) {
    processIssue({ issue, me, nodes, edges, personSignals });
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
    .map((node) => ({ ...node, score: node.id === me.id ? 1 : totalEdgeWeightForNode(node.id, edgeList) }))
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    me: me.id,
    stats: {
      people: nodeList.length,
      relationships: edgeList.length,
      conversationsScanned: issues.length
    },
    nodes: nodeList,
    edges: edgeList
  };
}

async function fetchIssueBatch(token, cloudId, issueLimit) {
  const fields = "summary,project,assignee,reporter,creator,comment,labels";
  const base = {
    maxResults: String(issueLimit),
    fields,
    jql: "assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser() ORDER BY updated DESC"
  };

  try {
    const response = await jiraApi("search", token, cloudId, base);
    return response.issues || [];
  } catch {
    const fallback = await jiraApi("search", token, cloudId, {
      ...base,
      jql: "assignee = currentUser() OR reporter = currentUser() ORDER BY updated DESC"
    });
    return fallback.issues || [];
  }
}

function processIssue({ issue, me, nodes, edges, personSignals }) {
  const fields = issue.fields || {};
  const projectName = fields.project?.key || fields.project?.name || "Unknown project";
  const summary = String(fields.summary || "").trim();
  const issueKey = issue.key || "Issue";

  const participants = new Map();

  addRoleParticipant(participants, fields.assignee, "assignee", 3, summary);
  addRoleParticipant(participants, fields.reporter, "reporter", 2, summary);
  addRoleParticipant(participants, fields.creator, "creator", 1, summary);

  const comments = fields.comment?.comments || [];
  for (const comment of comments) {
    addRoleParticipant(participants, comment.author, "commenter", 1, comment.body || "");
  }

  const meSignal = participants.get(me.id);
  if (!meSignal) {
    return;
  }

  for (const [userId, signal] of participants.entries()) {
    if (userId === me.id) {
      continue;
    }

    const user = signal.user;
    ensureNode(nodes, user);

    const mentionCount = countMentionsInTexts(meSignal.texts, userId);
    const issueWeight = Math.max(1, Math.min(meSignal.actions, signal.actions) + signal.roleBonus);

    addEdge(edges, me.id, userId, {
      weight: issueWeight,
      directMessages: 0,
      mentions: mentionCount,
      sharedChannelSignals: 1,
      channelName: `Project ${projectName}`
    });

    const personSignal = getOrCreateSignal(personSignals, userId);
    personSignal.totalMessages += signal.actions;
    personSignal.myMessages += meSignal.actions;
    personSignal.theirMessages += signal.actions;
    personSignal.sharedChannelSignals += 1;
    personSignal.mentions += mentionCount;

    ingestMessageText(personSignal, `${issueKey} ${summary}`);
    for (const text of signal.texts) {
      ingestMessageText(personSignal, text);
    }
  }
}

function addRoleParticipant(participants, actor, role, roleBonus, text) {
  if (!actor?.accountId) {
    return;
  }

  const current = participants.get(actor.accountId) || {
    user: {
      id: actor.accountId,
      label: actor.displayName || actor.emailAddress || actor.accountId,
      handle: actor.emailAddress || actor.accountId
    },
    actions: 0,
    roleBonus: 0,
    roles: new Set(),
    texts: []
  };

  current.actions += 1;
  if (!current.roles.has(role)) {
    current.roleBonus += roleBonus;
    current.roles.add(role);
  }
  if (text) {
    current.texts.push(String(text));
  }

  participants.set(actor.accountId, current);
}

function countMentionsInTexts(texts, accountId) {
  const pattern = new RegExp(`\\[~${escapeRegExp(accountId)}\\]`, "gi");
  return texts.reduce((sum, text) => sum + (String(text).match(pattern)?.length || 0), 0);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
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
  if (edge.mentions) {
    parts.push(`${edge.mentions} issue mentions`);
  }
  if (edge.sharedChannelSignals) {
    parts.push(`${edge.sharedChannelSignals} shared issue signals`);
  }
  return parts;
}

function classifyRelationship(edge, signal) {
  if (!signal) {
    return {
      label: "Light connection",
      summary: "There are only a few issue-collaboration signals so far."
    };
  }

  const total = Math.max(signal.totalMessages, edge.sharedChannelSignals);

  let label = "Occasional collaborator";
  if (total >= 50) {
    label = "Core collaborator";
  } else if (total >= 30) {
    label = "Strong collaborator";
  } else if (signal.sharedChannelSignals >= 8) {
    label = "Team channel partner";
  } else if (signal.mentions >= 5) {
    label = "Coordination-heavy contact";
  }

  const summary = `${total} recent issue-touch signals with ${signal.sharedChannelSignals} shared issue overlaps and ${signal.mentions} direct mentions.`;
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
    .map(([topic]) => topic);

  const selected = [];
  for (const topic of ranked) {
    if (selected.length >= limit) {
      break;
    }
    if (!selected.some((existing) => existing.includes(topic) || topic.includes(existing))) {
      selected.push(topic);
    }
  }

  return selected.map(titleCase);
}

function ingestMessageText(signal, text) {
  const cleanText = normalizeMessageText(text);
  captureMessageSnippet(signal, cleanText);
  const tokens = tokenizeText(cleanText);

  for (let index = 0; index < tokens.length; index += 1) {
    const term = tokens[index];
    scoreTopic(signal.topicScores, term, 1);
    if (index < tokens.length - 1) {
      scoreTopic(signal.topicScores, `${term} ${tokens[index + 1]}`, 1.2);
    }
  }
}

function scoreTopic(map, term, value) {
  if (term.length < 3 || stopwords.has(term)) {
    return;
  }
  map.set(term, (map.get(term) || 0) + value);
}

function tokenizeText(text) {
  return normalizeMessageText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !stopwords.has(part) && !/^\d+$/.test(part));
}

function normalizeMessageText(text) {
  return String(text)
    .replaceAll(/[~`*_\[\]{}()<>]/g, " ")
    .replaceAll(/https?:\/\/\S+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function captureMessageSnippet(signal, cleanText) {
  if (cleanText && signal.messageSnippets.length < 60) {
    signal.messageSnippets.push(cleanText.slice(0, 180));
  }
}

function summarizeConversation(signal, topTopics) {
  if (!signal || signal.totalMessages < 2) {
    return "Not enough Jira history yet to infer a reliable summary.";
  }

  const keywords = topTopics.length ? topTopics.slice(0, 3).join(", ") : "issue updates and delivery coordination";
  return `You mostly collaborate on ${keywords}.`;
}

function summarizeConversationSpaces(edge) {
  const projects = Array.from(edge.channels || []);
  if (projects.length === 0) {
    return "No shared Jira projects detected yet.";
  }
  return `Shared collaboration across ${projects.length} project context${projects.length > 1 ? "s" : ""}.`;
}

function titleCase(value) {
  return value
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

const stopwords = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "our", "are", "was",
  "were", "have", "has", "had", "but", "not", "can", "will", "just", "about", "into", "out",
  "how", "what", "when", "where", "who", "why", "then", "than", "there", "their", "they", "them",
  "here", "also", "need", "should", "would", "could", "like", "today", "tomorrow", "yesterday",
  "please", "thanks", "http", "https", "jira", "issue", "task", "story", "bug"
]);

function totalEdgeWeightForNode(nodeId, edges) {
  return edges.reduce((sum, edge) => {
    if (edge.source === nodeId || edge.target === nodeId) {
      return sum + edge.weight;
    }
    return sum;
  }, 0);
}
