"""API do agente de vendas AutoSeguro. Ve tambem CHALLENGE.md e docs/fluxograma-agente.drawio."""
from __future__ import annotations
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config as app_config
from . import knowledge_base, orchestrator, store
from .models import Message, new_id

app = FastAPI(title="AutoSeguro Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MensagemRequest(BaseModel):
    texto: str


class ResolucaoRequest(BaseModel):
    solucao: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/config")
def obter_config():
    """Config publica que a UI le em vez de hardcodar - fonte de verdade e o
    .env do agent-service (ver app/config.py)."""
    return {
        "handoff_mode": app_config.HANDOFF_MODE,
        "whatsapp_business_number": app_config.WHATSAPP_BUSINESS_NUMBER,
    }


@app.post("/conversations")
def criar_conversa():
    conv = store.create_conversation()
    return conv.to_public_dict()


@app.get("/conversations")
def listar_conversas():
    return [c.to_public_dict() for c in store.list_conversations()]


@app.get("/conversations/{conversation_id}")
def obter_conversa(conversation_id: str):
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    return conv.to_public_dict()


@app.post("/conversations/{conversation_id}/messages")
def enviar_mensagem(conversation_id: str, body: MensagemRequest):
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    orchestrator.handle_message(conv, body.texto)
    return conv.to_public_dict()


@app.post("/conversations/{conversation_id}/resolve-handoff")
def resolver_handoff(conversation_id: str, body: ResolucaoRequest):
    """Simula o atendente humano registrando como resolveu um handoff. Entra
    como pendente ate aprovacao (ver /knowledge-base/{entry_id}/approve)."""
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    if conv.status != "handoff":
        raise HTTPException(status_code=400, detail="Conversa nao esta em handoff")
    entry = knowledge_base.registrar_resolucao_pendente(
        conversation_id, conv.handoff_reason or "", conv.handoff_problema or "", body.solucao
    )
    store.log_event(conversation_id, "resolucao_humana_registrada", {"kb_entry_id": entry["id"]})
    return entry


@app.post("/conversations/{conversation_id}/attendant-messages")
def enviar_mensagem_atendente(conversation_id: str, body: MensagemRequest):
    """Mensagem escrita ao vivo pelo atendente humano, direto para o lead - nao
    passa pelo orchestrator/LLM, e o atendente falando por si mesmo."""
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    msg = Message(id=new_id("msg"), role="atendente", text=body.texto)
    conv.messages.append(msg)
    conv.touch()
    store.log_event(conversation_id, "mensagem_atendente", {"message_id": msg.id, "texto": body.texto})
    return conv.to_public_dict()


@app.get("/knowledge-base")
def listar_base_conhecimento():
    return knowledge_base.listar_entradas()


@app.post("/knowledge-base/{entry_id}/approve")
def aprovar_base_conhecimento(entry_id: str):
    entry = knowledge_base.aprovar_entrada(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entrada nao encontrada")
    return entry
