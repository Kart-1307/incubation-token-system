import localtunnel from 'localtunnel';

const SUBDOMAIN = 'sairam-incubation';
const PORT = 3000;
const EXPECTED_URL = `https://${SUBDOMAIN}.loca.lt`;
const RETRY_INTERVAL_MS = 4000;
const HEARTBEAT_INTERVAL_MS = 25000;

let currentTunnel = null;
let heartbeatInterval = null;
let isShuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(async () => {
    try {
      // Lightweight fetch to keep the tunnel alive and prevent remote idle disconnects
      await fetch(`https://${SUBDOMAIN}.loca.lt/api/terminal-stream`, {
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
  if (currentTunnel) {
    try {
      currentTunnel.removeAllListeners();
      currentTunnel.close();
    } catch {}
    currentTunnel = null;
  }
}

async function connectTunnel() {
  if (isShuttingDown) return;

  await closeCurrentTunnel();

  let attempt = 1;
  while (!isShuttingDown) {
    console.log(`\n[Tunnel] Requesting fixed domain: ${EXPECTED_URL} (Attempt #${attempt})...`);
    try {
      const tunnel = await localtunnel({
        port: PORT,
        subdomain: SUBDOMAIN,
      });

      const actualUrl = (tunnel.url || '').trim().toLowerCase();

      if (actualUrl === EXPECTED_URL) {
        currentTunnel = tunnel;
        console.log(`\n============================================================`);
        console.log(`✓ TUNNEL LOCKED SUCCESSFULLY: ${EXPECTED_URL}`);
        console.log(`📱 Mobile Scanner Link:       ${EXPECTED_URL}/mobile-scan`);
        console.log(`⚡ Persistent Auto-Recovery:   ACTIVE (Never changes domain)`);
        console.log(`============================================================\n`);

        startHeartbeat();

        tunnel.on('close', async () => {
          if (isShuttingDown) return;
          console.warn(`\n[!] Tunnel connection lost from server. Auto-reconnecting to ${EXPECTED_URL} in 3s...`);
          await sleep(3000);
          connectTunnel();
        });

        tunnel.on('error', async (err) => {
          if (isShuttingDown) return;
          console.warn(`\n[!] Tunnel error: ${err?.message || err}. Auto-recovering in 3s...`);
          await sleep(3000);
          connectTunnel();
        });

        return;
      } else {
        console.warn(`[!] Remote host temporarily assigned '${actualUrl}' (previous session still unlocking).`);
        console.log(`[!] Rejecting random domain. Waiting ${RETRY_INTERVAL_MS / 1000}s for '${SUBDOMAIN}' to free up...`);
        try {
          tunnel.close();
        } catch {}
        attempt++;
        await sleep(RETRY_INTERVAL_MS);
      }
    } catch (err) {
      console.warn(`[!] Connection attempt error: ${err?.message || err}. Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
      attempt++;
      await sleep(RETRY_INTERVAL_MS);
    }
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
process.on('exit', () => {
  stopHeartbeat();
  if (currentTunnel) {
    try {
      currentTunnel.close();
    } catch {}
  }
});

// Start the tunnel loop
connectTunnel();
