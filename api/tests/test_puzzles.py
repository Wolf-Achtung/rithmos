from datetime import datetime, timedelta, timezone

# the server works in UTC dates
_NOW = datetime.now(timezone.utc).date()
TODAY = _NOW.isoformat()
YESTERDAY = (_NOW - timedelta(days=1)).isoformat()
TOMORROW = (_NOW + timedelta(days=1)).isoformat()

JOBS = {"x-jobs-token": "test-jobs-token"}


def puzzle(day: str, seed: int = 1):
    return {
        "date": day,
        "seed": seed,
        "side": "white",
        "pieces": [
            {"id": "a", "side": "white", "shape": "round", "value": 2, "square": "a10"},
            {"id": "c", "side": "white", "shape": "round", "value": 6, "square": "e10"},
            {"id": "m", "side": "white", "shape": "round", "value": 4, "square": "b10"},
            {"id": "e0", "side": "black", "shape": "round", "value": 3, "square": "h16"},
        ],
        "goal": {"kind": "harmony"},
        "solution": {"pieceId": "m", "from": "b10", "to": "c10"},
        "harmony": {"kinds": ["arithmetic"], "values": [2, 4, 6]},
        "difficulty": 1,
    }


def auth(client):
    token = client.post("/v1/accounts").json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_ingest_requires_the_jobs_token(client):
    assert client.post("/v1/admin/puzzles", json={"puzzles": [puzzle(TODAY)]}).status_code == 403
    assert (
        client.post(
            "/v1/admin/puzzles", json={"puzzles": [puzzle(TODAY)]}, headers={"x-jobs-token": "wrong"}
        ).status_code
        == 403
    )


def test_today_is_served_without_solution(client):
    r = client.post("/v1/admin/puzzles", json={"puzzles": [puzzle(TODAY), puzzle(TOMORROW)]}, headers=JOBS)
    assert r.json() == {"stored": 2, "skipped": 0}
    today = client.get("/v1/puzzles/today")
    assert today.status_code == 200
    body = today.json()
    assert body["date"] == TODAY
    assert body["attempted"] is False
    assert "solution" not in body and "harmony" not in body
    assert [p["id"] for p in body["pieces"]] == ["a", "c", "m", "e0"]
    # future puzzles stay hidden
    assert client.get(f"/v1/puzzles/{TOMORROW}").status_code == 404
    assert client.get("/v1/puzzles/1999-01-01").status_code == 404


def test_attempt_compares_the_move_and_returns_the_distribution(client):
    client.post("/v1/admin/puzzles", json={"puzzles": [puzzle(TODAY)]}, headers=JOBS)
    solver, guesser = auth(client), auth(client)
    ok = client.post(
        f"/v1/puzzles/{TODAY}/attempts",
        json={"move": {"pieceId": "m", "from": "b10", "to": "c10"}, "tries": 2, "seconds": 40},
        headers=solver,
    )
    assert ok.status_code == 200
    assert ok.json()["solved"] is True
    assert ok.json()["harmony"] == {"kinds": ["arithmetic"], "values": [2, 4, 6]}
    assert ok.json()["distribution"] == {"attempts": 1, "solved": 1, "tries": {"2": 1}}
    wrong = client.post(
        f"/v1/puzzles/{TODAY}/attempts",
        json={"move": {"pieceId": "m", "from": "b10", "to": "b11"}, "tries": 3, "seconds": 90},
        headers=guesser,
    )
    assert wrong.json()["solved"] is False
    assert wrong.json()["solution"] == {"pieceId": "m", "from": "b10", "to": "c10"}
    dist = client.get(f"/v1/puzzles/{TODAY}/distribution").json()
    assert dist == {"attempts": 2, "solved": 1, "tries": {"2": 1}}
    # one attempt per account, and the puzzle now reads as attempted for that account
    again = client.post(
        f"/v1/puzzles/{TODAY}/attempts",
        json={"move": {"pieceId": "m", "from": "b10", "to": "c10"}, "tries": 1, "seconds": 5},
        headers=solver,
    )
    assert again.status_code == 409
    assert client.get("/v1/puzzles/today", headers=solver).json()["attempted"] is True
    assert client.get("/v1/puzzles/today").json()["attempted"] is False


def test_attempt_requires_auth_and_an_existing_puzzle(client):
    body = {"move": {"pieceId": "m", "from": "b10", "to": "c10"}, "tries": 1, "seconds": 1}
    assert client.post(f"/v1/puzzles/{TODAY}/attempts", json=body).status_code == 401
    assert client.post(f"/v1/puzzles/{YESTERDAY}/attempts", json=body, headers=auth(client)).status_code == 404


def test_reingest_replaces_untouched_puzzles_only(client):
    client.post("/v1/admin/puzzles", json={"puzzles": [puzzle(TODAY), puzzle(YESTERDAY)]}, headers=JOBS)
    client.post(
        f"/v1/puzzles/{TODAY}/attempts",
        json={"move": {"pieceId": "m", "from": "b10", "to": "c10"}, "tries": 1, "seconds": 1},
        headers=auth(client),
    )
    r = client.post(
        "/v1/admin/puzzles", json={"puzzles": [puzzle(TODAY, seed=2), puzzle(YESTERDAY, seed=2)]}, headers=JOBS
    )
    assert r.json() == {"stored": 1, "skipped": 1}


def test_ingest_validates_squares(client):
    bad = puzzle(TODAY)
    bad["pieces"][0]["square"] = "z99"
    assert client.post("/v1/admin/puzzles", json={"puzzles": [bad]}, headers=JOBS).status_code == 422
