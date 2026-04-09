export const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export const JIRA_SCOPES = [
  "read:jira-work",
  "read:jira-user",
  "offline_access"
];

export const CONFLUENCE_SCOPES = [
  "read:confluence-content.summary",
  "read:confluence-user",
  "search:confluence",
  "offline_access"
];

export const SLACK_USER_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "im:read",
  "im:history",
  "mpim:read",
  "mpim:history",
  "users:read",
  "users:read.email"
];

export const GITHUB_SCOPES = [
  "read:user",
  "user:email",
  "repo",
  "read:org"
];

export const LINEAR_SCOPES = [
  "read"
];

export const GOOGLE_WORKSPACE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/contacts.readonly"
];

export const GMAIL_CALENDAR_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly"
];

export const FIGMA_SCOPES = [
  "current_user:read",
  "file_content:read",
  "file_comments:read",
  "projects:read"
];

export const TRELLO_SCOPES = [
  "read",
  "write",
  "account"
];

export const SOURCE_DEFINITIONS = [
  {
    id: "slack",
    label: "Slack",
    description: "DMs, shared channels, mentions, and message topics.",
    category: "Messaging",
    liveSupported: true,
    planned: false,
    dataPoints: ["DMs", "Channels", "Mentions", "Topics"],
    accent: "#f59e0b"
  },
  {
    id: "jira",
    label: "Jira",
    description: "Issues, assignees, reporters, comments, and delivery coordination.",
    category: "Work tracking",
    liveSupported: true,
    planned: false,
    dataPoints: ["Issues", "Comments", "Mentions", "Projects"],
    accent: "#38bdf8"
  },
  {
    id: "google-workspace",
    label: "Google Workspace",
    description: "Chat, Meet, Drive, and Docs collaboration signals.",
    category: "Collaboration",
    liveSupported: true,
    planned: false,
    dataPoints: ["Chat", "Meet", "Docs", "Drive"],
    accent: "#22c55e"
  },
  {
    id: "notion",
    label: "Notion",
    description: "Pages, comments, database ownership, and documentation overlap.",
    category: "Knowledge",
    liveSupported: true,
    planned: false,
    dataPoints: ["Pages", "Comments", "Databases", "Owners"],
    accent: "#f97316"
  },
  {
    id: "zoom",
    label: "Zoom",
    description: "Meeting overlap, recurring sessions, and collaboration rhythm.",
    category: "Meetings",
    liveSupported: true,
    planned: false,
    dataPoints: ["Meetings", "Participants", "Cadence", "Hosts"],
    accent: "#60a5fa"
  },
  {
    id: "trello",
    label: "Trello",
    description: "Board membership, card handoffs, comments, and delivery flow.",
    category: "Project management",
    liveSupported: true,
    planned: false,
    dataPoints: ["Boards", "Cards", "Comments", "Handoffs"],
    accent: "#14b8a6"
  },
  {
    id: "github",
    label: "GitHub",
    description: "Pull requests, reviews, issues, and engineering collaboration depth.",
    category: "Engineering",
    liveSupported: true,
    planned: false,
    dataPoints: ["PRs", "Reviews", "Issues", "Repos"],
    accent: "#a78bfa"
  },
  {
    id: "linear",
    label: "Linear",
    description: "Cycles, issue ownership, triage, and product execution flow.",
    category: "Product execution",
    liveSupported: true,
    planned: false,
    dataPoints: ["Cycles", "Issues", "Owners", "Projects"],
    accent: "#f43f5e"
  },
  {
    id: "confluence",
    label: "Confluence",
    description: "Docs, comments, authorship, and institutional knowledge sharing.",
    category: "Documentation",
    liveSupported: true,
    planned: false,
    dataPoints: ["Pages", "Comments", "Authors", "Spaces"],
    accent: "#2563eb"
  },
  {
    id: "gmail-calendar",
    label: "Gmail / Calendar",
    description: "Email threads, recurring events, and communication cadence outside chat.",
    category: "Communication",
    liveSupported: true,
    planned: false,
    dataPoints: ["Emails", "Events", "Cadence", "Attendees"],
    accent: "#ef4444"
  },
  {
    id: "figma",
    label: "Figma",
    description: "Comment threads, handoff activity, and shared design ownership.",
    category: "Design",
    liveSupported: true,
    planned: false,
    dataPoints: ["Files", "Comments", "Handoffs", "Editors"],
    accent: "#ec4899"
  }
];

export const LIVE_SOURCE_IDS = SOURCE_DEFINITIONS.filter((source) => source.liveSupported).map(
  (source) => source.id
);

export const SOURCE_LABELS = Object.fromEntries(
  SOURCE_DEFINITIONS.map((source) => [source.id, source.label])
);

export const SOURCE_ACCENTS = Object.fromEntries(
  SOURCE_DEFINITIONS.map((source) => [source.id, source.accent])
);

export const SUGGESTED_SOURCES = [
  {
    id: "salesforce",
    label: "Salesforce",
    why: "Account ownership, opportunity movement, and customer relationships add revenue context."
  },
  {
    id: "hubspot",
    label: "HubSpot",
    why: "Marketing and CRM touchpoints can deepen external collaboration mapping."
  },
  {
    id: "miro",
    label: "Miro",
    why: "Workshop participation and board ownership add planning and ideation signals."
  },
  {
    id: "zendesk",
    label: "Zendesk",
    why: "Support escalations and shared customer resolution work surface service relationships."
  },
  {
    id: "loom",
    label: "Loom",
    why: "Async walkthroughs and view patterns add another communication layer."
  }
];
