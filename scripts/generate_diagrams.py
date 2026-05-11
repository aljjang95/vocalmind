"""
보컬마인드 사업계획서용 시각자료 5종 생성.
출력: C:/Users/Administrator/Desktop/보컬마인드_시각자료/*.png
"""
from __future__ import annotations
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np


OUT = Path(r"C:/Users/Administrator/Desktop/보컬마인드_시각자료")
OUT.mkdir(parents=True, exist_ok=True)

plt.rcParams["font.family"] = ["Pretendard", "Malgun Gothic", "NanumGothic", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False
plt.rcParams["figure.facecolor"] = "white"
plt.rcParams["axes.facecolor"] = "white"

NAVY = "#1F3A5F"
GOLD = "#D4A656"
SOFT = "#E8EEF5"
GRAY = "#888888"
RED = "#C0392B"
GREEN = "#27AE60"


def diagram_radar() -> None:
    """4축 긴장 레이더 차트 — 사용자 vs 정상 범위."""
    labels = ["후두 긴장\n(Jitter·Shimmer·HNR)",
              "혀뿌리 긴장\n(F1·F2 포먼트)",
              "턱 긴장\n(VSA 모음 공간)",
              "성구 전환\n(F0 smoothness)",
              "종합 긴장도"]
    user_score = [72, 65, 58, 70, 66]
    healthy = [25, 20, 18, 22, 21]

    angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False).tolist()
    user_score += user_score[:1]
    healthy += healthy[:1]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(8, 7), subplot_kw=dict(polar=True))
    ax.plot(angles, user_score, color=RED, linewidth=2, label="진단 결과 (현재)")
    ax.fill(angles, user_score, color=RED, alpha=0.15)
    ax.plot(angles, healthy, color=GREEN, linewidth=2, label="정상 범위")
    ax.fill(angles, healthy, color=GREEN, alpha=0.10)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, size=10)
    ax.set_yticks([20, 40, 60, 80])
    ax.set_yticklabels(["20", "40", "60", "80"], size=8, color=GRAY)
    ax.set_ylim(0, 100)
    ax.set_title("발성 4축 긴장 정량 진단 시각화", size=14, weight="bold", color=NAVY, pad=20)
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.10))
    ax.grid(color=GRAY, alpha=0.25)
    plt.tight_layout()
    plt.savefig(OUT / "01_radar_4axis.png", dpi=160, bbox_inches="tight")
    plt.close()


def diagram_architecture() -> None:
    """시스템 아키텍처 — 4계층 박스 다이어그램."""
    fig, ax = plt.subplots(figsize=(11, 7.5))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")

    layers = [
        (78, "Frontend (Vercel)",
         "Next.js 14 · React 18 · TypeScript · Zustand · Tailwind",
         "#3F75B0"),
        (58, "Backend (Fly.io · 도쿄 리전)",
         "Python 3.12 · FastAPI · parselmouth · ChromaDB · 백엔드 자동화 테스트 379개",
         NAVY),
        (38, "AI 인프라",
         "Anthropic Claude Haiku · Runware (FLUX·HunyuanVideo·LatentSync) · Modal Labs T4 GPU 3개",
         "#8B6BB1"),
        (18, "데이터·결제",
         "Supabase (Auth·DB·Storage·Realtime·RLS 7정책) · 토스페이먼츠 (선불 크레딧)",
         GOLD),
    ]

    for y, title, sub, color in layers:
        box = FancyBboxPatch((6, y), 88, 14,
                             boxstyle="round,pad=0.4,rounding_size=1.2",
                             facecolor=color, edgecolor="white", linewidth=2)
        ax.add_patch(box)
        ax.text(50, y + 9, title, ha="center", va="center",
                size=13, weight="bold", color="white")
        ax.text(50, y + 3.5, sub, ha="center", va="center",
                size=9, color="white", alpha=0.95)

    for y in (76, 56, 36):
        ax.annotate("", xy=(50, y - 2), xytext=(50, y),
                    arrowprops=dict(arrowstyle="->", color=GRAY, lw=1.5))

    ax.text(50, 96, "보컬마인드 시스템 아키텍처",
            ha="center", size=16, weight="bold", color=NAVY)
    ax.text(50, 92, "1인 풀스택 운영 — Frontend · Backend · AI · 데이터 4계층",
            ha="center", size=10, color=GRAY)

    plt.savefig(OUT / "02_architecture.png", dpi=160, bbox_inches="tight")
    plt.close()


