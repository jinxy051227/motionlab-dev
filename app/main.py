"""MotionLab demo server. Camera frames never leave the browser."""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
app = FastAPI(title="MotionLab", version="0.9.2", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")


class FeedbackRequest(BaseModel):
    volumeMl: float = Field(ge=0, le=300)
    ph: float = Field(ge=0, le=14)
    score: int = Field(ge=0, le=100)
    mixingRatio: float = Field(ge=0, le=1)
    errorMl: float = Field(ge=0, le=10)
    notes: list[str] = Field(default_factory=list, max_length=12)
    quickStart: bool = False
    scenario: str = Field(default="neutralization", pattern="^(neutralization|precipitate|gas|dissolution|heating)$")
    temperatureC: float = Field(default=20, ge=-10, le=200)
    phenomenon: str = Field(default="", max_length=180)
    observations: list[str] = Field(default_factory=list, max_length=8)
    language: str = Field(default="zh", pattern="^(zh|ja|en)$")


def safe_local_feedback(data: FeedbackRequest) -> str:
    """Source of truth stays in deterministic experiment rules."""
    if data.language in ("ja", "en"):
        lang = data.language
        intro = {
            "neutralization": (
                "強酸・強塩基の滴定モデルです。10.00 mLの0.100 mol/L HClには、理論上10.00 mLの0.100 mol/L NaOHが必要です。",
                "This is an idealized strong-acid/strong-base titration. 10.00 mL of 0.100 mol/L HCl requires 10.00 mL of 0.100 mol/L NaOH at equivalence."),
            "precipitate": ("Ca²⁺とCO₃²⁻から白色のCaCO₃沈殿が生成します。", "Ca²⁺ and CO₃²⁻ form a white CaCO₃ precipitate."),
            "gas": ("酸と炭酸水素イオンが反応し、CO₂が発生します。", "An acid reacts with bicarbonate to release CO₂ gas."),
            "dissolution": ("NaClは水中でNa⁺とCl⁻として分散します。溶解度を超えると固体が残ります。", "NaCl dissociates into Na⁺ and Cl⁻ in water; excess salt remains solid when saturation is reached."),
            "heating": ("加熱により水温が上昇し、蒸発が起こります。状態変化であり、化学反応ではありません。", "Heating raises water temperature and causes evaporation, a physical change rather than a chemical reaction.")
        }[data.scenario][0 if lang == "ja" else 1]
        if data.scenario == "neutralization":
            if data.errorMl <= .05:
                outcome = ("添加量は理論的な当量点に近づいています。", "The added volume is close to the theoretical equivalence point.")
            elif data.volumeMl < 10:
                outcome = ("当量点より手前で停止しています。少量ずつ加えて確認しましょう。", "You stopped before equivalence. Add small amounts and observe carefully.")
            else:
                outcome = ("当量点を超えています。終点付近では滴下速度を落としましょう。", "You exceeded equivalence. Slow down near the endpoint.")
            extra = outcome[0 if lang == "ja" else 1]
        else:
            extra = ""
        note = ("これは学習用の簡略モデルです。微視的な粒子表示は模式図で、実験室での安全確認に使えません。" if lang == "ja" else
                "This is a simplified teaching model. Microscopic particles are illustrative and cannot replace laboratory safety procedures.")
        if data.quickStart:
            note += (" 自動実演は実技評価に使用できません。" if lang == "ja" else " Auto-demo results cannot be used for practical-skill assessment.")
        return f"{intro}\n{extra}\n{note}".strip()
    if data.scenario != "neutralization":
        intros = {
            "precipitate": "碳酸钙沉淀：Ca²⁺与CO₃²⁻结合后形成CaCO₃(s)，其他离子主要留在溶液中。",
            "gas": "气体实验：酸与碳酸氢根发生反应时可生成CO₂，气泡是宏观观察；模拟没有计算真实气压。",
            "dissolution": "溶解实验：NaCl晶体中的Na⁺和Cl⁻在水中分散；饱和时更多固体会留下。",
            "heating": "加热实验：液体温度会上升并可蒸发；水的沸腾与蒸发是物理变化。",
        }
        return (intros.get(data.scenario, "该实验仍在建模中。") +
                f"\n记录温度：{data.temperatureC:.1f}°C，液量：{data.volumeMl:.2f}mL。" +
                (f"\n模拟观察：{data.phenomenon}。" if data.phenomenon else "") +
                "\n注意：微观视图为概念示意；实际操作应遵守老师与学校实验室的具体规程。")
    parts = [f"本次滴加了 {data.volumeMl:.3f} mL NaOH，理论等量体积为 10.000 mL。"]
    if data.errorMl <= 0.05:
        parts.append("加入体积非常接近理论等量点，说明终点判断比较准确。")
    elif data.volumeMl < 10:
        parts.append("在达到理论等量点之前停止，建议接近终点时缓慢加入。")
    else:
        parts.append("加入量超过理论等量点，建议后段降低流速、逐滴观察。")
    if data.mixingRatio < 0.25:
        parts.append("摇匀动作偏少；真实滴定需要持续混合，确保观察到的是整体颜色变化。")
    else:
        parts.append("有进行摇匀操作；仍应注意整个滴定过程的连续性。")
    parts.append("微观上，H₃O⁺ 与 OH⁻ 中和形成水；Na⁺ 和 Cl⁻ 主要作为旁观离子存在。")
    parts.append("请注意：这是理想化强酸强碱模型，不提供真实器具的触觉训练。")
    if data.quickStart:
        parts.append("本次使用过快进演示模式，不能把结果用作完整操作考核。")
    return "\n".join(parts)


@app.get("/")
def home():
    return FileResponse(STATIC / "index.html")


@app.get("/camera-check")
def camera_check():
    """Test camera permissions independently of AI and WebGL dependencies."""
    return FileResponse(STATIC / "camera-check.html")


@app.get("/classic")
def classic():
    """Updated 2D game-style lab; shared ExperimentEngine with 3D."""
    return FileResponse(STATIC / "studio2d.html")

@app.get("/legacy2d")
def legacy2d():
    """Unmodified safety/titration teaching demo for regression comparison."""
    return FileResponse(STATIC / "classic.html")


@app.get("/api/version")
def version_info():
    return {"version": "0.9.2", "features": ["assisted-pour-2d-3d", "wasd-camera-walk", "multi-experiment", "3d-physics", "camera-hand-tracking", "front-desk-2.5d", "no-depth-hand-input", "real-rack-holes", "detachable-lamp-cap", "vessel-to-vessel-transfer", "explicit-grip-gesture", "guided-auto-demo", "hover-vessel-content", "realistic-liquid-appearance", "persistent-micro-view", "runtime-zh-ja-en", "per-vessel-analytical-composition", "2d-3d-primary-vessel-handoff", "vertex-ai-gemini-coach", "contextual-ai-qa", "ai-answer-completion-check", "ai-retry", "question-language-detection"]}


@app.get("/healthz")
def health():
    return {"ok": True, "service": "motionlab"}


@app.get("/api/config")
def config():
    """Public configuration: no keys, service account IDs or other credentials."""
    from .gemini_service import ai_status
    status = ai_status()
    return {"geminiEnabled": status["configured"], "geminiProvider": status["provider"],
            "geminiModel": status["model"], "version": "0.9.2"}


@app.get("/api/ai/status")
def ai_status_endpoint():
    from .gemini_service import ai_status
    return ai_status()



@app.post("/api/feedback")
def feedback(data: FeedbackRequest, request: Request):
    """AI feedback only consumes structured simulation results, never raw camera video."""
    from .gemini_service import generate_coaching, ai_status, request_limiter
    fallback = safe_local_feedback(data)
    if not ai_status()["configured"]:
        return {"source": "rules", "text": fallback}
    if not request_limiter.allow(request.client.host if request.client else "unknown"):
        return {"source": "rules-fallback", "text": fallback, "error": "rate_limited"}
    try:
        text = generate_coaching(data.model_dump(), mode="report")
        if text:
            return {"source": "gemini", "text": text}
    except Exception:
        # Never leak SDK exception messages, tokens or project details to browsers.
        pass
    return {"source": "rules-fallback", "text": fallback, "error": "ai_unavailable"}


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=400)
    scenario: str = Field(default="neutralization", pattern="^(neutralization|precipitate|gas|dissolution|heating)$")
    language: str = Field(default="zh", pattern="^(zh|ja|en)$")
    volumeMl: float = Field(default=0, ge=0, le=300)
    temperatureC: float = Field(default=20, ge=-10, le=200)
    ph: float = Field(default=7, ge=0, le=14)
    phenomenon: str = Field(default="", max_length=180)
    observations: list[str] = Field(default_factory=list, max_length=8)


