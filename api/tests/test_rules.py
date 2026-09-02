"""The rules chat with a fake provider: grounded answers come back, ungrounded ones
become the fixed sentence, a repeated question costs no model call, caps hold."""

from rithmos_api.llm import RULES_TEXT, RuleAnswer, check_answer, normalize_question
from rithmos_api.routers.rules import NOT_IN_RULES, QUESTIONS_PER_ACCOUNT_PER_DAY
from tests.test_puzzles import auth


class FakeRules:
    model = "fake-rules"

    def __init__(self):
        self.calls = 0

    def answer(self, system, question):
        self.calls += 1
        assert "REGELFASSUNG" in system and "Mebben" in system
        if "dreieck" in question.lower():
            return RuleAnswer(
                answer="Ein Dreieck zieht ins dritte Feld, zwei Schritte, ausschließlich diagonal.", grounded=True
            )
        if "uhr" in question.lower():
            return RuleAnswer(answer="", grounded=False)
        return RuleAnswer(answer="Es gibt 99 Steine.", grounded=True)


def test_normalize_question():
    assert normalize_question("  Darf ein Dreieck   gerade ziehen?? ") == "darf ein dreieck gerade ziehen"


def test_check_answer_rejects_numbers_outside_the_rules():
    assert check_answer(RuleAnswer(answer="Es gibt 99 Steine.", grounded=True), "Wie viele Steine?") == [
        "answer: number 99 is not in the rules"
    ]
    assert (
        check_answer(RuleAnswer(answer="Die Pyramide ist 91 aus 36 + 25 + 16 + 9 + 4 + 1.", grounded=True), "?") == []
    )
    assert check_answer(RuleAnswer(answer="Der Stein 42 darf das.", grounded=True), "Was macht Stein 42?") == []
    assert check_answer(RuleAnswer(answer="", grounded=False), "Wie spät ist es?") == []
    assert "Selenus 1616" in RULES_TEXT


def test_rules_chat_answers_caches_and_caps(client):
    app = client.app
    app.state.rules = FakeRules()
    a = auth(client)
    r = client.post("/v1/rules/ask", json={"question": "Darf ein Dreieck gerade ziehen?"}, headers=a)
    assert r.status_code == 200
    body = r.json()
    assert body["grounded"] and "diagonal" in body["answer"]
    assert body["model"] == "fake-rules" and body["remaining"] == QUESTIONS_PER_ACCOUNT_PER_DAY - 1
    # the same question again, differently spelled: no model call, still an answer
    r = client.post("/v1/rules/ask", json={"question": "darf ein DREIECK gerade ziehen"}, headers=a)
    assert r.status_code == 200 and app.state.rules.calls == 1
    # not in the rules: the fixed sentence, never the model's text
    r = client.post("/v1/rules/ask", json={"question": "Wie spät ist es auf der Uhr?"}, headers=a)
    assert r.status_code == 200 and r.json() == {**r.json(), "answer": NOT_IN_RULES, "grounded": False}
    # an invented number fails the check twice and is not shown
    r = client.post("/v1/rules/ask", json={"question": "Wie viele Steine gibt es?"}, headers=a)
    assert r.status_code == 404 and app.state.rules.calls == 4
    # the per-account cap
    for i in range(QUESTIONS_PER_ACCOUNT_PER_DAY - 3):
        assert client.post("/v1/rules/ask", json={"question": f"Dreieck Frage {i}"}, headers=a).status_code == 200
    assert client.post("/v1/rules/ask", json={"question": "Dreieck noch eine"}, headers=a).status_code == 429
    assert client.post("/v1/rules/ask", json={"question": "Dreieck?"}).status_code == 401
    assert client.post("/v1/rules/ask", json={"question": "a"}, headers=a).status_code == 422


def test_rules_chat_is_silent_without_a_provider(client):
    client.app.state.rules = None
    assert (
        client.post(
            "/v1/rules/ask", json={"question": "Darf ein Dreieck gerade ziehen?"}, headers=auth(client)
        ).status_code
        == 404
    )
