# dsh-server-monitor

![plugin](https://img.shields.io/badge/dsh-plugin-blue) ![license](https://img.shields.io/badge/license-MIT-green)

A DeepSeek Harness (DSH) plugin that puts a server resource and control window **inside DSH** — no separate browser tab or manual tunnel.

## What it does

- Shows memory, swap, load, disk, per-container stats and QQ login status.
- Buttons: clear kernel cache, restart SnowLuma / AstrBot / both.
- QQ 登录 / QQ 退出 open the native QQ desktop **inside DSH** via noVNC in a near-fullscreen overlay, so the QR code and chat list stay legible. Scan the QR code or choose Sign out in QQ; stopping a container is not account logout.
- Collapses to a small button in the shell, and stays collapsed until the first successful read so an unconfigured install never parks an error card over the chat.
- Maintains loopback-only SSH forwards for monitor and noVNC with automatic reconnect.

This is a two-part product: the panel **plus the agent it talks to**. Both ship here — `server/` is the complete backend, so nothing private is required to get a working install.

## Install

Standard DSH bundle (`package.json` declares `dsh.bundle.patch` and ships `cordis.patch.yml`):

```sh
dsh plugin --profile desktop add https://github.com/ZhaoZiyangShaanxi/dsh-server-monitor
```

Manual install (development):

1. Link or install this package into your DSH profile's `node_modules`.
2. Add it to your profile patch:

```yaml
- insert:
    - id: dsh-server-monitor
      name: dsh-server-monitor
```

3. Reload DSH.

Prerequisite: the agent below reachable over SSH from the machine running DSH. Without it the panel reports the tunnel as down rather than pretending to have data.

## Configure

Create `$DSH_HOME/dsh-server-monitor.json` (defaults to `~/.dsh`):

```json
{
  "host": "root@your-server",
  "identityFile": "/path/to/key.pem",
  "knownHostsFile": "/path/to/known_hosts",
  "remotePort": 6186,
  "localPort": 16186,
  "remoteVncPort": 6081,
  "vncPort": 16081
}
```

Only `host` and `identityFile` are required. `remoteVncPort`/`vncPort` can be dropped if you do not want the QQ view.

## Server side: the bundled agent

`server/` is the whole backend — no other service or private repository is involved.

| File | Purpose |
| --- | --- |
| `server/monitor.py` | The agent: `GET /api/stats`, `POST /api/action`, static dashboard. |
| `server/dashboard.html` | Standalone page served on `/`, handy before the plugin is installed. |
| `server/qqbot-monitor.service` | systemd unit, loopback-bound. |
| `server/selftest.py` | Asserts the live contract (see below) against a running agent. |

```sh
sudo mkdir -p /opt/qqbot-monitor
sudo cp server/monitor.py server/dashboard.html /opt/qqbot-monitor/
sudo install -m 600 /dev/null /opt/qqbot-monitor/onebot-token   # then paste your OneBot token
sudo cp server/qqbot-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now qqbot-monitor
```

It talks to SnowLuma's OneBot endpoint (`ONEBOT_URL`, default `http://127.0.0.1:3000/get_status`) to report QQ login state, and drives these containers by name: `snowluma`, `astrbot`. Point the noVNC forward at your SnowLuma instance for the QQ view.

Environment overrides (all optional): `MONITOR_HOST` (`127.0.0.1`), `MONITOR_PORT` (`6186`), `ONEBOT_TOKEN_FILE`, `ONEBOT_URL`, `MONITOR_DASHBOARD`.

### `/api/stats` field contract

The plugin reads exactly these fields; anything else is ignored.

| Field | Type | Meaning |
| --- | --- | --- |
| `ts` | int | Unix seconds of the sample. |
| `host` | string | Hostname shown in the panel footer. |
| `uptime` | string | `uptime -p` output. |
| `load` | `[n,n,n]` | 1/5/15-minute load averages. |
| `cpu_count` | int | Core count, for load context. |
| `mem` | object | `total_mb`, `used_mb`, `avail_mb`, `swap_total_mb`, `swap_used_mb`. |
| `disk` | string | One `df -h /` row; the panel takes columns by whitespace. |
| `containers` | array | `{name, cpu, mem, mem_pct}`, all display strings. |
| `qq` | string | `online`, `offline`, `stopped`, or `unknown`. |

`POST /api/action` accepts `purge_cache`, `restart_snow`, `restart_ast`, `restart_both` and returns `{ok, msg}`. Anything else is a 400 — QQ login/logout are deliberately not API actions.

Most of the values are display strings on purpose: the panel is a readout, and parsing `docker stats` output server-side keeps the client dumb. `mem` and `load` stay numeric because the panel computes percentages and colours.

## Security

- Control requests must be same-origin; cross-site POSTs are rejected.
- On Desktop hosts the panel also runs the official Connection fence (`ctx.connection.requestRejection`), matching first-party plugins. It is probed, not injected, so the plugin still loads on hosts without that service.
- Only four monitor actions are allowed; QQ login/logout are not API actions.
- The agent binds loopback and does not authenticate — the SSH tunnel is the boundary. Do not expose port 6186.
- SSH and VNC bind locally; restrict any publicly exposed remote VNC port with your firewall.
- No host, key path, VNC password, or token is stored in this repository. Embedded VNC assumes DSH runs on the SSH tunnel machine.

## Known limits

- The QQ view is an `iframe` pointed at the local VNC forward, because a WebSocket upgrade cannot pass through the DSH host proxy. That forward must be up before you click 登录.
- The overlay shows the whole remote desktop, so QQ keeps its own window size. A guest screen of 1366x768 or smaller (`SNOWLUMA_SCREEN`) makes it fill the frame.
- Host-side changes take effect after DSH restarts; the desktop host runs without `--expose-internals`, so module HMR cannot reload this plugin in place.
- 退出 only opens the QR view — you still press sign-out inside QQ. Stopping the container just takes the bot offline; it does not end the account session.
- Container names (`snowluma`, `astrbot`) and SnowLuma's `get_status` response are what the defaults assume; edit `ACTIONS`/`qq_status` in `server/monitor.py` for a different stack.

## Test

Plugin (proxied routes, allowlist, CSRF fence, outage state, panel rendering):

```bash
node dsh-server-monitor/test.mjs
```

Agent (contract against a running instance):

```bash
MONITOR_PORT=16199 python3 dsh-server-monitor/server/monitor.py &
MONITOR_PORT=16199 python3 dsh-server-monitor/server/selftest.py
```
