"""Maquina de estados do agente. Espelha o fluxograma (docs/fluxograma-agente.drawio):
NLU (LLM) so extrai dados e sinaliza intencao; toda decisao de negocio - completude,
validacao, retry, handoff, preco - e codigo deterministico. O LLM nunca decide
sozinho encaminhar para humano nem escreve o valor da cotacao."""
from __future__ import annotations
import datetime as dt
from typing import Any

from . import llm, knowledge_base
from .models import Conversation, Message, QuoteAttempt, REQUIRED_SLOTS, new_id, now_iso
from .quote_client import cotar_com_retry
from .store import log_event

MISUNDERSTANDING_LIMIT = 3

_NOMES_SLOT = {
    "plano_id": "qual plano deseja (essencial, completo ou premium)",
    "idade": "sua idade",
    "veiculo_ano": "o ano de fabricacao do veiculo",
    "cep": "o CEP onde o veiculo fica",
    "data_inicio": "a data desejada para o inicio da vigencia (formato AAAA-MM-DD)",
}


def _historico(conv: Conversation, ultimas: int = 12) -> str:
    linhas = []
    for m in conv.messages[-ultimas:]:
        papel = "LEAD" if m.role == "lead" else "AGENTE"
        linhas.append(f"{papel}: {m.text}")
    return "\n".join(linhas)


def _validar_slots(slots: dict[str, Any]) -> str | None:
    """Validacao de formato/plausibilidade (nao e a regra de negocio - essa vive
    no quote-service). Retorna mensagem de erro ou None se ok."""
    try:
        idade = int(slots["idade"])
        if not (1 <= idade <= 120):
            return "A idade informada parece invalida."
    except (TypeError, ValueError):
        return "Nao consegui entender a idade informada."

    try:
        ano = int(slots["veiculo_ano"])
        if not (1950 <= ano <= dt.date.today().year + 1):
            return "O ano do veiculo informado parece invalido."
    except (TypeError, ValueError):
        return "Nao consegui entender o ano do veiculo."

    cep_digitos = str(slots.get("cep", "")).replace("-", "").strip()
    if not cep_digitos.isdigit() or len(cep_digitos) != 8:
        return "O CEP informado nao parece valido (precisa ter 8 digitos)."

    try:
        data_inicio = dt.date.fromisoformat(str(slots["data_inicio"]))
        if data_inicio < dt.date.today():
            return "A data de inicio da vigencia precisa ser hoje ou uma data futura."
    except (TypeError, ValueError):
        return "Nao consegui entender a data de inicio (use o formato AAAA-MM-DD)."

    return None


def _motivo_handoff(sinais: dict[str, Any]) -> str | None:
    if sinais.get("pedido_humano_explicito"):
        return "lead pediu atendimento humano explicitamente"
    if sinais.get("fora_do_escopo"):
        return "mensagem fora do escopo de seguro auto"
    if sinais.get("reclamacao_ou_sinistro"):
        return "reclamacao ou sinistro relatado pelo lead"
    if sinais.get("pede_desconto_ou_negociacao"):
        return "lead pede desconto ou negociacao de preco"
    return None


def _apresentar_cotacao(dados: dict[str, Any]) -> str:
    """Mensagem de apresentacao da cotacao. Montada por template Python direto do
    retorno do quote-service - nunca pelo LLM - para garantir que o preco exibido
    e sempre exatamente o que a API calculou."""
    linhas = [
        f"Cotacao pronta! Plano {dados['plano_nome']}: R$ {dados['premio_mensal']:.2f}/mes.",
        f"Franquia: R$ {dados['franquia']:.2f}.",
        f"Coberturas: {', '.join(dados['coberturas'])}.",
    ]
    carencia = dados.get("carencia")
    if carencia and carencia.get("coberturas"):
        linhas.append(
            f"Atencao: {', '.join(carencia['coberturas'])} tem carencia de {carencia['dias']} dias a partir do inicio da vigencia."
        )
    pro_rata = dados.get("primeiro_pagamento_pro_rata")
    if pro_rata:
        linhas.append(
            f"Como a vigencia comeca no meio do mes, o primeiro pagamento e proporcional: "
            f"R$ {pro_rata['valor_primeiro_pagamento']:.2f} ({pro_rata['dias_cobrados']} de {pro_rata['dias_no_mes']} dias)."
        )
    linhas.append("Quer seguir com essa cotacao?")
    return "\n".join(linhas)


