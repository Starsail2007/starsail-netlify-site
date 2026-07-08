const page = document.querySelector("[data-site-entry-page]");
const loader = document.querySelector("[data-site-entry-loader]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const entryLoaderKey = "starsail-entry-loader-played";

const hasPlayedIntro = () => {
  try {
    return window.sessionStorage.getItem(entryLoaderKey) === "true";
  } catch {
    return false;
  }
};

const rememberIntroPlayed = () => {
  try {
    window.sessionStorage.setItem(entryLoaderKey, "true");
  } catch {
    // Browsers can disable storage; the page should still animate normally.
  }
};

const parseDuration = (value) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return 1280;
  }

  if (trimmed.endsWith("ms")) {
    return Number.parseFloat(trimmed);
  }

  if (trimmed.endsWith("s")) {
    return Number.parseFloat(trimmed) * 1000;
  }

  return Number.parseFloat(trimmed) || 1280;
};

const getIntroDuration = () => {
  if (!loader) {
    return 1280;
  }

  return parseDuration(window.getComputedStyle(loader).getPropertyValue("--intro-duration"));
};

const replayHeadline = () => {
  if (!page || reducedMotion.matches) {
    return;
  }

  page.classList.add("is-headline-resetting");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      page.classList.remove("is-headline-resetting");
    });
  });
};

const finishIntro = ({ replayTitle = false, remember = true } = {}) => {
  page?.classList.remove("is-entry-loading");
  page?.classList.add("is-entry-ready");
  loader?.classList.add("is-finished");

  if (remember) {
    rememberIntroPlayed();
  }

  if (replayTitle) {
    replayHeadline();
  }

  window.setTimeout(() => {
    if (loader) {
      loader.hidden = true;
    }
  }, reducedMotion.matches ? 40 : 240);
};

if (!page || !loader) {
  finishIntro();
} else if (hasPlayedIntro()) {
  loader.hidden = true;
  loader.classList.add("is-finished");
  finishIntro({ replayTitle: true, remember: false });
} else {
  window.requestAnimationFrame(() => {
    loader.hidden = false;
    loader.classList.remove("is-finished");
    loader.classList.add("is-playing");

    window.setTimeout(
      finishIntro,
      reducedMotion.matches ? 120 : getIntroDuration()
    );
  });
}

window.addEventListener("pageshow", (event) => {
  if (!event.persisted || !page || !hasPlayedIntro()) {
    return;
  }

  loader.hidden = true;
  loader.classList.add("is-finished");
  page.classList.remove("is-entry-loading");
  page.classList.add("is-entry-ready");
  replayHeadline();
});
