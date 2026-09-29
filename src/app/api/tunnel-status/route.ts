import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'active-tunnel.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return NextResponse.json({
        success: true,
        active: true,
        url: data.url,
        mobileScanUrl: data.mobileScanUrl,
        updatedAt: data.updatedAt,
      });
    }

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const origin = `${proto}://${host}`;

    const isDeployed = !host.includes('localhost') && !host.includes('127.0.0.1');
    const defaultUrl = isDeployed ? origin : 'https://sairam-incubation.loca.lt';

    return NextResponse.json({
      success: true,
      active: isDeployed,
      url: defaultUrl,
      mobileScanUrl: `${defaultUrl}/mobile-scan`,
      isDeployed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error checking tunnel status' },
      { status: 500 }
    );
  }
}
