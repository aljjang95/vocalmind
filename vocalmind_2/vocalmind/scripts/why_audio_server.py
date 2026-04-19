"""WhyText TTS 관리 도구 — 로컬 웹 UI.

실행:
  cd vocalmind_2/vocalmind
  python scripts/why_audio_server.py

브라우저: http://localhost:9090
- 28단계 whyText 카드 표시
- 텍스트 수정 가능
- [합성] → Runware Qwen3-TTS → 미리듣기
- [저장] → Supabase Storage 업로드
"""
from __future__ import annotations

import base64
import json
import os
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
import requests
import uvicorn

sys.stdout.reconfigure(encoding="utf-8")

# ── Runware ──
API_URL = "https://api.runware.ai/v1"
MODEL = "alibaba:qwen@3-tts-1.7b-base"
API_KEY = os.environ.get("RUNWARE_API_KEY", "")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REF_WAV = PROJECT_ROOT / "backend" / "assets" / "hlb_master_ref_clean.wav"
OUTPUT_DIR = PROJECT_ROOT / "scripts" / "why_audio_output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── Supabase ──
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "vocal-clips"
STORAGE_PREFIX = "why-audio"

REF_TRANSCRIPT = (
    "성대는 본래 운동하고자 하는 그 운동성대로 아래부터 위로 붙는 운동성을 띄기 때문에 "
    "막히는게 아니라 힘만 빼놔도 알아서 바뀌어 줘서 올라가질 수가 있거든요. "
    "그래서 우리가 목의 힘을 가장 빼기 쉬운 방법은"
)

