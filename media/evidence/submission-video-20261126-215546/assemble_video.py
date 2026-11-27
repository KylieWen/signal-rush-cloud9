#!/usr/bin/env python3
"""Assemble the 160-second Signal Rush local submission draft.

The script uses only the project's existing demo, screenshots, source text, and
JetBrains evidence. It does not record new gameplay, synthesize narration, modify
source files, upload anything, or publish anything.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

WIDTH = 1280
HEIGHT = 720
FPS = 30
DURATION = 160
TOTAL_FRAMES = DURATION * FPS


@dataclass(frozen=True)
class Clip:
    name: str
    kind: str
    duration: int
    source: str = ""
    source_start: float = 0.0


CLIPS = [
    Clip("01-title-demo", "demo", 4, "media/signal-rush-demo.mp4", 0),
    Clip("02-title-card", "solid", 4),
    Clip("03-method-start", "demo", 3, "media/signal-rush-demo.mp4", 4),
    Clip("04-method-screenshot", "portrait", 9, "media/01-start.png"),
    Clip("05-gameplay-demo", "demo", 10, "media/signal-rush-demo.mp4", 7),
    Clip("06-scoring-screenshot", "portrait", 14, "media/02-gameplay.png"),
    Clip("07-results-demo", "demo", 7, "media/signal-rush-demo.mp4", 18),
    Clip("08-results-screenshot", "portrait", 5, "media/03-results.png"),
    Clip("09-leaderboard-demo", "demo", 7, "media/signal-rush-demo.mp4", 25),
    Clip("10-leaderboard-screenshot", "portrait", 5, "media/04-leaderboard.png"),
    Clip("11-booth-demo", "demo", 7, "media/signal-rush-demo.mp4", 32),
    Clip("12-booth-screenshot", "portrait", 5, "media/05-booth-display.png"),
    Clip("13-booth-method-demo", "demo", 5, "media/signal-rush-demo.mp4", 39),
    Clip("14-booth-method-screenshot", "portrait", 7, "media/05-booth-display.png"),
    Clip("15-accessibility", "portrait", 14, "media/01-start.png"),
    Clip("16-engineering", "solid", 10),
    Clip("17-ide-version", "solid", 5),
    Clip("18-ide-before", "solid", 5),
    Clip("19-ide-after", "solid", 4),
    Clip("20-tests", "solid", 10),
    Clip("21-offline-original", "portrait", 12, "media/05-booth-display.png"),
    Clip("22-closing", "blur", 8, "media/02-gameplay.png"),
]

# Output start, output end, source start, source end. Used to retain the supplied
# demo's existing audio at the same timeline positions. The source is effectively
# silent, but its audio is preserved rather than replaced with invented sound.
DEMO_AUDIO = [
    (0, 4, 0, 4),
    (8, 11, 4, 7),
    (20, 30, 7, 17),
    (44, 51, 18, 25),
    (56, 63, 25, 32),
    (68, 75, 32, 39),
    (80, 85, 39, 44),
]

# Bilingual bottom captions. These are also written as an editable SRT file.
CAPTIONS = [
    (0, 4, "45-second reaction arcade for event booths.", "45 秒反应街机，为现场摊位快速轮换而设计。"),
    (4, 8, "Edited only from the supplied demo, screenshots and evidence.", "仅使用已有 Demo、截图与证据剪辑；未补录新游戏结果。"),
    (8, 12, "Start with one click or tap.", "点击或轻触即可开始。"),
    (12, 16, "No login, installation or API key.", "无需登录、安装或 API Key。"),
    (16, 20, "Every run is 45 seconds; results appear immediately.", "每局固定 45 秒，结算即时可见。"),
    (20, 25, "Catch cyan signals; collect blue bonuses; avoid red noise.", "接住青色信号，收集蓝色奖励，避开红色噪声。"),
    (25, 30, "The supplied demo shows the actual game screen and HUD.", "已有 Demo 展示真实游戏画面与 HUD。"),
    (30, 35, "Sustained streaks unlock 1.5x, 2x, 3x and 4x.", "连续命中逐步解锁 1.5、2、3、4 倍。"),
    (35, 40, "Misses subtract 25; noise subtracts 75.", "空点扣 25 分，噪声扣 75 分。"),
    (40, 44, "Short rounds keep booth lines moving.", "短局循环让摊位排队持续流动。"),
    (44, 49, "Score, grade, accuracy, best streak and local rank.", "等级、分数、准确率、最佳连击与本地排名一次呈现。"),
    (49, 53, "This supplied demo run scored 000600 with 100% accuracy.", "已有 Demo 该局分数 000600，准确率 100%。"),
    (53, 56, "One click returns to the next run.", "一键再来，立即开始下一局。"),
    (56, 61, "Top ten runs stay on this device.", "本地前十保存在同一设备。"),
    (61, 68, "No account, server or Wi-Fi is required.", "无需账号、服务器或 Wi-Fi。"),
    (68, 73, "A separate display mirrors the local leaderboard.", "独立屏幕实时镜像本地排行榜。"),
    (73, 78, "Booth mode is designed to reset 15 seconds after a run.", "Booth 模式在每局结束后 15 秒自动重置。"),
    (78, 83, "The countdown pauses while the leaderboard is open.", "打开排行榜时，倒计时暂停。"),
    (83, 88, "One device can run play and display together.", "同一设备可同时运行游戏与排行榜显示。"),
    (88, 92, "This is a local board, not a cross-device network ranking.", "排行榜仅限本机，并非跨设备网络排行榜。"),
    (92, 97, "Arrow keys select; Space or Enter locks a target.", "方向键选择，空格或回车锁定。"),
    (97, 101, "P or Escape pauses; M toggles sound.", "P 或 Esc 暂停，M 切换声音。"),
    (101, 106, "Reduced motion, focus, contrast and live status are included.", "提供减少动态、可见焦点、高对比与状态播报。"),
    (106, 111, "A deterministic core owns scoring, timing and round state.", "确定性核心统一管理计分、计时与回合状态。"),
    (111, 116, "Rendering, audio, input and storage stay separate.", "渲染、音频、输入与存储保持分离。"),
    (116, 120, "Project inspected with IntelliJ IDEA 2025.3.", "项目使用 IntelliJ IDEA 2025.3 检查。"),
    (120, 124, "The IDE found a CSS variable and two lifecycle promises.", "IDE 发现 CSS 变量与两个生命周期 Promise 问题。"),
    (124, 127, "Both issue types were fixed; final source findings: 0.", "两类问题均已修复；最终源码问题为 0。"),
    (127, 130, "Environment warnings are listed separately, not counted as source findings.", "环境警告单独注明，不计为源码问题。"),
    (130, 134, "All 26 Node tests passed in this assembly run.", "本次剪辑时运行 Node 测试，26 项全部通过。"),
    (134, 138, "Coverage includes input, scoring, pause, persistence and corrupt storage.", "覆盖输入、计分、暂停、持久化与损坏存储。"),
    (138, 140, "Includes a 100-round booth reset stress test.", "包含 100 局 Booth 连续重置压力测试。"),
    (140, 145, "After first load, the app shell supports offline reload.", "首次加载后，应用外壳支持离线重载。"),
    (145, 149, "Artwork and sound are original; no external assets or trackers.", "图形与音效均为原创，无外部素材或追踪器。"),
    (149, 152, "MIT licensed and documented for local startup.", "采用 MIT 许可，附本地启动说明。"),
    (152, 156, "Simple controls. Short rounds. High-score rematches.", "简单操作，短局循环，高分复玩。"),
    (156, 160, "Run instructions and evidence are in the submission package.", "启动说明与完整证据均在提交包中。"),
]


def run(command: list[str | Path], *, cwd: Path | None = None, log_path: Path | None = None) -> str:
    proc = subprocess.run(
        [str(part) for part in command],
        cwd=str(cwd) if cwd else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if log_path is not None:
        log_path.write_text(proc.stdout, encoding="utf-8")
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}):\n{' '.join(map(str, command))}\n\n{proc.stdout}")
    return proc.stdout


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_sources(project: Path, output_dir: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for path in sorted(project.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(project)
        if any(part in {".git", ".idea", "__pycache__", "node_modules"} for part in rel.parts):
            continue
        if path.is_relative_to(output_dir):
            continue
        result[rel.as_posix()] = sha256_file(path)
    return result


def write_hash_list(path: Path, hashes: dict[str, str]) -> None:
    lines = [f"{digest}  {name}" for name, digest in sorted(hashes.items())]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def probe(path: Path, ffprobe: Path, *, count_frames: bool = False) -> dict:
    command = [ffprobe, "-v", "error"]
    if count_frames:
        command.append("-count_frames")
    command += ["-show_streams", "-show_format", "-of", "json", str(path)]
    return json.loads(run(command))


def ass_time(seconds: float) -> str:
    centiseconds = int(round(seconds * 100))
    hours, remainder = divmod(centiseconds, 360000)
    minutes, remainder = divmod(remainder, 6000)
    secs, cs = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"


def srt_time(seconds: float) -> str:
    milliseconds = int(round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def make_subtitles(output_dir: Path, test_duration_ms: str) -> tuple[Path, Path]:
    styles = """[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,23,&H00FFFFFF,&H000000FF,&H00101820,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,50,50,20,1
Style: Panel,Microsoft YaHei,10,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Section,Segoe UI,18,&H00F4E056,&H000000FF,&H00101820,&H00101820,1,0,0,0,100,100,1,0,3,6,0,7,44,40,24,1
Style: Badge,Segoe UI,13,&H00B8C4CE,&H000000FF,&H00101820,&H00101820,1,0,0,0,100,100,0,0,3,5,0,9,40,40,24,1
Style: CardTitle,Segoe UI,33,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: CardBody,Microsoft YaHei,23,&H00E6EEF3,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Small,Segoe UI,16,&H00B8C4CE,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Mono,Consolas,19,&H00DCE7ED,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Metric,Segoe UI,55,&H00F4E056,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Pass,Segoe UI,94,&H00F4E056,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: CenterTitle,Segoe UI,78,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1
Style: CenterAccent,Segoe UI,29,&H00F4E056,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1
Style: CenterBody,Microsoft YaHei,24,&H00E6EEF3,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: Subtitle,Microsoft YaHei,22,&H00FFFFFF,&H000000FF,&H00101820,&H00000000,0,0,0,0,100,100,0,0,3,9,0,2,54,54,18,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []

    def text(start: float, end: float, style: str, value: str, *, layer: int = 10,
             pos: tuple[float, float] | None = None, an: int | None = None,
             fade: bool = True) -> None:
        override = []
        if pos is not None:
            override.append(f"\\pos({pos[0]},{pos[1]})")
        if an is not None:
            override.append(f"\\an{an}")
        if fade:
            override.append("\\fad(220,220)")
        prefix = "{" + "".join(override) + "}" if override else ""
        events.append(
            f"Dialogue: 0,{ass_time(start)},{ass_time(end)},{style},,0,0,0,,"
            f"{prefix}{value}"
        )

    def rect(start: float, end: float, x: float, y: float, w: float, h: float,
             color: str = "0B1822", alpha: str = "38", layer: int = 0) -> None:
        drawing = (
            f"{{\\an7\\pos({x},{y})\\p1\\1c&H{color}&\\1a&H{alpha}&}}"
            f"m 0 0 l {w} 0 l {w} {h} l 0 {h}{{\\p0}}"
        )
        events.append(
            f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},Panel,,0,0,0,,{drawing}"
        )

    def section(start: float, end: float, label: str) -> None:
        text(start, end, "Section", label, layer=20, pos=(40, 18), fade=False)

    def badge(start: float, end: float, label: str = "SUPPLIED DEMO / 已有 DEMO") -> None:
        text(start, end, "Badge", label, layer=20, pos=(1240, 20), an=9, fade=False)

    def portrait_panel(start: float, end: float) -> None:
        rect(start, end, 28, 88, 636, 520, alpha="30")

    # Persistent bilingual captions.
    for start, end, english, chinese in CAPTIONS:
        text(start, end, "Subtitle", f"{english}\\N{chinese}", layer=30, fade=True)

    # 0:00-0:08 title. Let the supplied demo's own title breathe for the first
    # four seconds, then use a solid-color video background for the custom card.
    text(0, 8, "Section", "LOCAL SUBMISSION DRAFT / 本地参赛草案", layer=20, pos=(640, 54), an=8, fade=False)
    badge(0, 4)
    text(4, 8, "Badge", "TITLE CARD / 标题卡", layer=20, pos=(1240, 20), an=9, fade=False)
    text(4, 8, "CenterTitle", "SIGNAL RUSH", pos=(640, 266), fade=False)
    text(4, 8, "CenterAccent", "CATCH THE SIGNAL. BEAT THE NOISE.", pos=(640, 356), fade=False)
    text(4, 8, "CenterBody", "45 秒反应街机 · Cloud9 × JetBrains 2026", pos=(640, 414), fade=False)

    # 0:08-0:20 start and method.
    section(8, 20, "01 / START & METHOD")
    badge(8, 11)
    portrait_panel(11, 20)
    text(11, 20, "CardTitle", "One button. Zero setup.", pos=(58, 120))
    text(11, 20, "CardBody", "No login · no install · no API key\\N无需登录、安装或 API Key", pos=(58, 184))
    text(11, 20, "CardBody", "Mouse / touch / keyboard\\N鼠标、触屏、键盘均可操作", pos=(58, 262))
    text(11, 20, "CardBody", "Fixed 45-second rounds\\N每局固定 45 秒，成绩即时可见", pos=(58, 340))
    text(11, 20, "Mono", "python server.py --port 8010", pos=(58, 452))
    text(11, 20, "Small", "Local startup / 本地启动", pos=(58, 486))

    # 0:20-0:44 gameplay and scoring.
    section(20, 44, "02 / GAMEPLAY & SCORING")
    badge(20, 30)
    portrait_panel(30, 44)
    text(30, 44, "CardTitle", "Read the field. Build the streak.", pos=(58, 116))
    rows = [
        (180, "F4E056", "CYAN SIGNAL   +100\\N青色信号 +100"),
        (248, "F4B85A", "BLUE BONUS    +200\\N蓝色奖励 +200"),
        (316, "6882F4", "RED NOISE      -75\\N红色噪声 -75"),
        (384, "F4E056", "STREAK  4 / 9 / 16 / 25\\N连击解锁 1.5× / 2× / 3× / 4×"),
    ]
    for y, color, value in rows:
        rect(30, 44, 58, y + 4, 9, 48, color=color, alpha="00", layer=4)
        text(30, 44, "CardBody", value, pos=(84, y))
    text(30, 44, "Small", "Miss -25 · score never below 0\\N空点 -25 · 分数不低于 0", pos=(58, 500))

    # 0:44-0:56 results, using the supplied demo's actual values.
    section(44, 56, "03 / RESULTS")
    badge(44, 51)
    portrait_panel(51, 56)
    text(51, 56, "CardTitle", "Every run ends with evidence.", pos=(58, 118))
    text(51, 56, "Metric", "000600", pos=(58, 184))
    text(51, 56, "Small", "FINAL SCORE / 最终分数", pos=(60, 250))
    text(51, 56, "CardBody", "GRADE D · ACCURACY 100%\\N等级 D · 准确率 100%", pos=(58, 306))
    text(51, 56, "CardBody", "BEST STREAK 1 · LOCAL RANK #6\\N最佳连击 1 · 本地排名 #6", pos=(58, 382))
    text(51, 56, "Small", "Values from supplied demo / 数值来自已有 Demo", pos=(58, 500))

    # 0:56-1:08 local leaderboard.
    section(56, 68, "04 / LOCAL LEADERBOARD")
    badge(56, 63)
    portrait_panel(63, 68)
    text(63, 68, "CardTitle", "Local top ten. No account.", pos=(58, 120))
    text(63, 68, "CardBody", "Same device + same origin\\N同一设备、同一 origin", pos=(58, 194))
    text(63, 68, "CardBody", "Sanitized callsigns and bounded entries\\N清洗呼号并限制条目数量", pos=(58, 272))
    text(63, 68, "CardBody", "Sort: score → accuracy → timestamp\\N排序：分数 → 准确率 → 时间", pos=(58, 350))
    text(63, 68, "Small", "No backend or Wi-Fi / 无后端、无需 Wi-Fi", pos=(58, 500))

    # 1:08-1:32 Booth and separate display.
    section(68, 92, "05 / BOOTH & DISPLAY")
    badge(68, 75)
    badge(80, 85)
    for start, end in ((75, 80), (85, 92)):
        portrait_panel(start, end)
        text(start, end, "CardTitle", "Built for the booth.", pos=(58, 116))
        text(start, end, "CardBody", "15-second auto-reset after each run\\N每局结束后 15 秒自动重置", pos=(58, 184))
        text(start, end, "CardBody", "Countdown pauses while leaderboard is open\\N打开排行榜时倒计时暂停", pos=(58, 262))
        text(start, end, "CardBody", "Second screen mirrors local top ten\\N第二块屏幕镜像本地前十", pos=(58, 340))
        text(start, end, "Mono", "index.html?booth=1", pos=(58, 452))
        text(start, end, "Small", "Documented booth flow / 文档所述摊位流程", pos=(58, 490))

    # 1:32-1:46 accessibility and controls.
    section(92, 106, "06 / ACCESSIBILITY")
    portrait_panel(92, 106)
    text(92, 106, "CardTitle", "More than one way to play.", pos=(58, 116))
    text(92, 106, "CardBody", "← → select · Space / Enter lock\\N方向键选择 · 空格 / 回车锁定", pos=(58, 184))
    text(92, 106, "CardBody", "P / Esc pause · M sound\\NP / Esc 暂停 · M 切换声音", pos=(58, 252))
    text(92, 106, "CardBody", "Visible focus · reduced motion · high contrast\\N可见焦点 · 减少动态 · 高对比", pos=(58, 320))
    text(92, 106, "CardBody", "Live status announcements\\N状态播报", pos=(58, 388))
    text(92, 106, "Small", "Canvas is not fully screen-reader operable; keyboard selection\\Nand status announcements provide an alternative path.\\NCanvas 非完整屏幕阅读器可操作；键盘选择与状态播报提供替代路径。", pos=(58, 472))

    # 1:46-1:56 engineering method.
    section(106, 116, "07 / ENGINEERING METHOD")
    rect(106, 116, 46, 106, 6, 492, color="F4E056", alpha="00", layer=4)
    text(106, 116, "CardTitle", "Deterministic core. Separate systems.", pos=(78, 116))
    text(106, 116, "CenterAccent", "game-core.js", pos=(640, 212), fade=False)
    text(106, 116, "CenterBody", "↓", pos=(640, 258), fade=False)
    modules = [(78, "renderer.js"), (362, "audio.js"), (646, "game.js"), (930, "leaderboard.js")]
    for x, label in modules:
        rect(106, 116, x, 296, 244, 58, color="123044", alpha="70", layer=3)
        text(106, 116, "Mono", label, pos=(x + 122, 325), an=5, fade=False)
    text(106, 116, "CardBody", "Scoring · timing · multipliers · round state\\N计分、计时、倍率与回合状态", pos=(78, 398))
    text(106, 116, "CardBody", "100ms long-frame cap · auto-pause on focus loss\\N长帧最多推进 100ms · 失焦自动暂停", pos=(78, 458))
    text(106, 116, "CardBody", "Service Worker app shell · CSP connect-src 'none'", pos=(78, 518))
    text(106, 116, "Small", "Original SVG / CSS / Canvas + Web Audio / 原创图形与合成音效", pos=(78, 568))

    # 1:56-2:01 JetBrains version and profile.
    section(116, 121, "08 / JETBRAINS INSPECTION")
    rect(116, 121, 46, 106, 6, 492, color="F4E056", alpha="00", layer=4)
    text(116, 121, "CardTitle", "IntelliJ IDEA 2025.3", pos=(78, 116))
    text(116, 121, "Mono", "Build IU-253.28294.334", pos=(78, 176))
    rect(116, 121, 78, 232, 720, 86, color="123044", alpha="55", layer=3)
    text(116, 121, "CenterAccent", "Signal Rush Checks", pos=(438, 275), fade=False)
    text(116, 121, "CardBody", "JSIgnoredPromiseFromCall · CssUnusedSymbol · HtmlUnknownTarget", pos=(78, 364))
    text(116, 121, "Small", "Profile: .idea/inspectionProfiles/Signal_Rush_Checks.xml\\N检查配置副本：evidence/jetbrains/inspection-profile.xml", pos=(78, 432))
    text(116, 121, "Small", "Verified with idea64.exe --version / 版本来自本地证据", pos=(78, 520))

    # 2:01-2:06 before-fix findings.
    section(121, 126, "08 / JETBRAINS INSPECTION")
    rect(121, 126, 46, 106, 6, 492, color="F4E056", alpha="00", layer=4)
    text(121, 126, "CardTitle", "Before / 修复前", pos=(78, 112))
    text(121, 126, "Mono", "CSS  leaderboard-display.css:10", pos=(78, 190))
    text(121, 126, "CardBody", "Unresolved --display custom property\\N未解析 CSS 自定义属性", pos=(78, 224))
    text(121, 126, "Mono", "JS   sw.js:9", pos=(78, 316))
    text(121, 126, "CardBody", "skipWaiting() promise ignored / Promise 未等待", pos=(78, 350))
    text(121, 126, "Mono", "JS   sw.js:14", pos=(78, 424))
    text(121, 126, "CardBody", "clients.claim() promise ignored / Promise 未等待", pos=(78, 458))
    text(121, 126, "Small", "Evidence: before-css-unresolved.json · before-ignored-promises.json", pos=(78, 556))

    # 2:06-2:10 final inspection result.
    section(126, 130, "08 / JETBRAINS INSPECTION")
    rect(126, 130, 46, 106, 6, 492, color="F4E056", alpha="00", layer=4)
    text(126, 130, "CardTitle", "After / 修复后", pos=(78, 112))
    text(126, 130, "Pass", "0", pos=(248, 306), fade=False)
    text(126, 130, "CenterAccent", "SOURCE FINDINGS", pos=(248, 390), fade=False)
    text(126, 130, "CenterBody", "源码问题", pos=(248, 432), fade=False)
    text(126, 130, "CardBody", "Done · clean output contained only .descriptions.json\\N检查完成；干净输出目录仅有 .descriptions.json", pos=(492, 206))
    text(126, 130, "CardBody", "CSS variable and lifecycle promises fixed\\NCSS 变量与生命周期 Promise 已修复", pos=(492, 318))
    text(126, 130, "Small", "WSL, color-scheme and unrelated database-description warnings\\Nare environment warnings, not source findings.\\N环境警告单独注明，不计为源码问题。", pos=(492, 430))

    # 2:10-2:20 tests, using the freshly captured run.
    section(130, 140, "09 / TESTS")
    rect(130, 140, 46, 106, 6, 492, color="F4E056", alpha="00", layer=4)
    text(130, 140, "CardTitle", "node --test", pos=(78, 112))
    text(130, 140, "Pass", "26 / 26", pos=(360, 292), fade=False)
    text(130, 140, "CenterAccent", "PASS · 0 FAIL", pos=(360, 382), fade=False)
    rect(130, 140, 710, 176, 410, 236, color="123044", alpha="55", layer=3)
    text(130, 140, "Mono", f"tests         26\\Npass          26\\Nfail           0\\Nduration_ms  {test_duration_ms}", pos=(742, 204), fade=False)
    text(130, 140, "CardBody", "Input · scoring · pause · persistence · corrupt storage\\N输入、计分、暂停、持久化与损坏存储", pos=(78, 454))
    text(130, 140, "CardBody", "100-round booth reset stress test / 100 局 Booth 压力测试", pos=(78, 522))
    text(130, 140, "Small", "Captured during assembly / 本次剪辑时实际运行", pos=(78, 578))

    # 2:20-2:32 offline and originality.
    section(140, 152, "10 / OFFLINE & ORIGINAL")
    portrait_panel(140, 152)
    text(140, 152, "CardTitle", "Offline ready. Original by design.", pos=(58, 116))
    text(140, 152, "CardBody", "Service Worker caches the app shell after first load\\N首次加载后缓存应用外壳", pos=(58, 190))
    text(140, 152, "CardBody", "No trackers, external assets, music or network APIs\\N无追踪器、外部素材、音乐或网络 API", pos=(58, 268))
    text(140, 152, "CardBody", "Original SVG / CSS / Canvas + Web Audio\\N原创 SVG / CSS / Canvas 与 Web Audio", pos=(58, 346))
    text(140, 152, "CardBody", "MIT licensed · local run instructions included\\NMIT 许可 · 附本地启动说明", pos=(58, 424))
    text(140, 152, "Small", "README.md · SUBMISSION.md", pos=(58, 530))

    # 2:32-2:40 closing.
    rect(152, 160, 0, 0, WIDTH, HEIGHT, color="07121F", alpha="76", layer=2)
    text(152, 160, "Section", "11 / CLOSING", layer=20, pos=(640, 48), an=8, fade=False)
    text(152, 160, "CenterTitle", "SIGNAL RUSH", pos=(640, 238), fade=False)
    rect(152, 160, 500, 322, 280, 5, color="F4E056", alpha="00", layer=4)
    text(152, 160, "CenterAccent", "45 SEC · OFFLINE READY · PLAY AGAIN", pos=(640, 376), fade=False)
    text(152, 160, "CenterBody", "45 秒 · 离线可玩 · 随时再来", pos=(640, 424), fade=False)
    text(152, 160, "CenterBody", "README.md · SUBMISSION.md · evidence/jetbrains/", pos=(640, 492), fade=False)
    text(152, 160, "Small", "Local draft — public repository, Demo and video links pending user authorization\\N本地草案 — 公开仓库、Demo 与视频链接待用户授权", pos=(640, 552), an=5, fade=False)

    ass_path = output_dir / "subtitles.ass"
    ass_path.write_text(styles + "\n".join(events) + "\n", encoding="utf-8")

    srt_lines: list[str] = []
    for index, (start, end, english, chinese) in enumerate(CAPTIONS, start=1):
        srt_lines += [
            str(index),
            f"{srt_time(start)} --> {srt_time(end)}",
            english,
            chinese,
            "",
        ]
    srt_path = output_dir / "subtitles.srt"
    srt_path.write_text("\n".join(srt_lines), encoding="utf-8")
    return ass_path, srt_path


