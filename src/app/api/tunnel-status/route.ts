import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
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

    return NextResponse.json({
      success: true,
      active: false,
      url: 'https://sairam-incubation.loca.lt',
      mobileScanUrl: 'https://sairam-incubation.loca.lt/mobile-scan',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error checking tunnel status' },
      { status: 500 }
    );
  }
}
