import uuid


def auth(client):
    token = client.post("/v1/accounts").json()["token"]
    return {"Authorization": f"Bearer {token}"}


def record(i, coverage=0.5, device="phone"):
    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"rec-{i}")),
        "t": f"2026-09-0{i}T12:00:00Z",
        "coverage": coverage,
        "assist": 1,
        "device": device,
    }


def test_upload_is_idempotent_and_merges_devices(client):
    h = auth(client)
    r = client.put("/v1/coverage", json={"records": [record(1), record(2)]}, headers=h)
    assert r.status_code == 200
    assert r.json() == {"stored": 2, "total": 2}
    again = client.put("/v1/coverage", json={"records": [record(2), record(3, device="tablet")]}, headers=h)
    assert again.json() == {"stored": 1, "total": 3}
    listing = client.get("/v1/coverage", headers=h).json()["records"]
    assert [x["device"] for x in listing] == ["phone", "phone", "tablet"]
    assert listing[0]["t"].startswith("2026-09-01T12:00:00")


def test_records_are_private_to_the_account(client):
    a, b = auth(client), auth(client)
    client.put("/v1/coverage", json={"records": [record(1)]}, headers=a)
    assert client.get("/v1/coverage", headers=b).json()["records"] == []
    assert client.get("/v1/me", headers=a).json()["coverage_records"] == 1


def test_validation(client):
    h = auth(client)
    bad = {"records": [{**record(1), "coverage": 1.5}]}
    assert client.put("/v1/coverage", json=bad, headers=h).status_code == 422
    assert client.put("/v1/coverage", json={"records": []}).status_code == 401
