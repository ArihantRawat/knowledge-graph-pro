import { buildSimpleRelationshipGraph } from "./simple-graph.js";

export async function exchangeGitHubCode({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });
  return response.json();
}

export async function githubApi(path, token, query = {}) {
  const url = new URL(`https://api.github.com${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchGitHubProfile(token) {
  const me = await githubApi("/user", token);
  return {
    id: String(me.id),
    name: me.name || me.login || "GitHub User",
    handle: me.login || "",
    login: me.login || "",
    avatarUrl: me.avatar_url || ""
  };
}

export async function buildGitHubGraph({ token }) {
  const me = await fetchGitHubProfile(token);
  const repos = await githubApi("/user/repos", token, {
    per_page: 25,
    sort: "updated",
    affiliation: "owner,collaborator,organization_member"
  });

  const collaborators = new Map();
  let scanned = 0;

  for (const repo of repos || []) {
    if (!repo?.full_name || repo.fork) {
      continue;
    }
    scanned += 1;

    let contributors = [];
    try {
      contributors = await githubApi(`/repos/${repo.full_name}/contributors`, token, { per_page: 15 });
    } catch {
      continue;
    }

    for (const contributor of contributors || []) {
      if (!contributor?.id || String(contributor.id) === me.id) {
        continue;
      }
      const key = String(contributor.id);
      const current = collaborators.get(key) || {
        id: key,
        label: contributor.login || `User ${key}`,
        handle: contributor.login || "",
        weight: 0,
        mentions: 0,
        sharedChannelSignals: 0,
        channels: [],
        topics: []
      };
      current.weight += Math.max(1, Math.min(10, Number(contributor.contributions || 1)));
      current.sharedChannelSignals += 1;
      current.channels.push(`Repo ${repo.name}`);
      if (repo.language) {
        current.topics = Array.from(new Set([...current.topics, repo.language]));
      }
      collaborators.set(key, current);
    }
  }

  return buildSimpleRelationshipGraph({
    me: {
      id: me.id,
      label: me.name,
      handle: me.handle
    },
    collaborators: Array.from(collaborators.values()),
    conversationsScanned: scanned
  });
}
