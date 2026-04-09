import { buildSimpleRelationshipGraph } from "./simple-graph.js";

export function buildTrelloAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://trello.com/1/authorize");
  url.searchParams.set("key", clientId);
  url.searchParams.set("name", "Knowledge-Graph-Pro");
  url.searchParams.set("expiration", "30days");
  url.searchParams.set("scope", "read,write,account");
  url.searchParams.set("response_type", "token");
  url.searchParams.set("callback_method", "fragment");
  url.searchParams.set("return_url", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function trelloApi(path, key, token, query = {}) {
  const url = new URL(`https://api.trello.com/1/${path.replace(/^\//, "")}`);
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);

  for (const [queryKey, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(queryKey, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello API failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchTrelloProfile({ key, token }) {
  const me = await trelloApi("members/me", key, token, {
    fields: "id,fullName,username"
  });
  return {
    id: me.id || "",
    name: me.fullName || me.username || "Trello User",
    handle: me.username || ""
  };
}

export async function buildTrelloGraph({ key, token }) {
  const me = await fetchTrelloProfile({ key, token });
  const boards = await trelloApi("members/me/boards", key, token, {
    fields: "id,name",
    filter: "open"
  });

  const collaborators = new Map();
  let scanned = 0;
  for (const board of boards || []) {
    if (!board?.id) {
      continue;
    }
    scanned += 1;
    const members = await trelloApi(`boards/${board.id}/members`, key, token, {
      fields: "id,fullName,username"
    }).catch(() => []);

    for (const member of members || []) {
      if (!member?.id || member.id === me.id) {
        continue;
      }
      const current = collaborators.get(member.id) || {
        id: member.id,
        label: member.fullName || member.username || member.id,
        handle: member.username || "",
        weight: 0,
        sharedChannelSignals: 0,
        channels: [],
        topics: []
      };
      current.weight += 2;
      current.sharedChannelSignals += 1;
      current.channels.push(`Board ${board.name || board.id}`);
      collaborators.set(member.id, current);
    }
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: me.id || me.handle || "trello-me",
      label: me.name,
      handle: me.handle
    },
    collaborators: Array.from(collaborators.values()),
    conversationsScanned: scanned
  });
}