def _ir_para_handoff(conv: Conversation, motivo: str, mensagem_lead: str) -> str:
    caso, score = knowledge_base.buscar_caso_similar(motivo, mensagem_lead)
    if caso is not None:
        log_event(conv.id, "kb_aplicado", {"case_id": caso["id"], "score": score})
        resposta = llm.gerar_resposta(
            "Responda ao lead usando a solucao conhecida abaixo, adaptando o tom para WhatsApp. "
            "Nao adicione informacoes que nao estejam na solucao.",
            fatos={"situacao": motivo, "solucao_conhecida": caso["solucao"]},
        )
        return resposta

    conv.status = "handoff"
    conv.handoff_reason = motivo
    candidato_baixa_confianca, score_baixa = knowledge_base.melhor_candidato(motivo, mensagem_lead)
    if score_baixa == 0:
        candidato_baixa_confianca = None
    log_event(conv.id, "handoff", {
        "motivo": motivo,
        "candidato_kb_baixa_confianca": candidato_baixa_confianca["id"] if candidato_baixa_confianca else None,
    })
    return llm.gerar_resposta(
        "Informe ao lead, de forma cordial, que voce vai encaminhar a conversa para um atendente "
        "humano continuar, e explique o motivo em uma frase.",
        fatos={"motivo_handoff": motivo},
    )


def _executar_cotacao(conv: Conversation) -> str:
    payload = {
        "plano_id": conv.slots["plano_id"],
        "idade": int(conv.slots["idade"]),
        "veiculo_ano": int(conv.slots["veiculo_ano"]),
        "cep": conv.slots["cep"],
        "data_inicio": conv.slots["data_inicio"],
    }
    outcome = cotar_com_retry(payload)
    attempt = QuoteAttempt(
        id=new_id("qa"),
        timestamp=now_iso(),
        status=outcome.status,
        http_status=outcome.http_status,
        detail=outcome.data,
        latency_ms=outcome.latency_ms,
    )
    conv.quote_attempts.append(attempt)
    log_event(conv.id, "tentativa_cotacao", {
        "attempt_id": attempt.id,
        "status": outcome.status,
        "http_status": outcome.http_status,
        "attempts_used": outcome.attempts_used,
        "latency_ms": outcome.latency_ms,
    })

    if outcome.status == "sucesso":
        conv.status = "cotado"
        conv.last_quote_result = outcome.data
        return _apresentar_cotacao(outcome.data)

    if outcome.status == "recusa_negocio":
        conv.status = "recusa_negocio"
        motivo = outcome.data.get("motivo", "Regra de subscricao nao permite cotar para esses dados.")
        conv.last_quote_result = outcome.data
        return llm.gerar_resposta(
            "Explique ao lead, com empatia, que NAO foi possivel cotar por uma regra de subscricao "
            "(nao e um problema tecnico). Pergunte se ele quer encerrar por aqui ou falar com um "
            "atendente para verificar se ha alguma excecao possivel.",
            fatos={"motivo_recusa": motivo},
        )

    if outcome.status == "erro_infra":
        conv.status = "aguardando_retry"
        return llm.gerar_resposta(
            "Informe ao lead, com transparencia, que o sistema de cotacao esta instavel no momento "
            "e que voce vai tentar novamente assim que ele responder. Nao mencione nenhum valor."
        )

    # payload_invalido: bug nosso, nao do lead. Nao adianta repetir - vai para humano.
    return _ir_para_handoff(conv, "falha ao montar os dados da cotacao (payload invalido)", "")


