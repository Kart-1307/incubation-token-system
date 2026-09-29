import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';

// Clean candidate subdomains in order of preference
const PREFERRED_SUBDOMAINS = [
  'sairam-incubation',
  'sairam-food',
  'sairam-mess',
  'sairam-tokens',
];

const PORT = 3000;
const RETRY_INTERVAL_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 20000;

let currentTunnel = null;
let heartbeatInterval = null;
let isShuttingDown = false;
let activeTunnelUrl = '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeActiveTunnelInfo(url) {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const filePath = path.join(publicDir, 'active-tunnel.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          url,
          mobileScanUrl: `${url}/mobile-scan`,
          updatedAt: new Date().toISOString(),
          status: 'online',
        },
        null,
        2
      )
    );
  } catch (err) {
    // Non-blocking file write error
  }
}

function removeActiveTunnelInfo() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'active-tunnel.json');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

function startHeartbeat(targetUrl) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(async () => {
    try {
      await fetch(`${targetUrl}/api/terminal-stream`, {
        method: 'HEAD',
        headers: { 'Bypass-Tunnel-Reminder': 'true' },
        signal: AbortSignal.timeout(6000),
      }).catch(() => {});
    } catch {}
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function closeCurrentTunnel() {
  stopHeartbeat();
  removeActiveTunnelInfo();
  if (currentTunnel) {
    try {
      currentTunnel.removeAllListeners();
      currentTunnel.close();
    } catch {}
    currentTunnel = null;
  }
}

async function trySubdomain(subdomain) {
  try {
    const tunnelPromise = localtunnel({
      port: PORT,
      subdomain,
    });

    // 5-second timeout so it never hangs indefinitely
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout (5s)')), 5000)
    );

    const tunnel = await Promise.race([tunnelPromise, timeoutPromise]);
    const actualUrl = (tunnel.url || '').trim().replace(/\/$/, '');
    const expectedUrl = `https://${subdomain}.loca.lt`;

    if (actualUrl.toLowerCase() === expectedUrl.toLowerCase()) {
      return { success: true, tunnel, url: actualUrl, isExact: true };
    }

    // Server re-assigned because subdomain was locked
    try {
      tunnel.close();
    } catch {}
    return { success: false, assigned: actualUrl };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
}

async function connectTunnel() {
  if (isShuttingDown) return;

  await closeCurrentTunnel();

  let attempt = 1;
  while (!isShuttingDown) {
    console.log(`\n[Tunnel] Connecting to mobile tunnel server (Attempt #${attempt})...`);

    // 1. Try our preferred clean institutional subdomains first
    for (const sub of PREFERRED_SUBDOMAINS) {
      process.stdout.write(`[Tunnel] Checking subdomain: https://${sub}.loca.lt ... `);
      const res = await trySubdomain(sub);

      if (res.success) {
        console.log(`LOCKED!`);
        currentTunnel = res.tunnel;
        activeTunnelUrl = res.url;

        console.log(`\n============================================================`);
        console.log(`✓ MOBILE TUNNEL ACTIVE:      ${activeTunnelUrl}`);
        console.log(`📱 Mobile Scanner Link:       ${activeTunnelUrl}/mobile-scan`);
        console.log(`📋 Daily Food List Scanner:   ${activeTunnelUrl}/mobile-scan?mode=intake`);
        console.log(`⚡ Auto-Sync to Desktop:     CONNECTED`);
        console.log(`============================================================\n`);

        writeActiveTunnelInfo(activeTunnelUrl);
        startHeartbeat(activeTunnelUrl);

        currentTunnel.on('close', async () => {
          if (isShuttingDown) return;
          console.warn(`\n[!] Tunnel connection lost. Reconnecting in 3s...`);
          await sleep(3000);
          connectTunnel();
        });

        currentTunnel.on('error', async (err) => {
          if (isShuttingDown) return;
          console.warn(`\n[!] Tunnel error: ${err?.message || err}. Reconnecting in 3s...`);
          await sleep(3000);
          connectTunnel();
        });

        return;
      } else {
        console.log(`(temporarily busy, trying next)`);
      }
    }

    // 2. If all preferred subdomains are temporarily held, accept a clean fallback
    console.log(`[!] Preferred names currently releasing on server. Requesting assigned tunnel...`);
    try {
      const fallbackPromise = localtunnel({ port: PORT });
      const fallbackTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout (5s)')), 5000)
      );
      const fallbackTunnel = await Promise.race([fallbackPromise, fallbackTimeout]);
      const fallbackUrl = (fallbackTunnel.url || '').trim().replace(/\/$/, '');

      if (fallbackUrl) {
        currentTunnel = fallbackTunnel;
        activeTunnelUrl = fallbackUrl;

        console.log(`\n============================================================`);
        console.log(`✓ MOBILE TUNNEL ACTIVE:      ${activeTunnelUrl}`);
        console.log(`📱 Mobile Scanner Link:       ${activeTunnelUrl}/mobile-scan`);
        console.log(`============================================================\n`);

        writeActiveTunnelInfo(activeTunnelUrl);
        startHeartbeat(activeTunnelUrl);

        fallbackTunnel.on('close', async () => {
          if (isShuttingDown) return;
          await sleep(3000);
          connectTunnel();
        });

        return;
      }
    } catch (err) {
      console.warn(`[!] Connection attempt error: ${err?.message || err}`);
    }

    attempt++;
    console.log(`[!] Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
    await sleep(RETRY_INTERVAL_MS);
  }
}

// Clean up tunnel on exit to prevent zombie locks
const handleExit = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[Tunnel] Shutting down cleanly and releasing subdomain...');
  await closeCurrentTunnel();
  process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

// Keep standard input listening so the process doesn't exit on Windows
if (process.stdin.isTTY) {
  process.stdin.resume();
}

// Start the tunnel loop
connectTunnel();
