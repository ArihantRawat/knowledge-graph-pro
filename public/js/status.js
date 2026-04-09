import { elements } from "./dom.js";

export function setStatus(message, tone) {
  elements.statusText.textContent = message;
  if (tone === "live") {
    setStatusBadge("Live mode", "live");
  } else if (tone === "preview") {
    setStatusBadge("Preview mode", "preview");
  } else if (tone === "setup") {
    setStatusBadge("Setup needed", "setup");
  } else if (tone === "warning") {
    setStatusBadge("Attention", "warning");
  } else if (tone === "ready") {
    setStatusBadge("Ready", "ready");
  } else {
    setStatusBadge("Knowledge-Graph-Pro", "ready");
  }
}

export function setStatusBadge(label, tone) {
  elements.statusBadge.textContent = label;
  const colors = {
    live: "var(--accent)",
    preview: "var(--accent-warm)",
    setup: "var(--accent-hot)",
    warning: "var(--accent-hot)",
    ready: "var(--accent)"
  };
  elements.statusBadge.style.setProperty("--badge-dot", colors[tone] || colors.ready);
  elements.statusBadge.style.background =
    tone === "warning"
      ? "rgba(255, 122, 102, 0.12)"
      : tone === "preview"
        ? "rgba(255, 177, 92, 0.14)"
        : "rgba(255, 255, 255, 0.06)";
  elements.statusBadge.style.borderColor =
    tone === "warning"
      ? "rgba(255, 122, 102, 0.22)"
      : tone === "preview"
        ? "rgba(255, 177, 92, 0.22)"
        : "rgba(255, 255, 255, 0.08)";
}
