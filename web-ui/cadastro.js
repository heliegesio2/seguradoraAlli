(() => {
  const API = window.AGENT_API_BASE;

  const el = {
    form: document.getElementById("cadastro-form"),
    nome: document.getElementById("input-nome"),
    usuario: document.getElementById("input-usuario"),
    senha: document.getElementById("input-senha"),
    btnMostrarSenha: document.getElementById("btn-mostrar-senha"),
    btnCadastrar: document.getElementById("btn-cadastrar"),
    erro: document.getElementById("cadastro-erro"),
  };

  if (window.getSessao()) {
    window.location.href = "atendente.html";
  }

  window.attachPasswordToggle(el.btnMostrarSenha, el.senha);

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.erro.hidden = true;
    el.btnCadastrar.disabled = true;
    try {
      const papel = el.form.querySelector('input[name="papel"]:checked').value;
      const resp = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: el.nome.value.trim(),
          usuario: el.usuario.value.trim(),
          senha: el.senha.value,
          papel,
        }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.detail || "Não foi possível criar a conta.");
      sessionStorage.setItem(window.AUTH_KEY, JSON.stringify(dados));
      window.location.href = "atendente.html";
    } catch (err) {
      el.erro.textContent = err.message || "Não foi possível criar a conta.";
      el.erro.hidden = false;
    } finally {
      el.btnCadastrar.disabled = false;
    }
  });
})();