def handle_message(conv: Conversation, texto_lead: str) -> str:
    msg = Message(id=new_id("msg"), role="lead", text=texto_lead)
    conv.messages.append(msg)
    log_event(conv.id, "mensagem_recebida", {"message_id": msg.id, "texto": texto_lead})

    sinais = llm.extrair(_historico(conv), conv.slots)

    for campo, valor in (sinais.get("slots_atualizados") or {}).items():
        if campo in REQUIRED_SLOTS and valor not in (None, ""):
            conv.slots[campo] = valor

    if sinais.get("confianca_interpretacao") == "baixa":
        conv.misunderstanding_count += 1
    else:
        conv.misunderstanding_count = 0

    motivo = _motivo_handoff(sinais)
    if motivo is None and conv.misunderstanding_count >= MISUNDERSTANDING_LIMIT:
        motivo = "varias mensagens seguidas nao foram compreendidas com confianca"

    if motivo is not None:
        resposta = _ir_para_handoff(conv, motivo, texto_lead)
        _finalizar(conv, resposta)
        return resposta

    if conv.status == "cotado":
        if sinais.get("quer_aceitar_cotacao"):
            conv.status = "fechado"
            log_event(conv.id, "fechamento", {})
            resposta = llm.gerar_resposta(
                "Confirme para o lead que a cotacao foi aceita e que o proximo passo e o fechamento/"
                "pagamento, sem inventar prazos ou links especificos."
            )
        elif sinais.get("quer_recusar_cotacao"):
            conv.status = "perdido"
            log_event(conv.id, "perdido", {})
            resposta = llm.gerar_resposta(
                "Agradeca educadamente ao lead por considerar a AutoSeguro, mesmo ele nao seguindo "
                "com a cotacao agora, e deixe a porta aberta para o futuro."
            )
        else:
            resposta = llm.gerar_resposta(
                "Nao ficou claro se o lead quer aceitar a cotacao apresentada anteriormente. "
                "Pergunte diretamente se ele quer seguir com ela."
            )

    elif conv.status == "recusa_negocio":
        conv.status = "perdido_recusa"
        log_event(conv.id, "perdido_recusa", {})
        resposta = llm.gerar_resposta(
            "O lead reagiu a explicacao de que nao foi possivel cotar por regra de subscricao. "
            "Encerre a conversa de forma educada e profissional, sem inventar alternativas."
        )

    elif conv.status == "aguardando_retry":
        resposta = _executar_cotacao(conv)

    elif conv.status in ("fechado", "perdido", "perdido_recusa"):
        resposta = llm.gerar_resposta(
            "Esta conversa ja foi encerrada anteriormente (fechamento, recusa ou desistencia). "
            "Responda de forma breve e cordial; se o lead quiser reabrir o assunto, sugira falar "
            "com um atendente humano."
        )

    elif conv.status == "handoff":
        resposta = llm.gerar_resposta(
            "Esta conversa ja foi encaminhada para um atendente humano e ainda nao foi retomada. "
            "Responda de forma breve dizendo que um atendente vai continuar por aqui em breve."
        )

    else:  # coletando_dados (estado inicial/padrao)
        faltando = conv.missing_slots()
        if faltando:
            pedidos = "; ".join(_NOMES_SLOT[c] for c in faltando)
            resposta = llm.gerar_resposta(
                f"Peca ao lead, em uma mensagem curta de WhatsApp, os seguintes dados que ainda "
                f"faltam para gerar a cotacao: {pedidos}."
            )
        else:
            erro = _validar_slots(conv.slots)
            if erro:
                resposta = llm.gerar_resposta(
                    "Explique ao lead o problema encontrado nos dados que ele informou e peca a "
                    "correcao, de forma breve.",
                    fatos={"erro": erro},
                )
            else:
                resposta = _executar_cotacao(conv)

    _finalizar(conv, resposta)
    return resposta


def _finalizar(conv: Conversation, resposta: str) -> None:
    conv.messages.append(Message(id=new_id("msg"), role="agent", text=resposta))
    conv.touch()
    log_event(conv.id, "resposta_enviada", {"status": conv.status})
