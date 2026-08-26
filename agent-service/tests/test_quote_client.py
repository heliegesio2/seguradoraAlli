"""Testa a distincao infra-vs-negocio que o proprio desafio aponta como o
ponto que mais separa candidatos: erro de infraestrutura tenta de novo com
backoff; recusa de negocio e payload invalido NUNCA repetem."""
import httpx
import pytest

from app import quote_client


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


@pytest.fixture(autouse=True)
def sem_espera_real(monkeypatch):
    # backoff exponencial de verdade deixaria os testes lentos - so queremos
    # confirmar QUE ele tenta de novo, nao QUANTO TEMPO ele espera.
    monkeypatch.setattr(quote_client.time, "sleep", lambda segundos: None)


def test_sucesso_nao_repete(monkeypatch):
    chamadas = []

    def fake_post(url, json, timeout):
        chamadas.append(1)
        return FakeResponse(200, {"premio_mensal": 100})

    monkeypatch.setattr(quote_client.httpx, "post", fake_post)
    outcome = quote_client.cotar_com_retry({"plano_id": "completo"})

    assert outcome.status == "sucesso"
    assert outcome.attempts_used == 1
    assert len(chamadas) == 1


def test_recusa_de_negocio_nunca_repete(monkeypatch):
    chamadas = []

    def fake_post(url, json, timeout):
        chamadas.append(1)
        return FakeResponse(422, {"motivo": "idade fora da faixa aceita"})

    monkeypatch.setattr(quote_client.httpx, "post", fake_post)
    outcome = quote_client.cotar_com_retry({})

    assert outcome.status == "recusa_negocio"
    assert outcome.attempts_used == 1
    assert len(chamadas) == 1  # tentar de novo nao mudaria o resultado


def test_payload_invalido_nunca_repete(monkeypatch):
    def fake_post(url, json, timeout):
        return FakeResponse(400, {"error": "payload malformado"})

    monkeypatch.setattr(quote_client.httpx, "post", fake_post)
    outcome = quote_client.cotar_com_retry({})

    assert outcome.status == "payload_invalido"
    assert outcome.attempts_used == 1


def test_erro_de_infra_esgota_as_tentativas(monkeypatch):
    chamadas = []

    def fake_post(url, json, timeout):
        chamadas.append(1)
        return FakeResponse(503, {"error": "servico instavel"})

    monkeypatch.setattr(quote_client.httpx, "post", fake_post)
    outcome = quote_client.cotar_com_retry({})

    assert outcome.status == "erro_infra"
    assert outcome.attempts_used == quote_client.MAX_ATTEMPTS
    assert len(chamadas) == quote_client.MAX_ATTEMPTS


def test_erro_de_infra_recupera_numa_tentativa_seguinte(monkeypatch):
    chamadas = []

    def fake_post(url, json, timeout):
        chamadas.append(1)
        if len(chamadas) < 2:
            return FakeResponse(500, {"error": "servico instavel"})
        return FakeResponse(200, {"premio_mensal": 50})

    monkeypatch.setattr(quote_client.httpx, "post", fake_post)
    outcome = quote_client.cotar_com_retry({})

    assert outcome.status == "sucesso"
    assert outcome.attempts_used == 2


def test_timeout_conta_como_erro_de_infra(monkeypatch):
    def fake_post(url, json, timeout):
        raise httpx.TimeoutException("sem resposta a tempo")

    monkeypatch.setattr(quote_client.httpx, "post", fake_post)
    outcome = quote_client.cotar_com_retry({})

    assert outcome.status == "erro_infra"
    assert outcome.http_status is None
