// Sessao simples do painel interno (atendente/admin) - compartilhado entre
// login.html, atendente.html e admin.html. O widget publico do lead nao usa isso.
window.AUTH_KEY = "autoseguro_staff_session";

window.getSessao = function getSessao() {
  try {
    return JSON.parse(sessionStorage.getItem(window.AUTH_KEY) || "null");
  } catch {
    return null;
  }
};

window.exigirLogin = function exigirLogin(papeisPermitidos) {
  const sessao = window.getSessao();
  if (!sessao || (papeisPermitidos && !papeisPermitidos.includes(sessao.papel))) {
    window.location.href = "login.html";
    return null;
  }
  return sessao;
};

window.authHeaders = function authHeaders() {
  const sessao = window.getSessao();
  return sessao ? { Authorization: `Bearer ${sessao.token}` } : {};
};

window.logoutStaff = async function logoutStaff() {
  const sessao = window.getSessao();
  if (sessao) {
    try {
      await fetch(`${window.AGENT_API_BASE}/auth/logout`, {
        method: "POST",
        headers: window.authHeaders(),
      });
    } catch {
      // mesmo se a chamada falhar, ainda limpa a sessao local
    }
  }
  sessionStorage.removeItem(window.AUTH_KEY);
  window.location.href = "login.html";
};

// Botao de "olhinho" para mostrar/ocultar um campo de senha - usado no login e
// nos campos de chave do Admin.
window.attachPasswordToggle = function attachPasswordToggle(botao, campo) {
  botao.addEventListener("click", () => {
    const mostrando = campo.type === "text";
    campo.type = mostrando ? "password" : "text";
    botao.textContent = mostrando ? "👁" : "🙈";
    botao.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
  });
};
