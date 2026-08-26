"""Base de conhecimento de casos resolvidos por humanos.

MVP deliberado: casamento por sobreposicao de palavras-chave entre o motivo do
handoff/mensagem do lead e as tags de cada caso aprovado. Isso e suficiente para
demonstrar o ciclo de aprendizado (handoff -> resolucao -> aprovacao -> consulta)
sem depender de um indice vetorial. Trocar por busca semantica (embeddings) e o
proximo passo natural se o volume de casos crescer - ver README."""
from __future__ import annotations
import json, re, threading
from pathlib import Path
from typing import Any
from .models import new_id, now_iso

_KB_PATH = Path(__file__).resolve().parent.parent / "data" / "knowledge_base.json"
_lock = threading.Lock()

_STOPWORDS = {"o", "a", "de", "do", "da", "que", "e", "para", "com", "um", "uma",
              "seu", "sua", "meu", "minha", "nao", "sim", "por", "em", "no", "na"}

MIN_OVERLAP_SCORE = 2  # minimo de palavras-chave em comum para considerar "similar o suficiente"


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-zA-ZÀ-ÿ]+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _load() -> list[dict[str, Any]]:
    if not _KB_PATH.exists():
        return []
    return json.loads(_KB_PATH.read_text(encoding="utf-8"))


def _save(entries: list[dict[str, Any]]) -> None:
    with _lock:
        _KB_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")


def melhor_candidato(motivo: str, mensagem_lead: str) -> tuple[dict[str, Any] | None, int]:
    """Retorna (caso_mais_parecido_aprovado, score) mesmo que o score fique abaixo
    do minimo de confianca - usado para sugerir um candidato de baixa confianca
    ao atendente humano no handoff."""
    consulta_tokens = _tokenize(motivo) | _tokenize(mensagem_lead)
    melhor, melhor_score = None, 0
    for entry in _load():
        if not entry.get("aprovado"):
            continue
        tags_tokens = set(t.lower() for t in entry.get("tags", []))
        score = len(consulta_tokens & tags_tokens)
        if score > melhor_score:
            melhor, melhor_score = entry, score
    return melhor, melhor_score


def buscar_caso_similar(motivo: str, mensagem_lead: str) -> tuple[dict[str, Any] | None, int]:
    """Retorna (caso_mais_parecido_aprovado, score) ou (None, 0) se nada bateu o minimo
    de confianca necessario para responder sozinho (ver MIN_OVERLAP_SCORE)."""
    melhor, melhor_score = melhor_candidato(motivo, mensagem_lead)
    if melhor_score >= MIN_OVERLAP_SCORE:
        return melhor, melhor_score
    return None, 0


def registrar_resolucao_pendente(conversation_id: str, motivo: str, problema: str, solucao: str) -> dict[str, Any]:
    """Atendente humano registra como resolveu um handoff. Entra como pendente
    (aprovado=False) ate revisao - evita que uma resolucao ruim vire aprendizado ruim.
    Tags sao derivadas automaticamente do motivo + problema relatado (sem exigir
    digitacao manual do atendente)."""
    tags = sorted(_tokenize(motivo) | _tokenize(problema))
    entries = _load()
    entry = {
        "id": new_id("kb"),
        "conversation_id": conversation_id,
        "motivo": motivo,
        "tags": tags,
        "solucao": solucao,
        "aprovado": False,
        "criado_em": now_iso(),
    }
    entries.append(entry)
    _save(entries)
    return entry


def aprovar_entrada(entry_id: str) -> dict[str, Any] | None:
    entries = _load()
    for entry in entries:
        if entry["id"] == entry_id:
            entry["aprovado"] = True
            entry["aprovado_em"] = now_iso()
            _save(entries)
            return entry
    return None


def reprovar_entrada(entry_id: str) -> dict[str, Any] | None:
    """Remove uma resolucao pendente que o admin decidiu nao aprovar - nunca
    chega a entrar na base de conhecimento usada pelo agente."""
    entries = _load()
    for i, entry in enumerate(entries):
        if entry["id"] == entry_id:
            entries.pop(i)
            _save(entries)
            return entry
    return None


def listar_entradas() -> list[dict[str, Any]]:
    return _load()
