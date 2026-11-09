from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)

def test_index_health():
    response=client.get('/')
    assert response.status_code==200
    assert b'MotionLab' in response.content
    assert client.get('/healthz').json()['ok']

def test_static_rules_exist():
    assert client.get('/static/rules.js').status_code==200

def test_feedback_fallback(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    result=client.post('/api/feedback',json={'volumeMl':9.9,'ph':3,'score':50,'mixingRatio':0.2,'errorMl':0.1}).json()
    assert result['source']=='rules'
    assert '等量' in result['text']

def test_feedback_rejects_invalid():
    assert client.post('/api/feedback',json={'volumeMl':-1,'ph':7,'score':50,'mixingRatio':0.5,'errorMl':2}).status_code==422

def test_3d_page_and_classic_fallback():
    page=client.get('/')
    assert page.status_code==200
    assert b'MotionLab 3D' in page.content
    for path in ['/classic','/static/lab3d.js','/static/vision3d.js','/static/interaction3d.js']:
        assert client.get(path).status_code==200

def test_camera_diagnostics_independent_of_3d_cdns():
    r=client.get('/camera-check')
    assert r.status_code==200
    assert b'camera-check.js' in r.content
    assert client.get('/static/camera-check.js').status_code==200


def test_version_and_navigation_controls():
    version=client.get('/api/version').json()
    assert version['version']=='0.9.2'
    page=client.get('/').text
    assert 'WASD第一人称漫游' in page
    assert 'v0.9.2' in page
    assert client.get('/static/navigation3d.js').status_code == 200


def test_new_2d_studio_and_old_demo_accessible():
    new=client.get("/classic")
    assert new.status_code == 200
    assert "2D INTERACTIVE LAB" in new.text
    assert "倒入 3 mL" in new.text
    legacy=client.get("/legacy2d")
    assert legacy.status_code == 200
    assert "cameraVideo" in legacy.text


def test_2d_uses_shared_chemistry_engine():
    page=client.get("/static/studio2d.js")
    assert page.status_code==200
    assert "./experiment-engine.js" in page.text
    assert "./assisted-transfer.js" in page.text


def test_feedback_allows_heating_starter_volume(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r=client.post("/api/feedback",json={"volumeMl":25,"ph":7,"score":80,"mixingRatio":0,"errorMl":0,"scenario":"heating","temperatureC":80})
    assert r.status_code==200
    assert r.json()["source"]=="rules"


def test_bidirectional_navigation_all_2d_views():
    main = client.get('/').text
    new2d = client.get('/classic').text
    legacy = client.get('/legacy2d').text
    assert 'id="modeTo2d"' in main and 'href="/classic"' in main
    assert 'id="modeTo3d"' in new2d and 'href="/"' in new2d
    assert 'id="stageTo3d"' in new2d
    assert 'id="return3dSidebar"' in new2d
    assert 'legacy-to-3d' in legacy and 'legacy-to-new2d' in legacy

def test_nav_buttons_are_links_not_js_only():
    new2d = client.get('/classic').text
    assert '<a class="mode-exit"' in new2d
    assert 'aria-current="page"' in new2d
    assert '/static/studio2d.css?v=0902' in new2d

def test_v07_desk_view_grip_and_lesson_controls():
    html=client.get('/').text
    assert 'id="viewDesk"' in html
    assert 'id="viewExplore"' in html
    assert 'id="lessonAuto"' in html and 'id="lessonSteps"' in html
    assert client.get('/static/grip-intent.js').status_code==200
    assert client.get('/static/lesson-flow.js').status_code==200
    lab=client.get('/static/lab3d.js').text
    assert 'OrthographicCamera' in lab and 'pickGripTarget' in lab
    assert 'hand.change===\'grab\'' in lab
    assert 'this.heldOffsets' in lab
    assert 'setPresentation(' in lab
    page2d=client.get('/classic').text
    assert 'id="lessonAuto"' in page2d and 'id="lessonNext"' in page2d


def test_v09_micro_is_always_present_and_never_a_modal():
    for route in ("/", "/classic"):
        content=client.get(route).text
        assert 'id="microCanvas"' in content
        assert 'id="microModal"' not in content
        assert 'microDock' in content if route=="/" else 'live-micro-2d' in content
    assert client.get('/static/i18n.js').status_code==200
    assert client.get('/static/lab-session.js').status_code==200

def test_feedback_english_and_japanese(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    form={'volumeMl':12,'ph':11,'score':75,'mixingRatio':.2,'errorMl':2,'scenario':'neutralization'}
    en=client.post('/api/feedback',json={**form,'language':'en'}).json()['text']
    ja=client.post('/api/feedback',json={**form,'language':'ja'}).json()['text']
    assert 'equivalence' in en and 'endpoint' in en
    assert '当量点' in ja and '滴下' in ja
    assert client.post('/api/feedback',json={**form,'language':'es'}).status_code==422
