(() => {
  const THEME_STORAGE_KEY = "web-tools-hub-theme";
  const LIGHT = "light";
  const DARK = "dark";

  const isValidTheme = (value) => value === LIGHT || value === DARK;

  const getSystemTheme = () => (
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT
  );

  const getStoredTheme = () => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : null;
  };

  const getActiveTheme = () => document.documentElement.getAttribute("data-theme") || LIGHT;

  const syncToggleState = (theme) => {
    const toggles = document.querySelectorAll("[data-theme-toggle]");
    toggles.forEach((toggle) => {
      const isDark = theme === DARK;
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("data-active-theme", theme);
    });
  };

  const applyTheme = (theme, shouldPersist = false) => {
    const nextTheme = isValidTheme(theme) ? theme : LIGHT;
    document.documentElement.setAttribute("data-theme", nextTheme);
    syncToggleState(nextTheme);

    if (shouldPersist) {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
  };

  const toggleTheme = () => {
    const current = getActiveTheme();
    applyTheme(current === DARK ? LIGHT : DARK, true);
  };

  const initializeThemeToggles = () => {
    const initialTheme = getStoredTheme() || getActiveTheme() || getSystemTheme();
    applyTheme(initialTheme, false);

    const toggles = document.querySelectorAll("[data-theme-toggle]");
    toggles.forEach((toggle) => {
      toggle.addEventListener("click", toggleTheme);
    });
  };

  window.addEventListener("storage", (event) => {
    if (event.key !== THEME_STORAGE_KEY) {
      return;
    }

    const nextTheme = isValidTheme(event.newValue) ? event.newValue : LIGHT;
    applyTheme(nextTheme, false);
  });

  document.addEventListener("DOMContentLoaded", initializeThemeToggles);
})();
