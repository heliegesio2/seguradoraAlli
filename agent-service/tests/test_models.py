from app.models import Conversation, REQUIRED_SLOTS


def test_missing_slots_tudo_vazio():
    conv = Conversation(id="c1")
    assert conv.missing_slots() == REQUIRED_SLOTS


def test_missing_slots_parcial():
    conv = Conversation(id="c1")
    conv.slots["plano_id"] = "completo"
    conv.slots["idade"] = 30
    assert conv.missing_slots() == ["veiculo_ano", "cep", "data_inicio"]


def test_missing_slots_vazio_quando_completo():
    conv = Conversation(id="c1")
    for k in REQUIRED_SLOTS:
        conv.slots[k] = "x"
    assert conv.missing_slots() == []
