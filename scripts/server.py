#!/usr/bin/env python3
"""开发用 HTTP 服务器。

固定提供 skill 自带的 runtime 资源，并把外部 slides 目录挂载到 /slides/。

用法:
  python3 scripts/server.py
  python3 scripts/server.py /path/to/slides
  python3 scripts/server.py /path/to/slides 8080
  python3 scripts/server.py 8080
"""

import http.server
import json
import os
import posixpath
import socket
import sys
import urllib.parse


DEFAULT_PORT = 3333
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(SCRIPT_DIR)
RUNTIME_ROOT = os.path.join(SKILL_ROOT, "assets", "runtime")
DEFAULT_SLIDES_ROOT = os.path.join(SKILL_ROOT, "assets", "examples", "example-slides")


def parse_args(argv):
    args = argv[1:]
    if len(args) > 2:
        raise SystemExit("Usage: python3 scripts/server.py [slides_dir] [port]")

    slides_root = DEFAULT_SLIDES_ROOT
    port = DEFAULT_PORT
    for arg in args:
        if arg.isdigit():
            port = int(arg)
        else:
            slides_root = os.path.abspath(os.path.expanduser(arg))

    return slides_root, port


def ensure_exists(path, label):
    if not os.path.exists(path):
        raise SystemExit(f"{label} not found: {path}")


def find_free_port(start):
    for port in range(start, start + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port found in range {start}-{start + 99}")


def safe_join(root, relpath):
    root = os.path.abspath(root)
    target = os.path.abspath(os.path.normpath(os.path.join(root, relpath)))
    if os.path.commonpath([root, target]) != root:
        raise ValueError("path outside workspace")
    return target


def normalize_url_path(raw_path):
    path = urllib.parse.unquote(urllib.parse.urlparse(raw_path).path)
    path = posixpath.normpath(path)
    if not path.startswith("/"):
        path = "/" + path
    return path


SLIDES_ROOT, PORT = parse_args(sys.argv)
SLIDES_CONFIG = os.path.join(SLIDES_ROOT, "slides.js")
ensure_exists(RUNTIME_ROOT, "runtime root")
ensure_exists(SLIDES_ROOT, "slides directory")
ensure_exists(SLIDES_CONFIG, "slides.js")


class Handler(http.server.SimpleHTTPRequestHandler):

    def translate_path(self, path):
        route = normalize_url_path(path)
        if route == "/":
            return os.path.join(RUNTIME_ROOT, "index.html")
        if route.startswith("/slides/"):
            return safe_join(SLIDES_ROOT, route[len("/slides/"):])
        return safe_join(RUNTIME_ROOT, route.lstrip("/"))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_GET(self):
        if normalize_url_path(self.path) == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        route = normalize_url_path(self.path)

        if route == "/save":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                abspath = self._resolve_slide_file(data["path"])
                os.makedirs(os.path.dirname(abspath), exist_ok=True)
                with open(abspath, "w", encoding="utf-8") as handle:
                    handle.write(data["content"])
                self._json(200, {"ok": True, "path": data["path"], "mtime": os.path.getmtime(abspath)})
            except Exception as exc:
                self._json(400, {"ok": False, "error": str(exc)})

        elif route == "/save-batch":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                files = json.loads(body)
                mtimes = {}
                saved = []
                for item in files:
                    abspath = self._resolve_slide_file(item["path"])
                    os.makedirs(os.path.dirname(abspath), exist_ok=True)
                    with open(abspath, "w", encoding="utf-8") as handle:
                        handle.write(item["content"])
                    saved.append(item["path"])
                    mtimes[item["path"]] = os.path.getmtime(abspath)
                self._json(200, {"ok": True, "saved": saved, "mtimes": mtimes})
            except Exception as exc:
                self._json(400, {"ok": False, "error": str(exc)})

        elif route == "/mtimes":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                result = {}
                for path in data.get("paths", []):
                    abspath = self._resolve_slide_file(path)
                    if os.path.exists(abspath):
                        result[path] = os.path.getmtime(abspath)
                self._json(200, result)
            except Exception as exc:
                self._json(400, {"ok": False, "error": str(exc)})

        else:
            self.send_error(404)

    def _resolve_slide_file(self, request_path):
        route = normalize_url_path(request_path)
        if route.startswith("/slides/"):
            relpath = route[len("/slides/"):]
        else:
            relpath = request_path.lstrip("/")
            if relpath.startswith("slides/"):
                relpath = relpath[len("slides/"):]
        if not relpath:
            raise ValueError("slide path is empty")
        return safe_join(SLIDES_ROOT, relpath)

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if args and str(args[0]).startswith(("POST", "OPTIONS")):
            print(f"[server] {fmt % args}")


PORT = find_free_port(PORT)
print(f"slides_dir={SLIDES_ROOT}")
print(f"http://localhost:{PORT}")
http.server.HTTPServer(("", PORT), Handler).serve_forever()
