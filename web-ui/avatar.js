// Helper compartilhado pra desenhar o "bolinha com foto" (ou iniciais, se a
// pessoa nao tiver foto) - usado na lista de usuarios, nos rankings de
// relatorios e na pre-visualizacao em "Meus dados".
window.avatarHtml = function avatarHtml(nome, foto, tamanho = 32) {
  const estilo = `width:${tamanho}px;height:${tamanho}px;font-size:${Math.round(tamanho * 0.42)}px`;
  if (foto) {
    const nomeEscapado = (nome || "").replace(/"/g, "&quot;");
    return `<img class="avatar" style="${estilo}" src="${foto}" alt="${nomeEscapado}" />`;
  }
  const inicial = (nome || "?").trim().charAt(0).toUpperCase() || "?";
  return `<span class="avatar avatar--fallback" style="${estilo}">${inicial}</span>`;
};

// Bolinha clicavel na topbar com a foto do usuario logado - leva direto para
// "Meus dados" (trocar a foto). Roda sozinho ao carregar o script; so precisa
// que a pagina tenha um elemento <a id="topbar-avatar-usuario">. Fica
// deliberadamente fora do menu sanfona - e um atalho sempre visivel, igual o
// padrao comum de "avatar no canto" de outros paineis.
(() => {
  const el = document.getElementById("topbar-avatar-usuario");
  if (!el) return;
  try {
    const chave = window.AUTH_KEY || "autoseguro_staff_session";
    const sessao = JSON.parse(sessionStorage.getItem(chave) || "null");
    if (!sessao) {
      el.hidden = true;
      return;
    }
    el.innerHTML = window.avatarHtml(sessao.nome, sessao.foto, 34);
  } catch {
    el.hidden = true;
  }
})();

// Le um <input type="file"> como data URI, com validacao de tipo/tamanho no
// proprio navegador (o backend valida de novo, isso e so pra dar feedback
// rapido sem round-trip). Resolve null se nenhum arquivo foi escolhido.
window.lerFotoComoDataUri = function lerFotoComoDataUri(file, { tamanhoMaximoBytes = 500_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type.startsWith("image/")) return reject(new Error("Escolha um arquivo de imagem."));
    if (file.size > tamanhoMaximoBytes) return reject(new Error("Imagem muito grande — use até 500KB."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
};
