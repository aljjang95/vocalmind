"""Backwards-compat re-exporter — 실제 구현은 analyzers/ 참조.

기존 import 유지:
    from services.tension_analyzer import analyze_tension, _safe
"""
from __future__ import annotations
from analyzers import analyze_tension
from analyzers.utils import safe as _safe

__all__ = ["analyze_tension", "_safe"]
