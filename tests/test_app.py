from fastapi.testclient import TestClient

from app.main import app


def test_saude_endpoint():
    client = TestClient(app)
    resp = client.get('/api/v1/saude')
    assert resp.status_code == 200
    assert resp.json() == {'status': 'ok'}
