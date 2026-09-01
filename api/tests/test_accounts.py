def test_create_account_and_me(client):
    r = client.post("/v1/accounts")
    assert r.status_code == 201
    body = r.json()
    assert len(body["token"]) >= 40
    me = client.get("/v1/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json()["account_id"] == body["account_id"]
    assert me.json()["coverage_records"] == 0


def test_me_requires_a_valid_token(client):
    assert client.get("/v1/me").status_code == 401
    assert client.get("/v1/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_tokens_are_not_stored_in_clear(client, database_url):
    import psycopg

    token = client.post("/v1/accounts").json()["token"]
    with psycopg.connect(database_url) as conn:
        (stored,) = conn.execute("SELECT token_hash FROM accounts").fetchone()
    assert stored != token
    assert len(stored) == 64
