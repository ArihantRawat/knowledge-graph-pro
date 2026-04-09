import { elements } from "./dom.js";
import { state } from "./state.js";

export function setActiveTab(tab) {
  state.activeTab = tab;
  elements.graphTab.hidden = tab !== "graph";
  elements.integrationsTab.hidden = tab !== "integrations";
  elements.graphTabButton.classList.toggle("is-active", tab === "graph");
  elements.integrationsTabButton.classList.toggle("is-active", tab === "integrations");
}
