const themeToggles = [...document.querySelectorAll(".theme-toggle")];
const storageKey = "starsail-theme";
const validThemes = new Set(["dark", "light"]);
const fallbackThemeText = {
  darkLabel: "Dark",
  lightLabel: "Light",
  darkAriaLabel: "Switch to light theme",
  lightAriaLabel: "Switch to dark theme"
};

const readSavedTheme = () => {
  try {
    const theme = window.localStorage.getItem(storageKey);
    return validThemes.has(theme) ? theme : null;
  } catch {
    return null;
  }
};

const saveTheme = (theme) => {
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // Local storage can be unavailable in private or restricted browsing contexts.
  }
};

const setTheme = (theme) => {
  const nextTheme = validThemes.has(theme) ? theme : "dark";
  document.documentElement.dataset.theme = nextTheme;

  if (themeToggles.length === 0) {
    return;
  }

  themeToggles.forEach((toggle) => {
    const themeText = readThemeText(toggle);
    const label = toggle.querySelector(".theme-label");

    if (label) {
      label.textContent = nextTheme === "dark" ? themeText.darkLabel : themeText.lightLabel;
    }

    toggle.setAttribute(
      "aria-label",
      nextTheme === "dark"
        ? themeText.darkAriaLabel
        : themeText.lightAriaLabel
    );
  });
};

const readThemeText = (toggle) => ({
  darkLabel: toggle.dataset.themeDarkLabel || fallbackThemeText.darkLabel,
  lightLabel: toggle.dataset.themeLightLabel || fallbackThemeText.lightLabel,
  darkAriaLabel: toggle.dataset.themeDarkAriaLabel || fallbackThemeText.darkAriaLabel,
  lightAriaLabel: toggle.dataset.themeLightAriaLabel || fallbackThemeText.lightAriaLabel
});

setTheme(readSavedTheme() || document.documentElement.dataset.theme || "dark");

themeToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    saveTheme(nextTheme);
  });
});

window.addEventListener("storage", (event) => {
  if (event.key === storageKey) {
    setTheme(validThemes.has(event.newValue) ? event.newValue : "dark");
  }
});
