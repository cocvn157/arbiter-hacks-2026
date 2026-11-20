import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4173;
const CDP_PORT = 9235;
const URL = `http://127.0.0.1:${PORT}/`;
const SCREENSHOT_OUT = path.resolve('docs', 'screenshot.png');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForCdpTarget(cdpPort, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error('Timed out waiting for Edge CDP target');
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
          else entry.resolve(msg.result);
        }
      } else {
        this.events.push(msg);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`JS exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  fs.mkdirSync(path.dirname(SCREENSHOT_OUT), { recursive: true });
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-e2e-'));

  const previewProc = spawn('npx.cmd', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    shell: true,
    stdio: 'ignore',
  });

  let edgeProc;
  let cdp;

  try {
    await waitForHttp(URL);
    edgeProc = spawn(
      EDGE_PATH,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profileDir}`,
        '--window-size=1280,720',
        URL,
      ],
      { stdio: 'ignore' },
    );

    const target = await waitForCdpTarget(CDP_PORT);
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: URL });
    await sleep(1200);

    // Check initial render & layout overflow
    const initial = await cdp.eval(`(() => {
      const kpiDiv = document.querySelector('[data-testid="kpi-diversion"]')?.textContent;
      const kpiMeals = document.querySelector('[data-testid="kpi-meals"]')?.textContent;
      const kpiCo2 = document.querySelector('[data-testid="kpi-co2e"]')?.textContent;
      const kpiEcon = document.querySelector('[data-testid="kpi-economics"]')?.textContent;
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      const lotCount = document.querySelectorAll('[role="option"]').length;
      return { kpiDiv, kpiMeals, kpiCo2, kpiEcon, overflow, lotCount, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth };
    })()`);

    console.log('INITIAL:', JSON.stringify(initial));
    if (!initial.kpiDiv || initial.lotCount < 5) {
      throw new Error(`Unexpected initial state: ${JSON.stringify(initial)}`);
    }

    // Capture primary screenshot at 1280x720
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(SCREENSHOT_OUT, Buffer.from(shot.data, 'base64'));
    console.log('SCREENSHOT_SAVED:', SCREENSHOT_OUT);

    // Test interactive scenario switching
    await cdp.eval(`(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      tabs[1]?.click();
    })()`);
    await sleep(250);
    const s2 = await cdp.eval(`({
      div: document.querySelector('[data-testid="kpi-diversion"]')?.textContent,
      lots: document.querySelectorAll('[role="option"]').length
    })`);
    console.log('SCENARIO_2:', JSON.stringify(s2));

    // Switch back to Scenario 1
    await cdp.eval(`(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      tabs[0]?.click();
    })()`);
    await sleep(250);

    // Test adding a custom lot via Intake Modal
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Log Lot / CSV'));
      btn?.click();
    })()`);
    await sleep(200);
    await cdp.eval(`(() => {
      const submit = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Route Lot via Arbiter'));
      submit?.click();
    })()`);
    await sleep(250);
    const afterAdd = await cdp.eval(`document.querySelectorAll('[role="option"]').length`);
    console.log('AFTER_ADD_LOTS:', afterAdd);
    if (afterAdd !== initial.lotCount + 1) {
      throw new Error(`Expected lot count ${initial.lotCount + 1}, got ${afterAdd}`);
    }

    // Test Methodology Modal open & close
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Model Spec'));
      btn?.click();
    })()`);
    await sleep(150);
    const modalVisible = await cdp.eval(`Boolean(document.querySelector('[aria-label="Engine Methodology"]'))`);
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Done'));
      btn?.click();
    })()`);
    console.log('METHODOLOGY_MODAL_OK:', modalVisible);

    // Count runtime exceptions and console errors
    const exceptions = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown');
    const consoleErrors = cdp.events.filter(
      (e) => e.method === 'Runtime.consoleAPICalled' && e.params?.type === 'error',
    );
    console.log(`RUNTIME_ERRORS=${exceptions.length} CONSOLE_ERRORS=${consoleErrors.length}`);
    if (exceptions.length > 0 || consoleErrors.length > 0) {
      console.error('ERRORS:', JSON.stringify({ exceptions, consoleErrors }, null, 2));
      process.exitCode = 1;
    }
  } finally {
    if (cdp) cdp.close();
    if (edgeProc) edgeProc.kill();
    previewProc.kill();
    await sleep(300);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
