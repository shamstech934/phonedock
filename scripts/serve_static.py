#!/usr/bin/env python3
"""Lightweight static server for Next.js build output."""
import http.server
import os
import sys

PROJECT_DIR = "/home/z/my-project"
NEXT_DIR = os.path.join(PROJECT_DIR, ".next")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

class NextStaticHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]

        # Route: / -> index.html
        if path == "/" or path == "":
            self.serve_file(os.path.join(NEXT_DIR, "server/app/index.html"))
            return

        # Route: /_next/* -> .next/*
        if path.startswith("/_next/"):
            relative = path[len("/_next/"):]
            self.serve_file(os.path.join(NEXT_DIR, relative))
            return

        # Route: /logo.svg, /favicon.ico etc -> public/
        public_path = os.path.join(PROJECT_DIR, "public", path.lstrip("/"))
        if os.path.isfile(public_path):
            self.serve_file(public_path)
            return

        # Route: /robots.txt, /sitemap.xml -> .next/server/app/
        app_file = os.path.join(NEXT_DIR, "server/app", path.lstrip("/"))
        if os.path.isfile(app_file):
            self.serve_file(app_file)
            return

        # Route: API calls -> return empty JSON
        if path.startswith("/api/"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"{}")
            return

        # 404
        self.send_response(404)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        not_found = os.path.join(NEXT_DIR, "server/app/_not-found.html")
        if os.path.isfile(not_found):
            with open(not_found, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.wfile.write(b"<h1>404 Not Found</h1>")

    def serve_file(self, filepath):
        try:
            with open(filepath, "rb") as f:
                content = f.read()

            # Determine content type
            ext = os.path.splitext(filepath)[1].lower()
            content_types = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".woff2": "font/woff2",
                ".woff": "font/woff",
                ".svg": "image/svg+xml",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp",
                ".avif": "image/avif",
                ".ico": "image/x-icon",
                ".xml": "application/xml",
                ".txt": "text/plain",
            }
            ctype = content_types.get(ext, "application/octet-stream")

            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"File not found")
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, format, *args):
        # Quiet logging
        pass

if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), NextStaticHandler)
    print(f"Serving on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()