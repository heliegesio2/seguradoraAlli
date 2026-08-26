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
    "triagem_handoff",   # coletando nome + descricao do problema antes de decidir escalar
    "handoff",           # encaminhado para atendente humano
    "aguardando_avaliacao",  # atendente finalizou; aguardando nota de 1 a 10 do lead
    "atendimento_encerrado",  # nota recebida (ou fluxo encerrado) - conversa finalizada
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
    role: Literal["lead", "agent", "sistema", "atendente"]
    text: str
    timestamp: str = field(default_factory=now_iso)
    options: list[dict[str, str]] | None = None
    """Respostas rapidas sugeridas (ex: escolha de plano) - a UI renderiza como
    chips clicaveis em vez de exigir texto livre. None quando a pergunta e aberta."""
    oculto_para_atendente: bool = False
    """Mensagens de transicao (ex: 'vou te passar para um atendente') sao ruido
    na tela de quem ja E o atendente - ficam ocultas so nessa view, nao no widget do lead."""
    pede_avaliacao: bool = False
    """Sinaliza que a UI deve mostrar o seletor de nota (1 a 10) apos esta mensagem."""

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
    handoff_problema: str | None = None
    pre_handoff_status: Status | None = None
    lead_nome: str | None = None
    nota_atendimento: int | None = None
    atendente_responsavel: str | None = None
    """Nome do atendente humano que assumiu essa conversa (setado na primeira
    mensagem/finalizacao dele) - so para acompanhamento, nunca restringe quem
    mais pode ver ou responder a conversa."""
    atendente_assumiu_em: str | None = None
    """Timestamp de quando atendente_responsavel foi setado - usado nos relatorios
    (ex: 'atendimentos hoje')."""
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
            "handoff_problema": self.handoff_problema,
            "atendente_responsavel": self.atendente_responsavel,
            "atendente_assumiu_em": self.atendente_assumiu_em,
            "lead_nome": self.lead_nome,
            "nota_atendimento": self.nota_atendimento,
            "updated_at": self.updated_at,
        }
