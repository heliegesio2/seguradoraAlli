"""Persistencia das interacoes (mensagens e eventos da conversa) em MongoDB.

Cada evento vai para a colecao `interacoes` com metadados em texto puro
(conversation_id, tipo, timestamp) - uteis para consulta/filtragem - mas o
payload inteiro (que pode conter mensagem do lead, nome, CEP, motivo de
handoff, solucao do atendente etc.) e cifrado ANTES de sair do processo do
agent-service, com uma chave simetrica (Fernet/AES-128) que mora so na
variavel de ambiente MONGO_ENCRYPTION_KEY - nunca no banco. Isso significa que
quem tem acesso de admin ao MongoDB (consegue ler qualquer documento de
qualquer colecao) ainda assim NAO consegue ler o conteudo das interacoes: so o
processo do agent-service, que tem a chave, consegue decifrar.

Se o Mongo/chave nao estiverem configurados ou o banco estiver fora do ar, a
persistencia e melhor-esforco: o agente continua funcionando normalmente (o
log local em events.jsonl e o estado em memoria nao dependem disso) e so um
aviso e impresso no stderr. Nunca gravamos payload em claro - se a chave de
criptografia estiver ausente ou invalida, a persistencia fica desativada."""
from __future__ import annotations
import json, os, sys
from typing import Any

try:
    from pymongo import MongoClient
except ImportError:  # pragma: no cover - dependencia opcional em dev sem docker
    MongoClient = None  # type: ignore

try:
    from cryptography.fernet import Fernet
except ImportError:  # pragma: no cover
    Fernet = None  # type: ignore

MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB = os.getenv("MONGO_DB", "autoseguro")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "interacoes")
_ENCRYPTION_KEY = os.getenv("MONGO_ENCRYPTION_KEY", "")

_fernet = None
if Fernet and _ENCRYPTION_KEY:
    try:
        _fernet = Fernet(_ENCRYPTION_KEY.encode("ascii"))
    except (ValueError, TypeError) as exc:
        print(f"[mongo_client] MONGO_ENCRYPTION_KEY invalida, persistencia desativada: {exc}", file=sys.stderr)

_collection = None
if MongoClient and MONGO_URI and _fernet is not None:
    try:
        # MongoClient nao conecta de verdade aqui (e preguicoso por design do
        # driver) - so cria o objeto. A conexao real (com retry automatico do
        # driver) so acontece na primeira operacao, o que evita depender de
        # timing de boot entre os containers do docker-compose.
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        _collection = _client[MONGO_DB][MONGO_COLLECTION]
    except Exception as exc:  # pragma: no cover - URI malformada, ex.
        print(f"[mongo_client] Nao foi possivel configurar o cliente MongoDB: {exc}", file=sys.stderr)
        _collection = None
    else:
        try:
            _collection.create_index("conversation_id")
            _collection.create_index("timestamp")
        except Exception as exc:  # pragma: no cover - infra opcional
            print(
                f"[mongo_client] Nao foi possivel criar indices agora (Mongo pode ainda estar "
                f"subindo) - a proxima gravacao tenta de novo: {exc}",
                file=sys.stderr,
            )
elif MongoClient and MONGO_URI and _fernet is None:
    print(
        "[mongo_client] MONGO_URI configurada mas MONGO_ENCRYPTION_KEY ausente/invalida - "
        "persistencia desativada para nunca gravar payload em claro.",
        file=sys.stderr,
    )


def disponivel() -> bool:
    return _collection is not None


def _cifrar(payload: dict[str, Any]) -> str:
    bruto = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return _fernet.encrypt(bruto).decode("ascii")


def decifrar(payload_cifrado: str) -> dict[str, Any]:
    """Uso interno/depuracao (nao exposto por nenhum endpoint publico) - so
    quem roda com a MONGO_ENCRYPTION_KEY correta consegue chamar isso com
    sucesso; com a chave errada ou ausente, o Fernet recusa a decifrar."""
    if _fernet is None:
        raise RuntimeError("MONGO_ENCRYPTION_KEY nao configurada neste processo.")
    bruto = _fernet.decrypt(payload_cifrado.encode("ascii"))
    return json.loads(bruto.decode("utf-8"))


def registrar_interacao(
    event_id: str, conversation_id: str, event_type: str, timestamp: str, payload: dict[str, Any]
) -> None:
    """Grava uma copia cifrada do evento no MongoDB, alem do log local em
    events.jsonl. Melhor-esforco: se o Mongo nao estiver disponivel, so
    ignora silenciosamente - a operacao do agente nunca depende disso."""
    if _collection is None:
        return
    documento = {
        "_id": event_id,
        "conversation_id": conversation_id,
        "type": event_type,
        "timestamp": timestamp,
        "payload_cifrado": _cifrar(payload),
    }
    try:
        _collection.insert_one(documento)
    except Exception as exc:  # pragma: no cover - infra opcional
        print(f"[mongo_client] Falha ao gravar interacao no MongoDB: {exc}", file=sys.stderr)
