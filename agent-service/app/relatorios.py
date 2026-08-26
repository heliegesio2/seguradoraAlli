"""Relatorios agregados sobre atendimentos humanos - calculados em memoria a
partir do estado atual das conversas (sem banco de dados, consistente com o
resto do projeto - reinicia com o container, igual tudo mais).

Suporta filtro por periodo (data em que o atendente assumiu a conversa),
faixa de nota e nome do atendente - todos combinaveis. A serie temporal
(atendimentos por dia) alimenta o grafico do relatorios.html."""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from typing import Any
from .models import Conversation

_SERIE_MAX_DIAS = 366  # trava de seguranca contra um periodo absurdamente grande


def _parse_data(valor: str | None) -> date | None:
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def _data_assumiu(c: Conversation) -> date | None:
    if not c.atendente_assumiu_em:
        return None
    try:
        return datetime.fromisoformat(c.atendente_assumiu_em).date()
    except ValueError:
        return None


def _montar_serie_temporal(datas: list[date], inicio: date | None, fim: date | None) -> list[dict[str, Any]]:
    if not datas and not (inicio and fim):
        return []
    contagem: dict[date, int] = {}
    for d in datas:
        contagem[d] = contagem.get(d, 0) + 1

    ini = inicio or min(datas)
    fi = fim or max(datas)
    if ini > fi:
        ini, fi = fi, ini
    if (fi - ini).days > _SERIE_MAX_DIAS:
        fi = ini + timedelta(days=_SERIE_MAX_DIAS)

    serie = []
    atual = ini
    while atual <= fi:
        serie.append({"data": atual.isoformat(), "total": contagem.get(atual, 0)})
        atual += timedelta(days=1)
    return serie


def gerar_resumo(
    conversas: list[Conversation],
    *,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    nota_min: int | None = None,
    nota_max: int | None = None,
    atendente: str | None = None,
) -> dict[str, Any]:
    hoje = datetime.now(timezone.utc).date()
    inicio = _parse_data(data_inicio)
    fim = _parse_data(data_fim)
    atendente_termo = (atendente or "").strip().lower()

    atendidas: list[tuple[Conversation, date | None]] = []
    for c in conversas:
        if not c.atendente_responsavel:
            continue
        d = _data_assumiu(c)
        if inicio and (d is None or d < inicio):
            continue
        if fim and (d is None or d > fim):
            continue
        if nota_min is not None and (c.nota_atendimento is None or c.nota_atendimento < nota_min):
            continue
        if nota_max is not None and (c.nota_atendimento is None or c.nota_atendimento > nota_max):
            continue
        if atendente_termo and atendente_termo not in c.atendente_responsavel.lower():
            continue
        atendidas.append((c, d))

    atendimentos_hoje = sum(1 for _, d in atendidas if d == hoje)

    contagem: dict[str, int] = {}
    for c, _ in atendidas:
        contagem[c.atendente_responsavel] = contagem.get(c.atendente_responsavel, 0) + 1
    ranking_volume = sorted(
        ({"atendente": nome, "total": total} for nome, total in contagem.items()),
        key=lambda x: x["total"],
        reverse=True,
    )

    notas: dict[str, list[int]] = {}
    for c, _ in atendidas:
        if c.nota_atendimento is not None:
            notas.setdefault(c.atendente_responsavel, []).append(c.nota_atendimento)
    ranking_notas = sorted(
        (
            {"atendente": nome, "media_nota": round(sum(vs) / len(vs), 1), "avaliacoes": len(vs)}
            for nome, vs in notas.items()
        ),
        key=lambda x: x["media_nota"],
        reverse=True,
    )

    serie_temporal = _montar_serie_temporal([d for _, d in atendidas if d is not None], inicio, fim)

    return {
        "atendimentos_hoje": atendimentos_hoje,
        "total_atendimentos": len(atendidas),
        "ranking_volume": ranking_volume,
        "ranking_notas": ranking_notas,
        "serie_temporal": serie_temporal,
    }
