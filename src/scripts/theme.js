const themeToggle = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const storageKey = "starsail-theme";

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

  themeLabel.textContent = theme === "dark" ? "夜间" : "日间";
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark"
      ? "当前为夜间风格，点击切换到白天风格"
      : "当前为日间风格，点击切换到夜间风格"
  );
};

const initialTheme = readSavedTheme() === "light" ? "light" : "dark";
setTheme(initialTheme);

themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  saveTheme(nextTheme);
});
