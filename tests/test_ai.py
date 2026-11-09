from fastapi.testclient import TestClient
from app.main import app
from app import gemini_service as g
client = TestClient(app)


def test_ai_status_not_expose_credentials(monkeypatch):
    monkeypatch.setenv('MOTIONLAB_AI_PROVIDER', 'vertex')
    monkeypatch.setenv('GOOGLE_CLOUD_PROJECT', 'demo-project')
    monkeypatch.setenv('GEMINI_API_KEY', 'secret-should-not-appear')
    payload = client.get('/api/ai/status').json()
    assert payload['configured'] is True and payload['provider'] == 'vertex'
    assert 'secret-should-not-appear' not in str(payload)


def test_missing_credentials_falls_back(monkeypatch):
    monkeypatch.setenv('MOTIONLAB_AI_PROVIDER', 'off')
    response = client.post('/api/feedback', json={'volumeMl':9,'ph':3,'score':50,'mixingRatio':0,'errorMl':1})
    assert response.json()['source'] == 'rules'
    assert client.post('/api/ai/ask', json={'question':'为什么pH变化？'}).json()['source'] == 'unavailable'


def test_vertex_ai_feedback_mock(monkeypatch):
    monkeypatch.setenv('MOTIONLAB_AI_PROVIDER', 'vertex')
    monkeypatch.setenv('GOOGLE_CLOUD_PROJECT', 'demo-project')
    monkeypatch.setattr(g, 'generate_coaching', lambda data, mode: '模拟的Gemini回答')
    monkeypatch.setattr(g.request_limiter, 'allow', lambda ip: True)
    r = client.post('/api/feedback', json={'volumeMl':9,'ph':3,'score':50,'mixingRatio':0,'errorMl':1})
    assert r.json() == {'source':'gemini','text':'模拟的Gemini回答'}
    r = client.post('/api/ai/ask', json={'question':'为什么生成沉淀？', 'scenario':'precipitate', 'language':'ja'})
    assert r.json()['source'] == 'gemini'


def test_ai_failure_has_safe_fallback(monkeypatch):
    monkeypatch.setenv('MOTIONLAB_AI_PROVIDER', 'vertex')
    monkeypatch.setenv('GOOGLE_CLOUD_PROJECT', 'demo-project')
    monkeypatch.setattr(g.request_limiter, 'allow', lambda ip: True)
    def error(*a, **kw): raise RuntimeError('TOKEN SECRET')
    monkeypatch.setattr(g, 'generate_coaching', error)
    r = client.post('/api/feedback', json={'volumeMl':9,'ph':3,'score':50,'mixingRatio':0,'errorMl':1})
    assert r.json()['source'] == 'rules-fallback' and 'TOKEN SECRET' not in str(r.json())


def test_ai_question_has_limits():
    assert client.post('/api/ai/ask',json={'question':'x'}).status_code == 422
    assert client.post('/api/ai/ask',json={'question':'okay','language':'de'}).status_code == 422
