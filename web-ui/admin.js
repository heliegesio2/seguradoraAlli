(() => {
  const sessao = window.exigirLogin(["admin"]);
  if (!sessao) return;

  const API = window.AGENT_API_BASE;

  const el = {
    status: document.getElementById("admin-status"),
    topbarUsuario: document.getElementById("topbar-usuario"),
    btnSair: document.getElementById("btn-sair"),
    numero: document.getElementById("input-whatsapp-numero"),
    anthropicKey: document.getElementById("input-anthropic-key"),
    whatsappToken: document.getElementById("input-whatsapp-token"),
    badgeAnthropic: document.getElementById("badge-anthropic"),
    badgeWhatsappToken: document.getElementById("badge-whatsapp-token"),
    recaptchaSite: document.getElementById("input-recaptcha-site"),
    recaptchaSecret: document.getElementById("input-recaptcha-secret"),
    badgeRecaptchaSecret: document.getElementById("badge-recaptcha-secret"),
    claudeModel: document.getElementById("select-claude-model"),
    apiBase: document.getElementById("input-api-base"),
    btnSalvarApiBase: document.getElementById("btn-salvar-api-base"),
    apiBaseFeedback: document.getElementById("api-base-feedback"),
    btnSalvar: document.getElementById("btn-salvar-config"),
    feedback: document.getElementById("salvar-feedback"),
  };

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
    if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
    return resp.json();
  }

  function atualizarBadge(el_, configurada) {
    el_.textContent = configurada ? "configurada" : "não configurada";
    el_.className = "admin-badge" + (configurada ? " admin-badge--ok" : "");
  }

  async function carregar() {
    const cfg = await api("/config");
    const radio = document.querySelector(`input[name="handoff_mode"][value="${cfg.handoff_mode}"]`);
    if (radio) radio.checked = true;
    el.numero.value = cfg.whatsapp_business_number || "";
    el.recaptchaSite.value = cfg.recaptcha_site_key || "";
    if (cfg.claude_model) el.claudeModel.value = cfg.claude_model;
    atualizarBadge(el.badgeAnthropic, cfg.anthropic_api_key_configurada);
    atualizarBadge(el.badgeWhatsappToken, cfg.whatsapp_api_token_configurada);
    atualizarBadge(el.badgeRecaptchaSecret, cfg.recaptcha_secret_key_configurada);
    el.status.textContent = "configuração carregada";
  }

  async function salvar() {
    const modo = document.querySelector('input[name="handoff_mode"]:checked')?.value;
    el.btnSalvar.disabled = true;
    el.feedback.textContent = "Salvando…";
    try {
      const cfg = await api("/config", {
        method: "POST",
        body: JSON.stringify({
          handoff_mode: modo,
          claude_model: el.claudeModel.value,
          whatsapp_business_number: el.numero.value.trim(),
          anthropic_api_key: el.anthropicKey.value.trim(),
          whatsapp_api_token: el.whatsappToken.value.trim(),
          recaptcha_site_key: el.recaptchaSite.value.trim(),
          recaptcha_secret_key: el.recaptchaSecret.value.trim(),
        }),
      });
      el.anthropicKey.value = "";
      el.whatsappToken.value = "";
      el.recaptchaSecret.value = "";
      atualizarBadge(el.badgeAnthropic, cfg.anthropic_api_key_configurada);
      atualizarBadge(el.badgeWhatsappToken, cfg.whatsapp_api_token_configurada);
      atualizarBadge(el.badgeRecaptchaSecret, cfg.recaptcha_secret_key_configurada);
      el.feedback.textContent = "Configurações salvas com sucesso.";
    } catch (err) {
      el.feedback.textContent = "Erro ao salvar: " + err.message;
    } finally {
      el.btnSalvar.disabled = false;
    }
  }

  function salvarApiBase() {
    const novaUrl = el.apiBase.value.trim().replace(/\/+$/, "");
    if (!novaUrl) return;
    localStorage.setItem("autoseguro_api_base", novaUrl);
    el.apiBaseFeedback.textContent = "URL salva neste navegador. Recarregando…";
    setTimeout(() => location.reload(), 700);
  }

  el.apiBase.value = API;
  el.btnSalvarApiBase.addEventListener("click", salvarApiBase);

  document.querySelectorAll(".admin-eye").forEach((botao) => {
    const campo = document.getElementById(botao.dataset.alvo);
    if (campo) window.attachPasswordToggle(botao, campo);
  });

  el.btnSalvar.addEventListener("click", salvar);
  el.topbarUsuario.textContent = `${sessao.nome} (${sessao.papel})`;
  el.btnSair.addEventListener("click", () => window.logoutStaff());
  carregar().catch((err) => {
    el.status.textContent = "erro ao carregar configuração";
    console.error(err);
  });
})();
