"""
VocalMind Modal - 사전학습 모델 다운로드 및 관리
RVC v2 사전학습 Generator/Discriminator 가중치를 HuggingFace에서 다운로드한다.
Modal Volume /models/rvc/ 경로에 저장한다.
"""

import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

# Modal Volume 기반 모델 저장 경로
RVC_MODELS_DIR = Path("/models/rvc")
PRETRAINED_DIR = RVC_MODELS_DIR / "pretrained_v2"

# HuggingFace 다운로드 URL (RVC 공식)
PRETRAINED_URLS = {
    "G40k": "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/pretrained_v2/f0G40k.pth",
    "D40k": "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/pretrained_v2/f0D40k.pth",
}

PRETRAINED_FILES = {
    "G40k": PRETRAINED_DIR / "f0G40k.pth",
    "D40k": PRETRAINED_DIR / "f0D40k.pth",
}


def _download_file(url: str, dest_path: Path, desc: str = "다운로드 중") -> Path:
    """URL에서 파일을 다운로드한다. 이미 존재하면 건너뛴다."""
    if dest_path.exists():
        logger.info("이미 존재하는 파일 사용: %s", dest_path)
        return dest_path

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("%s: %s -> %s", desc, url, dest_path)

    try:
        from huggingface_hub import hf_hub_download

        if "huggingface.co" in url and "/resolve/" in url:
            parts = url.split("huggingface.co/")[1]
            repo_parts = parts.split("/resolve/")
            repo_id = repo_parts[0]
            filename = repo_parts[1].split("/", 1)[1]

            downloaded = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                local_dir=str(dest_path.parent),
                local_dir_use_symlinks=False,
            )
            downloaded_path = Path(downloaded)
            if downloaded_path != dest_path:
                shutil.move(str(downloaded_path), str(dest_path))
            logger.info("huggingface_hub로 다운로드 완료: %s", dest_path)
            return dest_path
    except ImportError:
        logger.debug("huggingface_hub 미설치, urllib로 폴백")
    except Exception as e:
        logger.warning("huggingface_hub 다운로드 실패, urllib로 폴백: %s", e)

    try:
        import urllib.request

        tmp_path = dest_path.with_suffix(".tmp")
        urllib.request.urlretrieve(url, str(tmp_path))
        shutil.move(str(tmp_path), str(dest_path))
        logger.info("다운로드 완료: %s", dest_path)
    except Exception as e:
        tmp_path = dest_path.with_suffix(".tmp")
        if tmp_path.exists():
            tmp_path.unlink()
        raise RuntimeError(f"파일 다운로드 실패 ({desc}): {e}") from e

    return dest_path


def ensure_pretrained_models() -> dict[str, Path]:
    """
    사전학습 G/D 모델이 존재하는지 확인하고, 없으면 다운로드한다.

    Returns:
        {"G40k": Path, "D40k": Path}
    """
    PRETRAINED_DIR.mkdir(parents=True, exist_ok=True)

    paths = {}
    for key, url in PRETRAINED_URLS.items():
        dest = PRETRAINED_FILES[key]
        _download_file(url, dest, f"사전학습 모델 다운로드 ({key})")
        paths[key] = dest
        logger.info("사전학습 모델 준비 완료: %s -> %s", key, dest)

    return paths


def get_pretrained_g_path(sr: int = 40000) -> Path:
    """사전학습 Generator 경로를 반환한다."""
    key = f"G{sr // 1000}k"
    path = PRETRAINED_FILES.get(key)
    if path is None or not path.exists():
        ensure_pretrained_models()
        path = PRETRAINED_FILES[key]
    return path


def get_pretrained_d_path(sr: int = 40000) -> Path:
    """사전학습 Discriminator 경로를 반환한다."""
    key = f"D{sr // 1000}k"
    path = PRETRAINED_FILES.get(key)
    if path is None or not path.exists():
        ensure_pretrained_models()
        path = PRETRAINED_FILES[key]
    return path
