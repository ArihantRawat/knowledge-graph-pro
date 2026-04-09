import { randomUUID } from "node:crypto";
import {
  CONFLUENCE_SCOPES,
  FIGMA_SCOPES,
  GITHUB_SCOPES,
  GMAIL_CALENDAR_SCOPES,
  GOOGLE_WORKSPACE_SCOPES,
  JIRA_SCOPES,
  LINEAR_SCOPES,
  LIVE_SOURCE_IDS,
  SLACK_USER_SCOPES,
  SOURCE_DEFINITIONS,
  SUGGESTED_SOURCES
} from "./constants.js";
import {
  integrationEnvKeys,
  isIntegrationConfigured,
  validateIntegrationConfig
} from "./config.js";
import { buildConfluenceGraph, fetchConfluenceProfile } from "./confluence-client.js";
import { demoGraph } from "./demo-graph.js";
import { buildFigmaGraph, exchangeFigmaCode, fetchFigmaProfile } from "./figma-client.js";
import { buildGitHubGraph, exchangeGitHubCode, fetchGitHubProfile } from "./github-client.js";
import {
  buildGmailCalendarGraph,
  buildGoogleWorkspaceGraph,
  exchangeGoogleCode,
  fetchGoogleProfile
} from "./google-client.js";
import { combineSourceGraphs } from "./graph-merge.js";
import { json, redirect, readJsonBody } from "./http-utils.js";
import { writeIntegrationConfig } from "./integration-config-store.js";
import { exchangeJiraCode, fetchJiraProfile } from "./jira-client.js";
import { buildJiraGraph } from "./jira-graph.js";
import { buildLinearGraph, exchangeLinearCode, fetchLinearProfile } from "./linear-client.js";
import { buildNotionGraph, exchangeNotionCode, notionProfileFromTokenPayload } from "./notion-client.js";
import { exchangeSlackCode, fetchSlackProfile, slackApi } from "./slack-client.js";
import { buildSlackGraph } from "./slack-graph.js";
import {
  buildTrelloAuthorizeUrl,
  buildTrelloGraph,
  fetchTrelloProfile
} from "./trello-client.js";
import { buildZoomGraph, exchangeZoomCode, fetchZoomProfile } from "./zoom-client.js";

