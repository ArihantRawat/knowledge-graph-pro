import { join } from "node:path";
import { upsertEnvValues } from "./env-store.js";
import { integrationEnvKeys } from "./config.js";

export async function writeIntegrationConfig({
  sourceId,
  clientId,
  clientSecret,
  redirectUri,
  appOrigin,
  port,
  rootDir,
  envFilePath
}) {
  const keys = integrationEnvKeys(sourceId);
  if (!keys) {
    throw new Error(`Unsupported integration source: ${sourceId}`);
  }

  process.env[keys.clientIdKey] = clientId;
  process.env[keys.clientSecretKey] = clientSecret || "";
  process.env[keys.redirectUriKey] = redirectUri;
  process.env.APP_ORIGIN = appOrigin;
  process.env.TLS_PFX_PATH = process.env.TLS_PFX_PATH || join(rootDir, "certs", "localhost.pfx");
  process.env.TLS_PFX_PASSPHRASE = process.env.TLS_PFX_PASSPHRASE || "jiragraph-local-dev";
  process.env.PORT = process.env.PORT || String(port);

  await upsertEnvValues(envFilePath, {
    [keys.clientIdKey]: process.env[keys.clientIdKey],
    [keys.clientSecretKey]: process.env[keys.clientSecretKey],
    [keys.redirectUriKey]: process.env[keys.redirectUriKey],
    APP_ORIGIN: process.env.APP_ORIGIN,
    TLS_PFX_PATH: process.env.TLS_PFX_PATH,
    TLS_PFX_PASSPHRASE: process.env.TLS_PFX_PASSPHRASE,
    PORT: process.env.PORT
  });
}
