# dsh-server-monitor

A DeepSeek Harness (DSH) plugin that puts a server resource and control window **inside DSH** — no separate browser tab or manual tunnel.

## What it does

- Shows memory, swap, load, disk, per-container stats and QQ login status.
- Buttons: clear kernel cache, restart SnowLuma / AstrBot / both.
- QQ 登录 / QQ 退出 open the native QQ desktop **inside DSH** via noVNC in a near-fullscreen overlay, so the QR code and chat list stay legible. Scan the QR code or choose Sign out in QQ; stopping a container is not account logout.
- Collapses to a small button in the shell.
- Maintains loopback-only SSH forwards for monitor and noVNC with automatic reconnect.

## Install

1. Link or install this package into your DSH profile's `node_modules`.
2. Add it to your profile patch:

```yaml
- insert:
    - id: dsh-server-monitor
      name: dsh-server-monitor
```

3. Reload DSH.

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

## Server side

The plugin expects `qqbot-monitor` bound to `127.0.0.1:6186` with `/api/stats` and `POST /api/action` (`purge_cache`, `restart_snow`, `restart_ast`, `restart_both`), plus SnowLuma noVNC at `127.0.0.1:6081`. The QQ desktop may require its VNC password. Login and logout happen manually in QQ; the plugin never submits credentials or deletes session data.

## Security

- Control requests must be same-origin; cross-site POSTs are rejected.
- Only four monitor actions are allowed; QQ login/logout are not API actions.
- SSH and VNC bind locally; restrict any publicly exposed remote VNC port with your firewall.
- No host, key path, VNC password, or token is stored in this repository. Embedded VNC assumes DSH runs on the SSH tunnel machine.

## Known limits

- The QQ view is an `iframe` pointed at the local VNC forward, because a WebSocket upgrade cannot pass through the DSH host proxy. That forward must be up before you click 登录.
- The overlay shows the whole remote desktop, so QQ keeps its own window size. A guest screen of 1366x768 or smaller (`SNOWLUMA_SCREEN`) makes it fill the frame.
- Host-side changes take effect after DSH restarts; the desktop host runs without `--expose-internals`, so module HMR cannot reload this plugin in place.
- 退出 only opens the QR view — you still press sign-out inside QQ. Stopping the container just takes the bot offline; it does not end the account session.

## Test

```bash
node dsh-server-monitor/test.mjs
```
