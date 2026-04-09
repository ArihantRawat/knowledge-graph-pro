import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createSecureContext } from "node:tls";
import { fileURLToPath } from "node:url";

export function resolvePaths() {
  const __filename = fileURLToPath(import.meta.url);
  const srcServerDir = dirname(__filename);
  const rootDir = join(srcServerDir, "..", "..");
  return {
    rootDir,
    envFilePath: join(rootDir, ".env"),
    publicDir: join(rootDir, "public"),
    certDefaultPath: join(rootDir, "certs", "localhost.pfx")
  };
}

export function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) {
        continue;
      }
      const [key, ...rest] = line.split("=");
      if (!(key in process.env)) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch {}
}

export function resolveRuntimeConfig() {
  const port = Number(process.env.PORT || 3000);
  const envOrigin = (process.env.APP_ORIGIN || "").trim();
  let appOrigin = envOrigin || `http://localhost:${port}`;

  if (envOrigin) {
    try {
      const parsed = new URL(envOrigin);
      if (
        ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
        Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)) !== port
      ) {
        parsed.port = String(port);
        appOrigin = parsed.toString().replace(/\/$/, "");
      }
    } catch {}
  }

  return {
    port,
    appOrigin,
    baseUrl: appOrigin
  };
}

export function loadTlsOptions(certDefaultPath) {
  const pfxPath = process.env.TLS_PFX_PATH || certDefaultPath;
  const passphrase = process.env.TLS_PFX_PASSPHRASE || "jiragraph-local-dev";

  try {
    if (String(pfxPath).trim() === "__disabled__") {
      return null;
    }

    const options = {
      pfx: readFileSync(pfxPath),
      passphrase
    };
    createSecureContext(options);
    return options;
  } catch {
    return null;
  }
}

export function validateJiraConfig() {
  return validateIntegrationConfig("jira");
}

export function isJiraConfigured() {
  return validateJiraConfig().ok;
}

export function validateSlackConfig() {
  return validateIntegrationConfig("slack");
}

export function isSlackConfigured() {
  return validateSlackConfig().ok;
}

export function validateIntegrationConfig(sourceId) {
  const spec = INTEGRATION_ENV[sourceId];
  if (!spec) {
    return { ok: false, issue: "Unsupported integration source." };
  }

  const clientId = (process.env[spec.clientIdKey] || "").trim();
  const clientSecret = (process.env[spec.clientSecretKey] || "").trim();
  const redirectUri = (process.env[spec.redirectUriKey] || "").trim();

  if (!clientId || (!clientSecret && !spec.secretOptional) || !redirectUri) {
    return { ok: false, issue: `Missing ${spec.label} credentials in .env.` };
  }

  if (
    (clientId && clientId.toLowerCase().includes("your_")) ||
    (clientSecret && clientSecret.toLowerCase().includes("your_"))
  ) {
    return { ok: false, issue: `Placeholder ${spec.label} credentials detected in .env.` };
  }

  if (!isAllowedLocalRedirectUri(redirectUri)) {
    return { ok: false, issue: `${spec.label} redirect URI must use https:// or http://localhost.` };
  }

  return { ok: true, issue: null };
}

export function isIntegrationConfigured(sourceId) {
  return validateIntegrationConfig(sourceId).ok;
}

export function integrationEnvKeys(sourceId) {
  return INTEGRATION_ENV[sourceId] || null;
}

function isAllowedLocalRedirectUri(value) {
  return (
    String(value).startsWith("https://") ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(String(value))
  );
}

const INTEGRATION_ENV = {
  slack: {
    label: "Slack",
    clientIdKey: "SLACK_CLIENT_ID",
    clientSecretKey: "SLACK_CLIENT_SECRET",
    redirectUriKey: "SLACK_REDIRECT_URI"
  },
  jira: {
    label: "Jira",
    clientIdKey: "JIRA_CLIENT_ID",
    clientSecretKey: "JIRA_CLIENT_SECRET",
    redirectUriKey: "JIRA_REDIRECT_URI"
  },
  confluence: {
    label: "Confluence",
    clientIdKey: "CONFLUENCE_CLIENT_ID",
    clientSecretKey: "CONFLUENCE_CLIENT_SECRET",
    redirectUriKey: "CONFLUENCE_REDIRECT_URI"
  },
  "google-workspace": {
    label: "Google Workspace",
    clientIdKey: "GOOGLE_WORKSPACE_CLIENT_ID",
    clientSecretKey: "GOOGLE_WORKSPACE_CLIENT_SECRET",
    redirectUriKey: "GOOGLE_WORKSPACE_REDIRECT_URI"
  },
  "gmail-calendar": {
    label: "Gmail / Calendar",
    clientIdKey: "GMAIL_CALENDAR_CLIENT_ID",
    clientSecretKey: "GMAIL_CALENDAR_CLIENT_SECRET",
    redirectUriKey: "GMAIL_CALENDAR_REDIRECT_URI"
  },
  notion: {
    label: "Notion",
    clientIdKey: "NOTION_CLIENT_ID",
    clientSecretKey: "NOTION_CLIENT_SECRET",
    redirectUriKey: "NOTION_REDIRECT_URI"
  },
  zoom: {
    label: "Zoom",
    clientIdKey: "ZOOM_CLIENT_ID",
    clientSecretKey: "ZOOM_CLIENT_SECRET",
    redirectUriKey: "ZOOM_REDIRECT_URI"
  },
  trello: {
    label: "Trello",
    clientIdKey: "TRELLO_CLIENT_ID",
    clientSecretKey: "TRELLO_CLIENT_SECRET",
    redirectUriKey: "TRELLO_REDIRECT_URI",
    secretOptional: true
  },
  github: {
    label: "GitHub",
    clientIdKey: "GITHUB_CLIENT_ID",
    clientSecretKey: "GITHUB_CLIENT_SECRET",
    redirectUriKey: "GITHUB_REDIRECT_URI"
  },
  linear: {
    label: "Linear",
    clientIdKey: "LINEAR_CLIENT_ID",
    clientSecretKey: "LINEAR_CLIENT_SECRET",
    redirectUriKey: "LINEAR_REDIRECT_URI"
  },
  figma: {
    label: "Figma",
    clientIdKey: "FIGMA_CLIENT_ID",
    clientSecretKey: "FIGMA_CLIENT_SECRET",
    redirectUriKey: "FIGMA_REDIRECT_URI"
  }
};
