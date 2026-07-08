const variantButtons = [...document.querySelectorAll("[data-entry-variant]")];
const variantPanels = [...document.querySelectorAll("[data-entry-panel]")];
const disabledLinks = [...document.querySelectorAll("[data-entry-disabled='true']")];
const avatarOpenButtons = [...document.querySelectorAll("[data-entry-avatar-open]")];
const avatarModals = [...document.querySelectorAll("[data-entry-avatar-modal]")];
const promptedOptions = [...document.querySelectorAll("[data-option-prompt]")];
const copyButtons = [...document.querySelectorAll("[data-entry-copy]")];
const qrOpenButtons = [...document.querySelectorAll("[data-entry-qr-open]")];
const qrZoomPanels = [...document.querySelectorAll("[data-entry-qr-zoom]")];
const changelogOpenButton = document.querySelector("[data-original-changelog-open]");
const changelogModal = document.querySelector("[data-original-changelog-modal]");

let lastFocusedElement = null;
let lastQrFocusedElement = null;
let activeModal = null;
let activeQrZoom = null;
let closeTimer = null;
let qrCloseTimer = null;
let promptTimer = null;

const showVariant = (variantId) => {
  variantButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.entryVariant === variantId));
  });

  variantPanels.forEach((panel) => {
    panel.hidden = panel.dataset.entryPanel !== variantId;
  });
};

variantButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const variantId = button.dataset.entryVariant;

    if (variantId) {
      showVariant(variantId);
    }
  });
});

disabledLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

promptedOptions.forEach((option) => {
  option.addEventListener("click", () => {
    window.clearTimeout(promptTimer);
    promptedOptions.forEach((item) => item.classList.remove("is-prompting"));
    option.classList.add("is-prompting");

    promptTimer = window.setTimeout(() => {
      option.classList.remove("is-prompting");
    }, 2200);
  });
});

const writeClipboardText = async (value) => {
  if (!value) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.entryCopy;
    const label = button.dataset.copyLabel || button.textContent || "";
    const doneLabel = button.dataset.copyDone || label;
    const copied = await writeClipboardText(value);

    if (!copied) {
      return;
    }

    button.textContent = doneLabel;
    button.classList.add("is-copied");

    window.setTimeout(() => {
      button.textContent = label;
      button.classList.remove("is-copied");
    }, 1400);
  });
});

const getModal = (modalId) => document.getElementById(modalId);

const openQrZoom = (panel, trigger) => {
  if (!panel) {
    return;
  }

  window.clearTimeout(qrCloseTimer);
  lastQrFocusedElement = trigger || document.activeElement;
  activeQrZoom = panel;
  panel.hidden = false;

  window.requestAnimationFrame(() => {
    panel.classList.add("is-open");
    panel.querySelector("[data-entry-qr-close]")?.focus({ preventScroll: true });
  });
};

const closeQrZoom = (panel = activeQrZoom, restoreFocus = true) => {
  if (!panel) {
    return false;
  }

  panel.classList.remove("is-open");

  qrCloseTimer = window.setTimeout(() => {
    panel.hidden = true;

    if (activeQrZoom === panel) {
      activeQrZoom = null;
    }

    if (restoreFocus) {
      lastQrFocusedElement?.focus({ preventScroll: true });
    }
  }, 220);

  return true;
};

const setModalOrigin = (modal, trigger) => {
  const rect = trigger.getBoundingClientRect();
  const originX = rect.left + rect.width / 2 - window.innerWidth / 2;
  const originY = rect.top + rect.height / 2 - window.innerHeight / 2;

  modal.style.setProperty("--entry-open-x", `${Math.round(originX)}px`);
  modal.style.setProperty("--entry-open-y", `${Math.round(originY)}px`);
};

const openModal = (modal, trigger) => {
  if (!modal) {
    return;
  }

  if (activeModal && activeModal !== modal) {
    closeModal(activeModal, false);
  }

  window.clearTimeout(closeTimer);
  lastFocusedElement = document.activeElement;
  activeModal = modal;
  setModalOrigin(modal, trigger);
  modal.hidden = false;
  document.body.classList.add("entry-modal-open");

  window.requestAnimationFrame(() => {
    modal.classList.add("is-open");
    modal.querySelector(".entry-modal-close")?.focus({ preventScroll: true });
  });
};

function closeModal(modal = activeModal, restoreFocus = true) {
  if (!modal) {
    return;
  }

  const openQrPanel = modal.querySelector("[data-entry-qr-zoom].is-open");

  if (openQrPanel) {
    closeQrZoom(openQrPanel, false);
  }

  modal.classList.remove("is-open");

  closeTimer = window.setTimeout(() => {
    modal.hidden = true;

    if (activeModal === modal) {
      activeModal = null;
      document.body.classList.remove("entry-modal-open");
    }

    if (restoreFocus) {
      lastFocusedElement?.focus({ preventScroll: true });
    }
  }, 430);
}

avatarOpenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const modalId = button.dataset.entryAvatarOpen;
    const modal = modalId ? getModal(modalId) : null;

    openModal(modal, button);
  });
});

qrOpenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const modal = button.closest("[data-entry-avatar-modal]");
    const panel = modal?.querySelector("[data-entry-qr-zoom]");

    openQrZoom(panel, button);
  });
});

qrZoomPanels.forEach((panel) => {
  panel.addEventListener("click", (event) => {
    const target = event.target;

    if (target instanceof Element && target.closest("[data-entry-qr-close]")) {
      closeQrZoom(panel);
    }
  });
});

avatarModals.forEach((modal) => {
  modal.addEventListener("click", (event) => {
    const target = event.target;

    if (target instanceof Element && target.closest("[data-entry-modal-close]")) {
      closeModal(modal);
    }
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeQrZoom) {
    closeQrZoom(activeQrZoom);
    return;
  }

  if (event.key === "Escape" && activeModal) {
    closeModal(activeModal);
  }

  if (event.key === "Escape" && changelogModal && !changelogModal.hidden) {
    closeChangelog();
  }
});

const openChangelog = () => {
  if (!changelogModal) {
    return;
  }

  lastFocusedElement = document.activeElement;
  changelogModal.hidden = false;
  document.body.classList.add("entry-modal-open");

  window.requestAnimationFrame(() => {
    changelogModal.classList.add("is-open");
    changelogModal.querySelector(".original-modal-close")?.focus({ preventScroll: true });
  });
};

function closeChangelog() {
  if (!changelogModal) {
    return;
  }

  changelogModal.classList.remove("is-open");

  window.setTimeout(() => {
    changelogModal.hidden = true;
    document.body.classList.remove("entry-modal-open");
    lastFocusedElement?.focus({ preventScroll: true });
  }, 260);
}

changelogOpenButton?.addEventListener("click", openChangelog);

changelogModal?.addEventListener("click", (event) => {
  const target = event.target;

  if (target instanceof Element && target.closest("[data-original-changelog-close]")) {
    closeChangelog();
  }
});
