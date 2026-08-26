"""Configuracao de negocio e chaves de API editaveis em runtime pelo painel Admin
(web-ui/admin.html), persistida em data/runtime_config.json. As variaveis de
ambiente (.env) servem so como valor inicial - depois do primeiro boot, o que
estiver salvo no JSON manda. Chaves nunca sao devolvidas por get_public(): a UI
so sabe se ESTAO configuradas, nunca o valor."""
from __future__ import annotations
import json, os, threading
from pathlib import Path
from typing import Any

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "runtime_config.json"
_lock = threading.Lock()

_CHAVES_SECRETAS = {"anthropic_api_key", "whatsapp_api_token", "recaptcha_secret_key"}

_MODOS_VALIDOS = {"site", "whatsapp", "misto"}

_MODELOS_VALIDOS = {"claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"}

_defaults: dict[str, Any] = {
    "handoff_mode": os.getenv("HANDOFF_MODE", "site"),
    "claude_model": os.getenv("CLAUDE_MODEL", "claude-opus-5"),
    "whatsapp_business_number": os.getenv("WHATSAPP_BUSINESS_NUMBER", ""),
    "anthropic_api_key": os.getenv("ANTHROPIC_API_KEY", ""),
    "whatsapp_api_token": os.getenv("WHATSAPP_API_TOKEN", ""),
    # Site key NAO e secreta (vai embutida no HTML por design do proprio Google);
    # so a secret key precisa ficar oculta.
    "recaptcha_site_key": os.getenv("RECAPTCHA_SITE_KEY", ""),
    "recaptcha_secret_key": os.getenv("RECAPTCHA_SECRET_KEY", ""),
}


def _load() -> dict[str, Any]:
    if _CONFIG_PATH.exists():
        try:
            salvo = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
            return {**_defaults, **salvo}
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_defaults)


_config: dict[str, Any] = _load()


def get_public() -> dict[str, Any]:
    """Vista segura para a UI - chaves secretas viram um booleano '<nome>_configurada'."""
    publico = {k: v for k, v in _config.items() if k not in _CHAVES_SECRETAS}
    for chave in _CHAVES_SECRETAS:
        publico[f"{chave}_configurada"] = bool(_config.get(chave))
    return publico


def get_secret(chave: str) -> str:
    return _config.get(chave) or ""


def get_handoff_mode() -> str:
    return _config.get("handoff_mode", "site")


def get_claude_model() -> str:
    return _config.get("claude_model") or "claude-opus-5"


def update(**campos: Any) -> dict[str, Any]:
    """Atualiza so os campos informados (nao-vazios) - deixar em branco no forms
    do admin preserva o valor atual, nao apaga a chave sem querer."""
    if "handoff_mode" in campos and campos["handoff_mode"] not in (None, ""):
        modo = campos["handoff_mode"]
        if modo not in _MODOS_VALIDOS:
            raise ValueError(f"handoff_mode invalido: {modo!r} (use site, whatsapp ou misto)")
        _config["handoff_mode"] = modo

    if "claude_model" in campos and campos["claude_model"] not in (None, ""):
        modelo = campos["claude_model"]
        if modelo not in _MODELOS_VALIDOS:
            raise ValueError(f"claude_model invalido: {modelo!r}")
        _config["claude_model"] = modelo

    for chave in (
        "whatsapp_business_number", "anthropic_api_key", "whatsapp_api_token",
        "recaptcha_site_key", "recaptcha_secret_key",
    ):
        valor = campos.get(chave)
        if valor:
            _config[chave] = valor

    with _lock:
        _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        _CONFIG_PATH.write_text(json.dumps(_config, ensure_ascii=False, indent=2), encoding="utf-8")
    return get_public()
