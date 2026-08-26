"""API do agente de vendas AutoSeguro. Ve tambem CHALLENGE.md e docs/fluxograma-agente.drawio."""
from __future__ import annotations
import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import auth
from . import config as app_config
from . import knowledge_base, orchestrator, relatorios, store
from .models import Message, new_id, now_iso

app = FastAPI(title="AutoSeguro Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MensagemRequest(BaseModel):
    texto: str


class ResolucaoRequest(BaseModel):
    solucao: str


class AvaliacaoRequest(BaseModel):
    nota: int


class ConfigUpdateRequest(BaseModel):
    handoff_mode: str | None = None
    claude_model: str | None = None
    whatsapp_business_number: str | None = None
    anthropic_api_key: str | None = None
    whatsapp_api_token: str | None = None
    recaptcha_site_key: str | None = None
    recaptcha_secret_key: str | None = None


class LoginRequest(BaseModel):
    usuario: str
    senha: str


class RecaptchaVerifyRequest(BaseModel):
    token: str


def exigir_papel(*papeis_permitidos: str):
    """Dependencia de rota: exige um token valido (header Authorization: Bearer
    <token>) e, se papeis_permitidos for informado, que a sessao tenha um desses
    papeis. Usada so nos endpoints de uso interno (atendente/admin) - o widget
    publico do lead nunca passa por aqui."""
    def dependencia(authorization: str | None = Header(default=None)) -> dict:
        token = (authorization or "").removeprefix("Bearer ").strip()
        sessao = auth.obter_sessao(token)
        if sessao is None:
            raise HTTPException(status_code=401, detail="Nao autenticado")
        if papeis_permitidos and sessao["papel"] not in papeis_permitidos:
            raise HTTPException(status_code=403, detail="Sem permissao para esta acao")
        return sessao
    return dependencia


def _garantir_conversa_disponivel(conv, sessao: dict) -> None:
    """Uma conversa 'em andamento' (handoff/aguardando_avaliacao com atendente ja
    atribuido) so pode ser mexida por quem a assumiu ou por um admin - evita dois
    atendentes atropelando o mesmo atendimento. Conversas ainda abertas (sem
    atendente) ou ja fechadas continuam livres para qualquer um."""
    em_andamento = conv.status in ("handoff", "aguardando_avaliacao") and conv.atendente_responsavel is not None
    if em_andamento and sessao["papel"] != "admin" and conv.atendente_responsavel != sessao["nome"]:
        raise HTTPException(
            status_code=403,
            detail=f"Conversa em andamento com {conv.atendente_responsavel}",
        )


def _assumir_se_necessario(conv, sessao: dict) -> None:
    """Na primeira acao de um atendente numa conversa, marca quem assumiu e
    manda uma saudacao automatica - o lead sempre sabe que um humano de verdade
    entrou na conversa, mesmo que o atendente va direto finalizar sem digitar nada."""
    if conv.atendente_responsavel is not None:
        return
    conv.atendente_responsavel = sessao["nome"]
    conv.atendente_assumiu_em = now_iso()
    saudacao = Message(
        id=new_id("msg"), role="atendente",
        text=f"Olá, eu sou {sessao['nome']}, vou te atender agora.",
    )
    conv.messages.append(saudacao)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login")
def login(body: LoginRequest):
    sessao = auth.autenticar(body.usuario, body.senha)
    if sessao is None:
        raise HTTPException(status_code=401, detail="Usuario ou senha invalidos")
    return sessao


@app.post("/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    auth.logout(token)
    return {"status": "ok"}


@app.get("/config")
def obter_config():
    """Config publica que a UI le em vez de hardcodar - editavel em runtime pelo
    painel Admin (web-ui/admin.html). Ver app/config.py."""
    return app_config.get_public()


@app.post("/config")
def atualizar_config(body: ConfigUpdateRequest, _sessao: dict = Depends(exigir_papel("admin"))):
    try:
        return app_config.update(
            handoff_mode=body.handoff_mode,
            claude_model=body.claude_model,
            whatsapp_business_number=body.whatsapp_business_number,
            anthropic_api_key=body.anthropic_api_key,
            whatsapp_api_token=body.whatsapp_api_token,
            recaptcha_site_key=body.recaptcha_site_key,
            recaptcha_secret_key=body.recaptcha_secret_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/recaptcha/verify")
def verificar_recaptcha(body: RecaptchaVerifyRequest):
    """Endpoint publico (o widget do lead chama antes de liberar o link real do
    WhatsApp) - valida o token contra a API do Google usando a secret key
    cadastrada no Admin. Sem secret key configurada, o gate nao deveria nem
    aparecer no front, mas por seguranca aqui tambem recusamos por padrao."""
    secret = app_config.get_secret("recaptcha_secret_key")
    if not secret:
        return {"sucesso": False}
    try:
        resp = httpx.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": secret, "response": body.token},
            timeout=5.0,
        )
        dados = resp.json()
    except httpx.HTTPError:
        return {"sucesso": False}
    return {"sucesso": bool(dados.get("success"))}


@app.post("/conversations")
def criar_conversa():
    conv = store.create_conversation()
    return conv.to_public_dict()


@app.get("/conversations")
def listar_conversas(_sessao: dict = Depends(exigir_papel("atendente", "admin"))):
    return [c.to_public_dict() for c in store.list_conversations()]


@app.get("/conversations/{conversation_id}")
def obter_conversa(conversation_id: str):
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    return conv.to_public_dict()


@app.post("/conversations/{conversation_id}/messages")
def enviar_mensagem(conversation_id: str, body: MensagemRequest):
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    orchestrator.handle_message(conv, body.texto)
    return conv.to_public_dict()


@app.post("/conversations/{conversation_id}/resolve-handoff")
def resolver_handoff(
    conversation_id: str, body: ResolucaoRequest,
    sessao: dict = Depends(exigir_papel("atendente", "admin")),
):
    """Atendente registra como resolveu o caso - disponivel em qualquer conversa,
    a qualquer momento (nao so durante o handoff), para alimentar a base de
    conhecimento. Entra como pendente ate aprovacao de um admin."""
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    _garantir_conversa_disponivel(conv, sessao)
    entry = knowledge_base.registrar_resolucao_pendente(
        conversation_id, conv.handoff_reason or "", conv.handoff_problema or "", body.solucao
    )
    store.log_event(conversation_id, "resolucao_humana_registrada", {"kb_entry_id": entry["id"]})
    return entry


@app.post("/conversations/{conversation_id}/finalizar-atendimento")
def finalizar_atendimento(
    conversation_id: str, sessao: dict = Depends(exigir_papel("atendente", "admin")),
):
    """Atendente clica em 'Finalizar atendimento': pede a nota de 1 a 10 ao lead
    antes de considerar a conversa encerrada."""
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    if conv.status != "handoff":
        raise HTTPException(status_code=400, detail="Conversa nao esta em handoff")
    _garantir_conversa_disponivel(conv, sessao)
    _assumir_se_necessario(conv, sessao)
    orchestrator.finalizar_atendimento(conv)
    return conv.to_public_dict()


@app.post("/conversations/{conversation_id}/avaliacao")
def registrar_avaliacao(conversation_id: str, body: AvaliacaoRequest):
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    if conv.status != "aguardando_avaliacao":
        raise HTTPException(status_code=400, detail="Conversa nao esta aguardando avaliacao")
    if not (1 <= body.nota <= 10):
        raise HTTPException(status_code=400, detail="Nota precisa estar entre 1 e 10")
    orchestrator.registrar_avaliacao(conv, body.nota)
    return conv.to_public_dict()


@app.post("/conversations/{conversation_id}/attendant-messages")
def enviar_mensagem_atendente(
    conversation_id: str, body: MensagemRequest,
    sessao: dict = Depends(exigir_papel("atendente", "admin")),
):
    """Mensagem escrita ao vivo pelo atendente humano, direto para o lead - nao
    passa pelo orchestrator/LLM, e o atendente falando por si mesmo. A primeira
    resposta assume a conversa; a partir dai, so quem assumiu (ou um admin)
    pode continuar respondendo - ver _garantir_conversa_disponivel."""
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    _garantir_conversa_disponivel(conv, sessao)
    _assumir_se_necessario(conv, sessao)
    msg = Message(id=new_id("msg"), role="atendente", text=body.texto)
    conv.messages.append(msg)
    conv.touch()
    store.log_event(conversation_id, "mensagem_atendente", {"message_id": msg.id, "texto": body.texto})
    return conv.to_public_dict()


@app.get("/reports/summary")
def relatorio_resumo(_sessao: dict = Depends(exigir_papel("atendente", "admin"))):
    return relatorios.gerar_resumo(store.list_conversations())


@app.get("/knowledge-base")
def listar_base_conhecimento(_sessao: dict = Depends(exigir_papel("atendente", "admin"))):
    return knowledge_base.listar_entradas()


@app.post("/knowledge-base/{entry_id}/approve")
def aprovar_base_conhecimento(entry_id: str, _sessao: dict = Depends(exigir_papel("admin"))):
    entry = knowledge_base.aprovar_entrada(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entrada nao encontrada")
    return entry


@app.post("/knowledge-base/{entry_id}/reject")
def reprovar_base_conhecimento(entry_id: str, _sessao: dict = Depends(exigir_papel("admin"))):
    entry = knowledge_base.reprovar_entrada(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entrada nao encontrada")
    return entry
