(() => {
  // Acordeon do FAQ
  document.querySelectorAll(".faq-item__question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const jaAberto = item.classList.contains("faq-item--aberto");
      document.querySelectorAll(".faq-item--aberto").forEach((el) => el.classList.remove("faq-item--aberto"));
      if (!jaAberto) item.classList.add("faq-item--aberto");
    });
  });

  // Qualquer CTA de "cotar" abre o mesmo widget de chat (o FAB cuida da lógica)
  const abrirChat = () => document.getElementById("btn-whatsapp-fab")?.click();
  document.querySelectorAll(".btn-cotar-plano").forEach((btn) => btn.addEventListener("click", abrirChat));
  document.getElementById("footer-abrir-chat")?.addEventListener("click", (e) => {
    e.preventDefault();
    abrirChat();
  });
})();
