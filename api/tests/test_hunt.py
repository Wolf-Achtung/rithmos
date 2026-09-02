"""The hunt with a fake vision provider: counts come back, caps hold, no key means 404."""

import base64

from rithmos_api.llm import HuntCounts, HuntGroup, clean_counts
from rithmos_api.quota import HUNT
from tests.test_puzzles import auth

PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 200).decode()


class FakeVision:
    model = "fake-vision"

    def __init__(self):
        self.calls = 0

    def count(self, system, media_type, image):
        self.calls += 1
        assert "Zähle" in system and media_type == "image/png"
        return HuntCounts(
            groups=[
                HuntGroup(label="Bücher", count=6),
                HuntGroup(label="Tassen", count=9),
                HuntGroup(label="bücher", count=7),
                HuntGroup(label="Stühle", count=12),
            ]
        )


def test_clean_counts_drops_duplicate_labels():
    c = clean_counts(
        HuntCounts(
            groups=[
                HuntGroup(label=" Bücher ", count=6),
                HuntGroup(label="bücher", count=7),
                HuntGroup(label="Tassen", count=9),
            ]
        )
    )
    assert [(g.label, g.count) for g in c.groups] == [("Bücher", 6), ("Tassen", 9)]


def test_hunt_counts_and_caps(client):
    app = client.app
    app.state.vision = FakeVision()
    a = auth(client)
    r = client.post("/v1/hunt", json={"media_type": "image/png", "image": PNG}, headers=a)
    assert r.status_code == 200
    body = r.json()
    assert [g["count"] for g in body["groups"]] == [6, 9, 12]
    assert body["model"] == "fake-vision" and body["remaining"] == HUNT.per_day - 1
    for _ in range(HUNT.per_day - 1):
        assert client.post("/v1/hunt", json={"media_type": "image/png", "image": PNG}, headers=a).status_code == 200
    assert client.post("/v1/hunt", json={"media_type": "image/png", "image": PNG}, headers=a).status_code == 429
    assert app.state.vision.calls == HUNT.per_day
    assert client.get("/v1/quota", headers=a).json()["hunt"] == {"limit": HUNT.per_day, "remaining": 0}
    assert client.post("/v1/hunt", json={"media_type": "image/png", "image": PNG}).status_code == 401
    assert client.post(
        "/v1/hunt", json={"media_type": "image/png", "image": "not base64!!"}, headers=auth(client)
    ).status_code in (422, 400)


def test_hunt_is_silent_without_a_provider(client):
    client.app.state.vision = None
    assert (
        client.post("/v1/hunt", json={"media_type": "image/png", "image": PNG}, headers=auth(client)).status_code == 404
    )
