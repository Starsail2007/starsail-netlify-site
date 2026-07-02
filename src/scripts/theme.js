import siteText from "../content/siteText";

const themeToggle = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const storageKey = "starsail-theme";
const themeText = siteText.shared.theme;

const readSavedTheme = () => {
  try {
    return window.localStorage.getItem(storageKey);
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
  document.documentElement.dataset.theme = theme;

  if (!themeToggle || !themeLabel) {
    return;
  }

  themeLabel.textContent = theme === "dark" ? themeText.darkLabel : themeText.lightLabel;
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark"
      ? themeText.darkAriaLabel
      : themeText.lightAriaLabel
  );
};

const forceDarkInitialTheme = document.body.classList.contains("maimai-body");
const initialTheme = forceDarkInitialTheme ? "dark" : readSavedTheme() === "light" ? "light" : "dark";
setTheme(initialTheme);

themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  saveTheme(nextTheme);
});
