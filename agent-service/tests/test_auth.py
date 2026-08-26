"""Testa hash de senha, cadastro e login - sem tocar em data/usuarios.json."""
import pytest

from app import auth


@pytest.fixture(autouse=True)
def usuarios_isolados(monkeypatch):
    monkeypatch.setattr(auth, "_salvar", lambda usuarios: None)
    auth._usuarios.clear()
    auth._usuarios.update(auth._seed())
    auth._sessoes.clear()
    yield
    auth._usuarios.clear()
    auth._sessoes.clear()


def test_senha_nunca_fica_em_texto_puro():
    auth.cadastrar("teste1", "senhaforte123", "Teste Um", "atendente")
    dados = auth._usuarios["teste1"]
    assert dados["hash"] != "senhaforte123"
    assert "senhaforte123" not in dados["hash"]
    assert "salt" in dados


def test_login_com_senha_certa_funciona():
    auth.cadastrar("teste2", "senhaforte123", "Teste Dois", "atendente")
    sessao = auth.autenticar("teste2", "senhaforte123")
    assert sessao is not None
    assert sessao["papel"] == "atendente"
    assert sessao["nome"] == "Teste Dois"
    assert "token" in sessao


def test_login_com_senha_errada_falha():
    auth.cadastrar("teste3", "senhaforte123", "Teste Tres", "atendente")
    assert auth.autenticar("teste3", "senhaerrada") is None


def test_login_com_usuario_inexistente_falha():
    assert auth.autenticar("ninguem", "qualquercoisa") is None


def test_nao_deixa_cadastrar_login_duplicado():
    auth.cadastrar("teste4", "senhaforte123", "Teste Quatro", "atendente")
    with pytest.raises(ValueError):
        auth.cadastrar("teste4", "outrasenha123", "Outro Nome", "admin")


def test_senha_curta_e_recusada():
    with pytest.raises(ValueError):
        auth.cadastrar("teste5", "123", "Teste Cinco", "atendente")


def test_perfil_invalido_e_recusado():
    with pytest.raises(ValueError):
        auth.cadastrar("teste6", "senhaforte123", "Teste Seis", "superadmin")


def test_cadastrar_nao_cria_sessao_automatica():
    resultado = auth.cadastrar("teste7", "senhaforte123", "Teste Sete", "atendente")
    assert "token" not in resultado  # quem cadastrou continua logado como si mesmo


def test_usuarios_semente_continuam_funcionando():
    sessao = auth.autenticar("admin", "admin123")
    assert sessao is not None
    assert sessao["papel"] == "admin"


def test_logout_invalida_o_token():
    sessao = auth.autenticar("admin", "admin123")
    token = sessao["token"]
    assert auth.obter_sessao(token) is not None
    auth.logout(token)
    assert auth.obter_sessao(token) is None