def build_clip(clip: Clip, project: Path, ffmpeg: Path, work_dir: Path) -> Path:
    output = work_dir / f"{clip.name}.mp4"
    frames = clip.duration * FPS
    common = [
        "-hide_banner", "-loglevel", "error", "-y",
        "-an", "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
        "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-video_track_timescale", "15360", str(output),
    ]
    if clip.kind == "demo":
        source = project / clip.source
        command = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-ss", str(clip.source_start), "-t", str(clip.duration), "-i", str(source),
            "-an", "-vf", "fps=30,scale=1280:720,setsar=1,format=yuv420p",
            "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "16", "-pix_fmt", "yuv420p", "-r", "30",
            "-video_track_timescale", "15360", str(output),
        ]
    elif clip.kind == "portrait":
        source = project / clip.source
        graph = (
            "[0:v]fps=30,split=2[bg][fg];"
            "[bg]scale=1280:720:force_original_aspect_ratio=increase,"
            "crop=1280:720,boxblur=24:2,eq=brightness=-0.22:saturation=0.65[bg2];"
            "[fg]scale=-2:660,eq=saturation=1.05[fg2];"
            "[bg2][fg2]overlay=x=W-w-46:y=30:shortest=1,format=yuv420p[v]"
        )
        command = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-loop", "1", "-framerate", "30", "-t", str(clip.duration),
            "-i", str(source), "-filter_complex", graph, "-map", "[v]",
        ] + common
    elif clip.kind == "solid":
        graph = (
            "color=c=0x07121F:s=1280x720:r=30,"
            "drawgrid=width=80:height=80:thickness=1:color=0x123044@0.22,"
            "vignette=PI/5,format=yuv420p"
        )
        command = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", graph, "-map", "0:v:0",
        ] + common
    elif clip.kind == "blur":
        source = project / clip.source
        graph = (
            "[0:v]fps=30,scale=1280:720:force_original_aspect_ratio=increase,"
            "crop=1280:720,boxblur=28:2,eq=brightness=-0.32:saturation=0.70,"
            "format=yuv420p[v]"
        )
        command = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-loop", "1", "-framerate", "30", "-t", str(clip.duration),
            "-i", str(source), "-filter_complex", graph, "-map", "[v]",
        ] + common
    else:
        raise ValueError(f"Unknown clip kind: {clip.kind}")
    run(command)
    return output


