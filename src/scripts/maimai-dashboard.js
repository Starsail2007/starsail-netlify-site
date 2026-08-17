document.addEventListener("error", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLImageElement) || !target.classList.contains("maimai-cover")) {
    return;
  }

  const fallback = target.dataset.coverFallback;

  if (fallback && target.src !== new URL(fallback, window.location.href).href) {
    target.src = fallback;
  }
}, true);
