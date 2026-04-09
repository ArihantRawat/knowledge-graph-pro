import { join } from "node:path";
import { upsertEnvValues } from "./env-store.js";

export async function writeJiraConfig({
  clientId,
  clientSecret,
  redirectUri,
  appOrigin,
  port,
  rootDir,
  envFilePath
}) {
  process.env.JIRA_CLIENT_ID = clientId;
  process.env.JIRA_CLIENT_SECRET = clientSecret;
  process.env.JIRA_REDIRECT_URI = redirectUri;
  process.env.APP_ORIGIN = appOrigin;
  process.env.TLS_PFX_PATH = process.env.TLS_PFX_PATH || join(rootDir, "certs", "localhost.pfx");
  process.env.TLS_PFX_PASSPHRASE = process.env.TLS_PFX_PASSPHRASE || "jiragraph-local-dev";
  process.env.PORT = process.env.PORT || String(port);

  await upsertEnvValues(envFilePath, {
    JIRA_CLIENT_ID: clientId,
    JIRA_CLIENT_SECRET: clientSecret,
    JIRA_REDIRECT_URI: redirectUri,
    APP_ORIGIN: process.env.APP_ORIGIN,
    TLS_PFX_PATH: process.env.TLS_PFX_PATH,
    TLS_PFX_PASSPHRASE: process.env.TLS_PFX_PASSPHRASE,
    PORT: process.env.PORT
  });
}
