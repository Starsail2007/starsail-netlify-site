const headline = document.querySelector("#headline");
const lines = [...document.querySelectorAll(".line")];
const buttons = [...document.querySelectorAll("[data-mode]")];
const interactiveRoot = document.querySelector("[data-interactive-root]") || document.documentElement;
const directPointerGlows = [...document.querySelectorAll("[data-direct-pointer-glow]")];
const worldcupRoot = document.querySelector("[data-worldcup-root]");
const worldcupSpotlightSelector = [
  ".worldcup-home-button",
  ".worldcup-page .theme-toggle",
  ".worldcup-section-tab",
  ".schedule-date-button",
  ".schedule-center-button",
  ".schedule-date-option",
  ".schedule-wheel-card",
  ".schedule-card",
  ".group-card",
  "button.group-fixture",
  "a.timeline-match",
  ".moments-time-list .timeline-match",
  ".bracket-match",
  ".moments-mode-button",
  ".moments-sort-button",
  ".moments-match-button",
  ".moments-detail-header button",
  ".moments-modal-titlebar button"
].join(",");
const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const supportsPointerEvents = "PointerEvent" in window;
let glowOpacity = 0;
let glowAnimationFrame = 0;
let directGlowOpacity = 0;
let directGlowAnimationFrame = 0;
let pointerPositionFrame = 0;
let pendingPointerPosition = null;

const setPointerGlowOpacity = (opacity) => {
  glowOpacity = Math.max(0, Math.min(1, opacity));
  root.style.setProperty("--pointer-glow-opacity", glowOpacity.toFixed(3));
};

const setDirectPointerGlowOpacity = (opacity) => {
  directGlowOpacity = Math.max(0, Math.min(1, opacity));

  for (const glow of directPointerGlows) {
    glow.style.opacity = directGlowOpacity.toFixed(3);
  }
};

const setDirectPointerGlowPosition = (clientX, clientY) => {
  const transform = `translate3d(${clientX.toFixed(1)}px, ${clientY.toFixed(1)}px, 0) translate3d(-50%, -50%, 0)`;

  for (const glow of directPointerGlows) {
    glow.style.transform = transform;
  }
};

const updateWorldCupSpotlight = (clientX, clientY) => {
  if (!worldcupRoot) {
    return;
  }

  const hitElement = document.elementFromPoint(clientX, clientY);
  const target = hitElement?.closest?.(worldcupSpotlightSelector);

  if (!target || !worldcupRoot.contains(target)) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

  target.style.setProperty("--spotlight-x", `${x.toFixed(1)}px`);
  target.style.setProperty("--spotlight-y", `${y.toFixed(1)}px`);
};

const animatePointerGlow = (targetOpacity, duration = 420) => {
  const target = Math.max(0, Math.min(1, targetOpacity));

  if (glowAnimationFrame) {
    window.cancelAnimationFrame(glowAnimationFrame);
  }

  if (reducedMotion.matches || duration <= 0 || Math.abs(glowOpacity - target) < .001) {
    setPointerGlowOpacity(target);
    glowAnimationFrame = 0;
    return;
  }

  const startOpacity = glowOpacity;
  const startTime = window.performance.now();

  const tick = (time) => {
    const progress = Math.min(1, (time - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    setPointerGlowOpacity(startOpacity + (target - startOpacity) * eased);

    if (progress < 1) {
      glowAnimationFrame = window.requestAnimationFrame(tick);
      return;
    }

    glowAnimationFrame = 0;
  };

  glowAnimationFrame = window.requestAnimationFrame(tick);
};

const animateDirectPointerGlow = (targetOpacity, duration = 420) => {
  const target = Math.max(0, Math.min(1, targetOpacity));

  if (directGlowAnimationFrame) {
    window.cancelAnimationFrame(directGlowAnimationFrame);
  }

  if (reducedMotion.matches || duration <= 0 || Math.abs(directGlowOpacity - target) < .001) {
    setDirectPointerGlowOpacity(target);
    directGlowAnimationFrame = 0;
    return;
  }

  const startOpacity = directGlowOpacity;
  const startTime = window.performance.now();

  const tick = (time) => {
    const progress = Math.min(1, (time - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    setDirectPointerGlowOpacity(startOpacity + (target - startOpacity) * eased);

    if (progress < 1) {
      directGlowAnimationFrame = window.requestAnimationFrame(tick);
      return;
    }

    directGlowAnimationFrame = 0;
  };

  directGlowAnimationFrame = window.requestAnimationFrame(tick);
};

const showPointerGlow = () => {
  if (directPointerGlows.length) {
    if (directGlowAnimationFrame) {
      window.cancelAnimationFrame(directGlowAnimationFrame);
      directGlowAnimationFrame = 0;
    }

    if (directGlowOpacity !== 1) {
      setDirectPointerGlowOpacity(1);
    }

    return;
  }

  if (glowAnimationFrame) {
    window.cancelAnimationFrame(glowAnimationFrame);
    glowAnimationFrame = 0;
  }

  setPointerGlowOpacity(1);
};

const hidePointerGlow = () => {
  if (directPointerGlows.length) {
    animateDirectPointerGlow(0, 720);
    return;
  }

  animatePointerGlow(0, 720);
};

setPointerGlowOpacity(0);
setDirectPointerGlowOpacity(0);

if (headline && lines.length) {
  let index = 0;

  for (const line of lines) {
    const text = line.dataset.text || line.textContent || "";
    const chars = [...text];

    line.replaceChildren(...chars.map((char) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = char;
      span.style.setProperty("--i", index++);
      return span;
    }));
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      headline.className = `headline${mode === "calm" ? "" : ` mode-${mode}`}`;

      buttons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
    });
  });
}

