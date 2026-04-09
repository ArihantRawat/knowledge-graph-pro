import { buildSimpleRelationshipGraph } from "./simple-graph.js";

const NOTION_VERSION = "2026-03-11";

export async function exchangeNotionCode({ code, clientId, clientSecret, redirectUri }) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });
  return response.json();
}

export async function notionApi(path, token, method = "GET", body) {
  const response = await fetch(`https://api.notion.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Notion API failed (${response.status}): ${payload.slice(0, 180)}`);
  }
  return response.json();
}

export function notionProfileFromTokenPayload(tokenPayload) {
  const owner = tokenPayload?.owner?.user || {};
  return {
    id: owner.id || tokenPayload?.workspace_id || "notion-workspace",
    name: owner.name || tokenPayload?.workspace_name || "Notion Workspace",
    handle: owner.person?.email || "",
    workspaceId: tokenPayload?.workspace_id || "",
    workspaceName: tokenPayload?.workspace_name || "Notion Workspace"
  };
}

export async function buildNotionGraph({ token, profile }) {
  const users = await notionApi("/v1/users?page_size=100", token);
  const pages = await notionApi("/v1/search", token, "POST", {
    page_size: 80,
    sort: {
      direction: "descending",
      timestamp: "last_edited_time"
    }
  });

  const meId = profile?.id || profile?.workspaceId || "notion-workspace";
  const meLabel = profile?.name || profile?.workspaceName || "Notion Workspace";
  const userById = new Map(
    (users.results || [])
      .filter((entry) => entry?.object === "user" && entry.type !== "bot")
      .map((entry) => [entry.id, entry])
  );
  const collaborators = new Map();
  let scanned = 0;

  for (const page of pages.results || []) {
    scanned += 1;
    const createdById = page?.created_by?.id || null;
    const editedById = page?.last_edited_by?.id || null;
    const title = pageTitle(page);

    for (const userId of [createdById, editedById]) {
      if (!userId || userId === meId) {
        continue;
      }
      const person = userById.get(userId) || {};
      const current = collaborators.get(userId) || {
        id: userId,
        label: person.name || `Notion user ${userId.slice(0, 6)}`,
        handle: person?.person?.email || "",
        weight: 0,
        sharedChannelSignals: 0,
        channels: [],
        topics: []
      };
      current.weight += 1;
      current.sharedChannelSignals += 1;
      current.channels.push("Notion pages");
      for (const topic of inferTopics(title)) {
        current.topics.push(topic);
      }
      collaborators.set(userId, current);
    }
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: meId,
      label: meLabel,
      handle: profile?.handle || ""
    },
    collaborators: Array.from(collaborators.values()),
    conversationsScanned: scanned
  });
}

function pageTitle(page) {
  const titleParts = page?.properties?.title?.title || page?.title || [];
  if (Array.isArray(titleParts) && titleParts.length > 0) {
    return titleParts.map((part) => part?.plain_text || "").join(" ").trim();
  }
  return String(page?.id || "Untitled");
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