WHY_TEXTS: dict[int, str] = {
    1: "설근(혀뿌리)이 자기 무게에 맡겨져 아래로 떨어져 있을 때, 목 전체가 자연스럽게 열리고 성대도 편하게 울릴 수 있습니다. 설근에 힘이 들어가면 목 안쪽이 좁아지면서 소리가 답답해지고 피로도 빨리 쌓여요. 먼저 설근의 무게를 느끼며 편안하게 놓아주는 감각을 몸으로 기억하는 게 모든 발성의 기초입니다.",
    2: "혀가 떨어지면 목 안쪽 긴장이 풀리면서 후두가 자연스럽게 내려앉습니다. 이 안정된 상태에서 발성하면 성대가 자유롭게 진동할 수 있고, 억지로 힘 주지 않아도 깊고 편한 소리가 나옵니다.",
    3: "라운딩은 음정을 올릴 때 목에 힘이 들어가지 않도록 몸 전체가 자연스럽게 따라가는 느낌입니다. 허밍 상태에서 안정을 유지한 채 음정 변화를 연습하면, 나중에 고음을 낼 때도 목을 조이지 않고 편하게 올라갈 수 있습니다.",
    4: "복식호흡은 배 아래쪽부터 천천히 공기를 채우는 방식으로, 성대를 자연스럽게 늘어나게 하고 안정적인 발성을 만듭니다. 아랫배가 밀려나고 명치까지 차오르는 느낌을 찾으면, 노래할 때 호흡이 끊어지지 않고 힘 빠진 소리를 낼 수 있습니다.",
    5: "허밍은 성대가 자유롭게 떨리도록 하면서 동시에 코의 공기감으로 공명을 느끼게 해줍니다. 입을 편하게 다물고 콧바람이 살짝 빠지는 상태에서 연습하면 성대 스스로만 움직이는 감각을 찾을 수 있어서, 나중에 입을 열었을 때 목에 힘 없이 소리가 나오는 기초가 됩니다.",
    6: "입술과 볼의 압력이 성대 접촉을 자연스럽게 만들고, 그 저항감이 배로 전달되어 복부에 안정적인 지지력이 생깁니다. 이 70% 정도의 배 압력이 목에 힘을 빼면서도 소리를 떨어뜨리지 않게 해주는 기초가 돼요.",
    7: "모음 5개를 차례로 라운딩하면서 혀와 목의 위치를 안정시키고, 입술 모양 변화만으로 소리가 자연스럽게 넘어가도록 연습합니다. 이렇게 하면 모음이 '순화'되면서 성대가 편안해지고, 같은 에너지로도 공명이 더 풍부하게 살아나요.",
    8: "모음을 길게 유지하며 연결하면 성대가 안정적으로 울리고, 음정이 흐트러지지 않습니다. 모음마다 입 모양과 혀의 위치가 달라지는데, 그 변화를 자연스럽게 넘어가야 소리가 끊기지 않고 부드럽게 흐릅니다.",
    9: "모음을 자연스럽게 연결하면서 성대가 부드럽게 움직이도록 훈련합니다. 자음의 힘을 빼고 모음에만 집중하면 성대 운동성이 좋아져서 음역대 전환이 매끄러워지고, 발성 형태가 무너지지 않으면서도 발음이 명확해집니다.",
    10: "옴 허밍은 목을 완전히이완시킨 상태에서 코를 통해 울림을 느끼게 해줍니다. 이 울림이 입안 전체로 퍼지면서 공명 공간이 자연스럽게 확보되고, 나중에 고음을 낼 때 필요한 울림의 감각을 몸이 기억하게 됩니다.",
    11: "멈 체킹은 음이 올라갈 때 성대가 자연스럽게 붙어있는 상태를 확인하는 과정입니다. 성대가 충분히 접촉하지 않으면 음이 떨리거나 끊어지므로, 이 단계에서 '적절한 붙임'의 감각을 몸에 저장하는 것이 중요합니다.",
    12: "진성과 가성의 경계를 허물면서 목에 힘을 완전히 빼야 음정 변화에도 목이 움직이지 않고 안정적인 소리가 나옵니다. 두성 밸런스 상태에서 발성하면 고음과 저음을 자연스럽게 연결할 수 있어서 성역 전환이 매끄러워집니다.",
    13: "1.5옥타브 스케일은 점프식으로 음정을 빠르게 옮기면서 성구 전환을 자연스럽게 만드는 연습입니다. 목과 혀가 긴장하지 않고 모음 변화만으로 음역대를 넘나들 수 있게 몸을 적응시키는 거예요.",
    14: "복부 압력을 70% 정도로 세팅하면 성대가 안정적으로 접촉하면서도 불필요한 긴장을 피할 수 있습니다. 마치 풍선을 부풀릴 때 적당한 힘을 유지하는 것처럼, 배에서 일정한 지지력을 느끼면 목소리가 흔들리지 않고 편하게 나옵니다.",
    15: "복부 압력은 성대를 안정적으로 지탱하는 기초입니다. 50-70% 정도의 적절한 긴장감을 유지하면 음정 변화에 따라 필요한 압력이 자동으로 조절되어, 목에 힘을 주지 않고도 맑은 소리가 나옵니다.",
    16: "성대 접촉 세팅은 목소리의 밀도와 안정성을 결정합니다. 배의 압력으로 성대를 자연스럽게 붙였을 때, 목이 긴장하지 않으면서도 튼튼한 소리가 나옵니다. 적정 강도(70% 정도)를 찾으면 높은 음까지 안전하게 올라갈 수 있습니다.",
    17: "세팅을 놓으면 음정이 흔들리고 성대가 일관된 압력을 받지 못해요. 스케일을 올라갈수록 더 강한 세팅이 필요한데, 처음 잡은 그 느낌을 끝까지 유지하면 어떤 높이에서도 안정적인 음이 나옵니다.",
    18: "진성과 가성이 자연스럽게 만나는 지점을 찾으면 음역대 전체에서 목이 편해지고 소리가 통일됩니다. 목에 힘을 빼고 두 성대가 함께 움직이도록 하면, 음정이 올라갈 때도 억지스러운 전환 없이 자연스럽게 흐릅니다.",
    19: "두성 밸런스로 선창하면 음정 변화와 가사 변화 앞에서 몸이 긴장하지 않습니다. 미리 편안한 상태를 경험하고 노래하면 성구 전환이 자연스럽게 일어나고, 소리가 끊기지 않고 흐릅니다.",
    20: "목에 힘을 빼면 성대가 자연스럽게 모양을 바꾸면서 저음에서 고음으로 매끄럽게 올라갑니다. 이건 기술이 아니라 이완의 결과예요. 억지로 만드는 소리가 아니라 몸이 자동으로 찾는 변화를 느껴보는 게 중요합니다.",
    21: "말자리는 목소리의 '기초 설정'입니다. 세팅된 압력과 울림을 유지하면서 발음을 연결하면, 음역대가 바뀌어도 목소리 색깔이 흔들리지 않고 고음까지 자연스럽게 올라갑니다. 이 상태에서 복부 긴장감이 따라오면서 안정적인 성대 작동이 가능해집니다.",
    22: "음정이 움직일 때 성대가 긴장하거나 풀리면서 끊어지는 느낌이 생깁니다. 세팅을 고정한 채로 음정을 연결하면 목에 불필요한 힘이 빠져나가지 않아서 음이 부드럽고 안정적으로 이어집니다.",
    23: "고음으로 올라갈수록 성대가 자동으로 벌어지려고 하는데, 이걸 막지 않으면 소리가 흩어지고 음정이 흔들립니다. 고음 전에 미리 성대 접촉을 단단히 해주면 음역대를 안정적으로 올라갈 수 있습니다.",
    24: "고음에서 목이 긴장되는 이유는 복부 압력이 부족하기 때문입니다. 배에서 일정한 압력을 유지하면 성대가 자연스럽게 접촉되어 목에 힘을 주지 않아도 소리가 선명해집니다. 이 압력을 숫자로 인식하고 조절하는 연습이 고음 안정성의 핵심입니다.",
    25: "빠사지오는 억지로 넘어가는 게 아니라 성대가 이미 준비된 상태에서 모음이 자연스럽게 변하면서 자동으로 통과되는 영역입니다. 이 구간을 느슨하게 흘려보내면 목이 졸리지 않고 음색이 자연스럽게 바뀌면서 높은음까지 편하게 올라갈 수 있어요.",
    26: "발음이 바뀌어도 목의 모양과 숨의 흐름을 같게 유지해야 음성이 일관되고 표현이 흔들리지 않습니다. 자음이 들어와도 모음의 울림 위치를 잃지 않는 것이 고음 안정성의 핵심입니다.",
    27: "말자리 상태에서 실제 가사로 전환하는 단계입니다. 지금까지 유지한 복부의 긴장감과 순화(성대의 안정감)가 가사 때문에 무너지기 쉬운데, 이 연습으로 어떤 말을 하든 그 기초가 흔들리지 않게 만듭니다.",
    28: "기술만 생각하면 목이 경직되고 노래가 경직됩니다. 감정을 살리되 지금 이 순간의 목 상태를 느끼면서 부르면, 기술이 자연스럽게 작동하고 청자의 마음까지 닿는 노래가 됩니다.",
}

