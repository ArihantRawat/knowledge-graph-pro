import { buildSimpleRelationshipGraph } from "./simple-graph.js";

export async function exchangeLinearCode({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });
  return response.json();
}

export async function linearGraphql(token, query, variables = {}) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Linear API failed (${response.status}): ${body.slice(0, 180)}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || "Linear API request failed.");
  }
  return payload.data || {};
}

export async function fetchLinearProfile(token) {
  const data = await linearGraphql(
    token,
    `query ViewerProfile {
      viewer {
        id
        name
        email
      }
    }`
  );

  const viewer = data.viewer || {};
  return {
    id: viewer.id || "",
    name: viewer.name || viewer.email || "Linear User",
    handle: viewer.email || ""
  };
}

export async function buildLinearGraph({ token }) {
  const data = await linearGraphql(
    token,
    `query GraphSeed {
      viewer {
        id
        name
        email
      }
      users(first: 60) {
        nodes {
          id
          name
          email
          active
        }
      }
      issues(first: 120) {
        nodes {
          identifier
          title
          assignee { id }
          creator { id }
        }
      }
    }`
  );

  const viewer = data.viewer || {};
  const meId = viewer.id || "linear-me";
  const users = new Map(
    (data.users?.nodes || [])
      .filter((entry) => entry?.id && entry.active !== false)
      .map((entry) => [entry.id, entry])
  );

  const collaborators = new Map();
  let scanned = 0;
  for (const issue of data.issues?.nodes || []) {
    scanned += 1;
    const creatorId = issue?.creator?.id;
    const assigneeId = issue?.assignee?.id;

    const related =
      creatorId === meId
        ? assigneeId
        : assigneeId === meId
          ? creatorId
          : null;
    if (!related || related === meId) {
      continue;
    }

    const person = users.get(related) || {};
    const current = collaborators.get(related) || {
      id: related,
      label: person.name || person.email || related,
      handle: person.email || "",
      weight: 0,
      sharedChannelSignals: 0,
      channels: [],
      topics: []
    };
    current.weight += 2;
    current.sharedChannelSignals += 1;
    current.channels.push("Linear issue workflow");
    for (const topic of inferTopics(issue?.title || "")) {
      current.topics.push(topic);
    }
    collaborators.set(related, current);
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: meId,
      label: viewer.name || viewer.email || "Linear User",
      handle: viewer.email || ""
    },
    collaborators: Array.from(collaborators.values()),
    conversationsScanned: scanned
  });
}

function inferTopics(text) {
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 4)
    )
  ).slice(0, 4);
}
