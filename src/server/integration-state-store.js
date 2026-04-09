import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function createIntegrationStateStore(filePath, knownSourceIds = []) {
  const state = {
    integrations: {}
  };

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(stripBom(raw));
    state.integrations = sanitizeIntegrations(parsed?.integrations, knownSourceIds);
  } catch {}

  async function save() {
    const payload = JSON.stringify(
      {
        integrations: sanitizeIntegrations(state.integrations, knownSourceIds)
      },
      null,
      2
    );
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${payload}\n`, "utf8");
  }

  function getIntegrationState() {
    return state.integrations;
  }

  return {
    getIntegrationState,
    save
  };
}

function sanitizeIntegrations(raw, knownSourceIds) {
  const source = raw && typeof raw === "object" ? raw : {};
  const known = new Set((knownSourceIds || []).map((entry) => String(entry)));
  const result = {};

  for (const [sourceId, record] of Object.entries(source)) {
    if (known.size > 0 && !known.has(sourceId)) {
      continue;
    }
    if (!record || typeof record !== "object") {
      continue;
    }

    result[sourceId] = {
      token: stringOrNull(record.token),
      refreshToken: stringOrNull(record.refreshToken),
      expiresIn: numberOrNull(record.expiresIn),
      profile: record.profile && typeof record.profile === "object" ? record.profile : null
    };
  }

  return result;
}

function stringOrNull(value) {
  const next = String(value || "").trim();
  return next || null;
}

function numberOrNull(value) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function stripBom(value) {
  return String(value || "").replace(/^\uFEFF/, "");
}
