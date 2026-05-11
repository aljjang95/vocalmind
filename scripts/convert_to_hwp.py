"""
docx → hwp 변환 (한컴 오피스 OLE Automation 사용).
한컴 오피스가 설치되어 있어야 함.
"""
from __future__ import annotations
from pathlib import Path
import win32com.client
import time


SRC = Path(r"C:/Users/Administrator/Desktop/보컬마인드_강한소상공인/보컬마인드_강한소상공인_사업계획서.docx")
DST = Path(r"C:/Users/Administrator/Desktop/보컬마인드_강한소상공인/보컬마인드_강한소상공인_사업계획서.hwp")


def convert() -> None:
    print(f"[*] 한컴 오피스 OLE 시작...")
    hwp = win32com.client.Dispatch("HWPFrame.HwpObject")

    try:
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
    except Exception:
        pass

    hwp.XHwpWindows.Item(0).Visible = False

    print(f"[*] docx 열기: {SRC.name}")
    ok = hwp.Open(str(SRC), "", "")
    if not ok:
        raise RuntimeError("docx 열기 실패")

    print(f"[*] hwp 저장: {DST.name}")
    hwp.SaveAs(str(DST), "HWP", "")
    time.sleep(1)

    hwp.Clear(3)
    hwp.Quit()
    print(f"[OK] -> {DST}")
    print(f"      {DST.stat().st_size:,} bytes")


if __name__ == "__main__":
    convert()
