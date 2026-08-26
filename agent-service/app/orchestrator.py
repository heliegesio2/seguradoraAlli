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

# Pergunta de plano e template fixo (nao LLM): as opcoes precisam bater exatamente
# com o enum aceito pelo quote-service (ver quote-service/app/main.py).
_PERGUNTA_PLANO = "Qual plano você prefere: Essencial, Completo ou Premium?"
_OPCOES_PLANO = [
    {"label": "Essencial", "value": "Quero o plano Essencial"},
    {"label": "Completo", "value": "Quero o plano Completo"},
    {"label": "Premium", "value": "Quero o plano Premium"},
]


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


def _escalar_para_handoff(conv: Conversation, motivo: str) -> str:
    """Escalonamento definitivo para atendente humano (sem checar KB - isso ja
    aconteceu antes, na triagem, ou nao se aplica como no bug interno de payload)."""
    conv.status = "handoff"
    conv.handoff_reason = motivo
    conv.pre_handoff_status = None
    log_event(conv.id, "handoff", {
        "motivo": motivo,
        "nome_lead": conv.lead_nome,
        "problema": conv.handoff_problema,
    })
    return llm.gerar_resposta(
        "Informe ao lead, de forma cordial e breve, que um atendente humano vai continuar a "
        "conversa a partir daqui.",
        fatos={"motivo_handoff": motivo, "nome_lead": conv.lead_nome, "problema_relatado": conv.handoff_problema},
    )


def _entrar_em_triagem_handoff(conv: Conversation, motivo: str, sinais: dict[str, Any]) -> str:
    """Primeira deteccao de que o lead precisa de humano: NAO escala direto -
    antes coleta nome (se nao tiver) e a descricao do problema, para so entao
    checar a base de conhecimento e decidir entre resolver sozinho ou escalar."""
    conv.pre_handoff_status = conv.status
    conv.status = "triagem_handoff"
    conv.handoff_reason = motivo
    conv.handoff_problema = None

    if sinais.get("nome_lead"):
        conv.lead_nome = sinais["nome_lead"]

    if conv.lead_nome is None:
        return llm.gerar_resposta(
            "O lead sinalizou que precisa falar com um atendente humano. Antes de encaminhar, "
            "peca educadamente o nome dele. Faca somente essa pergunta, em uma linha curta de WhatsApp."
        )
    return llm.gerar_resposta(
        "Peca ao lead, em uma linha curta de WhatsApp, para descrever qual e o problema ou "
        "duvida que ele tem - assim voce ve se ja consegue ajudar direto, sem precisar de um "
        "atendente humano."
    )


def _avancar_triagem_handoff(conv: Conversation, texto_lead: str, nome_ja_era_conhecido: bool) -> str:
    """Chamado nas mensagens seguintes, com a conversa ja em triagem_handoff -
    texto_lead e sempre a resposta a pergunta anterior (nome ou problema). A
    captura oportunista de nome_lead ja aconteceu em handle_message antes desta
    chamada; nome_ja_era_conhecido reflete o estado ANTES dessa captura, para
    diferenciar "acabou de dar o nome agora" de "ja sabiamos de antes"."""
    if not nome_ja_era_conhecido:
        if conv.lead_nome is None:
            conv.lead_nome = texto_lead.strip()[:60] or None
        return llm.gerar_resposta(
            "Agradeca pelo nome e peca, em uma linha curta de WhatsApp, para descrever qual e "
            "o problema ou duvida que ele tem.",
            fatos={"nome_lead": conv.lead_nome},
        )

    conv.handoff_problema = texto_lead
    caso, score = knowledge_base.buscar_caso_similar(conv.handoff_reason or "", conv.handoff_problema)
    if caso is not None:
        log_event(conv.id, "kb_aplicado", {"case_id": caso["id"], "score": score})
        conv.status = conv.pre_handoff_status or "coletando_dados"
        conv.pre_handoff_status = None
        return llm.gerar_resposta(
            "Responda ao lead usando a solucao conhecida abaixo. Deixe claro que esse e o "
            "procedimento correto e que nao e necessario falar com um atendente para isso. "
            "Adapte o tom para WhatsApp, sem adicionar informacoes que nao estejam na solucao.",
            fatos={"situacao": conv.handoff_reason, "solucao_conhecida": caso["solucao"]},
        )

    return _escalar_para_handoff(conv, conv.handoff_reason or "handoff solicitado pelo lead")


def finalizar_atendimento(conv: Conversation) -> str:
    """Atendente humano encerra o atendimento pelo painel. Pede a nota de 1 a 10
    ao lead antes de considerar a conversa de fato encerrada."""
    conv.status = "aguardando_avaliacao"
    log_event(conv.id, "atendimento_finalizado", {})
    resposta = "Foi um prazer te ajudar! Antes de encerrar, você pode avaliar o atendimento de 1 a 10?"
    _finalizar(conv, resposta, pede_avaliacao=True)
    return resposta


