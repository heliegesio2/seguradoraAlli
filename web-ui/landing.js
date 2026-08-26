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

  // CTA genérico ("Iniciar conversa" etc) só abre o widget vazio
  const abrirChat = () => document.getElementById("btn-whatsapp-fab")?.click();
  document.getElementById("footer-abrir-chat")?.addEventListener("click", (e) => {
    e.preventDefault();
    abrirChat();
  });

  // Cada card de plano já abre o widget com a mensagem de interesse pronta e
  // enviada, sem o lead precisar digitar/clicar em enviar de novo.
  document.querySelectorAll(".btn-cotar-plano").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plano = btn.dataset.plano || "";
      const texto = `Olá, gostaria de cotar o plano ${plano}`;
      if (window.AutoSeguroWidget) {
        window.AutoSeguroWidget.abrirComMensagem(texto);
      } else {
        abrirChat();
      }
    });
  });
})();
