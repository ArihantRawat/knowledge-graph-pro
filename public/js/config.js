const runtimeConfig = window.KNOWLEDGE_GRAPH_PRO_CONFIG || {};
const configuredApiBase = normalizeApiBase(runtimeConfig.apiBase || "");
const defaultApiBase = isLikelyStaticHost() ? "" : window.location.origin;

export const apiBase = configuredApiBase || defaultApiBase;
export const hasBackend = Boolean(resolveApiUrl("/api/config"));

export function resolveApiUrl(path) {
  if (!apiBase) {
    return null;
  }
  return `${apiBase}${path}`;
}

export function normalizeApiBase(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

export function isLikelyStaticHost() {
  return window.location.hostname.endsWith("github.io") || window.location.protocol === "file:";
}
