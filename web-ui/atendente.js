(() => {
  const API = window.AGENT_API_BASE;
  const ACK_KEY = "autoseguro_atendente_ack_v1";
  const POLL_MS = 4000;
  const BASE_TITLE = "Painel do atendente — AutoSeguro";

  const el = {
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
    detailHandoffReason: document.getElementById("detail-handoff-reason"),
    detailHandoffProblema: document.getElementById("detail-handoff-problema"),
    inputSolucao: document.getElementById("input-solucao"),
    solucaoMic: document.getElementById("solucao-mic"),
    btnRegistrarResolucao: document.getElementById("btn-registrar-resolucao"),
    detailInput: document.getElementById("detail-input"),
    detailMic: document.getElementById("detail-mic"),
    detailEnviar: document.getElementById("detail-enviar"),
    btnToggleKb: document.getElementById("btn-toggle-kb"),
    kbPanel: document.getElementById("kb-panel"),
    kbPendentes: document.getElementById("kb-pendentes"),
    kbAprovadas: document.getElementById("kb-aprovadas"),
    favicon: document.getElementById("favicon"),
  };

  let conversas = [];
  let selecionadaId = null;

  const paramsUrl = new URLSearchParams(location.search);
  const focoInicial = paramsUrl.get("conversation");
  let focoAplicado = false;

  async function api(path, options) {
    const resp = await fetch(`${API}${path}`, {
      headers: { "content-type": "application/json" },
      ...options,
    });
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

  function desenharFavicon(count) {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#146c43";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", size / 2, size / 2 + 2);

    if (count > 0) {
      const label = count > 9 ? "9+" : String(count);
      const bx = size * 0.76, by = size * 0.24, br = size * 0.27;
      ctx.fillStyle = "#d32f2f";
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${label.length > 1 ? 18 : 24}px 'Segoe UI', sans-serif`;
      ctx.fillText(label, bx, by + 1);
    }
    return canvas.toDataURL("image/png");
  }

  function atualizarBadge(count) {
    el.favicon.href = desenharFavicon(count);
    document.title = count > 0 ? `(${count > 9 ? "9+" : count}) ${BASE_TITLE}` : BASE_TITLE;
  }

  function contarPendentes(ack) {
    return conversas.filter(
      (c) => c.status === "handoff" && c.messages.length > (ack[c.id] ?? 0)
    ).length;
  }

  // --- lista de conversas -----------------------------------------------

  function renderLista() {
    const ack = loadAck();
    el.convCount.textContent = `(${conversas.length})`;

    if (!conversas.length) {
      el.listItems.innerHTML = '<div class="conv-list__empty">Nenhuma conversa ainda.</div>';
      return;
    }

    const ordenadas = [...conversas].sort((a, b) => {
      const aPend = a.status === "handoff" && a.messages.length > (ack[a.id] ?? 0);
      const bPend = b.status === "handoff" && b.messages.length > (ack[b.id] ?? 0);
      if (aPend !== bPend) return aPend ? -1 : 1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    el.listItems.innerHTML = "";
    for (const conv of ordenadas) {
      const pendente = conv.status === "handoff" && conv.messages.length > (ack[conv.id] ?? 0);
      const ultima = conv.messages[conv.messages.length - 1];

      const row = document.createElement("div");
      row.className = "conv-row" + (conv.id === selecionadaId ? " conv-row--active" : "");

      const dot = document.createElement("div");
      dot.className = "conv-row__dot" + (pendente ? "" : " conv-row__dot--hidden");

      const titulo = conv.lead_nome
        ? `${escapeHtml(conv.lead_nome)} · ${conv.id.replace("conv_", "")}`
        : conv.id.replace("conv_", "");

      const main = document.createElement("div");
      main.className = "conv-row__main";
      main.innerHTML = `
        <div class="conv-row__id">${titulo}</div>
        <div class="conv-row__preview">${ultima ? escapeHtml(ultima.text) : "(sem mensagens)"}</div>
        <span class="conv-row__badge conv-row__badge--${conv.status}">${conv.status}</span>
      `;

      row.appendChild(dot);
      row.appendChild(main);
      row.addEventListener("click", () => selecionarConversa(conv.id));
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
    el.detailStatus.textContent = `status: ${conv.status}`;

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

  async function carregarKb() {
    const entradas = await api("/knowledge-base");
    const pendentes = entradas.filter((e) => !e.aprovado);
    const aprovadas = entradas.filter((e) => e.aprovado);

    el.kbPendentes.innerHTML = "";
    if (!pendentes.length) {
      el.kbPendentes.textContent = "nenhuma pendente";
    } else {
      for (const entry of pendentes) {
        const div = document.createElement("div");
        div.className = "kb-entry";
        div.innerHTML = `<strong>${escapeHtml(entry.motivo || "(sem motivo)")}</strong><br/>${escapeHtml(entry.solucao)}<br/>tags: ${entry.tags.join(", ") || "-"}`;
        const btn = document.createElement("button");
        btn.className = "btn btn--filled";
        btn.textContent = "Aprovar para a base";
        btn.onclick = async () => {
          await api(`/knowledge-base/${entry.id}/approve`, { method: "POST" });
          await carregarKb();
        };
        div.appendChild(btn);
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

  el.btnRegistrarResolucao.addEventListener("click", registrarResolucao);
  el.btnToggleKb.addEventListener("click", () => {
    el.kbPanel.hidden = !el.kbPanel.hidden;
    if (!el.kbPanel.hidden) carregarKb().catch(console.error);
  });
  el.detailEnviar.addEventListener("click", enviarComoAtendente);
  el.detailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarComoAtendente();
  });
  attachMic(el.detailMic, el.detailInput);
  attachMic(el.solucaoMic, el.inputSolucao);

  poll();
  setInterval(poll, POLL_MS);
})();