STAGE_NAMES = {
    1: "설근 안정화", 2: "후두 안정", 3: "라운딩 기초",
    4: "복식호흡", 5: "허밍 기초", 6: "호흡-발성 연결",
    7: "5모음 라운딩", 8: "모음 연결", 9: "모음-자음 순화",
    10: "옴 허밍 공명", 11: "멈 체킹", 12: "두성 밸런스",
    13: "1.5옥타브 스케일", 14: "스타카토 세팅", 15: "복부 압력 조절",
    16: "성대 접촉 도약", 17: "세팅 유지 스케일", 18: "두성 라운딩",
    19: "두성 선창", 20: "빠사지오 체험", 21: "말자리 순화",
    22: "음정 연결", 23: "고음 도약", 24: "고음 압력 세팅",
    25: "빠사지오 통과", 26: "발음별 순화 유지", 27: "실가창 말자리",
    28: "실가창 종합",
}

BLOCK_NAMES = {
    1: "이완 기초", 2: "이완 기초", 3: "이완 기초",
    4: "호흡/허밍", 5: "호흡/허밍", 6: "호흡/허밍",
    7: "모음 순화", 8: "모음 순화", 9: "모음 순화",
    10: "발음 확장", 11: "발음 확장", 12: "발음 확장", 13: "발음 확장",
    14: "세팅 훈련", 15: "세팅 훈련", 16: "세팅 훈련", 17: "세팅 훈련",
    18: "두성/연결", 19: "두성/연결", 20: "두성/연결", 21: "두성/연결", 22: "두성/연결",
    23: "고음/표현", 24: "고음/표현", 25: "고음/표현", 26: "고음/표현",
    27: "실가창", 28: "실가창",
}

