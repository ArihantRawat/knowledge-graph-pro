import { readFile, writeFile } from "node:fs/promises";

export async function upsertEnvValues(envFilePath, updates) {
  let raw = "";

  try {
    raw = await readFile(envFilePath, "utf8");
  } catch {}

  const lines = raw ? raw.split(/\r?\n/) : [];
  const remaining = new Map(
    Object.entries(updates).map(([key, value]) => [key, String(value ?? "")])
  );
  const output = [];

  for (const line of lines) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      output.push(line);
      continue;
    }

    const [key] = line.split("=", 1);
    const trimmedKey = key.trim();

    if (!remaining.has(trimmedKey)) {
      output.push(line);
      continue;
    }

    output.push(`${trimmedKey}=${remaining.get(trimmedKey)}`);
    remaining.delete(trimmedKey);
  }

  for (const [key, value] of remaining.entries()) {
    output.push(`${key}=${value}`);
  }

  const normalized = output.filter((line, index, all) => !(index === all.length - 1 && line === ""));
  await writeFile(envFilePath, `${normalized.join("\n")}\n`, "utf8");
}
