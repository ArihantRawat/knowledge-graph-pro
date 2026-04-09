import { hasBackend, resolveApiUrl } from "./config.js";

export async function fetchJson(pathOrUrl, options) {
  const url =
    pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
      ? pathOrUrl
      : resolveApiUrl(pathOrUrl);

  if (!url) {
    throw new Error("Backend API is not configured for this deployment.");
  }

  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

export async function fetchStaticJson(path) {
  const response = await fetch(path);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("Unable to load static demo data.");
  }
  return payload;
}

export async function loadAppConfig() {
  if (!hasBackend) {
    return demoConfig();
  }
  return fetchJson("/api/config");
}

export async function fetchGraph({ mode = "live", sources = [] } = {}) {
  const query = sources.length ? `?sources=${encodeURIComponent(sources.join(","))}` : "";

  if (mode === "demo") {
    if (hasBackend) {
      try {
        return await fetchJson(`/api/demo-graph${query}`);
      } catch {}
    }
    return fetchStaticJson("./data/demo-graph.json");
  }

  return fetchJson(`/api/graph${query}`);
}

export async function saveIntegrationConfig(sourceId, payload) {
  return fetchJson(`/api/integrations/${sourceId}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function demoConfig() {
  return {
    appName: "Knowledge-Graph-Pro",
    appOrigin: window.location.origin,
    integrations: [
      demoIntegration("slack", "Slack", true, false, "DMs, shared channels, mentions, and message topics.", ["DMs", "Channels", "Mentions", "Topics"]),
      demoIntegration("jira", "Jira", true, false, "Issues, assignees, reporters, comments, and delivery coordination.", ["Issues", "Comments", "Mentions", "Projects"]),
      demoIntegration("google-workspace", "Google Workspace", true, false, "Chat, Meet, Drive, and Docs collaboration signals.", ["Chat", "Meet", "Docs", "Drive"]),
      demoIntegration("notion", "Notion", true, false, "Pages, comments, database ownership, and documentation overlap.", ["Pages", "Comments", "Databases", "Owners"]),
      demoIntegration("zoom", "Zoom", true, false, "Meeting overlap, recurring sessions, and collaboration rhythm.", ["Meetings", "Participants", "Cadence", "Hosts"]),
      demoIntegration("trello", "Trello", true, false, "Board membership, card handoffs, comments, and delivery flow.", ["Boards", "Cards", "Comments", "Handoffs"]),
      demoIntegration("github", "GitHub", true, false, "Pull requests, reviews, issues, and engineering collaboration depth.", ["PRs", "Reviews", "Issues", "Repos"]),
      demoIntegration("linear", "Linear", true, false, "Cycles, issue ownership, triage, and product execution flow.", ["Cycles", "Issues", "Owners", "Projects"]),
      demoIntegration("confluence", "Confluence", true, false, "Docs, comments, authorship, and institutional knowledge sharing.", ["Pages", "Comments", "Authors", "Spaces"]),
      demoIntegration("gmail-calendar", "Gmail / Calendar", true, false, "Email threads, recurring events, and communication cadence outside chat.", ["Emails", "Events", "Cadence", "Attendees"]),
      demoIntegration("figma", "Figma", true, false, "Comment threads, handoff activity, and shared design ownership.", ["Files", "Comments", "Handoffs", "Editors"])
    ],
    suggestions: [
      { id: "salesforce", label: "Salesforce", why: "Account ownership, opportunity movement, and customer relationships add revenue context." },
      { id: "hubspot", label: "HubSpot", why: "Marketing and CRM touchpoints can deepen external collaboration mapping." },
      { id: "miro", label: "Miro", why: "Workshop participation and board ownership add planning and ideation signals." },
      { id: "zendesk", label: "Zendesk", why: "Support escalations and shared customer resolution work surface service relationships." },
      { id: "loom", label: "Loom", why: "Async walkthroughs and view patterns add another communication layer." }
    ],
    authenticatedSources: []
  };
}

function demoIntegration(id, label, liveSupported, planned, description, dataPoints) {
  return {
    id,
    label,
    liveSupported,
    planned,
    description,
    dataPoints,
    configured: false,
    authenticated: false,
    configIssue: planned ? "Planned connector" : "Backend API is not configured.",
    redirectUri: ""
  };
}