# 상태 추적
synth_cache: dict[int, bytes] = {}
saved_urls: dict[int, str] = {}

app = FastAPI()

# 참조 오디오 미리 로드
_ref_b64: str = ""
def _get_ref() -> str:
    global _ref_b64
    if not _ref_b64:
        with open(REF_WAV, "rb") as f:
            _ref_b64 = base64.b64encode(f.read()).decode("ascii")
    return _ref_b64


class SynthRequest(BaseModel):
    stage_id: int
    text: str


class SaveRequest(BaseModel):
    stage_id: int


@app.get("/", response_class=HTMLResponse)
async def index():
    cards_html = ""
    for sid in sorted(WHY_TEXTS.keys()):
        name = STAGE_NAMES.get(sid, f"Stage {sid}")
        block = BLOCK_NAMES.get(sid, "")
        text = WHY_TEXTS[sid]
        status = "saved" if sid in saved_urls else ("ready" if sid in synth_cache else "idle")
        status_label = {"idle": "", "ready": "합성완료", "saved": "저장완료"}[status]
        status_color = {"idle": "#666", "ready": "#f59e0b", "saved": "#22c55e"}[status]

        cards_html += f"""
        <div class="card" id="card-{sid}" data-status="{status}">
          <div class="card-header">
            <span class="stage-num">{sid}</span>
            <span class="stage-name">{name}</span>
            <span class="block-name">{block}</span>
            <span class="status-badge" id="status-{sid}" style="background:{status_color}">{status_label}</span>
          </div>
          <textarea id="text-{sid}" rows="4">{text}</textarea>
          <div class="card-actions">
            <button class="btn btn-synth" onclick="synthesize({sid})" id="btn-synth-{sid}">합성</button>
            <div class="audio-wrap" id="audio-wrap-{sid}" style="display:none">
              <audio id="audio-{sid}" controls></audio>
            </div>
            <button class="btn btn-save" onclick="save({sid})" id="btn-save-{sid}" disabled>저장</button>
          </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>WhyText TTS Manager</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Pretendard',sans-serif; background:#0f0f0f; color:#e0e0e0; padding:20px 40px; }}
  h1 {{ text-align:center; margin-bottom:8px; font-size:24px; color:#fff; }}
  .subtitle {{ text-align:center; color:#888; margin-bottom:24px; font-size:14px; }}
  .top-actions {{ display:flex; justify-content:center; gap:12px; margin-bottom:24px; }}
  .top-actions button {{ padding:10px 24px; border:none; border-radius:8px; font-size:14px; cursor:pointer; font-weight:600; }}
  .btn-all-synth {{ background:#3b82f6; color:#fff; }}
  .btn-all-save {{ background:#22c55e; color:#fff; }}
  .btn-all-synth:hover {{ background:#2563eb; }}
  .btn-all-save:hover {{ background:#16a34a; }}
  .progress {{ text-align:center; margin-bottom:16px; font-size:14px; color:#aaa; }}
  .grid {{ display:grid; grid-template-columns:1fr; gap:16px; max-width:800px; margin:0 auto; }}
  .card {{ background:#1a1a1a; border:1px solid #333; border-radius:12px; padding:16px; }}
  .card[data-status="saved"] {{ border-color:#22c55e44; }}
  .card[data-status="ready"] {{ border-color:#f59e0b44; }}
  .card-header {{ display:flex; align-items:center; gap:8px; margin-bottom:10px; }}
  .stage-num {{ background:#3b82f6; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; }}
  .stage-name {{ font-weight:600; font-size:15px; }}
  .block-name {{ color:#888; font-size:12px; }}
  .status-badge {{ margin-left:auto; padding:2px 8px; border-radius:10px; font-size:11px; color:#fff; }}
  textarea {{ width:100%; background:#111; color:#ddd; border:1px solid #333; border-radius:8px; padding:10px; font-size:14px; line-height:1.6; resize:vertical; }}
  textarea:focus {{ outline:none; border-color:#3b82f6; }}
  .card-actions {{ display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap; }}
  .btn {{ padding:8px 18px; border:none; border-radius:8px; font-size:13px; cursor:pointer; font-weight:600; }}
  .btn:disabled {{ opacity:0.4; cursor:default; }}
  .btn-synth {{ background:#3b82f6; color:#fff; }}
  .btn-synth:hover:not(:disabled) {{ background:#2563eb; }}
  .btn-save {{ background:#22c55e; color:#fff; }}
  .btn-save:hover:not(:disabled) {{ background:#16a34a; }}
  .audio-wrap {{ flex:1; min-width:200px; }}
  audio {{ width:100%; height:36px; }}
  .spinner {{ display:inline-block; width:16px; height:16px; border:2px solid #fff4; border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; vertical-align:middle; margin-right:6px; }}
  @keyframes spin {{ to {{ transform:rotate(360deg); }} }}
</style>
</head>
<body>
  <h1>WhyText TTS Manager</h1>
  <p class="subtitle">28단계 whyText를 마스터 목소리로 합성하고 저장합니다</p>

  <div class="top-actions">
    <button class="btn-all-synth" onclick="synthesizeAll()">전체 합성</button>
    <button class="btn-all-save" onclick="saveAll()">전체 저장</button>
  </div>
  <div class="progress" id="progress"></div>

  <div class="grid">{cards_html}</div>

<script>
async function synthesize(sid) {{
  const btn = document.getElementById('btn-synth-' + sid);
  const text = document.getElementById('text-' + sid).value.trim();
  if (!text) return alert('텍스트가 비어있습니다');

  btn.innerHTML = '<span class="spinner"></span>합성중...';
  btn.disabled = true;

  try {{
    const res = await fetch('/api/synthesize', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ stage_id: sid, text }})
    }});
    if (!res.ok) {{
      const err = await res.json();
      throw new Error(err.detail || 'Failed');
    }}
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audioWrap = document.getElementById('audio-wrap-' + sid);
    const audio = document.getElementById('audio-' + sid);
    audio.src = url;
    audioWrap.style.display = 'block';

    document.getElementById('btn-save-' + sid).disabled = false;
    const badge = document.getElementById('status-' + sid);
    badge.textContent = '합성완료';
    badge.style.background = '#f59e0b';
    document.getElementById('card-' + sid).dataset.status = 'ready';
  }} catch (e) {{
    alert('합성 실패: ' + e.message);
  }} finally {{
    btn.innerHTML = '합성';
    btn.disabled = false;
  }}
}}

async function save(sid) {{
  const btn = document.getElementById('btn-save-' + sid);
  btn.innerHTML = '<span class="spinner"></span>저장중...';
  btn.disabled = true;

  try {{
    const res = await fetch('/api/save', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ stage_id: sid }})
    }});
    if (!res.ok) {{
      const err = await res.json();
      throw new Error(err.detail || 'Failed');
    }}
    const data = await res.json();
    const badge = document.getElementById('status-' + sid);
    badge.textContent = '저장완료';
    badge.style.background = '#22c55e';
    document.getElementById('card-' + sid).dataset.status = 'saved';
  }} catch (e) {{
    alert('저장 실패: ' + e.message);
    btn.disabled = false;
  }} finally {{
    btn.innerHTML = '저장';
  }}
}}

async function synthesizeAll() {{
  const ids = {json.dumps(sorted(WHY_TEXTS.keys()))};
  const prog = document.getElementById('progress');
  for (let i = 0; i < ids.length; i++) {{
    prog.textContent = `합성 중... ${{i+1}}/${{ids.length}}`;
    await synthesize(ids[i]);
    await new Promise(r => setTimeout(r, 500));
  }}
  prog.textContent = '전체 합성 완료!';
}}

async function saveAll() {{
  const cards = document.querySelectorAll('.card[data-status="ready"]');
  const prog = document.getElementById('progress');
  let i = 0;
  for (const card of cards) {{
    const sid = parseInt(card.id.replace('card-', ''));
    prog.textContent = `저장 중... ${{++i}}/${{cards.length}}`;
    await save(sid);
    await new Promise(r => setTimeout(r, 300));
  }}
  prog.textContent = cards.length ? '전체 저장 완료!' : '저장할 항목 없음 (먼저 합성하세요)';
}}
</script>
</body>
</html>"""