def diagram_value_chain() -> None:
    """Value Chain — 사용자 여정 흐름도."""
    fig, ax = plt.subplots(figsize=(13, 6))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")

    steps = [
        (8, "회원가입 +\nVoice Identity\n10문장 등록", NAVY),
        (24, "본인 MR\n업로드 +\n가이드 녹음", "#3F75B0"),
        (42, "AI 4축\n긴장 진단 +\nClaude 코칭", "#8B6BB1"),
        (60, "AI 스튜디오\n(Demucs→RVC→\nFLUX→HunyuanVideo)", GOLD),
        (78, "C2PA 워터마크\n+ 모더레이션", "#C26A4F"),
        (94, "MV 다운로드\n(16:9 / 9:16)", GREEN),
    ]

    for x, label, color in steps:
        box = FancyBboxPatch((x - 7, 50), 14, 24,
                             boxstyle="round,pad=0.3,rounding_size=1.0",
                             facecolor=color, edgecolor="white", linewidth=2)
        ax.add_patch(box)
        ax.text(x, 62, label, ha="center", va="center",
                size=9, weight="bold", color="white")

    for i in range(len(steps) - 1):
        x1 = steps[i][0] + 7.5
        x2 = steps[i + 1][0] - 7.5
        ax.annotate("", xy=(x2, 62), xytext=(x1, 62),
                    arrowprops=dict(arrowstyle="->", color=GRAY, lw=1.8))

    ax.text(50, 92, "보컬마인드 Value Chain",
            ha="center", size=16, weight="bold", color=NAVY)
    ax.text(50, 88, "본인 MR + AI 진단 + 음색 클로닝 + 영상 생성을 6단계 자동 파이프라인으로",
            ha="center", size=10, color=GRAY)

    box = FancyBboxPatch((20, 18), 60, 22,
                         boxstyle="round,pad=0.5,rounding_size=1.5",
                         facecolor=SOFT, edgecolor=NAVY, linewidth=1.5,
                         linestyle="--")
    ax.add_patch(box)
    ax.text(50, 33, "[ 선택 경로 — 1인 보컬강사 매칭 ]",
            ha="center", size=11, weight="bold", color=NAVY)
    ax.text(50, 25, "AI 진단 데이터 공유 → 강사 본 수업 → 매칭 수수료 20%",
            ha="center", size=10, color=NAVY)

    ax.annotate("", xy=(50, 40), xytext=(50, 50),
                arrowprops=dict(arrowstyle="->", color=GRAY, lw=1.5,
                                linestyle="--"))

    plt.savefig(OUT / "03_value_chain.png", dpi=160, bbox_inches="tight")
    plt.close()


