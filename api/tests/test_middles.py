def auth(client):
    token = client.post("/v1/accounts").json()["token"]
    return {"Authorization": f"Bearer {token}"}


def record(rid: str, **over):
    base = {
        "id": rid,
        "t": "2026-09-02T10:00:00Z",
        "mode": "practice",
        "level": 1,
        "kind": "arithmetic",
        "solved": True,
        "tries": 1,
        "cents": None,
        "device": "phone",
    }
    base.update(over)
    return base


def test_results_upload_is_idempotent_per_account(client):
    a, b = auth(client), auth(client)
    first = client.put(
        "/v1/middles/results", json={"records": [record("daily:2026-09-02", mode="daily", level=0)]}, headers=a
    )
    assert first.status_code == 200
    assert first.json() == {"stored": 1, "total": 1}
    again = client.put(
        "/v1/middles/results",
        json={"records": [record("daily:2026-09-02", mode="daily", level=0), record("practice:0", cents=12.5)]},
        headers=a,
    )
    assert again.json() == {"stored": 1, "total": 2}
    # the same client id in another account is another record
    other = client.put("/v1/middles/results", json={"records": [record("practice:0")]}, headers=b)
    assert other.json() == {"stored": 1, "total": 1}
    listed = client.get("/v1/middles/results", headers=a).json()["records"]
    assert [r["id"] for r in listed] == ["daily:2026-09-02", "practice:0"]
    assert listed[1]["cents"] == 12.5
    assert listed[0]["cents"] is None
    assert listed[0]["kind"] == "arithmetic" and listed[0]["mode"] == "daily"


def test_results_validate_and_require_auth(client):
    assert client.put("/v1/middles/results", json={"records": []}).status_code == 401
    bad = record("x", kind="octave")
    assert client.put("/v1/middles/results", json={"records": [bad]}, headers=auth(client)).status_code == 422
    assert client.get("/v1/middles/results").status_code == 401
