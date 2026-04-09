const THEME_STORAGE_KEY = "kgp_theme";

export function initTheme({ toggleButton, toggleText }) {
  const initial = storedTheme() || "night";
  applyTheme({ theme: initial, toggleButton, toggleText });

  if (!toggleButton) {
    return;
  }

  toggleButton.addEventListener("click", () => {
    const current = document.body.dataset.theme === "day" ? "day" : "night";
    const next = current === "day" ? "night" : "day";
    applyTheme({ theme: next, toggleButton, toggleText });
    persistTheme(next);
  });
}

export function applyTheme({ theme, toggleButton, toggleText }) {
  const next = theme === "day" ? "day" : "night";
  const isDay = next === "day";

  document.body.dataset.theme = next;

  if (toggleButton) {
    toggleButton.classList.toggle("is-active", isDay);
    toggleButton.setAttribute("aria-pressed", String(isDay));
    toggleButton.setAttribute("aria-label", isDay ? "Switch to night mode" : "Switch to day mode");
  }

  if (toggleText) {
    toggleText.textContent = isDay ? "Day" : "Night";
  }
}

function storedTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "day" || raw === "night" ? raw : null;
  } catch {
    return null;
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}
