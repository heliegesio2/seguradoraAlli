(() => {
  const API = window.AGENT_API_BASE;

  const el = {
    form: document.getElementById("login-form"),
    usuario: document.getElementById("input-usuario"),
    senha: document.getElementById("input-senha"),
    btnMostrarSenha: document.getElementById("btn-mostrar-senha"),
    btnEntrar: document.getElementById("btn-entrar"),
    erro: document.getElementById("login-erro"),
  };

  // Ja logado? Nao precisa passar pelo login de novo.
  if (window.getSessao()) {
    window.location.href = "atendente.html";
  }

  window.attachPasswordToggle(el.btnMostrarSenha, el.senha);

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.erro.hidden = true;
    el.btnEntrar.disabled = true;
    try {
      const resp = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          usuario: el.usuario.value.trim(),
          senha: el.senha.value,
        }),
      });
      if (!resp.ok) throw new Error("Usuário ou senha inválidos.");
      const sessao = await resp.json();
      sessionStorage.setItem(window.AUTH_KEY, JSON.stringify(sessao));
      window.location.href = "atendente.html";
    } catch (err) {
      el.erro.textContent = err.message || "Não foi possível entrar.";
      el.erro.hidden = false;
    } finally {
      el.btnEntrar.disabled = false;
    }
  });
})();
