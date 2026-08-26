"""Autenticacao do painel interno (atendente/admin), com cadastro proprio de
usuario - a pessoa escolhe o proprio perfil (admin ou atendente) no momento do
cadastro. Persistido em arquivo (data/usuarios.json, mesmo padrao de
config.py/knowledge_base.py) - sobrevive a reinicio do container. Senha nunca
fica em texto puro: cada usuario grava um hash salgado (PBKDF2-HMAC-SHA256),
nunca a senha original.

Sessao continua simples (token opaco em memoria, sem expiracao) - isso e um
desafio tecnico, nao auth de producao (sem 2FA, sem rate limit de tentativas,
sem verificacao de e-mail). O widget publico do lead nunca passa por aqui."""
from __future__ import annotations
import hashlib, json, os, secrets, threading
from pathlib import Path

_USERS_PATH = Path(__file__).resolve().parent.parent / "data" / "usuarios.json"
_lock = threading.Lock()

_PAPEIS_VALIDOS = {"admin", "atendente"}
_PBKDF2_ITERACOES = 200_000

# Usuarios de teste (mesmas credenciais que ja apareciam na tela de login) -
# usados so para semear o arquivo na primeira vez que o container sobe.
_USUARIOS_SEED = {
    "admin": {"senha": "admin123", "papel": "admin", "nome": "Administrador"},
    "atendente": {"senha": "atendente123", "papel": "atendente", "nome": "Atendente"},
}


def _hash_senha(senha: str, salt: bytes | None = None) -> dict:
    salt = salt or os.urandom(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt, _PBKDF2_ITERACOES)
    return {"salt": salt.hex(), "hash": hash_bytes.hex()}


def _senha_confere(senha: str, salt_hex: str, hash_hex: str) -> bool:
    calculado = hashlib.pbkdf2_hmac(
        "sha256", senha.encode("utf-8"), bytes.fromhex(salt_hex), _PBKDF2_ITERACOES
    )
    return secrets.compare_digest(calculado.hex(), hash_hex)


def _seed() -> dict:
    usuarios = {}
    for usuario, dados in _USUARIOS_SEED.items():
        usuarios[usuario] = {
            "papel": dados["papel"],
            "nome": dados["nome"],
            **_hash_senha(dados["senha"]),
        }
    return usuarios


def _salvar(usuarios: dict) -> None:
    with _lock:
        _USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
        _USERS_PATH.write_text(json.dumps(usuarios, ensure_ascii=False, indent=2), encoding="utf-8")


def _carregar() -> dict:
    if _USERS_PATH.exists():
        try:
            return json.loads(_USERS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    usuarios = _seed()
    _salvar(usuarios)
    return usuarios


_usuarios: dict = _carregar()
_sessoes: dict[str, dict] = {}  # token -> {"usuario", "papel", "nome"}


def _criar_sessao(usuario: str) -> dict:
    dados = _usuarios[usuario]
    token = secrets.token_hex(16)
    sessao = {"usuario": usuario, "papel": dados["papel"], "nome": dados["nome"]}
    _sessoes[token] = sessao
    return {"token": token, **sessao}


def cadastrar(usuario: str, senha: str, nome: str, papel: str) -> dict:
    """Cadastro de usuario novo - quem se cadastra escolhe o proprio perfil
    (admin ou atendente). Levanta ValueError com uma mensagem apresentavel ao
    usuario quando algo nao bate (login duplicado, senha curta, perfil
    invalido etc). Retorna uma sessao ja autenticada (login automatico)."""
    usuario_normalizado = (usuario or "").strip().lower()
    nome = (nome or "").strip()
    if not usuario_normalizado or not senha or not nome:
        raise ValueError("Preencha nome, usuário e senha.")
    if len(senha) < 6:
        raise ValueError("A senha precisa ter pelo menos 6 caracteres.")
    if papel not in _PAPEIS_VALIDOS:
        raise ValueError("Escolha um perfil válido (admin ou atendente).")
    if usuario_normalizado in _usuarios:
        raise ValueError("Já existe um usuário cadastrado com esse login.")

    _usuarios[usuario_normalizado] = {"papel": papel, "nome": nome, **_hash_senha(senha)}
    _salvar(_usuarios)
    return _criar_sessao(usuario_normalizado)


def autenticar(usuario: str, senha: str) -> dict | None:
    usuario_normalizado = (usuario or "").strip().lower()
    dados = _usuarios.get(usuario_normalizado)
    if dados is None or not _senha_confere(senha, dados["salt"], dados["hash"]):
        return None
    return _criar_sessao(usuario_normalizado)


def obter_sessao(token: str | None) -> dict | None:
    if not token:
        return None
    return _sessoes.get(token)


def logout(token: str | None) -> None:
    if token:
        _sessoes.pop(token, None)
