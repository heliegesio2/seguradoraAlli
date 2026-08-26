"""Testa o loop de aprendizado: resolucao entra pendente, so casos aprovados
participam do casamento por palavras-chave, e reprovar remove de vez."""
import pytest

from app import knowledge_base as kb


@pytest.fixture(autouse=True)
def kb_isolada(tmp_path, monkeypatch):
    # cada teste usa seu proprio arquivo temporario - nunca toca
    # agent-service/data/knowledge_base.json de verdade.
    monkeypatch.setattr(kb, "_KB_PATH", tmp_path / "knowledge_base.json")


def test_sem_arquivo_comeca_vazia():
    assert kb.listar_entradas() == []


def test_registrar_resolucao_fica_pendente():
    entry = kb.registrar_resolucao_pendente(
        "conv1", "duvida sobre sinistro", "carro batido na traseira", "acionar central 0800"
    )
    assert entry["aprovado"] is False
    assert entry["solucao"] == "acionar central 0800"
    assert "sinistro" in entry["tags"]


def test_resolucao_pendente_nao_aparece_na_busca():
    kb.registrar_resolucao_pendente(
        "conv1", "duvida sinistro carro batido", "carro batido sinistro", "acionar central"
    )
    caso, score = kb.buscar_caso_similar("duvida sinistro", "carro batido")
    assert caso is None
    assert score == 0


def test_aprovada_aparece_na_busca_com_confianca_suficiente():
    entry = kb.registrar_resolucao_pendente(
        "conv1", "duvida sobre sinistro carro batido", "sinistro carro batido", "acionar central 0800"
    )
    kb.aprovar_entrada(entry["id"])

    caso, score = kb.buscar_caso_similar("duvida sobre sinistro carro batido", "sinistro carro batido")

    assert caso is not None
    assert caso["id"] == entry["id"]
    assert score >= kb.MIN_OVERLAP_SCORE


def test_score_abaixo_do_minimo_nao_conta_como_similar():
    entry = kb.registrar_resolucao_pendente("conv1", "sinistro", "carro batido", "solucao")
    kb.aprovar_entrada(entry["id"])
    # so uma palavra em comum ("carro") - abaixo do MIN_OVERLAP_SCORE (2)
    caso, score = kb.buscar_caso_similar("carro", "outra coisa qualquer")
    assert caso is None


def test_reprovar_remove_a_entrada_de_vez():
    entry = kb.registrar_resolucao_pendente("conv1", "motivo x", "problema y", "solucao z")
    kb.reprovar_entrada(entry["id"])
    assert kb.listar_entradas() == []


def test_reprovar_id_inexistente_nao_quebra():
    assert kb.reprovar_entrada("kb_naoexiste") is None