export function createRequestHandler({
  baseUrl,
  appOrigin,
  port,
  rootDir,
  envFilePath,
  getSession,
  getIntegrationState,
  saveIntegrationState,
  serveStatic
}) {
  return async function requestHandler(req, res) {
    try {
      const url = new URL(req.url || "/", baseUrl);
      const session = getSession(req, res);
      const oauthState = ensureOAuthState(session);
      const integrationState = getIntegrationState();
      const configMatch = url.pathname.match(/^\/api\/integrations\/([a-z-]+)\/config$/);
      const authStartMatch = url.pathname.match(/^\/auth\/([a-z-]+)\/start$/);
      const authCallbackMatch = url.pathname.match(/^\/auth\/([a-z-]+)\/callback$/);

      if (req.method === "GET" && url.pathname === "/api/config") {
        return json(res, 200, {
          appName: "Knowledge-Graph-Pro",
          appOrigin,
          integrations: buildIntegrationPayload(integrationState, appOrigin),
          suggestions: SUGGESTED_SOURCES,
          authenticatedSources: LIVE_SOURCE_IDS.filter((sourceId) => Boolean(integrationState[sourceId]?.token))
        });
      }

      if (req.method === "POST" && configMatch) {
        const sourceId = configMatch[1];
        if (!LIVE_SOURCE_IDS.includes(sourceId)) {
          return json(res, 400, { error: "This integration is not configurable yet." });
        }

        const body = await readJsonBody(req);
        const clientId = String(body.clientId || "").trim();
        const clientSecret = String(body.clientSecret || "").trim();
        const redirectUri =
          String(body.redirectUri || "").trim() || `${appOrigin}/auth/${sourceId}/callback`;
        const keys = integrationEnvKeys(sourceId);

        if (!keys) {
          return json(res, 400, { error: "Unsupported integration source." });
        }

        const requiresSecret = sourceId !== "trello";
        if (!clientId || (requiresSecret && !clientSecret)) {
          return json(res, 400, { error: "Client ID and Client Secret are required." });
        }

        await writeIntegrationConfig({
          sourceId,
          clientId,
          clientSecret,
          redirectUri,
          appOrigin,
          port,
          rootDir,
          envFilePath
        });

        const validation = validateIntegrationConfig(sourceId);
        return json(res, 200, {
          ok: validation.ok,
          configIssue: validation.issue,
          redirectUri
        });
      }

      if (req.method === "GET" && authStartMatch) {
        const sourceId = authStartMatch[1];
        if (!LIVE_SOURCE_IDS.includes(sourceId)) {
          return json(res, 400, { error: "This integration cannot be connected yet." });
        }
        if (!isIntegrationConfigured(sourceId)) {
          redirect(res, `/?error=${encodeURIComponent(`${sourceLabel(sourceId)} is not configured yet.`)}`);
          return;
        }

        const record = ensureIntegrationRecord(oauthState, sourceId);
        const state = randomUUID();
        record.oauthState = state;

        const authUrl = buildAuthorizationUrl(sourceId, appOrigin, state);
        redirect(res, authUrl);
        return;
      }

      if (req.method === "GET" && authCallbackMatch) {
        const sourceId = authCallbackMatch[1];
        if (!LIVE_SOURCE_IDS.includes(sourceId)) {
          return json(res, 400, { error: "This integration cannot be connected yet." });
        }

        const oauthRecord = ensureIntegrationRecord(oauthState, sourceId);
        const error = url.searchParams.get("error");
        if (error) {
          redirect(res, `/?error=${encodeURIComponent(error)}`);
          return;
        }

        if (sourceId === "trello") {
          return handleTrelloCallback({
            res,
            url,
            oauthRecord,
            integrationState,
            saveIntegrationState
          });
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state || state !== oauthRecord.oauthState) {
          return json(res, 400, { error: "Invalid OAuth callback state." });
        }

        const tokenResult = await exchangeAuthorizationCode(sourceId, code, appOrigin);
        const accessToken = extractAccessToken(sourceId, tokenResult);
        if (!accessToken) {
          return json(res, 400, { error: tokenResult.error_description || tokenResult.error || "OAuth exchange failed." });
        }

        const integrationRecord = ensureIntegrationRecord(integrationState, sourceId);
        integrationRecord.token = accessToken;
        integrationRecord.refreshToken = tokenResult.refresh_token || null;
        integrationRecord.expiresIn = Number(tokenResult.expires_in || 0) || null;
        integrationRecord.profile = await fetchProfileFromToken(sourceId, accessToken, tokenResult);
        oauthRecord.oauthState = null;
        await saveIntegrationState();
        redirect(res, "/");
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/graph") {
        const limit = Math.min(Number(url.searchParams.get("limit") || 75), 200);
        const requestedSources = parseRequestedSources(url);
        const sourceGraphs = [];
        const errors = [];

        for (const sourceId of requestedSources) {
          const record = integrationState[sourceId];
          if (!record?.token) {
            continue;
          }

          try {
            const graph = await buildGraphForSource({
              sourceId,
              record,
              limit
            });
            if (graph) {
              sourceGraphs.push({ sourceId, graph });
            }
          } catch (error) {
            errors.push(`${sourceLabel(sourceId)}: ${error.message}`);
          }
        }

        if (sourceGraphs.length === 0) {
          return json(res, 401, {
            error:
              errors[0] ||
              "No live integrations are connected yet. Open Integrations and connect one or more sources first."
          });
        }

        const combined = combineSourceGraphs(sourceGraphs);
        if (errors.length) {
          combined.warnings = errors;
        }
        return json(res, 200, combined);
      }

      if (req.method === "GET" && url.pathname === "/api/demo-graph") {
        return json(res, 200, demoGraph({ sources: parseRequestedSources(url) }));
      }

      return serveStatic(url.pathname, res);
    } catch (error) {
      console.error(error);
      return json(res, 500, { error: "Internal server error." });
    }
  };
}

