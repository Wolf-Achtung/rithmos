"""The narrator with a fake provider: the facts check, the cache, the cap, the gate."""

from datetime import datetime, timezone

import pytest

from rithmos_api.llm import Facts, Narration, check, facts_json, narrate
from tests.test_puzzles import JOBS, auth, puzzle

TODAY = datetime.now(timezone.utc).date().isoformat()

FACTS = Facts(
    kind="musical",
    a=6,
    b=8,
    c=12,
    truth={"kind": "musical", "value": 8},
    lies=[{"kind": "musical", "value": 9}, {"kind": "arithmetic", "value": 8}],
    ratio=[3, 4, 6],
)

GOOD = Narration(
    monk="Sechs, acht und zwölf stehen zueinander wie 3 zu 4 zu 6, und so hörte Boethius die Quarte und die Quinte.",
    analyst="Hin mit 6, zurück mit 12: der Schnitt über die Strecke ist 8, das harmonische Mittel, wie beim F1-Score.",
    truth="8 ist das harmonische Mittel von 6 und 12, weil 2 mal 6 mal 12 geteilt durch 18 genau 8 ergibt.",
    lies=[
        "9 ist das harmonische Mittel von 6 und 12, weil es genau in der Mitte zwischen beiden liegt.",
        "8 ist das arithmetische Mittel von 6 und 12, weil die Abstände 2 und 4 zusammen 6 ergeben.",
    ],
)


class FakeProvider:
    model = "fake-model"

    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = 0

    def narrate(self, system, facts):
        self.calls += 1
        assert "Rithmomachia" in system
        assert '"a": 6' in facts
        return self.answers.pop(0)


def test_check_accepts_the_facts_and_rejects_invented_numbers():
    assert check(GOOD, FACTS) == []
    bad = GOOD.model_copy(update={"analyst": "Mit 7 und 12 rechnet man den Schnitt 8."})
    assert any("7" in p for p in check(bad, FACTS))
    wrong_truth = GOOD.model_copy(update={"truth": "9 ist das harmonische Mittel von 6 und 12."})
    assert any(p.startswith("truth") for p in check(wrong_truth, FACTS))
    swapped_lie = GOOD.model_copy(update={"lies": [GOOD.lies[1], GOOD.lies[0]]})
    assert any(p.startswith("lie") for p in check(swapped_lie, FACTS))
    assert "Fundstück" not in facts_json(FACTS) and '"mittelart_von_b": "musikalisch"' in facts_json(FACTS)


def test_narrate_retries_once_then_gives_up():
    bad = GOOD.model_copy(update={"monk": "Die 5 fehlt hier."})
    p = FakeProvider([bad, GOOD])
    assert narrate(p, FACTS) == GOOD
    assert p.calls == 2
    p2 = FakeProvider([bad, bad])
    with pytest.raises(ValueError):
        narrate(p2, FACTS)


def _ingest(client, day=TODAY):
    body = puzzle(day)
    body["solution"]["facts"] = FACTS.model_dump(include={"truth", "lies", "ratio"})
    assert client.post("/v1/admin/puzzles", json={"puzzles": [body]}, headers=JOBS).json()["stored"] == 1


def test_narration_is_served_after_the_attempt_and_cached_per_day(client):
    app = client.app
    app.state.llm = FakeProvider([GOOD, GOOD])
    _ingest(client)
    a, b = auth(client), auth(client)
    assert client.get(f"/v1/puzzles/{TODAY}/narration", headers=a).status_code == 403
    client.post(f"/v1/puzzles/{TODAY}/attempts", json={"answer": 8, "tries": 1, "seconds": 5}, headers=a)
    r = client.get(f"/v1/puzzles/{TODAY}/narration", headers=a)
    assert r.status_code == 200
    body = r.json()
    assert body["monk"] == GOOD.monk and body["model"] == "fake-model"
    assert len(body["statements"]) == 3
    assert body["statements"][body["truth"]] == GOOD.truth
    assert "solution" not in body
    # a second account gets the cached text: no second model call
    client.post(f"/v1/puzzles/{TODAY}/attempts", json={"answer": 9, "tries": 3, "seconds": 5}, headers=b)
    assert client.get(f"/v1/puzzles/{TODAY}/narration", headers=b).json() == body
    assert app.state.llm.calls == 1
    assert client.get(f"/v1/puzzles/{TODAY}/narration").status_code == 401


def test_narration_falls_silent_without_provider_facts_or_budget(client):
    app = client.app
    _ingest(client)
    a = auth(client)
    client.post(f"/v1/puzzles/{TODAY}/attempts", json={"answer": 8, "tries": 1, "seconds": 5}, headers=a)
    app.state.llm = None
    assert client.get(f"/v1/puzzles/{TODAY}/narration", headers=a).status_code == 404
    app.state.llm = FakeProvider([GOOD])
    app.state.settings = type(app.state.settings)(
        database_url=app.state.settings.database_url,
        jobs_token=app.state.settings.jobs_token,
        cors_origins=app.state.settings.cors_origins,
        llm_daily_cap=0,
    )
    assert client.get(f"/v1/puzzles/{TODAY}/narration", headers=a).status_code == 404
    assert app.state.llm.calls == 0