def build_audio(source: Path, ffmpeg: Path, work_dir: Path) -> Path:
    output = work_dir / "timeline-audio.wav"
    labels = [f"a{index}" for index in range(len(DEMO_AUDIO))]
    delayed = [f"d{index}" for index in range(len(DEMO_AUDIO))]
    filters = [f"[0:a]asplit={len(labels)}{''.join(f'[{label}]' for label in labels)}"]
    for index, ((_, _, source_start, source_end), label, delayed_label) in enumerate(
        zip(DEMO_AUDIO, labels, delayed)
    ):
        output_start = DEMO_AUDIO[index][0]
        delay_ms = int(round(output_start * 1000))
        filters.append(
            f"[{label}]atrim=start={source_start}:end={source_end},"
            f"asetpts=PTS-STARTPTS,adelay={delay_ms}|{delay_ms}[{delayed_label}]"
        )
    mix_inputs = "".join(f"[{label}]" for label in delayed) + "[1:a]"
    filters.append(
        f"{mix_inputs}amix=inputs={len(delayed) + 1}:duration=longest:"
        "dropout_transition=0:normalize=0,atrim=duration=160,"
        "apad=whole_dur=160,asetpts=N/SR/TB[aout]"
    )
    command = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source),
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo:d=160",
        "-filter_complex", ";".join(filters), "-map", "[aout]",
        "-t", "160", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", str(output),
    ]
    run(command)
    return output


