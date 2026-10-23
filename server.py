"""Локальний сервер для ASCII Art Studio. Використовує лише стандартну бібліотеку Python."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000


class StudioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/api/info":
            payload = {
                "name": "ASCII Art Studio",
                "status": "ok",
                "message": "Локальний сервер працює. Перетворення виконується у браузері."
            }
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def log_message(self, format_string, *args):
        # Залишаємо короткі журнали HTTP-запитів у терміналі.
        print(f"[{self.log_date_time_string()}] {format_string % args}")


def main():
    server = ThreadingHTTPServer((HOST, PORT), StudioHandler)
    print("ASCII Art Studio запущено!")
    print(f"Відкрийте у браузері: http://{HOST}:{PORT}")
    print("Щоб зупинити сервер, натисніть Ctrl+C.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер зупиняється...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
