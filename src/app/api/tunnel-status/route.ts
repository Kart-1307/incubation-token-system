import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

function getLocalIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const origin = `${proto}://${host}`;
    const isDeployed = !host.includes('localhost') && !host.includes('127.0.0.1');

    const localIp = getLocalIpAddress();
    const port = host.includes(':') ? host.split(':')[1] : '3000';
    const localIpUrl = localIp ? `http://${localIp}:${port}` : null;

    const filePath = path.join(process.cwd(), 'public', 'active-tunnel.json');
    let tunnelData: any = null;
    let tunnelActive = false;

    if (fs.existsSync(filePath)) {
      try {
        tunnelData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const ageMs = Date.now() - new Date(tunnelData.updatedAt || 0).getTime();
        // Active if updated in last 60 seconds
        tunnelActive = ageMs < 60000;
      } catch {}
    }

    const preferredTunnelUrl = tunnelData?.url || 'https://sairam-incubation.loca.lt';
    const activeUrl = isDeployed ? origin : (tunnelActive ? preferredTunnelUrl : (localIpUrl || preferredTunnelUrl));

    return NextResponse.json({
      success: true,
      active: isDeployed || tunnelActive,
      url: activeUrl,
      tunnelUrl: preferredTunnelUrl,
      tunnelActive,
      localIpUrl,
      isDeployed,
      mobileScanUrl: `${activeUrl}/mobile-scan`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error checking tunnel status' },
      { status: 500 }
    );
  }
}
