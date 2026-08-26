"""Autenticacao simples para o painel interno (atendente/admin). Usuarios de
teste fixos em memoria e token opaco - NAO e auth de producao (sem hash de
senha, sem expiracao de sessao), mas basta para restringir o acesso as telas
internas neste desafio. O widget publico do lead nunca passa por aqui."""
from __future__ import annotations
import secrets

USUARIOS_TESTE = {
    "admin": {"senha": "admin123", "papel": "admin", "nome": "Administrador"},
    "atendente": {"senha": "atendente123", "papel": "atendente", "nome": "Atendente"},
}

_sessoes: dict[str, dict] = {}  # token -> {"usuario", "papel", "nome"}


def autenticar(usuario: str, senha: str) -> dict | None:
    dados = USUARIOS_TESTE.get(usuario)
    if dados is None or dados["senha"] != senha:
        return None
    token = secrets.token_hex(16)
    sessao = {"usuario": usuario, "papel": dados["papel"], "nome": dados["nome"]}
    _sessoes[token] = sessao
    return {"token": token, **sessao}


def obter_sessao(token: str | None) -> dict | None:
    if not token:
        return None
    return _sessoes.get(token)


def logout(token: str | None) -> None:
    if token:
        _sessoes.pop(token, None)
