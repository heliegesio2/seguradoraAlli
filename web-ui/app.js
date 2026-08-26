(() => {
  const API = window.AGENT_API_BASE;

  const el = {
    messages: document.getElementById("messages"),
    input: document.getElementById("input-mensagem"),
    btnEnviar: document.getElementById("btn-enviar"),
    btnNovaConversa: document.getElementById("btn-nova-conversa"),
    btnToggleDebug: document.getElementById("btn-toggle-debug"),
    statusChip: document.getElementById("status-chip"),
    debugPanel: document.getElementById("debug-panel"),
    debugStatus: document.getElementById("debug-status"),
    debugSlots: document.getElementById("debug-slots"),
    debugAttempts: document.getElementById("debug-attempts"),
    handoffCard: document.getElementById("handoff-card"),
    debugHandoffReason: document.getElementById("debug-handoff-reason"),
    inputSolucao: document.getElementById("input-solucao"),
    inputTags: document.getElementById("input-tags"),
    btnRegistrarResolucao: document.getElementById("btn-registrar-resolucao"),
    kbPendentes: document.getElementById("kb-pendentes"),
  };

  let conversationId = null;
  let enviando = false;

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

  function formatHora(iso) {
    try {
      return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function renderMensagens(conv) {
    el.messages.innerHTML = "";
    for (const m of conv.messages) {
      const bubble = document.createElement("div");
      bubble.className = `bubble bubble--${m.role === "lead" ? "lead" : "agent"}`;
      bubble.textContent = m.text;
      const meta = document.createElement("span");
      meta.className = "bubble__meta";
      meta.textContent = formatHora(m.timestamp);
      bubble.appendChild(meta);
      el.messages.appendChild(bubble);
    }
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function renderStatus(conv) {
    el.statusChip.textContent = `status: ${conv.status}`;
    el.statusChip.className = `topbar__status status--${conv.status}`;
    el.debugStatus.textContent = conv.status;
    el.debugSlots.textContent = JSON.stringify(conv.slots, null, 2);

    el.debugAttempts.innerHTML = "";
    if (!conv.quote_attempts.length) {
      el.debugAttempts.textContent = "nenhuma ainda";
    } else {
      for (const a of conv.quote_attempts) {
        const row = document.createElement("div");
        row.className = `attempt-row attempt-row--${a.status}`;
        row.textContent = `${a.id} · ${a.status} · http=${a.http_status ?? "-"} · ${a.latency_ms}ms`;
        el.debugAttempts.appendChild(row);
      }
    }

    if (conv.status === "handoff") {
      el.handoffCard.hidden = false;
      el.debugHandoffReason.textContent = conv.handoff_reason || "(sem motivo registrado)";
    } else {
      el.handoffCard.hidden = true;
    }
  }

  function render(conv) {
    renderMensagens(conv);
    renderStatus(conv);
  }

  async function novaConversa() {
    const conv = await api("/conversations", { method: "POST" });
    conversationId = conv.id;
    render(conv);
    await carregarKbPendentes();
  }

  async function enviarMensagem() {
    const texto = el.input.value.trim();
    if (!texto || enviando || !conversationId) return;
    enviando = true;
    el.input.value = "";
    el.btnEnviar.disabled = true;

    const bubbleOtimista = document.createElement("div");
    bubbleOtimista.className = "bubble bubble--lead";
    bubbleOtimista.textContent = texto;
    el.messages.appendChild(bubbleOtimista);
    el.messages.scrollTop = el.messages.scrollHeight;

    try {
      const conv = await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ texto }),
      });
      render(conv);
      if (conv.status === "handoff") {
        await carregarKbPendentes();
      }
    } catch (err) {
      const erroBubble = document.createElement("div");
      erroBubble.className = "bubble bubble--system";
      erroBubble.textContent = `Erro ao falar com o agente: ${err.message}`;
      el.messages.appendChild(erroBubble);
    } finally {
      enviando = false;
      el.btnEnviar.disabled = false;
      el.input.focus();
    }
  }

  async function registrarResolucao() {
    const solucao = el.inputSolucao.value.trim();
    if (!solucao || !conversationId) return;
    const tags = el.inputTags.value.split(",").map((t) => t.trim()).filter(Boolean);
    await api(`/conversations/${conversationId}/resolve-handoff`, {
      method: "POST",
      body: JSON.stringify({ solucao, tags }),
    });
    el.inputSolucao.value = "";
    el.inputTags.value = "";
    await carregarKbPendentes();
  }

  async function carregarKbPendentes() {
    const entradas = await api("/knowledge-base");
    const pendentes = entradas.filter((e) => !e.aprovado);
    el.kbPendentes.innerHTML = "";
    if (!pendentes.length) {
      el.kbPendentes.textContent = "nenhuma pendente";
      return;
    }
    for (const entry of pendentes) {
      const div = document.createElement("div");
      div.className = "kb-entry";
      div.innerHTML = `<strong>${entry.motivo || "(sem motivo)"}</strong><br/>${entry.solucao}<br/>tags: ${entry.tags.join(", ") || "-"}`;
      const btn = document.createElement("button");
      btn.className = "btn btn--filled";
      btn.textContent = "Aprovar para a base";
      btn.onclick = async () => {
        await api(`/knowledge-base/${entry.id}/approve`, { method: "POST" });
        await carregarKbPendentes();
      };
      div.appendChild(btn);
      el.kbPendentes.appendChild(div);
    }
  }

  el.btnEnviar.addEventListener("click", enviarMensagem);
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarMensagem();
  });
  el.btnNovaConversa.addEventListener("click", novaConversa);
  el.btnToggleDebug.addEventListener("click", () => {
    el.debugPanel.hidden = !el.debugPanel.hidden;
  });
  el.btnRegistrarResolucao.addEventListener("click", registrarResolucao);

  novaConversa().catch((err) => {
    el.statusChip.textContent = "erro ao conectar com o agent-service";
    console.error(err);
  });
})();
