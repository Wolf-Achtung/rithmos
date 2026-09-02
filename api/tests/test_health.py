def test_health_reports_schema_version(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "schema_version": 2}
