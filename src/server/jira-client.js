export async function exchangeJiraCode({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });
  return response.json();
}

export async function fetchAccessibleResources(token) {
  const response = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  return response.json();
}

export async function jiraApi(path, token, cloudId, query = {}) {
  const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/${path}`);
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
    const text = await response.text();
    throw new Error(`Jira API ${path} failed: ${response.status} ${text.slice(0, 180)}`);
  }

  return response.json();
}

export async function fetchJiraProfile(token) {
  const resources = await fetchAccessibleResources(token);
  const cloud = Array.isArray(resources) ? resources[0] : null;

  if (!cloud?.id) {
    throw new Error("No Jira cloud site is accessible for this token.");
  }

  const me = await jiraApi("myself", token, cloud.id);
  return {
    id: me.accountId,
    name: me.displayName || me.emailAddress || "Jira User",
    handle: me.emailAddress || me.accountId,
    cloudId: cloud.id,
    siteName: cloud.name || "Jira Cloud",
    siteUrl: cloud.url || ""
  };
}
