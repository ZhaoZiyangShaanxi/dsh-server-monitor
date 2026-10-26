import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const inject = ['webServer'];

const ROOT = '/dsh-server-monitor';
const ACTIONS = new Set(['purge_cache', 'restart_snow', 'restart_ast', 'restart_both']);

/** Connection details live outside the package so no host or key is published. */
function settings() {
  const file = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-server-monitor.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) || {};
  } catch (error) {
    console.error('server monitor config unavailable:', error.message);
    return {};
  }
}

export function apply(ctx) {
  const config = settings();
  const localPort = config.localPort ?? 16186;
  const vncPort = config.vncPort ?? 16081;
  const upstream = 'http://127.0.0.1:' + localPort;
  const configured = !!(config.host && config.identityFile);
  if (!configured) console.error('server monitor: configure SSH host and identityFile in dsh-server-monitor.json');
  let child, timer, stopped = false, backoff = 10000;

  // Own a dedicated tunnel so the plugin never disturbs a user's existing forwards.
  function connect() {
    if (stopped || !configured) return;
    child = spawn('ssh', [
      '-N', '-T', '-i', config.identityFile,
      '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
      '-o', 'UserKnownHostsFile=' + (config.knownHostsFile || join(homedir(), '.ssh', 'known_hosts')),
      '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-L', '127.0.0.1:' + localPort + ':127.0.0.1:' + (config.remotePort ?? 6186),
      '-L', '127.0.0.1:' + vncPort + ':127.0.0.1:' + (config.remoteVncPort ?? 6081),
      config.host,
    ], { windowsHide: true, stdio: ['ignore', 'ignore', 'inherit'] });
    let scheduled = false;
    const startedAt = Date.now();
    const retry = () => {
      if (scheduled || stopped) return;
      scheduled = true;
      // A refused or dropped handshake is not worth a fixed 10s hammer: repeated
      // attempts are what get a host banned by fail2ban. Back off instead.
      if (Date.now() - startedAt > 60000) backoff = 10000;
      timer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 300000);
    };
    child.once('error', error => { console.error('server monitor SSH failed to start:', error.message); retry(); });
    child.once('exit', code => { if (code !== 0) console.error('server monitor SSH exited:', code); retry(); });
  }
  connect();
  ctx.effect(() => () => { stopped = true; clearTimeout(timer); child?.kill(); }, 'server monitor: tunnel');

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROOT, handler: async (req, res) => {
    const reply = (status, value) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname.slice(ROOT.length);
      let options = { signal: AbortSignal.timeout(70000) };
      if (req.method === 'POST' && path === '/api/action') {
        if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) return reply(403, { ok: false, msg: 'cross-site control rejected' });
        let text = '';
        for await (const chunk of req) {
          text += chunk;
          if (text.length > 1024) return reply(413, { ok: false, msg: 'payload too large' });
        }
        const body = JSON.parse(text);
        if (!ACTIONS.has(body.action)) return reply(400, { ok: false, msg: 'unknown action' });
        options = { ...options, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: body.action }) };
      } else if (req.method !== 'GET' || !['/', '/api/stats'].includes(path)) {
        return reply(404, { ok: false, msg: 'not found' });
      }
      const upstreamResponse = await fetch(upstream + path, options);
      let body = await upstreamResponse.text();
      if (path === '/') body = body.replaceAll('"/api/', '"' + ROOT + '/api/');
      if (path === '/api/stats') body = JSON.stringify({ ...JSON.parse(body), vncUrl: 'http://localhost:' + vncPort + '/?resize=scale' });
      res.writeHead(upstreamResponse.status, {
        'content-type': path === '/' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-frame-options': 'SAMEORIGIN',
      });
      res.end(body);
    } catch {
      if (req.method === 'GET' && new URL(req.url, 'http://localhost').pathname === ROOT + '/') {
        res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end('<meta charset="utf-8"><meta http-equiv="refresh" content="5"><body style="background:#0e1117;color:#e6edf3;font:16px system-ui;padding:24px">connecting, retrying in 5 seconds…</body>');
      } else {
        reply(503, { ok: false, msg: configured ? 'SSH 隧道未连通；请检查服务器 SSH 服务和 DSH 主机日志' : '服务器监控未配置 SSH host 或 identityFile' });
      }
    }
  } }), 'server monitor: routes');
}