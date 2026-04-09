import { buildSimpleRelationshipGraph } from "./simple-graph.js";

export async function exchangeZoomCode({ code, clientId, clientSecret, redirectUri }) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });
  return response.json();
}

export async function zoomApi(path, token, query = {}) {
  const url = new URL(`https://api.zoom.us/v2/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zoom API failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchZoomProfile(token) {
  const me = await zoomApi("users/me", token);
  return {
    id: me.id || me.email || "",
    name: me.display_name || me.first_name || me.email || "Zoom User",
    handle: me.email || "",
    accountId: me.account_id || ""
  };
}

export async function buildZoomGraph({ token }) {
  const me = await fetchZoomProfile(token);
  const meetings = await zoomApi("users/me/meetings", token, {
    type: "scheduled",
    page_size: 60
  }).catch(() => ({ meetings: [] }));

  const collaborators = [];
  for (const meeting of meetings.meetings || []) {
    collaborators.push({
      id: `meeting-host-${meeting.id}`,
      label: "Meeting participants",
      handle: "",
      weight: 1,
      sharedChannelSignals: 1,
      channels: ["Zoom meetings"],
      topics: inferTopics(meeting.topic || "")
    });
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: me.id || me.handle || "zoom-me",
      label: me.name,
      handle: me.handle
    },
    collaborators,
    conversationsScanned: (meetings.meetings || []).length
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
