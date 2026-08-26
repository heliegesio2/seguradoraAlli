(() => {
  const API = window.AGENT_API_BASE;
  const SESSION_KEY = "autoseguro_widget_conversation_id";

  const el = {
    fab: document.getElementById("btn-whatsapp-fab"),
    widget: document.getElementById("widget"),
    btnFechar: document.getElementById("btn-fechar-widget"),
    messages: document.getElementById("widget-messages"),
    input: document.getElementById("widget-input"),
    btnEnviar: document.getElementById("widget-enviar"),
    btnMic: document.getElementById("widget-mic"),
    status: document.getElementById("widget-status"),
    handoff: document.getElementById("widget-handoff"),
    handoffTexto: document.getElementById("widget-handoff-texto"),
    handoffActions: document.getElementById("widget-handoff-actions"),
  };

  let conversationId = sessionStorage.getItem(SESSION_KEY);
  let enviando = false;
  let carregada = false;
  let handoffMode = "site";
  let whatsappNumber = "";
  let recaptchaSiteKey = "";
  let handoffAcoesConstruidas = false;
  let recaptchaScriptPromise = null;

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
    conv.messages.forEach((m, idx) => {
      const tipo = m.role === "lead" ? "lead" : m.role === "atendente" ? "atendente" : "agent";
      const bubble = document.createElement("div");
      bubble.className = `bubble bubble--${tipo}`;
      if (tipo === "atendente") {
        const label = document.createElement("div");
        label.className = "bubble__role-label";
        label.textContent = "Atendente";
        bubble.appendChild(label);
      }
      bubble.appendChild(document.createTextNode(m.text));
      const meta = document.createElement("span");
      meta.className = "bubble__meta";
      meta.textContent = formatHora(m.timestamp);
      bubble.appendChild(meta);
      el.messages.appendChild(bubble);

      const ehUltima = idx === conv.messages.length - 1;
      if (ehUltima && m.options && m.options.length) {
        const wrap = document.createElement("div");
        wrap.className = "widget__options";
        for (const opcao of m.options) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "option-chip";
          chip.textContent = opcao.label;
          chip.addEventListener("click", () => enviarTexto(opcao.value));
          wrap.appendChild(chip);
        }
        el.messages.appendChild(wrap);
      }
      if (ehUltima && m.pede_avaliacao && conv.status === "aguardando_avaliacao") {
        const wrap = document.createElement("div");
        wrap.className = "widget__rating";
        for (let nota = 1; nota <= 10; nota++) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "rating-chip";
          chip.textContent = String(nota);
          chip.addEventListener("click", () => enviarAvaliacao(nota));
          wrap.appendChild(chip);
        }
        el.messages.appendChild(wrap);
      }
    });
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function criarBotaoHandoffSite(conv) {
    const ultimaLead = [...conv.messages].reverse().find((m) => m.role === "lead");
    const url = new URL("atendente.html", window.location.href);
    url.searchParams.set("conversation", conv.id);
    if (conv.lead_nome) url.searchParams.set("nome", conv.lead_nome);
    if (ultimaLead) url.searchParams.set("duvida", ultimaLead.text);

    const a = document.createElement("a");
    a.href = url.toString();
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Abrir atendimento";
    a.className = "btn btn--filled btn--handoff";
    return a;
  }

  function criarBotaoHandoffWhatsapp(conv) {
    const texto = encodeURIComponent(
      `Olá! Vim do site da AutoSeguro (conversa ${conv.id}). Motivo do encaminhamento: ${conv.handoff_reason || "atendimento humano"}.`
    );
    const a = document.createElement("a");
    a.href = `https://wa.me/${whatsappNumber}?text=${texto}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Continuar no WhatsApp";
    a.className = "btn btn--filled btn--whatsapp";
    return a;
  }

  function carregarRecaptchaScript() {
    if (window.grecaptcha && window.grecaptcha.render) return Promise.resolve();
    if (recaptchaScriptPromise) return recaptchaScriptPromise;
    recaptchaScriptPromise = new Promise((resolve) => {
      window.__onRecaptchaLoad = resolve;
      const s = document.createElement("script");
      s.src = "https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoad&render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    });
    return recaptchaScriptPromise;
  }

  function criarAreaHandoffWhatsapp(conv) {
    if (!recaptchaSiteKey) {
      return criarBotaoHandoffWhatsapp(conv);
    }

    const container = document.createElement("div");
    container.className = "widget__whatsapp-gate";

    const botaoDesabilitado = document.createElement("button");
    botaoDesabilitado.type = "button";
    botaoDesabilitado.className = "btn btn--filled btn--whatsapp";
    botaoDesabilitado.disabled = true;
    botaoDesabilitado.textContent = "Confirme abaixo para continuar no WhatsApp";

    const recaptchaSlot = document.createElement("div");
    container.appendChild(recaptchaSlot);
    container.appendChild(botaoDesabilitado);

    carregarRecaptchaScript().then(() => {
      window.grecaptcha.render(recaptchaSlot, {
        sitekey: recaptchaSiteKey,
        callback: async (token) => {
          botaoDesabilitado.textContent = "Verificando…";
          try {
            const resultado = await api("/recaptcha/verify", {
              method: "POST",
              body: JSON.stringify({ token }),
            });
            if (resultado.sucesso) {
              container.replaceChild(criarBotaoHandoffWhatsapp(conv), botaoDesabilitado);
            } else {
              botaoDesabilitado.textContent = "Verificação falhou, tente marcar de novo";
            }
          } catch (err) {
            botaoDesabilitado.textContent = "Erro ao verificar, tente de novo";
            console.error(err);
          }
        },
      });
    });

    return container;
  }

  function renderHandoff(conv) {
    if (conv.status !== "handoff") {
      handoffAcoesConstruidas = false;
      el.handoff.hidden = true;
      if (conv.status === "aguardando_avaliacao") el.status.textContent = "aguardando sua avaliação";
      else if (conv.status === "atendimento_encerrado") el.status.textContent = "atendimento encerrado";
      else el.status.textContent = "online";
      return;
    }
    el.status.textContent = "encaminhado para atendente";
    el.handoff.hidden = false;
    el.handoffTexto.textContent = conv.handoff_reason
      ? `Esse caso precisa de um atendente humano: ${conv.handoff_reason}.`
      : "Esse caso precisa de um atendente humano.";

    // So monta os botoes uma vez por handoff: recriar a cada poll destruiria o
    // iframe do reCAPTCHA (quando presente) no meio da verificacao do lead.
    if (handoffAcoesConstruidas) return;
    handoffAcoesConstruidas = true;

    el.handoffActions.innerHTML = "";
    if (handoffMode === "whatsapp" && whatsappNumber) {
      el.handoffActions.appendChild(criarAreaHandoffWhatsapp(conv));
    } else if (handoffMode === "misto") {
      el.handoffActions.appendChild(criarBotaoHandoffSite(conv));
      if (whatsappNumber) el.handoffActions.appendChild(criarAreaHandoffWhatsapp(conv));
    } else {
      // Modo "site" (padrao): o atendimento continua aqui mesmo. O botao so
      // abre o painel interno do atendente (uso do time, nao do lead) ja com
      // essa conversa selecionada - simula o atendente sendo notificado.
      el.handoffActions.appendChild(criarBotaoHandoffSite(conv));
    }
  }

  function render(conv) {
    renderMensagens(conv);
    renderHandoff(conv);
  }

  async function carregarConfig() {
    try {
      const cfg = await api("/config");
      handoffMode = cfg.handoff_mode || "site";
      whatsappNumber = cfg.whatsapp_business_number || "";
      recaptchaSiteKey = cfg.recaptcha_site_key || "";
    } catch (err) {
      console.error(err);
    }
  }

  async function garantirConversa() {
    if (conversationId) {
      try {
        const conv = await api(`/conversations/${conversationId}`);
        render(conv);
        return;
      } catch {
        conversationId = null;
      }
    }
    const conv = await api("/conversations", { method: "POST" });
    conversationId = conv.id;
    sessionStorage.setItem(SESSION_KEY, conversationId);
    render(conv);
  }

  async function enviarTexto(texto) {
    if (!texto || enviando || !conversationId) return;
    enviando = true;
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
    } catch (err) {
      const erroBubble = document.createElement("div");
      erroBubble.className = "bubble bubble--system";
      erroBubble.textContent = "Não consegui falar com o servidor agora. Tente de novo em instantes.";
      el.messages.appendChild(erroBubble);
      console.error(err);
    } finally {
      enviando = false;
      el.btnEnviar.disabled = false;
      el.input.focus();
    }
  }

  function enviarMensagem() {
    const texto = el.input.value.trim();
    if (!texto) return;
    el.input.value = "";
    enviarTexto(texto);
  }

  async function enviarAvaliacao(nota) {
    if (!conversationId) return;
    try {
      const conv = await api(`/conversations/${conversationId}/avaliacao`, {
        method: "POST",
        body: JSON.stringify({ nota }),
      });
      render(conv);
    } catch (err) {
      console.error(err);
    }
  }

  async function abrirWidget() {
    el.widget.hidden = false;
    el.fab.setAttribute("aria-expanded", "true");
    if (!carregada) {
      carregada = true;
      try {
        await garantirConversa();
      } catch (err) {
        el.status.textContent = "erro ao conectar";
        console.error(err);
      }
    }
    el.input.focus();
  }

  function fecharWidget() {
    el.widget.hidden = true;
    el.fab.setAttribute("aria-expanded", "false");
  }

  el.fab.addEventListener("click", () => {
    if (el.widget.hidden) abrirWidget();
    else fecharWidget();
  });
  el.btnFechar.addEventListener("click", fecharWidget);
  el.btnEnviar.addEventListener("click", enviarMensagem);
  attachMic(el.btnMic, el.input);
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarMensagem();
  });

  document.getElementById("btn-abrir-chat")?.addEventListener("click", abrirWidget);
  carregarConfig();

  // Enquanto o widget estiver aberto, sincroniza com respostas do atendente
  // humano (enviadas pelo painel interno) sem exigir que o lead reenvie algo.
  setInterval(() => {
    if (!el.widget.hidden && conversationId) {
      api(`/conversations/${conversationId}`).then(render).catch(() => {});
    }
  }, 4000);
})();