const updatePointerPositionNow = (clientX, clientY) => {
  updateWorldCupSpotlight(clientX, clientY);

  if (directPointerGlows.length) {
    setDirectPointerGlowPosition(clientX, clientY);
    showPointerGlow();
    return;
  }

  const x = `${((clientX / window.innerWidth) * 100).toFixed(2)}%`;
  const y = `${((clientY / window.innerHeight) * 100).toFixed(2)}%`;

  root.style.setProperty("--x", x);
  root.style.setProperty("--y", y);
  root.style.setProperty("--pointer-x-px", `${clientX.toFixed(1)}px`);
  root.style.setProperty("--pointer-y-px", `${clientY.toFixed(1)}px`);
  showPointerGlow();
};

const schedulePointerPosition = (clientX, clientY) => {
  if (reducedMotion.matches || !finePointer.matches) {
    return;
  }

  pendingPointerPosition = { clientX, clientY };

  if (pointerPositionFrame) {
    return;
  }

  pointerPositionFrame = window.requestAnimationFrame(() => {
    pointerPositionFrame = 0;

    if (!pendingPointerPosition) {
      return;
    }

    const { clientX: nextX, clientY: nextY } = pendingPointerPosition;
    pendingPointerPosition = null;
    updatePointerPositionNow(nextX, nextY);
  });
};

const cancelPendingPointerPosition = () => {
  pendingPointerPosition = null;

  if (!pointerPositionFrame) {
    return;
  }

  window.cancelAnimationFrame(pointerPositionFrame);
  pointerPositionFrame = 0;
};

const handlePointerMove = (event) => {
  const coalescedEvents = event.getCoalescedEvents?.();
  const latestEvent = coalescedEvents?.[coalescedEvents.length - 1] || event;

  schedulePointerPosition(latestEvent.clientX, latestEvent.clientY);
};

const handleMouseMove = (event) => {
  schedulePointerPosition(event.clientX, event.clientY);
};

const handlePointerDown = (event) => {
  schedulePointerPosition(event.clientX, event.clientY);

  if (event.pointerType !== "touch") {
    return;
  }

  interactiveRoot.classList.add("is-touching");
};

const handlePointerEnd = (event) => {
  if (event.pointerType === "touch") {
    interactiveRoot.classList.remove("is-touching");
    hidePointerGlow();
  }
};

const getPrimaryTouch = (event) => event.touches[0] || event.changedTouches[0];

const handleTouchMove = (event) => {
  const touch = getPrimaryTouch(event);

  if (!touch) {
    return;
  }

  schedulePointerPosition(touch.clientX, touch.clientY);
};

const handleTouchStart = (event) => {
  interactiveRoot.classList.add("is-touching");
  handleTouchMove(event);
};

const handleTouchEnd = (event) => {
  handleTouchMove(event);

  if (event.touches.length === 0) {
    interactiveRoot.classList.remove("is-touching");
    hidePointerGlow();
  }
};

const handlePointerLeave = () => {
  cancelPendingPointerPosition();
  interactiveRoot.classList.remove("is-touching");
  hidePointerGlow();
};

const handleVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    hidePointerGlow();
  }
};

if ("onpointerrawupdate" in window) {
  window.addEventListener("pointerrawupdate", handlePointerMove, { passive: true });
} else if (supportsPointerEvents) {
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
}

if (!supportsPointerEvents) {
  window.addEventListener("mousemove", handleMouseMove, { passive: true });
}

window.addEventListener("blur", hidePointerGlow, { passive: true });
document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });
interactiveRoot.addEventListener("pointerdown", handlePointerDown, { passive: true });
interactiveRoot.addEventListener("pointerup", handlePointerEnd, { passive: true });
interactiveRoot.addEventListener("pointercancel", handlePointerLeave, { passive: true });
interactiveRoot.addEventListener("pointerleave", handlePointerLeave, { passive: true });

if (!supportsPointerEvents) {
  interactiveRoot.addEventListener("touchstart", handleTouchStart, { passive: true });
  interactiveRoot.addEventListener("touchmove", handleTouchMove, { passive: true });
  interactiveRoot.addEventListener("touchend", handleTouchEnd, { passive: true });
  interactiveRoot.addEventListener("touchcancel", handleTouchEnd, { passive: true });
}
