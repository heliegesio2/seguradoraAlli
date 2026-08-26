// Base URL do agent-service. Pode ser trocada em runtime pelo Admin (fica salva
// so neste navegador, via localStorage - nunca sai daqui) para apontar para um
// backend diferente de localhost:8001, por exemplo em producao.
window.AGENT_API_BASE = (() => {
  try {
    return localStorage.getItem("autoseguro_api_base") || window.AGENT_API_BASE || "http://localhost:8001";
  } catch {
    return window.AGENT_API_BASE || "http://localhost:8001";
  }
})();

// Modo de handoff (site/whatsapp/misto), modelo Claude e numero do WhatsApp
// Business vem do backend (GET /config, editavel pelo painel Admin) - ver widget.js.