@app.post("/api/synthesize")
async def api_synthesize(req: SynthRequest):
    if not API_KEY:
        raise HTTPException(500, "RUNWARE_API_KEY not set")

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    })

    payload = [
        {
            "taskType": "audioInference",
            "taskUUID": str(uuid.uuid4()),
            "model": MODEL,
            "speech": {
                "text": req.text,
                "voice": "clone",
                "language": "Korean",
                "speed": 1.0,
            },
            "settings": {
                "transcript": REF_TRANSCRIPT,
                "xVectorOnly": False,
                "maxNewTokens": 2048,
            },
            "inputs": {
                "audio": _get_ref(),
            },
            "audioSettings": {
                "channels": 1,
                "sampleRate": 48000,
                "bitrate": 192,
            },
            "outputType": "base64Data",
            "outputFormat": "MP3",
        }
    ]

    try:
        resp = session.post(API_URL, json=payload, timeout=(10, 120))
        resp.raise_for_status()
        result = resp.json()
    except requests.RequestException as e:
        raise HTTPException(502, f"Runware error: {e}")

    errors = result.get("errors", []) if isinstance(result, dict) else []
    if errors:
        raise HTTPException(502, errors[0].get("message", str(errors[0])))

    data_list = result.get("data", []) if isinstance(result, dict) else result
    data = data_list[0] if isinstance(data_list, list) and data_list else result

    audio_b64 = data.get("audioBase64Data") or data.get("audioURL", "")
    if not audio_b64:
        raise HTTPException(502, "No audio in response")

    if audio_b64.startswith("http"):
        r = session.get(audio_b64, timeout=(10, 60))
        r.raise_for_status()
        audio_bytes = r.content
    else:
        audio_bytes = base64.b64decode(audio_b64)

    # 로컬 저장 + 캐시
    out_file = OUTPUT_DIR / f"stage_{req.stage_id}.mp3"
    out_file.write_bytes(audio_bytes)
    synth_cache[req.stage_id] = audio_bytes

    return Response(content=audio_bytes, media_type="audio/mpeg")


@app.post("/api/save")
async def api_save(req: SaveRequest):
    if req.stage_id not in synth_cache:
        raise HTTPException(400, "Not synthesized yet")
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Supabase keys not set")

    audio_bytes = synth_cache[req.stage_id]
    storage_path = f"{STORAGE_PREFIX}/stage_{req.stage_id}.mp3"
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"

    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "audio/mpeg",
            "x-upsert": "true",
        },
        data=audio_bytes,
        timeout=(10, 30),
    )
    resp.raise_for_status()

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{storage_path}"
    saved_urls[req.stage_id] = public_url

    # URL 매핑 저장
    url_file = PROJECT_ROOT / "scripts" / "why_audio_urls.json"
    with open(url_file, "w", encoding="utf-8") as f:
        json.dump({str(k): v for k, v in sorted(saved_urls.items())}, f, ensure_ascii=False, indent=2)

    return {"url": public_url}


if __name__ == "__main__":
    if not API_KEY:
        print("WARNING: RUNWARE_API_KEY not set")
    if not REF_WAV.exists():
        print(f"ERROR: Ref file not found: {REF_WAV}")
        sys.exit(1)
    print(f"\n  http://localhost:9090\n")
    uvicorn.run(app, host="0.0.0.0", port=9090)
