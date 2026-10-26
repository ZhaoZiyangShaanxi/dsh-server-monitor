#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""qqbot-monitor — the loopback-only agent behind the dsh-server-monitor DSH plugin.

Serves two endpoints, by default on 127.0.0.1:6186. The plugin reaches this port
through its own SSH tunnel, so keep it bound to loopback: nothing here authenticates,
the tunnel is the boundary.

    GET  /api/stats   -> JSON snapshot; field contract is in ../README.md
    POST /api/action  -> {"action": "<one of ACTIONS>"} -> {"ok": bool, "msg": str}

Paths, port and the OneBot endpoint are configurable by environment variable so the
same file runs under any prefix.
"""
import json
import os
import socket
import subprocess
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = os.environ.get("MONITOR_HOST", "127.0.0.1")
PORT = int(os.environ.get("MONITOR_PORT", "6186"))
TOKEN_FILE = os.environ.get("ONEBOT_TOKEN_FILE", "/opt/qqbot-monitor/onebot-token")
ONEBOT_URL = os.environ.get("ONEBOT_URL", "http://127.0.0.1:3000/get_status")
DASHBOARD_FILE = os.environ.get("MONITOR_DASHBOARD", os.path.join(HERE, "dashboard.html"))

ACTIONS = {
    "purge_cache":  ("清理缓存",     "sync; echo 3 > /proc/sys/vm/drop_caches", 30),
    "restart_snow": ("重启 SnowLuma", "docker restart snowluma", 60),
    "restart_ast":  ("重启 AstrBot",  "docker restart astrbot", 60),
    "restart_both": ("重启全部容器", "docker restart snowluma astrbot", 90),
}


def sh(cmd, timeout=30):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True,
                              timeout=timeout).stdout.strip()
    except Exception:
        return ""


def container_running(name):
    return sh("docker inspect -f '{{.State.Running}}' " + name).strip() == "true"


def onebot_token():
    try:
        with open(TOKEN_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def qq_status():
    """online / offline / stopped / unknown — never raises."""
    if not container_running("snowluma"):
        return "stopped"
    token = onebot_token()
    if not token:
        return "unknown"
    try:
        req = urllib.request.Request(
            ONEBOT_URL, data=b"{}",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + token})
        with urllib.request.urlopen(req, timeout=4) as r:
            d = json.loads(r.read())
        return "online" if d.get("status") == "ok" and d.get("data", {}).get("online") else "offline"
    except Exception:
        return "unknown"


def read_mem():
    d = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, v = line.split(":", 1)
            d[k] = int(v.strip().split()[0]) // 1024
    total = d.get("MemTotal", 0)
    avail = d.get("MemAvailable", 0)
    return {"total_mb": total, "used_mb": total - avail, "avail_mb": avail,
            "swap_total_mb": d.get("SwapTotal", 0),
            "swap_used_mb": d.get("SwapTotal", 0) - d.get("SwapFree", 0)}


def containers():
    out = sh("docker stats --no-stream --format "
             "'{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}'")
    res = []
    for line in out.splitlines():
        p = line.split("|")
        if len(p) == 4:
            res.append({"name": p[0], "cpu": p[1], "mem": p[2], "mem_pct": p[3]})
    return res


def stats():
    return {"ts": int(time.time()), "host": socket.gethostname(), "uptime": sh("uptime -p"),
            "load": [round(x, 2) for x in os.getloadavg()], "cpu_count": os.cpu_count(),
            "mem": read_mem(), "disk": sh("df -h / | tail -1"), "containers": containers(),
            "qq": qq_status()}


def do_action(name):
    if name not in ACTIONS:
        return {"ok": False, "msg": "未知操作"}
    label, cmd, timeout = ACTIONS[name]
    try:
        subprocess.run(cmd, shell=True, capture_output=True, text=True,
                       timeout=timeout, check=True)
        return {"ok": True, "msg": label + " 已执行"}
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return {"ok": False, "msg": label + " 失败，请检查服务器日志"}


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/stats"):
            body = json.dumps(stats(), ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        try:
            with open(DASHBOARD_FILE, encoding="utf-8") as f:
                html = f.read()
        except OSError:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())

    def do_POST(self):
        if self.path.startswith("/api/action"):
            try:
                n = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(n))
                result = do_action(body.get("action", ""))
            except Exception as e:
                result = {"ok": False, "msg": str(e)}
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
