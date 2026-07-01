const headline = document.querySelector("#headline");
const lines = [...document.querySelectorAll(".line")];
const buttons = [...document.querySelectorAll("[data-mode]")];
const interactiveRoot = document.querySelector("[data-interactive-root]") || document.documentElement;
const interactiveSelector = "button, a, input, textarea, select, [role='button'], [data-allow-touch-scroll]";
let activeTouchPointerId = null;

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

const updatePointerPosition = (clientX, clientY) => {
  const x = `${Math.round((clientX / window.innerWidth) * 100)}%`;
  const y = `${Math.round((clientY / window.innerHeight) * 100)}%`;

  document.documentElement.style.setProperty("--x", x);
  document.documentElement.style.setProperty("--y", y);
};

const isInteractiveElement = (target) => (
  target instanceof Element && Boolean(target.closest(interactiveSelector))
);

const capturePointer = (event) => {
  if (!interactiveRoot.setPointerCapture || event.pointerId == null) {
    return;
  }

  try {
    interactiveRoot.setPointerCapture(event.pointerId);
  } catch {
    // Some browsers can reject capture if the pointer already ended.
  }
};

const releasePointer = (event) => {
  if (!interactiveRoot.releasePointerCapture || event.pointerId == null) {
    return;
  }

  try {
    if (!interactiveRoot.hasPointerCapture || interactiveRoot.hasPointerCapture(event.pointerId)) {
      interactiveRoot.releasePointerCapture(event.pointerId);
    }
  } catch {
    // Ignore stale pointer ids after cancellation.
  }
};

const handlePointerMove = (event) => {
  updatePointerPosition(event.clientX, event.clientY);
};

const handlePointerDown = (event) => {
  updatePointerPosition(event.clientX, event.clientY);

  if (event.pointerType !== "touch") {
    return;
  }

  activeTouchPointerId = event.pointerId;
  interactiveRoot.classList.add("is-touching");

  if (!isInteractiveElement(event.target)) {
    capturePointer(event);
  }
};

const handlePointerEnd = (event) => {
  if (event.pointerType === "touch" && activeTouchPointerId === event.pointerId) {
    activeTouchPointerId = null;
    interactiveRoot.classList.remove("is-touching");
  }

  releasePointer(event);
};

window.addEventListener("pointermove", handlePointerMove, { passive: true });
interactiveRoot.addEventListener("pointerdown", handlePointerDown, { passive: true });
interactiveRoot.addEventListener("pointerup", handlePointerEnd, { passive: true });
interactiveRoot.addEventListener("pointercancel", handlePointerEnd, { passive: true });
interactiveRoot.addEventListener("pointerleave", handlePointerEnd, { passive: true });