def diagram_budget() -> None:
    """1억 원 자금 사용 도넛 차트."""
    labels = [
        "Modal GPU + Runware API\n(3,000만 원)",
        "강사 파트너 인센티브\n(2,000만 원)",
        "인플루언서 마케팅\n(2,000만 원)",
        "다국어화 + 글로벌 결제\n(1,500만 원)",
        "특허·상표·법무\n(1,000만 원)",
        "운영 안전망\n(500만 원)",
    ]
    sizes = [30, 20, 20, 15, 10, 5]
    colors = [NAVY, GOLD, "#3F75B0", "#8B6BB1", "#C26A4F", GREEN]

    fig, ax = plt.subplots(figsize=(10, 7.5))
    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        colors=colors,
        autopct="%1.0f%%",
        startangle=90,
        pctdistance=0.78,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
        textprops=dict(size=10, color=NAVY),
    )
    for autotext in autotexts:
        autotext.set_color("white")
        autotext.set_weight("bold")
        autotext.set_size(11)

    ax.text(0, 0.05, "총 1억 원", ha="center", va="center",
            size=20, weight="bold", color=NAVY)
    ax.text(0, -0.10, "(3단계 통과 시)", ha="center", va="center",
            size=10, color=GRAY)

    ax.set_title("성장지원자금 + 사업화자금 사용 계획",
                 size=15, weight="bold", color=NAVY, pad=20)
    plt.savefig(OUT / "04_budget_donut.png", dpi=160, bbox_inches="tight")
    plt.close()


def diagram_revenue() -> None:
    """24개월 매출 성장 시뮬레이션."""
    months = list(range(1, 25))
    revenue = []
    for m in months:
        if m <= 3:
            r = m * 33
        elif m <= 9:
            r = 100 + (m - 3) * 150
        else:
            r = 1000 + (m - 9) * 270
        revenue.append(r)

    users = []
    for m in months:
        if m <= 3:
            u = m * 33
        elif m <= 9:
            u = 100 + (m - 3) * 800
        else:
            u = 5000 + (m - 9) * 1000
        users.append(u)

    fig, ax1 = plt.subplots(figsize=(12, 6.5))
    ax2 = ax1.twinx()

    ax1.fill_between(months, revenue, color=NAVY, alpha=0.15)
    ax1.plot(months, revenue, color=NAVY, lw=3, marker="o", markersize=5,
             label="월 매출 (만 원)")
    ax1.set_xlabel("개월차", size=11, color=NAVY)
    ax1.set_ylabel("월 매출 (만 원)", size=11, color=NAVY)
    ax1.tick_params(axis="y", labelcolor=NAVY)
    ax1.set_xticks([1, 3, 6, 9, 12, 18, 24])
    ax1.set_ylim(0, max(revenue) * 1.18)
    ax1.grid(alpha=0.25)

    ax2.plot(months, users, color=GOLD, lw=2.5, marker="s", markersize=4,
             linestyle="--", label="누적 사용자 (명)")
    ax2.set_ylabel("누적 사용자 (명)", size=11, color=GOLD)
    ax2.tick_params(axis="y", labelcolor=GOLD)
    ax2.set_ylim(0, max(users) * 1.18)

    ax1.axvspan(0.5, 3.5, color=GREEN, alpha=0.08)
    ax1.axvspan(3.5, 9.5, color=GOLD, alpha=0.08)
    ax1.axvspan(9.5, 24.5, color=NAVY, alpha=0.08)

    y_top = ax1.get_ylim()[1] * 0.93
    ax1.text(2, y_top, "단기\n(베타)",
             ha="center", va="top", size=9, color=GREEN, weight="bold")
    ax1.text(6.5, y_top, "중기\n(Phase 1 확장)",
             ha="center", va="top", size=9, color=GOLD, weight="bold")
    ax1.text(17, y_top, "장기 (Phase 2 글로벌 · B2B)",
             ha="center", va="top", size=9, color=NAVY, weight="bold")

    ax1.set_title("24개월 매출·사용자 성장 시뮬레이션",
                  size=15, weight="bold", color=NAVY, pad=20)
    fig.legend(loc="upper left", bbox_to_anchor=(0.13, 0.88), framealpha=0.95)
    plt.tight_layout()
    plt.savefig(OUT / "05_revenue_growth.png", dpi=160, bbox_inches="tight")
    plt.close()


def main() -> None:
    diagram_radar()
    diagram_architecture()
    diagram_value_chain()
    diagram_budget()
    diagram_revenue()
    print(f"OK -> {OUT}")
    for p in sorted(OUT.glob("*.png")):
        print(f"  {p.name}  ({p.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
