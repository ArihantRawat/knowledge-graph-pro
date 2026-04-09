import { buildSimpleRelationshipGraph } from "./simple-graph.js";
import { fetchAccessibleResources } from "./jira-client.js";

export async function confluenceApi(path, token, cloudId, query = {}) {
  const url = new URL(`https://api.atlassian.com/ex/confluence/${cloudId}/${path.replace(/^\//, "")}`);
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
    throw new Error(`Confluence API failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchConfluenceProfile(token) {
  const resources = await fetchAccessibleResources(token);
  const confluenceResource = (resources || []).find((resource) =>
    Array.isArray(resource.scopes) && resource.scopes.some((scope) => String(scope).includes("confluence"))
  );

  if (!confluenceResource?.id) {
    throw new Error("No Confluence cloud site is accessible for this token.");
  }

  const me = await confluenceApi("/wiki/rest/api/user/current", token, confluenceResource.id);
  return {
    id: me.accountId || me.userKey || confluenceResource.id,
    name: me.displayName || "Confluence User",
    handle: me.email || me.accountId || "",
    cloudId: confluenceResource.id,
    siteName: confluenceResource.name || "Confluence Cloud",
    siteUrl: confluenceResource.url || ""
  };
}

export async function buildConfluenceGraph({ token, cloudId }) {
  const profile = await fetchConfluenceProfile(token);
  const effectiveCloudId = cloudId || profile.cloudId;
  const search = await confluenceApi("/wiki/rest/api/search", token, effectiveCloudId, {
    cql: "type=page order by lastmodified desc",
    limit: 60
  });

  const collaborators = new Map();
  let scanned = 0;

  for (const result of search.results || []) {
    scanned += 1;
    const title = String(result.title || "");
    const candidates = [
      result?.history?.createdBy,
      result?.history?.lastUpdated?.by,
      result?.content?.history?.createdBy,
      result?.content?.history?.lastUpdated?.by
    ];

    for (const user of candidates) {
      const accountId = String(user?.accountId || "").trim();
      if (!accountId || accountId === profile.id) {
        continue;
      }

      const current = collaborators.get(accountId) || {
        id: accountId,
        label: user.displayName || accountId,
        handle: user.email || accountId,
        weight: 0,
        sharedChannelSignals: 0,
        channels: [],
        topics: []
      };
      current.weight += 1;
      current.sharedChannelSignals += 1;
      current.channels.push("Confluence pages");
      for (const topic of inferTopics(title)) {
        current.topics.push(topic);
      }
      collaborators.set(accountId, current);
    }
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: profile.id,
      label: profile.name,
      handle: profile.handle
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
