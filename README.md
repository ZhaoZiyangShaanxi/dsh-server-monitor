# dsh-server-monitor

A DeepSeek Harness (DSH) plugin that puts a server resource and control window **inside DSH** — no separate browser tab or manual tunnel.

## What it does

- Shows memory, swap, load, disk, per-container stats and QQ login status.
- Buttons: clear kernel cache, restart SnowLuma / AstrBot / both.
- Collapses to a small button and reopens from the same place in the shell.
- Keeps its own SSH tunnel with automatic reconnect, so it never touches your other forwards.

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
  "localPort": 16186
}
```

## Server side

The plugin expects the existing `qqbot-monitor` service on the server: a small Python HTTP service bound to `127.0.0.1:6186` exposing `/api/stats` and `POST /api/action` (`purge_cache`, `restart_snow`, `restart_ast`, `restart_both`).

## Security

- Control requests must be same-origin; cross-site POSTs are rejected.
- Only four actions are allowed; no shell passthrough.
- No host, key path, or token is stored in this repository.

## Test

```bash
node dsh-server-monitor/test.mjs
```
