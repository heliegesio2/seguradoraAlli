"""Relatorios agregados sobre atendimentos humanos - calculados em memoria a
partir do estado atual das conversas (sem banco de dados, consistente com o
resto do projeto - reinicia com o container, igual tudo mais)."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
from .models import Conversation


def gerar_resumo(conversas: list[Conversation]) -> dict[str, Any]:
    hoje = datetime.now(timezone.utc).date()
    atendidas = [c for c in conversas if c.atendente_responsavel]

    atendimentos_hoje = 0
    for c in atendidas:
        if not c.atendente_assumiu_em:
            continue
        try:
            data = datetime.fromisoformat(c.atendente_assumiu_em).date()
        except ValueError:
            continue
        if data == hoje:
            atendimentos_hoje += 1

    contagem: dict[str, int] = {}
    for c in atendidas:
        contagem[c.atendente_responsavel] = contagem.get(c.atendente_responsavel, 0) + 1
    ranking_volume = sorted(
        ({"atendente": nome, "total": total} for nome, total in contagem.items()),
        key=lambda x: x["total"],
        reverse=True,
    )

    notas: dict[str, list[int]] = {}
    for c in atendidas:
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

    return {
        "atendimentos_hoje": atendimentos_hoje,
        "total_atendimentos": len(atendidas),
        "ranking_volume": ranking_volume,
        "ranking_notas": ranking_notas,
    }
