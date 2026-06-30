const avatarLink = document.querySelector(".avatar-link");
const avatarModal = document.querySelector("#avatar-modal");
const modalClose = document.querySelector(".modal-close");
let lastFocusedElement = null;

const openAvatarModal = (event) => {
  event.preventDefault();

  if (!avatarModal || !modalClose) {
    return;
  }

  lastFocusedElement = document.activeElement;
  avatarModal.hidden = false;
  document.body.classList.add("modal-open");

  window.requestAnimationFrame(() => {
    avatarModal.classList.add("is-open");
    modalClose.focus({ preventScroll: true });
  });
};

const closeAvatarModal = () => {
  if (!avatarModal) {
    return;
  }

  avatarModal.classList.remove("is-open");
  document.body.classList.remove("modal-open");

  window.setTimeout(() => {
    avatarModal.hidden = true;
    lastFocusedElement?.focus({ preventScroll: true });
  }, 340);
};

avatarLink?.addEventListener("click", openAvatarModal);
modalClose?.addEventListener("click", closeAvatarModal);

avatarModal?.addEventListener("click", (event) => {
  if (event.target === avatarModal) {
    closeAvatarModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && avatarModal && !avatarModal.hidden) {
    closeAvatarModal();
  }
});
