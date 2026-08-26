// Base URL do agent-service. Mapeada pelo docker-compose para a porta do host.
window.AGENT_API_BASE = window.AGENT_API_BASE || "http://localhost:8001";

// Modo de handoff (site/whatsapp) e numero do WhatsApp Business vem do backend
// (GET /config, lido do .env do agent-service) - ver widget.js.
