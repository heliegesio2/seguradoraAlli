"""Estado das conversas (em memoria - reinicia com o container) e log de eventos
persistido em JSONL para rastreabilidade (cada mensagem/tentativa/decisao vira uma linha)."""
from __future__ import annotations
import json, threading
from pathlib import Path
from typing import Any
from .models import Conversation, now_iso, new_id

_LOG_PATH = Path(__file__).resolve().parent.parent / "logs" / "events.jsonl"
_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
_lock = threading.Lock()

_conversations: dict[str, Conversation] = {}


def create_conversation() -> Conversation:
    conv = Conversation(id=new_id("conv"))
    _conversations[conv.id] = conv
    log_event(conv.id, "conversa_iniciada", {})
    return conv


def get_conversation(conversation_id: str) -> Conversation | None:
    return _conversations.get(conversation_id)


def list_conversations() -> list[Conversation]:
    return sorted(_conversations.values(), key=lambda c: c.created_at, reverse=True)


def log_event(conversation_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Toda ocorrencia relevante (mensagem, tentativa de cotacao, mudanca de status,
    decisao de handoff) e apendada aqui com id proprio + timestamp, para auditoria
    posterior independente do estado em memoria."""
    entry = {
        "event_id": new_id("evt"),
        "conversation_id": conversation_id,
        "type": event_type,
        "timestamp": now_iso(),
        "payload": payload,
    }
    with _lock:
        with _LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
