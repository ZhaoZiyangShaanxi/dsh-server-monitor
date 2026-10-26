import json
import subprocess
import urllib.request

BASE = "http://127.0.0.1:16199"
stats = json.load(urllib.request.urlopen(BASE + "/api/stats", timeout=10))
print("keys:", sorted(stats.keys()))
print("mem keys:", sorted(stats["mem"].keys()))
print("qq:", stats["qq"], "cpu:", stats["cpu_count"], "load:", stats["load"])
print("containers:", [c["name"] for c in stats["containers"]])
print("uptime:", stats["uptime"])

page = urllib.request.urlopen(BASE + "/", timeout=10)
print("page status:", page.status, "has api path:", b"/api/stats" in page.read())

req = urllib.request.Request(BASE + "/api/action", data=json.dumps({"action": "shell"}).encode(),
                             headers={"Content-Type": "application/json"})
print("bad action:", json.loads(urllib.request.urlopen(req, timeout=10).read()))
