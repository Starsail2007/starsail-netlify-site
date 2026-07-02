const headline = document.querySelector("#headline");
const lines = [...document.querySelectorAll(".line")];
const buttons = [...document.querySelectorAll("[data-mode]")];
const interactiveRoot = document.querySelector("[data-interactive-root]") || document.documentElement;

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

const handlePointerMove = (event) => {
  updatePointerPosition(event.clientX, event.clientY);
};

const handlePointerDown = (event) => {
  updatePointerPosition(event.clientX, event.clientY);

  if (event.pointerType !== "touch") {
    return;
  }

  interactiveRoot.classList.add("is-touching");
};

const handlePointerEnd = (event) => {
  if (event.pointerType === "touch") {
    interactiveRoot.classList.remove("is-touching");
  }
};

const getPrimaryTouch = (event) => event.touches[0] || event.changedTouches[0];

const handleTouchMove = (event) => {
  const touch = getPrimaryTouch(event);

  if (!touch) {
    return;
  }

  updatePointerPosition(touch.clientX, touch.clientY);
};

const handleTouchStart = (event) => {
  interactiveRoot.classList.add("is-touching");
  handleTouchMove(event);
};

const handleTouchEnd = (event) => {
  handleTouchMove(event);

  if (event.touches.length === 0) {
    interactiveRoot.classList.remove("is-touching");
  }
};

window.addEventListener("pointermove", handlePointerMove, { passive: true });
interactiveRoot.addEventListener("pointerdown", handlePointerDown, { passive: true });
interactiveRoot.addEventListener("pointerup", handlePointerEnd, { passive: true });
interactiveRoot.addEventListener("pointercancel", handlePointerEnd, { passive: true });
interactiveRoot.addEventListener("pointerleave", handlePointerEnd, { passive: true });
interactiveRoot.addEventListener("touchstart", handleTouchStart, { passive: true });
interactiveRoot.addEventListener("touchmove", handleTouchMove, { passive: true });
interactiveRoot.addEventListener("touchend", handleTouchEnd, { passive: true });
interactiveRoot.addEventListener("touchcancel", handleTouchEnd, { passive: true });
