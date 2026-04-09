import { buildSimpleRelationshipGraph } from "./simple-graph.js";

export async function exchangeFigmaCode({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch("https://api.figma.com/v1/oauth/token", {
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

export async function figmaApi(path, token, query = {}) {
  const url = new URL(`https://api.figma.com/v1/${path.replace(/^\//, "")}`);
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
    const payload = await response.text();
    throw new Error(`Figma API failed (${response.status}): ${payload.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchFigmaProfile(token) {
  const me = await figmaApi("me", token);
  return {
    id: me.id || me.email || "",
    name: me.handle || me.email || "Figma User",
    handle: me.email || me.handle || ""
  };
}

export async function buildFigmaGraph({ token }) {
  const me = await fetchFigmaProfile(token);

  return buildSimpleRelationshipGraph({
    me: {
      id: me.id || me.handle || "figma-me",
      label: me.name,
      handle: me.handle
    },
    collaborators: [],
    conversationsScanned: 1
  });
}
