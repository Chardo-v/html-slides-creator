#!/usr/bin/env python3
"""开发用 HTTP 服务器 — 禁止缓存，支持文件写入 API
用法: python3 server.py [port]
"""
import http.server, sys, json, os, urllib.parse, time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3333
BASE = os.path.dirname(os.path.abspath(__file__))

def find_free_port(start):
    import socket
    for port in range(start, start + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('', port))
                return port
            except OSError:
                continue
    raise RuntimeError(f'No free port found in range {start}–{start+99}')

class Handler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        if urllib.parse.urlparse(self.path).path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path == '/save':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data    = json.loads(body)
                relpath = data['path'].lstrip('/')          # e.g. "example-slides/01-cover.html"
                content = data['content']
                abspath = os.path.normpath(os.path.join(BASE, relpath))
                # 安全检查：只允许写工作区内的文件
                if not abspath.startswith(BASE):
                    raise ValueError('path outside workspace')
                os.makedirs(os.path.dirname(abspath), exist_ok=True)
                with open(abspath, 'w', encoding='utf-8') as f:
                    f.write(content)
                self._json(200, {'ok': True, 'path': relpath, 'mtime': os.path.getmtime(abspath)})
            except Exception as e:
                self._json(400, {'ok': False, 'error': str(e)})

        elif path == '/save-batch':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                files   = json.loads(body)   # [{ path, content }, ...]
                saved   = []
                for item in files:
                    relpath = item['path'].lstrip('/')
                    abspath = os.path.normpath(os.path.join(BASE, relpath))
                    if not abspath.startswith(BASE):
                        raise ValueError(f'path outside workspace: {relpath}')
                    os.makedirs(os.path.dirname(abspath), exist_ok=True)
                    with open(abspath, 'w', encoding='utf-8') as f:
                        f.write(item['content'])
                    saved.append(relpath)
                mtimes = {p: os.path.getmtime(os.path.normpath(os.path.join(BASE, p.lstrip('/')))) for p in saved}
                self._json(200, {'ok': True, 'saved': saved, 'mtimes': mtimes})
            except Exception as e:
                self._json(400, {'ok': False, 'error': str(e)})

        elif path == '/mtimes':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data  = json.loads(body)
                paths = data.get('paths', [])
                result = {}
                for p in paths:
                    abspath = os.path.normpath(os.path.join(BASE, p.lstrip('/')))
                    if abspath.startswith(BASE) and os.path.exists(abspath):
                        result[p] = os.path.getmtime(abspath)
                self._json(200, result)
            except Exception as e:
                self._json(400, {'ok': False, 'error': str(e)})

        else:
            self.send_error(404)

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # 只打印写操作，忽略 GET 噪音
        if args and str(args[0]).startswith(('POST', 'OPTIONS')):
            print(f'[server] {fmt % args}')

PORT = find_free_port(PORT)
print(f'http://localhost:{PORT}')
http.server.HTTPServer(('', PORT), Handler).serve_forever()