async function buildGraphForSource({ sourceId, record, limit }) {
  if (sourceId === "jira" && record.profile?.cloudId) {
    return buildJiraGraph({
      token: record.token,
      cloudId: record.profile.cloudId,
      issueLimit: limit
    });
  }
  if (sourceId === "slack") {
    return buildSlackGraph({
      token: record.token,
      historyLimit: limit,
      slackApi
    });
  }
  if (sourceId === "confluence") {
    return buildConfluenceGraph({
      token: record.token,
      cloudId: record.profile?.cloudId
    });
  }
  if (sourceId === "github") {
    return buildGitHubGraph({ token: record.token });
  }
  if (sourceId === "linear") {
    return buildLinearGraph({ token: record.token });
  }
  if (sourceId === "notion") {
    return buildNotionGraph({
      token: record.token,
      profile: record.profile
    });
  }
  if (sourceId === "google-workspace") {
    return buildGoogleWorkspaceGraph({ token: record.token });
  }
  if (sourceId === "gmail-calendar") {
    return buildGmailCalendarGraph({ token: record.token });
  }
  if (sourceId === "zoom") {
    return buildZoomGraph({ token: record.token });
  }
  if (sourceId === "figma") {
    return buildFigmaGraph({ token: record.token });
  }
  if (sourceId === "trello") {
    const keys = integrationEnvKeys("trello");
    return buildTrelloGraph({
      key: process.env[keys.clientIdKey],
      token: record.token
    });
  }
  return null;
}

async function fetchProfileFromToken(sourceId, token, tokenResult) {
  if (sourceId === "jira") {
    return fetchJiraProfile(token);
  }
  if (sourceId === "slack") {
    return fetchSlackProfile(token);
  }
  if (sourceId === "confluence") {
    return fetchConfluenceProfile(token);
  }
  if (sourceId === "github") {
    return fetchGitHubProfile(token);
  }
  if (sourceId === "linear") {
    return fetchLinearProfile(token);
  }
  if (sourceId === "google-workspace" || sourceId === "gmail-calendar") {
    return fetchGoogleProfile(token);
  }
  if (sourceId === "notion") {
    return notionProfileFromTokenPayload(tokenResult);
  }
  if (sourceId === "zoom") {
    return fetchZoomProfile(token);
  }
  if (sourceId === "figma") {
    return fetchFigmaProfile(token);
  }
  return null;
}

function extractAccessToken(sourceId, tokenResult) {
  if (sourceId === "slack") {
    return tokenResult.authed_user?.access_token || tokenResult.access_token || null;
  }
  return tokenResult.access_token || null;
}

async function exchangeAuthorizationCode(sourceId, code, appOrigin) {
  const keys = integrationEnvKeys(sourceId);
  const redirectUri = resolveRedirectUri(sourceId, appOrigin);
  const common = {
    code,
    clientId: process.env[keys.clientIdKey],
    clientSecret: process.env[keys.clientSecretKey],
    redirectUri
  };

  if (sourceId === "jira" || sourceId === "confluence") {
    return exchangeJiraCode(common);
  }
  if (sourceId === "slack") {
    return exchangeSlackCode(common);
  }
  if (sourceId === "github") {
    return exchangeGitHubCode(common);
  }
  if (sourceId === "linear") {
    return exchangeLinearCode(common);
  }
  if (sourceId === "notion") {
    return exchangeNotionCode(common);
  }
  if (sourceId === "google-workspace" || sourceId === "gmail-calendar") {
    return exchangeGoogleCode(common);
  }
  if (sourceId === "zoom") {
    return exchangeZoomCode(common);
  }
  if (sourceId === "figma") {
    return exchangeFigmaCode(common);
  }

  return {};
}

