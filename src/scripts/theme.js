import siteText from "../content/siteText";

const themeToggles = [...document.querySelectorAll(".theme-toggle")];
const storageKey = "starsail-theme";
const themeText = siteText.shared.theme;
const validThemes = new Set(["dark", "light"]);

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
