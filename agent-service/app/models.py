"""Modelos de dados da conversa. Tudo aqui e serializavel para JSON (log/API)."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Literal
import uuid

Status = Literal[
    "coletando_dados",   # ainda faltam campos obrigatorios ou dados invalidos
    "aguardando_retry",  # falha de infra esgotou tentativas; lead decide se tenta de novo
    "cotado",            # cotacao apresentada, aguardando reacao do lead
    "recusa_negocio",    # recusa de subscricao explicada, aguardando reacao do lead
    "handoff",           # encaminhado para atendente humano
    "fechado",           # lead aceitou a cotacao
    "perdido",           # lead recusou/desistiu apos ver a cotacao
    "perdido_recusa",    # recusa de negocio (subscricao) aceita pelo lead, sem handoff
]

REQUIRED_SLOTS = ["plano_id", "idade", "veiculo_ano", "cep", "data_inicio"]


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Message:
    id: str
    role: Literal["lead", "agent", "sistema"]
    text: str
    timestamp: str = field(default_factory=now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class QuoteAttempt:
    id: str
    timestamp: str
    status: Literal["sucesso", "erro_infra", "recusa_negocio", "payload_invalido"]
    http_status: int | None
    detail: dict[str, Any]
    latency_ms: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Conversation:
    id: str
    status: Status = "coletando_dados"
    slots: dict[str, Any] = field(default_factory=lambda: {k: None for k in REQUIRED_SLOTS})
    messages: list[Message] = field(default_factory=list)
    quote_attempts: list[QuoteAttempt] = field(default_factory=list)
    last_quote_result: dict[str, Any] | None = None
    handoff_reason: str | None = None
    misunderstanding_count: int = 0
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)

    def touch(self) -> None:
        self.updated_at = now_iso()

    def missing_slots(self) -> list[str]:
        return [k for k in REQUIRED_SLOTS if not self.slots.get(k)]

    def to_public_dict(self) -> dict[str, Any]:
        """Vista publica para a UI: estado + trace, sem detalhes internos sensiveis."""
        return {
            "id": self.id,
            "status": self.status,
            "slots": self.slots,
            "messages": [m.to_dict() for m in self.messages],
            "quote_attempts": [q.to_dict() for q in self.quote_attempts],
            "last_quote_result": self.last_quote_result,
            "handoff_reason": self.handoff_reason,
            "updated_at": self.updated_at,
        }
