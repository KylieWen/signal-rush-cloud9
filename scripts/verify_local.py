#!/usr/bin/env python3
"""Verify Signal Rush with local runtimes only; never installs or publishes anything."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import socket
import struct
import subprocess
import sys
import time
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from urllib.request import ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parents[1]
MIN_TESTS = 26
REQUIRED_FILES = (
    "README.md",
    "SUBMISSION.md",
    "LICENSE",
    "package.json",
    "run-windows.bat",
    "server.py",
    "index.html",
    "leaderboard.html",
    "styles.css",
    "leaderboard-display.css",
    "game-core.js",
    "game.js",
    "renderer.js",
    "audio.js",
    "leaderboard.js",
    "leaderboard-display.js",
    "sw.js",
    "manifest.webmanifest",
    "icon.svg",
    "media/signal-rush-demo.mp4",
    "scripts/verify_local.py",
)
REQUIRED_MEDIA = (
    "media/01-start.png",
    "media/02-gameplay.png",
    "media/03-results.png",
    "media/04-leaderboard.png",
    "media/05-booth-display.png",
)


class LocalReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []
        self.has_csp = False
        self.has_arena = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.has_csp = True
        if tag == "canvas" and values.get("id") == "gameCanvas":
            self.has_arena = True
        for attribute in ("src", "href"):
            value = values.get(attribute)
            if value:
                self.references.append(value)


def iter_boxes(data: bytes, start: int, end: int):
    position = start
    while position + 8 <= end:
        size, kind = struct.unpack_from(">I4s", data, position)
        header = 8
        if size == 1:
            if position + 16 > end:
                return
            size = struct.unpack_from(">Q", data, position + 8)[0]
            header = 16
        elif size == 0:
            size = end - position
        if size < header or position + size > end:
            return
        yield kind, position + header, position + size
        position += size


def mp4_duration_seconds(path: Path) -> float:
    data = path.read_bytes()
    if len(data) < 16 or data[4:8] != b"ftyp":
        raise AssertionError(f"Not an MP4 file: {path.name}")
    for kind, body, end in iter_boxes(data, 0, len(data)):
        if kind != b"moov":
            continue
        for child, child_body, _ in iter_boxes(data, body, end):
            if child != b"mvhd":
                continue
            version = data[child_body]
            if version == 0:
                timescale, duration = struct.unpack_from(">II", data, child_body + 12)
            elif version == 1:
                timescale, duration = struct.unpack_from(">IQ", data, child_body + 20)
            else:
                raise AssertionError("Unsupported MP4 movie header version")
            return duration / timescale
    raise AssertionError("MP4 movie header not found")


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise AssertionError(f"Not a valid PNG file: {path.name}")
    return struct.unpack_from(">II", header, 16)


def reserve_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def check_local_references(path: Path, parser: LocalReferenceParser) -> None:
    text = path.read_text(encoding="utf-8")
    parser.feed(text)
    for reference in parser.references:
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or reference.startswith(("#", "data:")):
            continue
        relative = unquote(parsed.path).lstrip("/")
        target = (ROOT / (relative or "index.html")).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            raise AssertionError(f"{path.name} references missing local file: {reference}")


def verify_static_package() -> list[str]:
    lines: list[str] = []
    for relative in REQUIRED_FILES:
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size == 0:
            raise AssertionError(f"Required file missing or empty: {relative}")
    lines.append(f"Required package files: {len(REQUIRED_FILES)} present")

    if "MIT License" not in (ROOT / "LICENSE").read_text(encoding="utf-8"):
        raise AssertionError("LICENSE is not MIT")
    lines.append("License: MIT")

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    for key in ("name", "start_url", "scope", "icons"):
        if not manifest.get(key):
            raise AssertionError(f"Manifest field missing: {key}")
    lines.append("Web app manifest: valid")

    index_parser = LocalReferenceParser()
    check_local_references(ROOT / "index.html", index_parser)
    if not index_parser.has_csp or not index_parser.has_arena:
        raise AssertionError("Index is missing CSP or game canvas")
    leaderboard_parser = LocalReferenceParser()
    check_local_references(ROOT / "leaderboard.html", leaderboard_parser)
    lines.append("HTML local asset references and CSP: valid")

    service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
    shell = re.findall(r"['\"](\./[^'\"]+)['\"]", service_worker)
    if not shell:
        raise AssertionError("Service-worker app shell is empty")
    for reference in shell:
        relative = unquote(urlsplit(reference).path).lstrip("./")
        if not (ROOT / relative).is_file():
            raise AssertionError(f"Service worker references missing file: {reference}")
    lines.append(f"Service-worker app shell: {len(shell)} local entries present")

    for relative in REQUIRED_MEDIA:
        width, height = png_dimensions(ROOT / relative)
        lines.append(f"PNG {relative}: {width}x{height}")

    duration = mp4_duration_seconds(ROOT / "media/signal-rush-demo.mp4")
    if not 0 < duration <= 180:
        raise AssertionError(f"Demo video duration exceeds three minutes: {duration:.3f}s")
    lines.append(f"Demo video: {duration:.3f}s (limit 180s)")
    return lines


def verify_node_tests() -> tuple[list[str], int, int]:
    node = shutil.which("node")
    if not node:
        raise AssertionError("Node.js is required for the test suite")
    result = subprocess.run(
        [node, "--test"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=False,
    )
    output = (result.stdout + result.stderr).strip()
    tests_match = re.search(r"(?:ℹ|#)\s+tests\s+(\d+)", output)
    pass_match = re.search(r"(?:ℹ|#)\s+pass\s+(\d+)", output)
    fail_match = re.search(r"(?:ℹ|#)\s+fail\s+(\d+)", output)
    if not tests_match or not pass_match or not fail_match:
        raise AssertionError("Could not parse Node test summary\n" + output)
    tests = int(tests_match.group(1))
    passed = int(pass_match.group(1))
    failed = int(fail_match.group(1))
    if result.returncode != 0 or failed != 0 or passed != tests or tests < MIN_TESTS:
        raise AssertionError(f"Node tests failed or regressed: {passed}/{tests} passed\n" + output)
    version = subprocess.run(
        [node, "--version"], capture_output=True, text=True, check=True
    ).stdout.strip()
    return [f"Node: {version}", f"Node tests: {passed}/{tests} passed", output], tests, passed


def verify_server() -> list[str]:
    port = reserve_port()
    base = f"http://127.0.0.1:{port}"
    process = subprocess.Popen(
        [
            sys.executable,
            str(ROOT / "server.py"),
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    opener = build_opener(ProxyHandler({}))
    endpoints = (
        ("/", "text/html"),
        ("/index.html?booth=1", "text/html"),
        ("/leaderboard.html", "text/html"),
        ("/sw.js", "text/javascript"),
        ("/game-core.js", "text/javascript"),
        ("/styles.css", "text/css"),
        ("/manifest.webmanifest", "application/manifest+json"),
    )
    lines = [f"Local server: Python {sys.version.split()[0]} on 127.0.0.1:{port}"]
    try:
        deadline = time.monotonic() + 8
        while True:
            if process.poll() is not None:
                raise AssertionError("Local server exited before becoming ready")
            try:
                with opener.open(base + "/", timeout=1) as response:
                    if response.status != 200:
                        raise AssertionError(f"Root endpoint returned {response.status}")
                break
            except OSError:
                if time.monotonic() >= deadline:
                    raise AssertionError("Local server did not become ready within 8 seconds")
                time.sleep(0.1)

        for endpoint, expected_type in endpoints:
            with opener.open(base + endpoint, timeout=3) as response:
                body = response.read()
                content_type = response.headers.get_content_type()
                if response.status != 200 or not body:
                    raise AssertionError(f"Endpoint failed: {endpoint}")
                if content_type != expected_type:
                    raise AssertionError(
                        f"Unexpected content type for {endpoint}: {content_type}"
                    )
                for header, expected in (
                    ("Cache-Control", "no-store"),
                    ("X-Content-Type-Options", "nosniff"),
                    ("Referrer-Policy", "no-referrer"),
                ):
                    if response.headers.get(header) != expected:
                        raise AssertionError(f"Missing {header} on {endpoint}")
                if endpoint == "/" and b"Signal Rush" not in body:
                    raise AssertionError("Root page is not Signal Rush")
            lines.append(f"HTTP 200 {endpoint}: {content_type}, security headers valid")
        return lines
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=5)
        else:
            process.communicate(timeout=5)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional UTF-8 report path, relative to the project root unless absolute",
    )
    args = parser.parse_args()
    lines = [
        "Signal Rush local verification",
        f"Timestamp: {datetime.now().astimezone().isoformat(timespec='seconds')}",
        "Mode: offline/local only; no installs, uploads, or commits",
        "",
    ]
    status = 0
    try:
        if sys.version_info < (3, 10):
            raise AssertionError("Python 3.10+ is required")
        lines.extend(verify_static_package())
        test_lines, _, _ = verify_node_tests()
        lines.extend(test_lines)
        lines.extend(verify_server())
        lines.extend(["", "RESULT: PASS"])
    except Exception as error:
        status = 1
        lines.extend(["", f"RESULT: FAIL — {type(error).__name__}: {error}"])

    report = "\n".join(lines) + "\n"
    if args.report:
        destination = args.report if args.report.is_absolute() else ROOT / args.report
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(report)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(report, end="")
    return status


if __name__ == "__main__":
    raise SystemExit(main())
