"""Testa o coracao do agente: criterio de handoff, validacao de dados, e a
garantia central do projeto - o preco da cotacao nunca vem do LLM, e a
distincao entre falha de infra (repete) e recusa de negocio (nunca repete).
Todo o Claude e o quote-service reais sao substituidos por dublês (monkeypatch);
nenhum teste aqui precisa de ANTHROPIC_API_KEY nem do quote-service rodando."""
import pytest

from app import orchestrator
from app.models import Conversation
from app.quote_client import QuoteOutcome


@pytest.fixture(autouse=True)
def sem_efeitos_colaterais(monkeypatch):
    # log_event grava em disco (events.jsonl) e tenta escrever no Mongo -
    # nao e o que estamos testando aqui, so a logica de decisao.
    monkeypatch.setattr(orchestrator, "log_event", lambda *a, **k: None)


# --- _motivo_handoff (criterio de handoff explicito e defensavel) ----------

def test_motivo_handoff_pedido_explicito():
    assert orchestrator._motivo_handoff({"pedido_humano_explicito": True}) is not None


def test_motivo_handoff_fora_do_escopo():
    assert orchestrator._motivo_handoff({"fora_do_escopo": True}) is not None


def test_motivo_handoff_reclamacao_ou_sinistro():
    assert orchestrator._motivo_handoff({"reclamacao_ou_sinistro": True}) is not None


def test_motivo_handoff_pede_desconto():
    assert orchestrator._motivo_handoff({"pede_desconto_ou_negociacao": True}) is not None


def test_motivo_handoff_nenhum_sinal_nao_escala():
    assert orchestrator._motivo_handoff({}) is None


# --- _validar_slots ---------------------------------------------------------

def _slots_validos(**overrides):
    base = {"idade": 30, "veiculo_ano": 2020, "cep": "01310-100", "data_inicio": "2099-01-01"}
    base.update(overrides)
    return base


def test_slots_validos_sem_erro():
    assert orchestrator._validar_slots(_slots_validos()) is None


def test_idade_invalida_da_erro():
    assert orchestrator._validar_slots(_slots_validos(idade=200)) is not None


def test_ano_do_veiculo_invalido_da_erro():
    assert orchestrator._validar_slots(_slots_validos(veiculo_ano=1800)) is not None


def test_cep_invalido_da_erro():
    assert orchestrator._validar_slots(_slots_validos(cep="abc")) is not None


def test_data_no_passado_da_erro():
    assert orchestrator._validar_slots(_slots_validos(data_inicio="2000-01-01")) is not None


# --- _apresentar_cotacao (nunca o LLM escreve o preco) ----------------------

def test_preco_vem_direto_do_json_nunca_do_llm(monkeypatch):
    chamou_llm = []
    monkeypatch.setattr(
        orchestrator.llm, "gerar_resposta",
        lambda *a, **k: chamou_llm.append(1) or "NUNCA DEVERIA APARECER NA RESPOSTA",
    )
    dados = {
        "plano_nome": "Completo", "premio_mensal": 209.9, "franquia": 3000.0,
        "coberturas": ["colisao", "roubo"],
    }
    texto = orchestrator._apresentar_cotacao(dados)

    assert "209.90" in texto
    assert "NUNCA DEVERIA" not in texto
    assert not chamou_llm


# --- _executar_cotacao: infra-vs-negocio, o ponto que mais separa ----------

def _conversa_com_dados_completos():
    conv = Conversation(id="c1")
    conv.slots.update({
        "plano_id": "completo", "idade": 30, "veiculo_ano": 2020,
        "cep": "01310-100", "data_inicio": "2099-01-01",
    })
    return conv


def test_sucesso_apresenta_o_preco_devolvido_pelo_quote_service(monkeypatch):
    outcome = QuoteOutcome(
        "sucesso", 200,
        {"plano_nome": "Completo", "premio_mensal": 209.9, "franquia": 3000.0, "coberturas": ["colisao"]},
        100, 1,
    )
    monkeypatch.setattr(orchestrator, "cotar_com_retry", lambda payload: outcome)

    conv = _conversa_com_dados_completos()
    resposta = orchestrator._executar_cotacao(conv)

    assert conv.status == "cotado"
    assert "209.90" in resposta