def find_tool(explicit: str | None, env_name: str, name: str, fallback: Path) -> Path:
    if explicit:
        path = Path(explicit).resolve()
        if not path.is_file():
            raise FileNotFoundError(path)
        return path
    if os.environ.get(env_name):
        return find_tool(os.environ[env_name], env_name, name, fallback)
    on_path = shutil.which(name)
    if on_path:
        return Path(on_path).resolve()
    if fallback.is_file():
        return fallback.resolve()
    raise FileNotFoundError(f"Cannot find {name}; pass --{name} or set {env_name}.")


def main() -> int:
    script_path = Path(__file__).resolve()
    output_dir = script_path.parent
    default_project = script_path.parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=default_project)
    parser.add_argument("--output-dir", type=Path, default=output_dir)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--ffprobe")
    args = parser.parse_args()

    project = args.project.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    local_appdata = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local")))
    tool_root = local_appdata / "Temp/signal-rush-video-tools-20261126/venv/Lib/site-packages"
    ffmpeg = find_tool(
        args.ffmpeg, "FFMPEG", "ffmpeg",
        tool_root / "static_ffmpeg/bin/win32/ffmpeg.exe",
    )
    ffprobe = find_tool(
        args.ffprobe, "FFPROBE", "ffprobe",
        tool_root / "static_ffmpeg/bin/win32/ffprobe.exe",
    )

    required = [
        project / "README.md",
        project / "SUBMISSION.md",
        project / "media/signal-rush-demo.mp4",
        project / "media/01-start.png",
        project / "media/02-gameplay.png",
        project / "media/03-results.png",
        project / "media/04-leaderboard.png",
        project / "media/05-booth-display.png",
        project / "evidence/jetbrains/idea-version.txt",
        project / "evidence/jetbrains/inspection-profile.xml",
        project / "evidence/jetbrains/before-css-unresolved.json",
        project / "evidence/jetbrains/before-ignored-promises.json",
        project / "evidence/jetbrains/final-inspection-summary.txt",
    ]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing required inputs:\n" + "\n".join(missing))

    print("Validating source media and evidence...", flush=True)
    source_demo = project / "media/signal-rush-demo.mp4"
    source_probe = probe(source_demo, ffprobe)
    (output_dir / "source-ffprobe.json").write_text(
        json.dumps(source_probe, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    source_duration = float(source_probe["format"]["duration"])
    if abs(source_duration - 52.0) > 0.001:
        raise RuntimeError(f"Expected 52-second source demo, found {source_duration}")

    idea_version = (project / "evidence/jetbrains/idea-version.txt").read_text(encoding="utf-8")
    final_summary = (project / "evidence/jetbrains/final-inspection-summary.txt").read_text(encoding="utf-8")
    css_before = json.loads((project / "evidence/jetbrains/before-css-unresolved.json").read_text(encoding="utf-8"))
    promise_before = json.loads((project / "evidence/jetbrains/before-ignored-promises.json").read_text(encoding="utf-8"))
    if "IntelliJ IDEA 2025.3" not in idea_version or "IU-253.28294.334" not in idea_version:
        raise RuntimeError("IDE version evidence did not match the documented version")
    if len(css_before.get("problems", [])) != 1 or len(promise_before.get("problems", [])) != 2:
        raise RuntimeError("Before-fix JetBrains evidence counts changed")
    if "Source findings under the enabled profile: 0" not in final_summary:
        raise RuntimeError("Final JetBrains summary no longer reports zero source findings")

    print("Running Node tests for the on-screen test card...", flush=True)
    test_output_path = output_dir / "node-test-output.txt"
    node_version = run(["node", "--version"], cwd=project).strip()
    test_output = run(["node", "--test"], cwd=project, log_path=test_output_path)
    pass_match = re.search(r"(?m)^ℹ pass (\d+)\s*$", test_output)
    fail_match = re.search(r"(?m)^ℹ fail (\d+)\s*$", test_output)
    duration_match = re.search(r"(?m)^ℹ duration_ms ([\d.]+)\s*$", test_output)
    if not pass_match or not fail_match or int(pass_match.group(1)) != 26 or int(fail_match.group(1)) != 0:
        raise RuntimeError("Node tests are not 26/26; refusing to render a 26/26 claim")
    test_duration_ms = duration_match.group(1) if duration_match else "n/a"

    before_hashes = hash_sources(project, output_dir)
    ass_path, srt_path = make_subtitles(output_dir, test_duration_ms)

    with tempfile.TemporaryDirectory(prefix="signal-rush-video-build-") as temp_name:
        work_dir = Path(temp_name)
        segment_paths: list[Path] = []
        elapsed = 0
        for clip in CLIPS:
            print(f"Rendering {clip.name} ({elapsed:03d}-{elapsed + clip.duration:03d}s)...", flush=True)
            segment_paths.append(build_clip(clip, project, ffmpeg, work_dir))
            elapsed += clip.duration
        if elapsed != DURATION:
            raise RuntimeError(f"Timeline totals {elapsed}s, expected {DURATION}s")

        concat_list = work_dir / "segments.txt"
        concat_list.write_text(
            "".join(f"file '{path.as_posix()}'\n" for path in segment_paths), encoding="utf-8"
        )
        base_video = work_dir / "base-160s.mp4"
        run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c", "copy", str(base_video),
        ])

        print("Building the 160-second audio timeline from existing demo audio...", flush=True)
        audio_path = build_audio(source_demo, ffmpeg, work_dir)

        final_path = output_dir / "signal-rush-cloud9-jetbrains-160s-draft.mp4"
        print("Burning bilingual text and encoding the final H.264 MP4...", flush=True)
        final_graph = (
            "[0:v]ass=subtitles.ass:fontsdir='C\\:/Windows/Fonts',"
            "fps=30,setpts=N/(30*TB),format=yuv420p[v]"
        )
        run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(base_video), "-i", str(audio_path),
            "-filter_complex", final_graph, "-map", "[v]", "-map", "1:a:0",
            "-frames:v", str(TOTAL_FRAMES), "-t", str(DURATION),
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-profile:v", "high", "-level:v", "3.1", "-pix_fmt", "yuv420p",
            "-r", "30", "-g", "60", "-c:a", "aac", "-b:a", "128k",
            "-ar", "48000", "-ac", "2", "-movflags", "+faststart",
            "-metadata", "title=Signal Rush — Cloud9 × JetBrains local submission draft",
            "-metadata", "comment=160s local draft from existing assets only; no narration.",
            str(final_path),
        ], cwd=output_dir)

    print("Verifying duration, codec, resolution, frame count and full decode...", flush=True)
    final_probe = probe(final_path, ffprobe, count_frames=True)
    (output_dir / "ffprobe.json").write_text(
        json.dumps(final_probe, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    decode_log = output_dir / "decode-verification.txt"
    run([
        ffmpeg, "-hide_banner", "-v", "info", "-xerror", "-i", str(final_path),
        "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-",
    ], log_path=decode_log)

    video = next(stream for stream in final_probe["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in final_probe["streams"] if stream["codec_type"] == "audio")
    format_duration = float(final_probe["format"]["duration"])
    checks = {
        "duration_exactly_160s": abs(format_duration - DURATION) <= 0.001,
        "video_codec_h264": video.get("codec_name") == "h264",
        "resolution_1280x720": (video.get("width"), video.get("height")) == (WIDTH, HEIGHT),
        "frame_rate_30fps": video.get("avg_frame_rate") == "30/1",
        "decoded_frame_count_4800": int(video.get("nb_read_frames", "0")) == TOTAL_FRAMES,
        "pixel_format_yuv420p": video.get("pix_fmt") == "yuv420p",
        "audio_codec_aac": audio.get("codec_name") == "aac",
        "audio_48khz_stereo": audio.get("sample_rate") == "48000" and audio.get("channels") == 2,
        "audio_duration_160s": abs(float(audio.get("duration", "0")) - DURATION) <= 0.001,
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise RuntimeError("Final verification failed: " + ", ".join(failed))

    after_hashes = hash_sources(project, output_dir)
    if before_hashes != after_hashes:
        changed = sorted(
            name for name in set(before_hashes) | set(after_hashes)
            if before_hashes.get(name) != after_hashes.get(name)
        )
        raise RuntimeError("Source files changed during assembly: " + ", ".join(changed))
    write_hash_list(output_dir / "source-hashes.sha256", after_hashes)

    ffmpeg_version = run([ffmpeg, "-version"]).splitlines()[0]
    ffprobe_version = run([ffprobe, "-version"]).splitlines()[0]
    python_version = sys.version.split()[0]
    (output_dir / "tool-versions.txt").write_text(
        "\n".join([
            f"Python: {python_version}",
            f"Node: {node_version}",
            f"ffmpeg: {ffmpeg_version}",
            f"ffprobe: {ffprobe_version}",
            f"ffmpeg path: {ffmpeg}",
            f"ffprobe path: {ffprobe}",
            "Installation scope: isolated temporary venv only; no global install.",
        ]) + "\n",
        encoding="utf-8",
    )

    verification_lines = [
        "Signal Rush 160-second draft verification",
        "RESULT: PASS",
        "",
        f"File: {final_path}",
        f"Container duration: {format_duration:.6f} s",
        f"Video: {video['codec_name']}, {video['width']}x{video['height']}, "
        f"{video['avg_frame_rate']} fps, {video['pix_fmt']}",
        f"Decoded video frames: {video['nb_read_frames']}",
        f"Audio: {audio['codec_name']}, {audio['sample_rate']} Hz, {audio['channels']} channels, "
        f"{float(audio['duration']):.6f} s",
        "Full ffmpeg audio+video decode: exit 0, no decode errors",
        "Source files unchanged during assembly: yes",
        f"Node tests in this run: {pass_match.group(1)} passed, {fail_match.group(1)} failed",
        "JetBrains evidence validated: 1 CSS finding + 2 Promise findings before; 0 source findings after",
        "",
        "Checks:",
    ]
    verification_lines += [f"- {name}: {'PASS' if passed else 'FAIL'}" for name, passed in checks.items()]
    verification_lines += [
        "",
        f"ffprobe command: {ffprobe} -v error -count_frames -show_streams -show_format -of json {final_path}",
        f"decode command: {ffmpeg} -hide_banner -v info -xerror -i {final_path} -map 0:v:0 -map 0:a:0 -f null -",
        "Raw outputs: ffprobe.json and decode-verification.txt",
    ]
    (output_dir / "verification.txt").write_text("\n".join(verification_lines) + "\n", encoding="utf-8")

    video_hash = sha256_file(final_path)
    report = f"""SIGNAL RUSH — LOCAL 2:40 SUBMISSION VIDEO DRAFT

Output
{final_path}

Specifications
- Duration: exactly 160.000 seconds (2:40), 4800 frames
- Video: H.264 High, 1280x720, 30 fps, yuv420p
- Audio: AAC, 48 kHz stereo; supplied demo audio retained at its timeline positions
- Container: MP4 with faststart
- SHA-256: {video_hash}

Content timeline
0:00-0:08  Title and local-draft disclosure
0:08-0:20  Start, controls and zero-setup method
0:20-0:44  Supplied demo gameplay plus scoring and multiplier rules
0:44-0:56  Actual supplied result: 000600, grade D, 100% accuracy, best streak 1, local rank #6
0:56-1:08  Local top-ten leaderboard
1:08-1:32  Booth auto-reset method and separate display
1:32-1:46  Keyboard, pause, reduced motion, focus, contrast and status announcements
1:46-1:56  Deterministic-core engineering method
1:56-2:10  IntelliJ IDEA 2025.3 inspection evidence and before/after findings
2:10-2:20  Fresh node --test run: 26/26 passed, 0 failed
2:20-2:32  Offline app shell, original assets and MIT license
2:32-2:40  Closing card and local package references

Evidence and honesty notes
- The 52-second source demo is a captioned edited demo, not a newly recorded continuous
  45-second live run. It is labeled as supplied demo footage; no new gameplay or score
  was fabricated.
- Source audio measures effectively silent (-91 dB). No local TTS was used. Readable
  bilingual cards and burned-in Chinese/English subtitles carry the explanation.
- JetBrains slides render the existing text/JSON evidence. They are not fabricated IDE
  screenshots. The final claim is 0 source findings under the enabled profile; listed
  environment warnings are explicitly separate.
- Node tests were rerun during assembly. Raw output is in node-test-output.txt.
- Source hashes before and after the successful assembly match; the existing demo and
  source files were not modified by this script.
- During an earlier render, SUBMISSION.md was externally edited to reference an earlier
  draft hash. That source file was left untouched as requested; use REPORT.txt and
  SHA256SUMS for the final draft hash.
- ffmpeg/ffprobe were installed only in an isolated temporary venv, not globally.

Verification
- ffprobe.json: stream/container metadata and counted frames
- decode-verification.txt: full audio+video decode log, exit 0
- verification.txt: concise PASS checks
- source-hashes.sha256: hashes of existing project inputs
- SHA256SUMS: hashes of generated deliverables
- source-contact-sheet.jpg: visual map of the supplied demo

Limitations / remaining work before a formal submission
- Add a newly recorded continuous live run, IDE screen capture, keyboard/mobile footage,
  and optional narration if desired.
- Public repository, Demo and video links remain pending user authorization.
- Nothing was uploaded, published, pushed, registered, accepted, or purchased.

Rebuild
Run this script with Python and pass --ffmpeg/--ffprobe if the isolated tools are not at
their recorded paths. The script refuses to render a 26/26 claim unless the current
Node run actually reports 26 passed and 0 failed.
"""
    (output_dir / "REPORT.txt").write_text(report, encoding="utf-8")

    generated_names = [
        "signal-rush-cloud9-jetbrains-160s-draft.mp4",
        "assemble_video.py",
        "subtitles.ass",
        "subtitles.srt",
        "source-ffprobe.json",
        "ffprobe.json",
        "decode-verification.txt",
        "verification.txt",
        "node-test-output.txt",
        "source-hashes.sha256",
        "tool-versions.txt",
        "source-contact-sheet.jpg",
        "REPORT.txt",
    ]
    generated_hashes = {
        name: sha256_file(output_dir / name)
        for name in generated_names
        if (output_dir / name).is_file()
    }
    write_hash_list(output_dir / "SHA256SUMS", generated_hashes)

    print(f"PASS: {final_path}", flush=True)
    print(f"Duration: {format_duration:.6f}s; frames: {video['nb_read_frames']}; SHA-256: {video_hash}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
