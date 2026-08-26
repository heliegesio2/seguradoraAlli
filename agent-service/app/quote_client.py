"""Cliente do quote-service. Isola a distincao entre falha de infraestrutura
(retry com backoff) e recusa de negocio (definitiva, nao se repete tentando de novo)."""
from __future__ import annotations
import os, time
from dataclasses import dataclass
from typing import Any
import httpx

QUOTE_SERVICE_URL = os.getenv("QUOTE_SERVICE_URL", "http://localhost:8000")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("QUOTE_REQUEST_TIMEOUT", "4"))
MAX_ATTEMPTS = int(os.getenv("QUOTE_MAX_ATTEMPTS", "3"))
BACKOFF_BASE_SECONDS = float(os.getenv("QUOTE_BACKOFF_BASE", "0.5"))


@dataclass
class QuoteOutcome:
    status: str  # "sucesso" | "erro_infra" | "recusa_negocio" | "payload_invalido"
    http_status: int | None
    data: dict[str, Any]
    latency_ms: int
    attempts_used: int


def _single_call(payload: dict[str, Any]) -> tuple[str, int | None, dict[str, Any], int]:
    start = time.monotonic()
    try:
        resp = httpx.post(f"{QUOTE_SERVICE_URL}/quote", json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
    except httpx.TimeoutException:
        latency_ms = int((time.monotonic() - start) * 1000)
        return "erro_infra", None, {"error": "timeout", "message": "Sem resposta a tempo do servico de cotacao."}, latency_ms
    except httpx.RequestError as e:
        latency_ms = int((time.monotonic() - start) * 1000)
        return "erro_infra", None, {"error": "conexao", "message": str(e)}, latency_ms

    latency_ms = int((time.monotonic() - start) * 1000)
    body = resp.json()
    if resp.status_code == 200:
        return "sucesso", resp.status_code, body, latency_ms
    if resp.status_code == 422:
        return "recusa_negocio", resp.status_code, body, latency_ms
    if resp.status_code == 400:
        return "payload_invalido", resp.status_code, body, latency_ms
    # 500/502/503 e qualquer outro 5xx caem aqui como falha de infra
    return "erro_infra", resp.status_code, body, latency_ms


def cotar_com_retry(payload: dict[str, Any]) -> QuoteOutcome:
    """Tenta cotar com backoff exponencial, mas SO para falha de infra.
    Recusa de negocio (422) e payload invalido (400) sao definitivos: tentar de
    novo com os mesmos dados nao muda o resultado, entao nunca entram no retry."""
    last_status, last_http, last_data, last_latency = "erro_infra", None, {}, 0
    for attempt in range(1, MAX_ATTEMPTS + 1):
        status, http_status, data, latency_ms = _single_call(payload)
        last_status, last_http, last_data, last_latency = status, http_status, data, latency_ms
        if status != "erro_infra":
            return QuoteOutcome(status, http_status, data, latency_ms, attempt)
        if attempt < MAX_ATTEMPTS:
            time.sleep(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))
    return QuoteOutcome(last_status, last_http, last_data, last_latency, MAX_ATTEMPTS)
