"""Testa os filtros combinaveis de periodo/nota/atendente e os rankings."""
from app.models import Conversation
from app import relatorios


def _conversa(atendente, data_assumiu, nota=None):
    conv = Conversation(id=f"c-{atendente}-{data_assumiu}-{nota}")
    conv.atendente_responsavel = atendente
    conv.atendente_assumiu_em = f"{data_assumiu}T10:00:00+00:00"
    conv.nota_atendimento = nota
    return conv


def test_conversa_sem_atendente_nao_conta():
    conv = Conversation(id="c1")
    resumo = relatorios.gerar_resumo([conv])
    assert resumo["total_atendimentos"] == 0


def test_filtro_de_periodo():
    conversas = [_conversa("Ana", "2026-01-01"), _conversa("Ana", "2026-02-15")]
    resumo = relatorios.gerar_resumo(conversas, data_inicio="2026-02-01", data_fim="2026-02-28")
    assert resumo["total_atendimentos"] == 1


def test_filtro_de_nota_minima():
    conversas = [_conversa("Ana", "2026-01-01", nota=5), _conversa("Ana", "2026-01-02", nota=9)]
    resumo = relatorios.gerar_resumo(conversas, nota_min=8)
    assert resumo["total_atendimentos"] == 1
    assert resumo["ranking_notas"][0]["media_nota"] == 9.0


def test_filtro_de_nota_exclui_sem_avaliacao():
    conversas = [_conversa("Ana", "2026-01-01", nota=None), _conversa("Ana", "2026-01-02", nota=9)]
    resumo = relatorios.gerar_resumo(conversas, nota_min=1)
    assert resumo["total_atendimentos"] == 1


def test_filtro_por_nome_do_atendente():
    conversas = [_conversa("Ana", "2026-01-01"), _conversa("Bruno", "2026-01-01")]
    resumo = relatorios.gerar_resumo(conversas, atendente="ana")  # case-insensitive
    assert resumo["total_atendimentos"] == 1


def test_ranking_de_volume_ordenado_desc():
    conversas = [_conversa("Ana", "2026-01-01"), _conversa("Bruno", "2026-01-01"), _conversa("Bruno", "2026-01-02")]
    resumo = relatorios.gerar_resumo(conversas)
    assert resumo["ranking_volume"][0]["atendente"] == "Bruno"
    assert resumo["ranking_volume"][0]["total"] == 2


def test_ranking_de_notas_calcula_media():
    conversas = [_conversa("Ana", "2026-01-01", nota=6), _conversa("Ana", "2026-01-02", nota=10)]
    resumo = relatorios.gerar_resumo(conversas)
    assert resumo["ranking_notas"][0]["media_nota"] == 8.0
    assert resumo["ranking_notas"][0]["avaliacoes"] == 2