def test_recusa_de_negocio_nunca_repete_e_nao_menciona_preco(monkeypatch):
    chamadas = []

    def fake_cotar(payload):
        chamadas.append(1)
        return QuoteOutcome("recusa_negocio", 422, {"motivo": "idade fora da faixa aceita"}, 50, 1)

    monkeypatch.setattr(orchestrator, "cotar_com_retry", fake_cotar)
    monkeypatch.setattr(orchestrator.llm, "gerar_resposta", lambda *a, **k: "Nao foi possivel cotar por regra de assinatura.")

    conv = _conversa_com_dados_completos()
    resposta = orchestrator._executar_cotacao(conv)

    assert conv.status == "recusa_negocio"
    assert len(chamadas) == 1
    assert "R$" not in resposta


def test_erro_de_infra_avisa_sem_inventar_preco(monkeypatch):
    monkeypatch.setattr(orchestrator, "cotar_com_retry", lambda payload: QuoteOutcome("erro_infra", None, {}, 4000, 3))
    monkeypatch.setattr(orchestrator.llm, "gerar_resposta", lambda *a, **k: "Sistema de cotacao instavel, vou tentar de novo.")

    conv = _conversa_com_dados_completos()
    resposta = orchestrator._executar_cotacao(conv)

    assert conv.status == "aguardando_retry"
    assert "R$" not in resposta


def test_payload_invalido_escala_direto_sem_triagem(monkeypatch):
    monkeypatch.setattr(orchestrator, "cotar_com_retry", lambda payload: QuoteOutcome("payload_invalido", 400, {}, 10, 1))
    monkeypatch.setattr(orchestrator.llm, "gerar_resposta", lambda *a, **k: "Vou te encaminhar para um atendente.")

    conv = _conversa_com_dados_completos()
    orchestrator._executar_cotacao(conv)

    assert conv.status == "handoff"


# --- handle_message: fluxo completo com Claude e quote-service mockados ----

def test_handle_message_ate_a_cotacao_sair(monkeypatch):
    monkeypatch.setattr(orchestrator.llm, "extrair", lambda *a, **k: {
        "slots_atualizados": {
            "plano_id": "completo", "idade": 30, "veiculo_ano": 2020,
            "cep": "01310-100", "data_inicio": "2099-01-01",
        },
        "confianca_interpretacao": "alta",
    })
    outcome = QuoteOutcome(
        "sucesso", 200,
        {"plano_nome": "Completo", "premio_mensal": 209.9, "franquia": 3000.0, "coberturas": ["colisao"]},
        100, 1,
    )
    monkeypatch.setattr(orchestrator, "cotar_com_retry", lambda payload: outcome)

    conv = Conversation(id="c1")
    resposta = orchestrator.handle_message(
        conv, "quero cotar o completo, 30 anos, carro 2020, cep 01310-100, inicio em 2099-01-01"
    )

    assert conv.status == "cotado"
    assert "209.90" in resposta
    assert len(conv.messages) == 2  # mensagem do lead + resposta do agente


def test_pedido_explicito_de_atendente_entra_em_triagem_antes_de_escalar(monkeypatch):
    monkeypatch.setattr(orchestrator.llm, "extrair", lambda *a, **k: {
        "pedido_humano_explicito": True, "confianca_interpretacao": "alta",
    })
    monkeypatch.setattr(orchestrator.llm, "gerar_resposta", lambda *a, **k: "Antes de encaminhar, qual seu nome?")

    conv = Conversation(id="c1")
    orchestrator.handle_message(conv, "quero falar com um atendente")

    # nao escala direto - primeiro pede nome/problema (triagem)
    assert conv.status == "triagem_handoff"


def test_tres_falhas_de_compreensao_seguidas_dispara_handoff(monkeypatch):
    monkeypatch.setattr(orchestrator.llm, "extrair", lambda *a, **k: {"confianca_interpretacao": "baixa"})
    monkeypatch.setattr(orchestrator.llm, "gerar_resposta", lambda *a, **k: "Desculpe, nao entendi.")

    conv = Conversation(id="c1")
    orchestrator.handle_message(conv, "mensagem confusa 1")
    orchestrator.handle_message(conv, "mensagem confusa 2")
    assert conv.status == "coletando_dados"  # ainda nao, so 2 falhas
    orchestrator.handle_message(conv, "mensagem confusa 3")
    assert conv.status == "triagem_handoff"  # 3a falha dispara o criterio
