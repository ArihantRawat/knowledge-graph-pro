import { buildSimpleRelationshipGraph } from "./simple-graph.js";

export async function exchangeGoogleCode({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  return response.json();
}

export async function googleApi(url, token, method = "GET", body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Google API failed (${response.status}): ${payload.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchGoogleProfile(token) {
  const profile = await googleApi("https://www.googleapis.com/oauth2/v2/userinfo", token);
  return {
    id: profile.id || profile.email || "",
    name: profile.name || profile.email || "Google User",
    handle: profile.email || "",
    picture: profile.picture || ""
  };
}

export async function buildGoogleWorkspaceGraph({ token }) {
  const me = await fetchGoogleProfile(token);
  let connections = [];
  try {
    const response = await googleApi(
      "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=120",
      token
    );
    connections = response.connections || [];
  } catch {
    connections = [];
  }

  const collaborators = [];
  for (const person of connections) {
    const email = person?.emailAddresses?.[0]?.value || "";
    const name = person?.names?.[0]?.displayName || email;
    if (!email || sameIdentity(email, me.handle)) {
      continue;
    }
    collaborators.push({
      id: email.toLowerCase(),
      label: name || email,
      handle: email,
      weight: 1,
      sharedChannelSignals: 1,
      channels: ["Google contacts"],
      topics: ["workspace"]
    });
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: me.id || me.handle || "google-me",
      label: me.name,
      handle: me.handle
    },
    collaborators,
    conversationsScanned: connections.length
  });
}

export async function buildGmailCalendarGraph({ token }) {
  const me = await fetchGoogleProfile(token);
  const collaborators = new Map();
  let scanned = 0;

  const messageList = await googleApi(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=35&q=newer_than:30d",
    token
  ).catch(() => ({ messages: [] }));

  for (const message of messageList.messages || []) {
    if (!message?.id) {
      continue;
    }
    scanned += 1;
    const detail = await googleApi(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
      token
    ).catch(() => null);
    if (!detail) {
      continue;
    }

    const headers = new Map(
      (detail.payload?.headers || []).map((entry) => [String(entry.name || "").toLowerCase(), String(entry.value || "")])
    );
    const subject = headers.get("subject") || "";
    const participants = [
      ...extractEmails(headers.get("from")),
      ...extractEmails(headers.get("to")),
      ...extractEmails(headers.get("cc"))
    ];
    for (const email of participants) {
      if (!email || sameIdentity(email, me.handle)) {
        continue;
      }
      const key = email.toLowerCase();
      const current = collaborators.get(key) || {
        id: key,
        label: email,
        handle: email,
        weight: 0,
        sharedChannelSignals: 0,
        channels: [],
        topics: []
      };
      current.weight += 1;
      current.sharedChannelSignals += 1;
      current.channels.push("Gmail threads");
      for (const topic of inferTopics(subject)) {
        current.topics.push(topic);
      }
      collaborators.set(key, current);
    }
  }

  const nowIso = new Date().toISOString();
  const calendar = await googleApi(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=35&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(nowIso)}`,
    token
  ).catch(() => ({ items: [] }));

  for (const event of calendar.items || []) {
    scanned += 1;
    for (const attendee of event.attendees || []) {
      const email = String(attendee?.email || "").trim();
      if (!email || sameIdentity(email, me.handle)) {
        continue;
      }
      const key = email.toLowerCase();
      const current = collaborators.get(key) || {
        id: key,
        label: email,
        handle: email,
        weight: 0,
        sharedChannelSignals: 0,
        channels: [],
        topics: []
      };
      current.weight += 1;
      current.sharedChannelSignals += 1;
      current.channels.push("Calendar events");
      for (const topic of inferTopics(event.summary || "")) {
        current.topics.push(topic);
      }
      collaborators.set(key, current);
    }
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: me.id || me.handle || "google-me",
      label: me.name,
      handle: me.handle
    },
    collaborators: Array.from(collaborators.values()),
    conversationsScanned: scanned
  });
}

function extractEmails(raw) {
  if (!raw) {
    return [];
  }
  return Array.from(
    new Set(
      String(raw)
        .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
    )
  );
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

function sameIdentity(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}
