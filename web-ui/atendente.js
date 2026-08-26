(() => {
  const sessao = window.exigirLogin(["atendente", "admin"]);
  if (!sessao) return;

  const API = window.AGENT_API_BASE;
  const ACK_KEY = "autoseguro_atendente_ack_v1";
  const POLL_MS = 4000;
  const BASE_TITLE = "Painel do atendente — AutoSeguro";

  const el = {
    topbarUsuario: document.getElementById("topbar-usuario"),
    linkAdmin: document.getElementById("link-admin"),
    btnSair: document.getElementById("btn-sair"),
    conexaoStatus: document.getElementById("conexao-status"),
    convCount: document.getElementById("conv-count"),
    listItems: document.getElementById("conv-list-items"),
    detailEmpty: document.getElementById("conv-detail-empty"),
    detailBody: document.getElementById("conv-detail-body"),
    detailId: document.getElementById("detail-id"),
    detailStatus: document.getElementById("detail-status"),
    detailMessages: document.getElementById("detail-messages"),
    detailSlots: document.getElementById("detail-slots"),
    detailAttempts: document.getElementById("detail-attempts"),
    detailHandoffCard: document.getElementById("detail-handoff-card"),
    detailResolucaoCard: document.getElementById("detail-resolucao-card"),
    detailHandoffReason: document.getElementById("detail-handoff-reason"),
    detailHandoffProblema: document.getElementById("detail-handoff-problema"),
    btnFinalizarAtendimento: document.getElementById("btn-finalizar-atendimento"),
    detailNotaCard: document.getElementById("detail-nota-card"),
    detailNotaValor: document.getElementById("detail-nota-valor"),
    inputSolucao: document.getElementById("input-solucao"),
    solucaoMic: document.getElementById("solucao-mic"),
    btnRegistrarResolucao: document.getElementById("btn-registrar-resolucao"),
    detailInput: document.getElementById("detail-input"),
    detailMic: document.getElementById("detail-mic"),
    detailEnviar: document.getElementById("detail-enviar"),
    btnMenu: document.getElementById("btn-menu"),
    menuPainel: document.getElementById("menu-painel"),
    btnToggleKb: document.getElementById("btn-toggle-kb"),
    btnFecharKb: document.getElementById("btn-fechar-kb"),
    kbPanel: document.getElementById("kb-panel"),
    kbSomenteAdminHint: document.getElementById("kb-somente-admin-hint"),
    selectOrdenacao: document.getElementById("select-ordenacao"),
    kbPendentes: document.getElementById("kb-pendentes"),
    kbAprovadas: document.getElementById("kb-aprovadas"),
    btnToggleRelatorios: document.getElementById("btn-toggle-relatorios"),
    btnFecharRelatorios: document.getElementById("btn-fechar-relatorios"),
    relatoriosPanel: document.getElementById("relatorios-panel"),
    relHoje: document.getElementById("rel-hoje"),
    relTotal: document.getElementById("rel-total"),
    relRankingVolume: document.getElementById("rel-ranking-volume"),
    relRankingNotas: document.getElementById("rel-ranking-notas"),
    btnToggleDocs: document.getElementById("btn-toggle-docs"),
    btnFecharDocs: document.getElementById("btn-fechar-docs"),
    docsPanel: document.getElementById("docs-panel"),
    docLista: document.getElementById("doc-lista"),
    favicon: document.getElementById("favicon"),
  };

  let conversas = [];
  let selecionadaId = null;
  let ordenacao = "padrao";

  const paramsUrl = new URLSearchParams(location.search);
  const focoInicial = paramsUrl.get("conversation");
  let focoAplicado = false;

  async function api(path, options) {
    const resp = await fetch(`${API}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...window.authHeaders(), ...(options?.headers || {}) },
    });
    if (resp.status === 401) {
      sessionStorage.removeItem(window.AUTH_KEY);
      window.location.href = "login.html";
      throw new Error("Sessão expirada.");
    }
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`${resp.status}: ${body}`);
    }
    return resp.json();
  }

  function loadAck() {
    try {
      return JSON.parse(localStorage.getItem(ACK_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveAck(ack) {
    localStorage.setItem(ACK_KEY, JSON.stringify(ack));
  }

  function formatHora(iso) {
    try {
      return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  // --- badge na aba (favicon + titulo) ---------------------------------

  const badgeAba = window.criarBadgeAba({ favicon: el.favicon, letra: "A", cor: "#5b4ff0", tituloBase: BASE_TITLE });
  const atualizarBadge = (count) => badgeAba.atualizar(count);

  function contarPendentes(ack) {
    return conversas.filter(
      (c) => c.status === "handoff" && c.messages.length > (ack[c.id] ?? 0)
    ).length;
  }

  // --- lista de conversas -----------------------------------------------

  function estaBloqueadaParaMim(conv) {
    const emAndamento = (conv.status === "handoff" || conv.status === "aguardando_avaliacao")
      && conv.atendente_responsavel;
    if (!emAndamento) return false;
    if (sessao.papel === "admin") return false;
    return conv.atendente_responsavel !== sessao.nome;
  }

  function ordenarConversas(ack) {
    if (ordenacao === "nota_desc" || ordenacao === "nota_asc") {
      const sinal = ordenacao === "nota_desc" ? -1 : 1;
      return [...conversas].sort((a, b) => {
        const na = a.nota_atendimento;
        const nb = b.nota_atendimento;
        if (na == null && nb == null) return 0;
        if (na == null) return 1; // sem nota vai para o fim, nos dois sentidos
        if (nb == null) return -1;
        return sinal * (na - nb);
      });
    }
    return [...conversas].sort((a, b) => {
      const aPend = a.status === "handoff" && a.messages.length > (ack[a.id] ?? 0);
      const bPend = b.status === "handoff" && b.messages.length > (ack[b.id] ?? 0);
      if (aPend !== bPend) return aPend ? -1 : 1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  }

  function renderLista() {
    const ack = loadAck();
    el.convCount.textContent = `(${conversas.length})`;

    if (!conversas.length) {
      el.listItems.innerHTML = '<div class="conv-list__empty">Nenhuma conversa ainda.</div>';
      return;
    }

    const ordenadas = ordenarConversas(ack);

    el.listItems.innerHTML = "";
    for (const conv of ordenadas) {
      const pendente = conv.status === "handoff" && conv.messages.length > (ack[conv.id] ?? 0);
      const ultima = conv.messages[conv.messages.length - 1];

      const bloqueada = estaBloqueadaParaMim(conv);

      const row = document.createElement("div");
      row.className = "conv-row"
        + (conv.id === selecionadaId ? " conv-row--active" : "")
        + (bloqueada ? " conv-row--bloqueada" : "");

      const dot = document.createElement("div");
      dot.className = "conv-row__dot" + (pendente ? "" : " conv-row__dot--hidden");

      const titulo = conv.lead_nome
        ? `${escapeHtml(conv.lead_nome)} · ${conv.id.replace("conv_", "")}`
        : conv.id.replace("conv_", "");

      const nota = conv.nota_atendimento != null ? ` · nota ${conv.nota_atendimento}/10` : "";

      const main = document.createElement("div");
      main.className = "conv-row__main";
      main.innerHTML = `
        <div class="conv-row__id">${titulo}</div>
        <div class="conv-row__preview">${ultima ? escapeHtml(ultima.text) : "(sem mensagens)"}${escapeHtml(nota)}</div>
        <span class="conv-row__badge conv-row__badge--${conv.status}">${conv.status}</span>
        ${conv.atendente_responsavel ? `<div class="conv-row__atendente">${bloqueada ? "🔒 Em atendimento com" : "Atendido por"} ${escapeHtml(conv.atendente_responsavel)}</div>` : ""}
      `;

      row.appendChild(dot);
      row.appendChild(main);
      if (bloqueada) {
        row.title = `Em atendimento com ${conv.atendente_responsavel} - aguarde ficar aberta ou fechada.`;
      } else {
        row.addEventListener("click", () => selecionarConversa(conv.id));
      }
      el.listItems.appendChild(row);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // --- detalhe da conversa selecionada -----------------------------------

  function selecionarConversa(id) {
    selecionadaId = id;
    const ack = loadAck();
    const conv = conversas.find((c) => c.id === id);
    if (conv) ack[id] = conv.messages.length;
    saveAck(ack);
    renderDetalhe();
    renderLista();
    atualizarBadge(contarPendentes(loadAck()));
  }

  function renderDetalhe() {
    const conv = conversas.find((c) => c.id === selecionadaId);
    if (!conv) {
      el.detailEmpty.hidden = false;
      el.detailBody.hidden = true;
      return;
    }
    el.detailEmpty.hidden = true;
    el.detailBody.hidden = false;

    el.detailId.textContent = conv.lead_nome ? `${conv.lead_nome} · ${conv.id}` : conv.id;
    el.detailStatus.textContent = conv.atendente_responsavel
      ? `status: ${conv.status} · atendido por ${conv.atendente_responsavel}`
      : `status: ${conv.status}`;

    el.detailMessages.innerHTML = "";
    for (const m of conv.messages) {
      if (m.oculto_para_atendente) continue;
      const tipo = m.role === "lead" ? "lead" : m.role === "atendente" ? "atendente" : "agent";
      const bubble = document.createElement("div");
      bubble.className = `bubble bubble--${tipo}`;
      if (tipo === "atendente") {
        const label = document.createElement("div");
        label.className = "bubble__role-label";
        label.textContent = "Você (atendente)";
        bubble.appendChild(label);
      }
      bubble.appendChild(document.createTextNode(m.text));
      const meta = document.createElement("span");
      meta.className = "bubble__meta";
      meta.textContent = formatHora(m.timestamp);
      bubble.appendChild(meta);
      el.detailMessages.appendChild(bubble);
    }
    el.detailMessages.scrollTop = el.detailMessages.scrollHeight;

    el.detailSlots.textContent = JSON.stringify(conv.slots, null, 2);

    el.detailAttempts.innerHTML = "";
    if (!conv.quote_attempts.length) {
      el.detailAttempts.textContent = "nenhuma ainda";
    } else {
      for (const a of conv.quote_attempts) {
        const row = document.createElement("div");
        row.className = `attempt-row attempt-row--${a.status}`;
        row.textContent = `${a.id} · ${a.status} · http=${a.http_status ?? "-"} · ${a.latency_ms}ms`;
        el.detailAttempts.appendChild(row);
      }
    }

    if (conv.status === "handoff") {
      el.detailHandoffCard.hidden = false;
      el.detailHandoffReason.textContent = conv.handoff_reason || "(sem motivo registrado)";
      el.detailHandoffProblema.textContent = conv.handoff_problema || "(nao informado)";
    } else {
      el.detailHandoffCard.hidden = true;
    }

    // So quem pode finalizar esse atendimento (dono ou admin) registra a
    // resolucao - reaproveita a mesma regra do bloqueio "em andamento".
    el.detailResolucaoCard.hidden = estaBloqueadaParaMim(conv);

    if (conv.nota_atendimento != null) {
      el.detailNotaCard.hidden = false;
      el.detailNotaValor.textContent = `${conv.nota_atendimento}/10`;
    } else {
      el.detailNotaCard.hidden = true;
    }
  }

  async function registrarResolucao() {
    const solucao = el.inputSolucao.value.trim();
    if (!solucao || !selecionadaId) return;
    await api(`/conversations/${selecionadaId}/resolve-handoff`, {
      method: "POST",
      body: JSON.stringify({ solucao }),
    });
    el.inputSolucao.value = "";
    await carregarConversas();
    await carregarKb();
  }

  async function finalizarAtendimento() {
    if (!selecionadaId) return;
    if (!confirm("Finalizar o atendimento? O lead vai receber o pedido de avaliação (1 a 10).")) return;
    await api(`/conversations/${selecionadaId}/finalizar-atendimento`, { method: "POST" });
    await carregarConversas();
  }

  async function enviarComoAtendente() {
    const texto = el.detailInput.value.trim();
    if (!texto || !selecionadaId) return;
    el.detailInput.value = "";
    await api(`/conversations/${selecionadaId}/attendant-messages`, {
      method: "POST",
      body: JSON.stringify({ texto }),
    });
    await carregarConversas();
  }

  // --- base de conhecimento ----------------------------------------------

  function renderRanking(el_, itens, formatarLinha) {
    el_.innerHTML = "";
    if (!itens.length) {
      el_.textContent = "sem dados ainda";
      return;
    }
    for (const item of itens) {
      const row = document.createElement("div");
      row.className = "rel-row";
      row.innerHTML = formatarLinha(item);
      el_.appendChild(row);
    }
  }

  async function carregarRelatorios() {
    const dados = await api("/reports/summary");
    el.relHoje.textContent = dados.atendimentos_hoje;
    el.relTotal.textContent = dados.total_atendimentos;
    renderRanking(el.relRankingVolume, dados.ranking_volume, (item) => `
      <span class="rel-row__nome">${escapeHtml(item.atendente)}</span>
      <span class="rel-row__valor">${item.total} atendimento(s)</span>
    `);
    renderRanking(el.relRankingNotas, dados.ranking_notas, (item) => `
      <span class="rel-row__nome">${escapeHtml(item.atendente)}</span>
      <span class="rel-row__valor">${item.media_nota}/10 (${item.avaliacoes})</span>
    `);
  }

  function renderDocumentacao() {
    const itens = window.DOCUMENTACAO_ITENS || [];
    el.docLista.innerHTML = "";
    if (!itens.length) {
      el.docLista.textContent = "Nenhum item ainda.";
      return;
    }
    itens.forEach((item, idx) => {
      const bloco = document.createElement("div");
      bloco.className = "doc-item";

      const pergunta = document.createElement("button");
      pergunta.type = "button";
      pergunta.className = "doc-item__pergunta";
      pergunta.innerHTML = `<span>${escapeHtml(item.titulo)}</span><span class="doc-item__icon">+</span>`;

      const resposta = document.createElement("div");
      resposta.className = "doc-item__resposta";
      resposta.innerHTML = `<div class="doc-item__resposta-inner">${item.corpo}</div>`;

      pergunta.addEventListener("click", () => {
        bloco.classList.toggle("doc-item--aberto");
      });

      bloco.appendChild(pergunta);
      bloco.appendChild(resposta);
      el.docLista.appendChild(bloco);

      if (idx === 0) bloco.classList.add("doc-item--aberto");
    });
  }

  async function carregarKb() {
    const entradas = await api("/knowledge-base");
    const pendentes = entradas.filter((e) => !e.aprovado);
    const aprovadas = entradas.filter((e) => e.aprovado);
    const souAdmin = sessao.papel === "admin";
    el.kbSomenteAdminHint.hidden = souAdmin;

    el.kbPendentes.innerHTML = "";
    if (!pendentes.length) {
      el.kbPendentes.textContent = "nenhuma pendente";
    } else {
      for (const entry of pendentes) {
        const div = document.createElement("div");
        div.className = "kb-entry";
        div.innerHTML = `<strong>${escapeHtml(entry.motivo || "(sem motivo)")}</strong><br/>${escapeHtml(entry.solucao)}<br/>tags: ${entry.tags.join(", ") || "-"}`;
        if (souAdmin) {
          const acoes = document.createElement("div");
          acoes.className = "kb-entry__acoes";

          const btnAprovar = document.createElement("button");
          btnAprovar.className = "btn btn--filled";
          btnAprovar.textContent = "Aprovar";
          btnAprovar.onclick = async () => {
            await api(`/knowledge-base/${entry.id}/approve`, { method: "POST" });
            await carregarKb();
          };

          const btnReprovar = document.createElement("button");
          btnReprovar.className = "btn btn--outline";
          btnReprovar.textContent = "Reprovar";
          btnReprovar.onclick = async () => {
            await api(`/knowledge-base/${entry.id}/reject`, { method: "POST" });
            await carregarKb();
          };

          acoes.appendChild(btnAprovar);
          acoes.appendChild(btnReprovar);
          div.appendChild(acoes);
        }
        el.kbPendentes.appendChild(div);
      }
    }

    el.kbAprovadas.innerHTML = "";
    if (!aprovadas.length) {
      el.kbAprovadas.textContent = "nenhuma ainda";
    } else {
      for (const entry of aprovadas) {
        const div = document.createElement("div");
        div.className = "kb-entry";
        div.innerHTML = `<strong>${escapeHtml(entry.motivo || "(sem motivo)")}</strong><br/>${escapeHtml(entry.solucao)}<br/>tags: ${entry.tags.join(", ") || "-"}`;
        el.kbAprovadas.appendChild(div);
      }
    }
  }

  // --- polling -------------------------------------------------------------

  async function carregarConversas() {
    conversas = await api("/conversations");

    if (selecionadaId) {
      // A conversa aberta esta sendo acompanhada ao vivo - qualquer mensagem
      // nova nela (inclusive a propria resposta do atendente) ja conta como vista.
      const ack = loadAck();
      const conv = conversas.find((c) => c.id === selecionadaId);
      if (conv) {
        ack[selecionadaId] = conv.messages.length;
        saveAck(ack);
      }
    }

    renderLista();
    if (selecionadaId) renderDetalhe();
    atualizarBadge(contarPendentes(loadAck()));

    if (!focoAplicado && focoInicial && conversas.some((c) => c.id === focoInicial)) {
      focoAplicado = true;
      selecionarConversa(focoInicial);
    }
  }

  async function poll() {
    try {
      await carregarConversas();
      el.conexaoStatus.textContent = `conectado · ${conversas.length} conversa(s)`;
    } catch (err) {
      el.conexaoStatus.textContent = "erro ao conectar com o agent-service";
      console.error(err);
    }
  }

  el.selectOrdenacao.addEventListener("change", () => {
    ordenacao = el.selectOrdenacao.value;
    renderLista();
  });
  const detailMicControl = attachMic(el.detailMic, el.detailInput);
  const solucaoMicControl = attachMic(el.solucaoMic, el.inputSolucao);

  el.btnRegistrarResolucao.addEventListener("click", () => {
    solucaoMicControl.parar();
    registrarResolucao();
  });
  el.btnFinalizarAtendimento.addEventListener("click", finalizarAtendimento);

  // Menu sanfona (hamburguer) da topbar
  el.btnMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    const abrir = el.menuPainel.hidden;
    el.menuPainel.hidden = !abrir;
    el.btnMenu.setAttribute("aria-expanded", String(abrir));
  });
  document.addEventListener("click", (e) => {
    if (!el.menuPainel.hidden && !el.menuPainel.contains(e.target) && e.target !== el.btnMenu) {
      el.menuPainel.hidden = true;
      el.btnMenu.setAttribute("aria-expanded", "false");
    }
  });

  function fecharPainelLaterais({ exceto } = {}) {
    if (exceto !== "kb") el.kbPanel.hidden = true;
    if (exceto !== "relatorios") el.relatoriosPanel.hidden = true;
    if (exceto !== "docs") el.docsPanel.hidden = true;
  }

  el.btnToggleKb.addEventListener("click", () => {
    el.menuPainel.hidden = true;
    fecharPainelLaterais({ exceto: "kb" });
    el.kbPanel.hidden = !el.kbPanel.hidden;
    if (!el.kbPanel.hidden) carregarKb().catch(console.error);
  });
  el.btnFecharKb.addEventListener("click", () => {
    el.kbPanel.hidden = true;
  });

  el.btnToggleRelatorios.addEventListener("click", () => {
    el.menuPainel.hidden = true;
    fecharPainelLaterais({ exceto: "relatorios" });
    el.relatoriosPanel.hidden = !el.relatoriosPanel.hidden;
    if (!el.relatoriosPanel.hidden) carregarRelatorios().catch(console.error);
  });
  el.btnFecharRelatorios.addEventListener("click", () => {
    el.relatoriosPanel.hidden = true;
  });

  el.btnToggleDocs.addEventListener("click", () => {
    el.menuPainel.hidden = true;
    fecharPainelLaterais({ exceto: "docs" });
    el.docsPanel.hidden = !el.docsPanel.hidden;
  });
  el.btnFecharDocs.addEventListener("click", () => {
    el.docsPanel.hidden = true;
  });
  el.detailEnviar.addEventListener("click", () => {
    detailMicControl.parar();
    enviarComoAtendente();
  });
  el.detailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      detailMicControl.parar();
      enviarComoAtendente();
    }
  });

  el.topbarUsuario.textContent = `${sessao.nome} (${sessao.papel})`;
  if (sessao.papel !== "admin") el.linkAdmin.hidden = true;
  el.btnSair.addEventListener("click", () => window.logoutStaff());
  renderDocumentacao();

  poll();
  setInterval(poll, POLL_MS);
})();