function buildAuthorizationUrl(sourceId, appOrigin, state) {
  const keys = integrationEnvKeys(sourceId);
  const clientId = process.env[keys.clientIdKey] || "";
  const redirectUri = resolveRedirectUri(sourceId, appOrigin);

  if (sourceId === "jira") {
    return atlassianAuthorizeUrl(clientId, JIRA_SCOPES, redirectUri, state);
  }
  if (sourceId === "confluence") {
    return atlassianAuthorizeUrl(clientId, CONFLUENCE_SCOPES, redirectUri, state);
  }
  if (sourceId === "slack") {
    const authUrl = new URL("https://slack.com/oauth/v2/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("user_scope", SLACK_USER_SCOPES.join(","));
    return authUrl.toString();
  }
  if (sourceId === "github") {
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", GITHUB_SCOPES.join(" "));
    authUrl.searchParams.set("state", state);
    return authUrl.toString();
  }
  if (sourceId === "linear") {
    const authUrl = new URL("https://linear.app/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", LINEAR_SCOPES.join(","));
    authUrl.searchParams.set("state", state);
    return authUrl.toString();
  }
  if (sourceId === "notion") {
    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("state", state);
    return authUrl.toString();
  }
  if (sourceId === "google-workspace" || sourceId === "gmail-calendar") {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set(
      "scope",
      (sourceId === "google-workspace" ? GOOGLE_WORKSPACE_SCOPES : GMAIL_CALENDAR_SCOPES).join(" ")
    );
    authUrl.searchParams.set("state", state);
    return authUrl.toString();
  }
  if (sourceId === "zoom") {
    const authUrl = new URL("https://zoom.us/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    return authUrl.toString();
  }
  if (sourceId === "figma") {
    const authUrl = new URL("https://www.figma.com/oauth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", FIGMA_SCOPES.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    return authUrl.toString();
  }
  if (sourceId === "trello") {
    return buildTrelloAuthorizeUrl({
      clientId,
      redirectUri,
      state
    });
  }

  throw new Error("Unsupported integration source.");
}

function atlassianAuthorizeUrl(clientId, scopes, redirectUri, state) {
  const authUrl = new URL("https://auth.atlassian.com/authorize");
  authUrl.searchParams.set("audience", "api.atlassian.com");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("prompt", "consent");
  return authUrl.toString();
}

async function handleTrelloCallback({
  res,
  url,
  oauthRecord,
  integrationState,
  saveIntegrationState
}) {
  const token = url.searchParams.get("token");
  const state = url.searchParams.get("state");

  if (!token) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Trello callback</title></head>
  <body>
    <script>
      const hash = window.location.hash.replace(/^#/, "");
      const params = new URLSearchParams(hash);
      const next = new URL(window.location.pathname, window.location.origin);
      for (const [key, value] of params.entries()) {
        next.searchParams.set(key, value);
      }
      window.location.replace(next.toString());
    </script>
  </body>
</html>`);
    return;
  }

  if (!state || state !== oauthRecord.oauthState) {
    return json(res, 400, { error: "Invalid OAuth callback state." });
  }

  const keys = integrationEnvKeys("trello");
  const integrationRecord = ensureIntegrationRecord(integrationState, "trello");
  integrationRecord.token = token;
  integrationRecord.profile = await fetchTrelloProfile({
    key: process.env[keys.clientIdKey],
    token
  });
  oauthRecord.oauthState = null;
  await saveIntegrationState();
  redirect(res, "/");
}

function ensureOAuthState(session) {
  if (!session.oauth) {
    session.oauth = {};
  }
  return session.oauth;
}

function ensureIntegrationRecord(integrationState, sourceId) {
  if (!integrationState[sourceId]) {
    integrationState[sourceId] = {};
  }
  return integrationState[sourceId];
}

function buildIntegrationPayload(integrationState, appOrigin) {
  return SOURCE_DEFINITIONS.map((source) => {
    const record = integrationState[source.id] || {};
    const validation = validationForSource(source.id);
    const redirectUri = source.liveSupported ? resolveRedirectUri(source.id, appOrigin) : "";

    return {
      ...source,
      configured: source.liveSupported ? validation.ok : false,
      configIssue: source.liveSupported ? validation.issue : "Planned connector",
      authenticated: Boolean(record.token),
      redirectUri,
      user: record.profile || null
    };
  });
}

function validationForSource(sourceId) {
  return validateIntegrationConfig(sourceId);
}

function parseRequestedSources(url) {
  const raw = String(url.searchParams.get("sources") || "").trim();
  if (!raw) {
    return SOURCE_DEFINITIONS.map((source) => source.id);
  }

  const known = new Set(SOURCE_DEFINITIONS.map((source) => source.id));
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((sourceId) => known.has(sourceId));
}

function resolveRedirectUri(sourceId, appOrigin) {
  const keys = integrationEnvKeys(sourceId);
  const envValue = keys ? process.env[keys.redirectUriKey] : "";
  const fallback = `${appOrigin}/auth/${sourceId}/callback`;

  if (!envValue) {
    return fallback;
  }

  try {
    const redirectUrl = new URL(envValue);
    const origin = new URL(appOrigin);
    const isLocalRedirect = ["localhost", "127.0.0.1"].includes(redirectUrl.hostname);
    const isLocalOrigin = ["localhost", "127.0.0.1"].includes(origin.hostname);
    if (isLocalRedirect && isLocalOrigin && redirectUrl.port !== origin.port) {
      return fallback;
    }
  } catch {}

  return envValue;
}

function sourceLabel(sourceId) {
  return SOURCE_DEFINITIONS.find((source) => source.id === sourceId)?.label || sourceId;
}
