"""Configuracao de negocio lida do ambiente (.env). Fonte unica de verdade para o
modo de handoff - a UI (web-ui) le isso via GET /config em vez de hardcodar."""
from __future__ import annotations
import os

# "site": handoff humano continua dentro do chat do site (padrao - nao gera custo
#         de WhatsApp Business API). "whatsapp": encaminha o lead para o numero
#         real via wa.me (usa WHATSAPP_BUSINESS_NUMBER abaixo).
HANDOFF_MODE = os.getenv("HANDOFF_MODE", "site")
WHATSAPP_BUSINESS_NUMBER = os.getenv("WHATSAPP_BUSINESS_NUMBER", "")
