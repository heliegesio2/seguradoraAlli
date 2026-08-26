// Toggle generico do menu sanfona (hamburguer) da topbar - compartilhado por
// todas as paginas internas. So precisa dos ids #btn-menu / #menu-painel;
// roda sozinho ao carregar o script. Gate de perfil (esconder Usuarios/
// Configuracoes de quem nao e admin) continua responsabilidade de cada
// pagina, feito depois de saber a sessao.
(() => {
  const btn = document.getElementById("btn-menu");
  const painel = document.getElementById("menu-painel");
  if (!btn || !painel) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    btn.setAttribute("aria-expanded", String(abrir));
  });
  document.addEventListener("click", (e) => {
    if (!painel.hidden && !painel.contains(e.target) && e.target !== btn) {
      painel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });

  const btnSair = document.getElementById("btn-sair");
  if (btnSair) btnSair.addEventListener("click", () => window.logoutStaff());
})();
