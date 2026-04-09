export const state = {
  appConfig: null,
  graph: null,
  selectedNodeId: null,
  selectedIntegrationId: "jira",
  activeTab: "graph",
  mode: "demo",
  mobilePanel: "graph",
  filters: {
    search: "",
    sourceIds: [],
    relationship: "all",
    minWeight: 0
  },
  view: {
    scale: 1,
    x: 0,
    y: 0
  },
  panning: null,
  didPan: false,
  renderQueued: false
};

export const RELATIONSHIP_ORDER = [
  "Core collaborator",
  "Strong collaborator",
  "Team channel partner",
  "Coordination-heavy contact",
  "Occasional collaborator",
  "Light connection"
];
