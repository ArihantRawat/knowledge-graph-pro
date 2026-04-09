import { elements } from "./dom.js";
import { state } from "./state.js";
import { clamp } from "./utils.js";

let renderHandler = () => {};

export function setRenderHandler(handler) {
  renderHandler = typeof handler === "function" ? handler : () => {};
}

export function onPointerDown(event) {
  if (event.target.closest("[data-node-id]")) {
    return;
  }

  const point = getSvgPoint(event.clientX, event.clientY);
  state.panning = {
    pointerId: event.pointerId,
    startX: point.x,
    startY: point.y,
    originX: state.view.x,
    originY: state.view.y,
    moved: false
  };
  if (elements.graphStage) {
    elements.graphStage.classList.add("is-panning");
  }
  elements.graphCanvas.setPointerCapture(event.pointerId);
}

export function onPointerMove(event) {
  if (!state.panning || state.panning.pointerId !== event.pointerId) {
    return;
  }

  const point = getSvgPoint(event.clientX, event.clientY);
  if (
    Math.abs(point.x - state.panning.startX) > 2 ||
    Math.abs(point.y - state.panning.startY) > 2
  ) {
    state.panning.moved = true;
    state.didPan = true;
  }

  state.view.x = state.panning.originX + (point.x - state.panning.startX);
  state.view.y = state.panning.originY + (point.y - state.panning.startY);
  scheduleRender();
}

export function onPointerUp(event) {
  if (!state.panning || state.panning.pointerId !== event.pointerId) {
    return;
  }

  elements.graphCanvas.releasePointerCapture(event.pointerId);
  state.panning = null;
  if (elements.graphStage) {
    elements.graphStage.classList.remove("is-panning");
  }
}

export function onWheel(event) {
  event.preventDefault();
  const point = getSvgPoint(event.clientX, event.clientY);
  const factor = clamp(Math.exp(-event.deltaY * 0.00075), 0.94, 1.06);
  zoomAt(point, factor);
}

export function onDoubleClick(event) {
  event.preventDefault();
  const point = getSvgPoint(event.clientX, event.clientY);
  zoomAt(point, 1.22);
}

export function onCanvasClick(event) {
  if (state.didPan) {
    state.didPan = false;
    return;
  }

  if (!event.target.closest("[data-node-id]")) {
    state.selectedNodeId = null;
    renderHandler();
  }
}

export function applyZoom(multiplier) {
  const point = getViewportCenter();
  zoomAt(point, multiplier);
}

export function resetView() {
  state.view.scale = 1;
  state.view.x = 0;
  state.view.y = 0;
  updateZoomPill();
  renderHandler();
}

export function updateZoomPill() {
  if (!elements.zoomPill) {
    return;
  }
  elements.zoomPill.textContent = `Zoom ${Math.round(state.view.scale * 100)}%`;
}

function zoomAt(point, multiplier) {
  const previousScale = state.view.scale;
  const nextScale = clamp(previousScale * multiplier, 0.5, 3.2);
  if (nextScale === previousScale) {
    return;
  }

  const worldX = (point.x - state.view.x) / previousScale;
  const worldY = (point.y - state.view.y) / previousScale;

  state.view.scale = nextScale;
  state.view.x = point.x - worldX * nextScale;
  state.view.y = point.y - worldY * nextScale;
  updateZoomPill();
  scheduleRender();
}

function getSvgPoint(clientX, clientY) {
  const rect = elements.graphCanvas.getBoundingClientRect();
  const box = elements.graphCanvas.viewBox.baseVal;
  return {
    x: ((clientX - rect.left) / rect.width) * box.width + box.x,
    y: ((clientY - rect.top) / rect.height) * box.height + box.y
  };
}

function getViewportCenter() {
  const box = elements.graphCanvas.viewBox.baseVal;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function scheduleRender() {
  if (state.renderQueued) {
    return;
  }
  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    renderHandler();
  });
}
