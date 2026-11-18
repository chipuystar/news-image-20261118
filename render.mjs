// Renders news.html to entry.png: headless Chromium via CDP.
// Run from this directory: node render.mjs
// Uses the image WebGL policy (allows all origins); localhost navigation is
// blocked in this environment, so the page loads from a file:// URL.
import { WebSocket } from 'ws';
import { spawn, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const DEBUG_PORT = 9228;
const WIDTH = 1024;
const HEIGHT = 1024;
const SHA = '8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6';
const URL = `file://${join(DIR, 'news.html')}`;
const OUT = join(DIR, 'entry.png');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  try { execSync(`pkill -f 'remote-debugging-port=${DEBUG_PORT}'`); await sleep(500); } catch {}
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    `--remote-debugging-port=${DEBUG_PORT}`, '--allow-file-access-from-files',
    '--hatch-webgl-allowed-domains-file=/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt',
    `--hatch-webgl-allowed-domains-sha256=${SHA}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let version;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) { version = await res.json(); break; }
    } catch {}
    await sleep(500);
  }
  if (!version) throw new Error('DevTools endpoint did not come up');

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  let id = 0;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await send('Page.navigate', { url: URL }, sessionId);
    await sleep(2000);
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      fromSurface: true,
    }, sessionId);
    writeFileSync(OUT, Buffer.from(data, 'base64'));
    console.log('rendered:', OUT);
  } finally {
    ws.close();
    chrome.kill();
  }
  process.exit(0);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
