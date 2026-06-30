const headline = document.querySelector("#headline");
const lines = [...document.querySelectorAll(".line")];
const buttons = [...document.querySelectorAll("[data-mode]")];

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

window.addEventListener("pointermove", (event) => {
  const x = `${Math.round((event.clientX / window.innerWidth) * 100)}%`;
  const y = `${Math.round((event.clientY / window.innerHeight) * 100)}%`;
  document.documentElement.style.setProperty("--x", x);
  document.documentElement.style.setProperty("--y", y);
});
