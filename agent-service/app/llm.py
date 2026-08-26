"""Cliente Claude. Duas responsabilidades apenas:
 (1) extrair dados estruturados + sinais de intencao da mensagem do lead (tool use);
 (2) gerar texto natural para o lead a partir de instrucoes + fatos fornecidos.

O LLM nunca decide preco, retry ou handoff sozinho - isso e sempre codigo
deterministico (ver orchestrator.py). Para o preco em especifico, o texto que o
menciona e sempre montado por template em Python a partir da resposta real do
quote-service, nunca escrito livremente pelo modelo - ver orchestrator.py."""
from __future__ import annotations
import json, os
from typing import Any
import anthropic
from . import config as app_config

MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5")
EFFORT = os.getenv("CLAUDE_EFFORT", "low")

_client_cache: dict[str, Any] = {"key": None, "client": None}


def _client() -> anthropic.Anthropic:
    """Recria o cliente so quando a chave (editavel via painel Admin) muda -
    evita reconectar a cada chamada mas ainda pega trocas de chave em runtime."""
    key = app_config.get_secret("anthropic_api_key") or None
    if _client_cache["key"] != key:
        _client_cache["client"] = anthropic.Anthropic(api_key=key)
        _client_cache["key"] = key
    return _client_cache["client"]

_EXTRACT_TOOL = {
    "name": "analisar_mensagem",
    "description": "Extrai dados de cotacao e sinais de intencao da mensagem mais recente do lead, dado o contexto da conversa.",
    "input_schema": {
        "type": "object",
        "properties": {
            "slots_atualizados": {
                "type": "object",
                "description": "Somente os campos que a mensagem atual confirma ou corrige. Omita os que nao apareceram nesta mensagem.",
                "properties": {
                    "plano_id": {"type": "string", "enum": ["essencial", "completo", "premium"]},
                    "idade": {"type": "integer"},
                    "veiculo_ano": {"type": "integer"},
                    "cep": {"type": "string"},
                    "data_inicio": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "additionalProperties": False,
            },
            "nome_lead": {"type": "string", "description": "Nome do lead, apenas se ele se identificou explicitamente nesta mensagem (ex: 'sou o Joao', 'meu nome e Maria'). Omita se nao disse."},
            "pedido_humano_explicito": {"type": "boolean"},
            "fora_do_escopo": {"type": "boolean", "description": "Mensagem sem relacao com contratar/cotar seguro auto"},
            "reclamacao_ou_sinistro": {"type": "boolean"},
            "pede_desconto_ou_negociacao": {"type": "boolean"},
            "quer_aceitar_cotacao": {"type": "boolean"},
            "quer_recusar_cotacao": {"type": "boolean"},
            "confianca_interpretacao": {"type": "string", "enum": ["alta", "media", "baixa"]},
        },
        "required": [
            "slots_atualizados", "pedido_humano_explicito", "fora_do_escopo",
            "reclamacao_ou_sinistro", "pede_desconto_ou_negociacao",
            "quer_aceitar_cotacao", "quer_recusar_cotacao", "confianca_interpretacao",
        ],
        "additionalProperties": False,
    },
}

_EXTRACT_SYSTEM = """Voce e o modulo de compreensao de um agente de vendas de seguro \
auto por WhatsApp. Sua unica tarefa e analisar a mensagem mais recente do lead e \
chamar a ferramenta analisar_mensagem com os dados extraidos. Nao converse, nao \
responda ao lead aqui - apenas extraia. Use somente informacoes explicitas na \
mensagem; nunca infira idade, ano do veiculo, CEP ou data que o lead nao disse."""

_FALLBACK_EXTRACAO: dict[str, Any] = {
    "slots_atualizados": {},
    "pedido_humano_explicito": False,
    "fora_do_escopo": False,
    "reclamacao_ou_sinistro": False,
    "pede_desconto_ou_negociacao": False,
    "quer_aceitar_cotacao": False,
    "quer_recusar_cotacao": False,
    "confianca_interpretacao": "baixa",
}


def extrair(historico: str, slots_atuais: dict[str, Any]) -> dict[str, Any]:
    """Roda uma chamada com tool_choice forcado para garantir saida estruturada."""
    contexto = (
        f"Dados ja confirmados nesta conversa: {json.dumps(slots_atuais, ensure_ascii=False)}\n\n"
        f"Historico recente (mais antiga primeiro):\n{historico}"
    )
    resp = _client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=_EXTRACT_SYSTEM,
        output_config={"effort": EFFORT},
        tools=[_EXTRACT_TOOL],
        tool_choice={"type": "tool", "name": "analisar_mensagem"},
        messages=[{"role": "user", "content": contexto}],
    )
    for block in resp.content:
        if block.type == "tool_use":
            return block.input
    return dict(_FALLBACK_EXTRACAO)


_REPLY_SYSTEM = """Voce e um assistente de vendas da AutoSeguro conversando por \
WhatsApp. Tom: direto, cordial, frases curtas de mensagem de WhatsApp, sem emojis \
em excesso. Regra inegociavel: NUNCA invente valores de preco, prazos, coberturas, \
franquias ou qualquer numero. Use apenas os fatos fornecidos explicitamente na \
instrucao. Se a instrucao nao trouxer um numero, nao mencione numero nenhum. \
Responda so a mensagem que o lead vai ler - nunca inclua comentarios sobre a sua \
propria resposta (nada de "Obs:", notas explicando o que voce manteve/decidiu, ou \
qualquer meta-comentario fora do personagem)."""


def gerar_resposta(instrucao: str, fatos: dict[str, Any] | None = None) -> str:
    """Gera texto natural. Nunca usado para comunicar preco - isso e sempre
    montado por template direto do retorno do quote-service (ver orchestrator.py)."""
    contexto = instrucao
    if fatos:
        contexto += (
            "\n\nFatos disponiveis (use somente estes se precisar citar algo concreto):\n"
            + json.dumps(fatos, ensure_ascii=False)
        )
    resp = _client().messages.create(
        model=MODEL,
        max_tokens=400,
        system=_REPLY_SYSTEM,
        output_config={"effort": EFFORT},
        messages=[{"role": "user", "content": contexto}],
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()