@app.post("/api/ai/ask")
def ask_ai(data: AskRequest, request: Request):
    """On-demand contextual tutor, not a realtime video analyzer."""
    from .gemini_service import generate_coaching, ai_status, request_limiter
    if not ai_status()["configured"]:
        return {"source": "unavailable", "text": {
            "zh": "尚未连接 Gemini。请先设置 Vertex AI 项目及本地授权。",
            "ja": "Geminiに未接続です。Vertex AIの設定と認証を行ってください。",
            "en": "Gemini is not connected. Configure Vertex AI and authentication first.",
        }[data.language]}
    if not request_limiter.allow(request.client.host if request.client else "unknown"):
        return {"source": "unavailable", "text": {
            "zh": "请求过于频繁，请稍后再试。", "ja": "リクエストが多すぎます。しばらくしてから再試行してください。",
            "en": "Too many requests. Please try again later.",
        }[data.language]}
    try:
        return {"source": "gemini", "text": generate_coaching(data.model_dump(), mode="question")}
    except Exception as exc:
        from .gemini_service import IncompleteAIResponse
        if isinstance(exc, IncompleteAIResponse):
            return {"source": "unavailable", "error": "incomplete_answer", "text": {
                "zh": "Gemini连续两次未能给出完整回答，系统已拦截残缺内容。请稍后重试。",
                "ja": "Geminiが2回とも回答を完了できませんでした。不完全な回答は表示していません。時間をおいて再試行してください。",
                "en": "Gemini produced an incomplete answer twice; the partial text was not shown. Please retry later.",
            }[data.language]}
        return {"source": "unavailable", "text": {
            "zh": "Gemini暂时无法响应。请检查Vertex AI配置、服务账号权限及模型可用性。",
            "ja": "Geminiへの接続に失敗しました。Vertex AI、権限、モデルを確認してください。",
            "en": "Gemini request failed. Check Vertex AI setup, permissions and model availability.",
        }[data.language]}
