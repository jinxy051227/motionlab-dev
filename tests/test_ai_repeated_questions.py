"""Regression tests for the duplicate-question partial response bug.
These simulate SDK responses; no account/API calls or secrets required.
"""
import sys
import types as pytypes
from app import gemini_service as g
from fastapi.testclient import TestClient
from app.main import app
import pytest


class FakeGenAIConfig:
    def __init__(self, **kw): self.values = kw


class FakeThinking:
    def __init__(self, **kw): self.values = kw


class FakeClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []
        self.models = self
    def generate_content(self, **kw):
        self.calls.append(kw)
        return next(self.responses)
    def close(self): pass


def make_response(text, reason="STOP"):
    return pytypes.SimpleNamespace(text=text, candidates=[pytypes.SimpleNamespace(finish_reason=reason)])


def prepare(monkeypatch, responses):
    stub = pytypes.SimpleNamespace(GenerateContentConfig=FakeGenAIConfig,
                                   ThinkingConfig=FakeThinking)
    monkeypatch.setitem(sys.modules, 'google', pytypes.ModuleType('google'))
    monkeypatch.setitem(sys.modules, 'google.genai', pytypes.ModuleType('google.genai'))
    sys.modules['google'].genai = sys.modules['google.genai']
    sys.modules['google.genai'].types = stub
    monkeypatch.setenv('GEMINI_MODEL','gemini-3.5-flash')
    monkeypatch.setenv('GOOGLE_CLOUD_PROJECT','unit-test-project')
    monkeypatch.setenv('MOTIONLAB_AI_PROVIDER','vertex')
    instance=FakeClient(responses)
    monkeypatch.setattr(g,'_client',lambda:instance)
    monkeypatch.setattr(g.request_limiter,'allow',lambda _:True)
    return instance


def test_same_question_twice_second_model_truncated_then_recovered(monkeypatch):
    good='酸と炭酸水素塩が反応すると、二酸化炭素が発生し、泡として観察できます。\n[END_ANSWER]'
    instance=prepare(monkeypatch, [make_response(good),
       make_response('conceptual particle animations vs. molecular dynamics, HCl 10mL, pH', 'MAX_TOKENS'),
       make_response(good)])
    question={'question':'なぜ泡が発生するの？', 'scenario':'gas', 'language':'zh'}
    client=TestClient(app)
    first=client.post('/api/ai/ask',json=question).json()
    second=client.post('/api/ai/ask',json=question).json()
    assert first['source']=='gemini' and second['source']=='gemini'
    assert first['text']==second['text'] and 'END_ANSWER' not in first['text']
    assert len(instance.calls)==3  # first call; second call + one automatic retry
    assert instance.calls[1]['config'].values['max_output_tokens']>=2000
    assert instance.calls[2]['config'].values['max_output_tokens']>instance.calls[1]['config'].values['max_output_tokens']
    assert instance.calls[2]['config'].values['thinking_config'].values['thinking_level']=='low'


def test_never_show_partial_english_for_japanese(monkeypatch):
    prepare(monkeypatch,[make_response('English notes: inspect current pH'),
                         make_response('HCl 10mL, pH', 'MAX_TOKENS')])
    client=TestClient(app)
    response=client.post('/api/ai/ask',json={'question':'なぜ泡が発生するの？','language':'zh'}).json()
    assert response['source']=='unavailable'
    assert response['error']=='incomplete_answer'
    assert 'HCl 10mL' not in response['text']


def test_ui_language_fallback_and_japanese_question_detection():
    assert g.response_language({'question':'なぜ泡が発生するの？','language':'zh'},mode='question')=='ja'
    assert g.response_language({'question':'为什么有气泡？','language':'ja'},mode='question')=='zh'
    assert g.response_language({'question':'Why do bubbles form?','language':'zh'},mode='question')=='en'
    assert g.response_language({'language':'ja'},mode='report')=='ja'


def test_finish_reason_enum_shapes():
    response=make_response('完成。', pytypes.SimpleNamespace(name='MAX_TOKENS'))
    assert g._finish_reason(response)=='MAX_TOKENS'
    assert not g._answer_is_complete('conceptual particle animations vs pH', 'ja', 'STOP')
    assert g._answer_is_complete('中和反応が進み、pHが変化します。[END_ANSWER]', 'ja', 'STOP')
