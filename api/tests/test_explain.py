"""'Erklär es mir' with a fake translator: the four fields fall as the words and the answer say."""

from datetime import datetime, timezone

from rithmos_api.llm import Claim, explain_input, judge_explanation
from tests.test_puzzles import JOBS, auth, puzzle

TODAY = datetime.now(timezone.utc).date().isoformat()


class FakeExplain:
    model = "fake-explain"

    def __init__(self):
        self.calls = 0

    def translate(self, system, text):
        self.calls += 1
        assert "steps" in system and "Erklärung:" in text
        low = text.lower()
        if "abstand" in low or "plus" in low:
            return Claim(pattern="steps", evidence="Abstand")
        if "verhältnis" in low or "saite" in low:
            return Claim(pattern="ratio", evidence="Verhältnis")
        return Claim(pattern="unclear", evidence="")


def test_judge_explanation_fills_the_four_fields():
    assert judge_explanation("ratio", "musical", True) == "understood"
    assert judge_explanation("steps", "musical", True) == "luck"
    assert judge_explanation("ratio", "musical", False) == "slip"
    assert judge_explanation("steps", "musical", False) == "misread"
    assert judge_explanation("unclear", "musical", True) == "none"
    assert explain_input(" weil ", 6, 8, 12) == "Reihe: 6 · 8 · 12\nErklärung: weil"


def test_explain_after_the_attempt_once_a_day(client):
    app = client.app
    app.state.explain = FakeExplain()
    assert client.post("/v1/admin/puzzles", json={"puzzles": [puzzle(TODAY)]}, headers=JOBS).json()["stored"] == 1
    a, b = auth(client), auth(client)
    url = f"/v1/puzzles/{TODAY}/explain"
    assert client.post(url, json={"text": "weil der Abstand gleich ist"}, headers=a).status_code == 403
    client.post(f"/v1/puzzles/{TODAY}/attempts", json={"answer": 8, "tries": 1, "seconds": 5}, headers=a)
    r = client.post(url, json={"text": "weil die Schritte sich wie die Saiten verhalten, ein Verhältnis"}, headers=a)
    assert r.status_code == 200
    assert r.json() == {"pattern": "ratio", "verdict": "understood", "model": "fake-explain", "remaining": 0}
    assert client.post(url, json={"text": "noch einmal, Abstand"}, headers=a).status_code == 429
    # a wrong answer with the right reason is a slip; the wrong reason a misread
    client.post(f"/v1/puzzles/{TODAY}/attempts", json={"answer": 9, "tries": 3, "seconds": 5}, headers=b)
    r = client.post(url, json={"text": "der Abstand ist beide Male drei"}, headers=b)
    assert r.json()["verdict"] == "misread" and r.json()["pattern"] == "steps"
    assert app.state.explain.calls == 2
    assert client.post(url, json={"text": "irgendwas"}).status_code == 401


def test_explain_is_silent_without_a_provider(client):
    client.app.state.explain = None
    assert client.post(f"/v1/puzzles/{TODAY}/explain", json={"text": "weil"}, headers=auth(client)).status_code == 404
