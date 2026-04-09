import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { json } from "./http-utils.js";

export function createStaticHandler({ publicDir, staticTypes }) {
  return async function serveStatic(pathname, res) {
    const cleanPath = pathname === "/" ? "/index.html" : pathname;
    const filePath = normalize(join(publicDir, cleanPath));
    try {
      if (!filePath.startsWith(publicDir)) {
        throw new Error("Invalid path");
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": staticTypes[extname(filePath)] || "application/octet-stream"
      });
      res.end(body);
    } catch {
      json(res, 404, { error: "Not found." });
    }
  };
}
