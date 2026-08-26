(() => {
  const sessao = window.exigirLogin();
  if (!sessao) return;

  const API = window.AGENT_API_BASE;

  const el = {
    status: document.getElementById("meus-dados-status"),
    topbarUsuario: document.getElementById("topbar-usuario"),
    fotoAtual: document.getElementById("foto-atual"),
    inputFoto: document.getElementById("input-foto"),
    btnSalvar: document.getElementById("btn-salvar-foto"),
    btnRemover: document.getElementById("btn-remover-foto"),
    erro: document.getElementById("foto-erro"),
    sucesso: document.getElementById("foto-sucesso"),
  };

  let fotoSelecionada = undefined; // undefined = nao mexeu ainda; null = remover

  el.status.textContent = `${sessao.nome} (${sessao.papel})`;
  el.topbarUsuario.textContent = `${sessao.nome} (${sessao.papel})`;
  if (sessao.papel !== "admin") {
    document.getElementById("link-usuarios")?.setAttribute("hidden", "");
    document.getElementById("link-admin")?.setAttribute("hidden", "");
  }

  function renderFotoAtual() {
    const foto = fotoSelecionada === undefined ? sessao.foto : fotoSelecionada;
    el.fotoAtual.innerHTML = window.avatarHtml(sessao.nome, foto, 88);
  }
  renderFotoAtual();

  el.inputFoto.addEventListener("change", async () => {
    try {
      fotoSelecionada = await window.lerFotoComoDataUri(el.inputFoto.files[0]);
      renderFotoAtual();
    } catch (err) {
      el.erro.textContent = err.message;
      el.erro.hidden = false;
      el.inputFoto.value = "";
    }
  });

  async function salvarFoto(foto) {
    el.erro.hidden = true;
    el.sucesso.hidden = true;
    try {
      const resp = await fetch(`${API}/auth/me/foto`, {
        method: "POST",
        headers: { "content-type": "application/json", ...window.authHeaders() },
        body: JSON.stringify({ foto }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.detail || "Não foi possível salvar a foto.");

      const sessaoAtualizada = { ...sessao, foto: dados.foto };
      sessionStorage.setItem(window.AUTH_KEY, JSON.stringify(sessaoAtualizada));
      sessao.foto = dados.foto;
      fotoSelecionada = undefined;
      el.inputFoto.value = "";
      renderFotoAtual();
      const bolinhaTopbar = document.getElementById("topbar-avatar-usuario");
      if (bolinhaTopbar) bolinhaTopbar.innerHTML = window.avatarHtml(sessao.nome, sessao.foto, 34);
      el.sucesso.textContent = foto ? "Foto atualizada!" : "Foto removida.";
      el.sucesso.hidden = false;
    } catch (err) {
      el.erro.textContent = err.message || "Não foi possível salvar a foto.";
      el.erro.hidden = false;
    }
  }

  el.btnSalvar.addEventListener("click", () => {
    if (fotoSelecionada === undefined) {
      el.erro.textContent = "Escolha uma foto primeiro.";
      el.erro.hidden = false;
      return;
    }
    salvarFoto(fotoSelecionada);
  });

  el.btnRemover.addEventListener("click", () => salvarFoto(null));
})();
