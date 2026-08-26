(() => {
  const sessao = window.exigirLogin(["admin"]);
  if (!sessao) return;

  const API = window.AGENT_API_BASE;

  const el = {
    topbarUsuario: document.getElementById("topbar-usuario"),
    form: document.getElementById("form-novo-usuario"),
    nome: document.getElementById("input-nome"),
    usuario: document.getElementById("input-usuario"),
    senha: document.getElementById("input-senha"),
    btnMostrarSenha: document.getElementById("btn-mostrar-senha"),
    btnCriar: document.getElementById("btn-criar-usuario"),
    erro: document.getElementById("usuario-erro"),
    sucesso: document.getElementById("usuario-sucesso"),
    lista: document.getElementById("usuarios-lista"),
    inputFoto: document.getElementById("input-foto"),
    fotoPreview: document.getElementById("foto-preview"),
  };

  let fotoSelecionada = null;

  el.topbarUsuario.textContent = `${sessao.nome} (${sessao.papel})`;
  if (sessao.papel !== "admin") {
    document.getElementById("link-usuarios")?.setAttribute("hidden", "");
    document.getElementById("link-admin")?.setAttribute("hidden", "");
  }
  window.attachPasswordToggle(el.btnMostrarSenha, el.senha);
  el.fotoPreview.innerHTML = window.avatarHtml("", null, 48);

  el.inputFoto.addEventListener("change", async () => {
    try {
      fotoSelecionada = await window.lerFotoComoDataUri(el.inputFoto.files[0]);
      el.fotoPreview.innerHTML = window.avatarHtml(el.nome.value, fotoSelecionada, 48);
    } catch (err) {
      el.erro.textContent = err.message;
      el.erro.hidden = false;
      el.inputFoto.value = "";
      fotoSelecionada = null;
    }
  });

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  async function api(path, options) {
    const resp = await fetch(`${API}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...window.authHeaders(), ...(options?.headers || {}) },
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.detail || "Falha na requisição.");
    return dados;
  }

  async function carregarUsuarios() {
    try {
      const usuarios = await api("/auth/users");
      el.lista.innerHTML = "";
      usuarios.forEach((u) => {
        const linha = document.createElement("div");
        linha.className = "usuarios-linha";
        linha.innerHTML = `
          <div class="usuarios-linha__principal">
            ${window.avatarHtml(u.nome, u.foto, 36)}
            <div>
              <div class="usuarios-linha__nome">${escapeHtml(u.nome)}</div>
              <div class="usuarios-linha__login">@${escapeHtml(u.usuario)}</div>
            </div>
          </div>
          <span class="usuarios-badge usuarios-badge--${u.papel}">${escapeHtml(u.papel)}</span>
        `;
        el.lista.appendChild(linha);
      });
    } catch (err) {
      el.lista.textContent = "Não foi possível carregar os usuários.";
      console.error(err);
    }
  }

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.erro.hidden = true;
    el.sucesso.hidden = true;
    el.btnCriar.disabled = true;
    try {
      const papel = el.form.querySelector('input[name="papel"]:checked').value;
      const criado = await api("/auth/users", {
        method: "POST",
        body: JSON.stringify({
          nome: el.nome.value.trim(),
          usuario: el.usuario.value.trim(),
          senha: el.senha.value,
          papel,
          foto: fotoSelecionada,
        }),
      });
      el.sucesso.textContent = `Usuário "${criado.nome}" criado como ${criado.papel}.`;
      el.sucesso.hidden = false;
      el.form.reset();
      fotoSelecionada = null;
      el.fotoPreview.innerHTML = window.avatarHtml("", null, 48);
      await carregarUsuarios();
    } catch (err) {
      el.erro.textContent = err.message || "Não foi possível criar o usuário.";
      el.erro.hidden = false;
    } finally {
      el.btnCriar.disabled = false;
    }
  });

  carregarUsuarios();
})();