def registrar_avaliacao(conv: Conversation, nota: int) -> str:
    """Lead avalia o atendimento (1 a 10). Gera um agradecimento elaborado, com o
    tom adaptado a nota - nunca inventando detalhes do atendimento em si."""
    conv.nota_atendimento = nota
    conv.status = "atendimento_encerrado"
    log_event(conv.id, "avaliacao_recebida", {"nota": nota})
    conv.messages.append(Message(id=new_id("msg"), role="lead", text=f"Nota do atendimento: {nota}/10"))

    resposta = llm.gerar_resposta(
        "O lead acabou de avaliar o atendimento recebido. Escreva uma mensagem de agradecimento "
        "calorosa e bem elaborada (3 a 5 frases), encerrando a conversa com cordialidade. Adapte "
        "o tom conforme a nota: se for alta (8 a 10), comemore e convide a voltar sempre; se for "
        "mediana (5 a 7), agradeca e diga que o feedback vai ajudar a melhorar; se for baixa (1 a "
        "4), peca desculpas com empatia e assuma o compromisso de melhorar. Nao invente detalhes "
        "do atendimento que nao foram informados aqui.",
        fatos={"nota": nota},
    )
    _finalizar(conv, resposta)
    return resposta


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

    # payload_invalido: bug nosso, nao do lead. Nao adianta repetir - vai direto para
    # humano, sem triagem (nao faz sentido pedir "qual seu problema" para um bug interno).
    return _escalar_para_handoff(conv, "falha ao montar os dados da cotacao (payload invalido)")


def _proxima_pergunta_slot(conv: Conversation) -> tuple[str, list[dict[str, str]] | None]:
    """Pergunta apenas o PROXIMO dado que falta (nunca todos de uma vez). O plano
    vem com opcoes fixas (chips); os demais campos ficam abertos para texto/audio."""
    proximo = conv.missing_slots()[0]
    if proximo == "plano_id":
        return _PERGUNTA_PLANO, _OPCOES_PLANO
    resposta = llm.gerar_resposta(
        f"Peca ao lead, em uma mensagem curta e direta de WhatsApp, apenas o seguinte "
        f"dado que falta para gerar a cotacao: {_NOMES_SLOT[proximo]}. Faca so essa "
        f"pergunta - nao mencione nenhum outro dado nesta mensagem."
    )
    return resposta, None


def handle_message(conv: Conversation, texto_lead: str) -> str:
    msg = Message(id=new_id("msg"), role="lead", text=texto_lead)
    conv.messages.append(msg)
    log_event(conv.id, "mensagem_recebida", {"message_id": msg.id, "texto": texto_lead})

    # Precisa ser capturado ANTES da extracao/captura oportunista de nome abaixo,
    # senao a triagem nunca consegue distinguir "acabou de dar o nome agora" de
    # "ja sabiamos o nome de uma mensagem anterior" (ambos ficariam com lead_nome
    # setado no momento em que _avancar_triagem_handoff for chamado).
    nome_ja_era_conhecido = conv.lead_nome is not None

    sinais = llm.extrair(_historico(conv), conv.slots)

    for campo, valor in (sinais.get("slots_atualizados") or {}).items():
        if campo in REQUIRED_SLOTS and valor not in (None, ""):
            conv.slots[campo] = valor

    if sinais.get("nome_lead"):
        conv.lead_nome = sinais["nome_lead"]

    if sinais.get("confianca_interpretacao") == "baixa":
        conv.misunderstanding_count += 1
    else:
        conv.misunderstanding_count = 0

    motivo = _motivo_handoff(sinais)
    if motivo is None and conv.misunderstanding_count >= MISUNDERSTANDING_LIMIT:
        motivo = "varias mensagens seguidas nao foram compreendidas com confianca"

    if motivo is not None and conv.status not in (
        "triagem_handoff", "handoff", "aguardando_avaliacao", "atendimento_encerrado",
    ):
        resposta = _entrar_em_triagem_handoff(conv, motivo, sinais)
        _finalizar(conv, resposta)
        return resposta

    opcoes: list[dict[str, str]] | None = None
    oculto = False

    if conv.status == "triagem_handoff":
        resposta = _avancar_triagem_handoff(conv, texto_lead, nome_ja_era_conhecido)
        if conv.status == "handoff":
            oculto = True

    elif conv.status == "cotado":
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

    elif conv.status in ("fechado", "perdido", "perdido_recusa", "atendimento_encerrado"):
        resposta = llm.gerar_resposta(
            "Esta conversa ja foi encerrada anteriormente (fechamento, recusa, desistencia ou "
            "atendimento finalizado). Responda de forma breve e cordial; se o lead quiser reabrir "
            "o assunto, sugira falar com um atendente humano."
        )

    elif conv.status == "handoff":
        resposta = llm.gerar_resposta(
            "Esta conversa ja foi encaminhada para um atendente humano e ainda nao foi retomada. "
            "Responda de forma breve dizendo que um atendente vai continuar por aqui em breve."
        )

    elif conv.status == "aguardando_avaliacao":
        resposta = llm.gerar_resposta(
            "O atendimento humano foi finalizado e o lead ainda nao enviou a nota de 1 a 10. "
            "Peca gentilmente, em uma linha curta, que ele toque em um numero de 1 a 10 para avaliar."
        )

    else:  # coletando_dados (estado inicial/padrao)
        faltando = conv.missing_slots()
        if faltando:
            resposta, opcoes = _proxima_pergunta_slot(conv)
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

    _finalizar(conv, resposta, opcoes, oculto)
    return resposta


def _finalizar(
    conv: Conversation,
    resposta: str,
    opcoes: list[dict[str, str]] | None = None,
    oculto_para_atendente: bool = False,
    pede_avaliacao: bool = False,
) -> None:
    conv.messages.append(Message(
        id=new_id("msg"), role="agent", text=resposta, options=opcoes,
        oculto_para_atendente=oculto_para_atendente, pede_avaliacao=pede_avaliacao,
    ))
    conv.touch()
    log_event(conv.id, "resposta_enviada", {"status": conv.status})
