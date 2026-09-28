import { NextResponse } from 'next/server';
import { getStaffSession } from '@/actions/authActions';

export async function GET() {
  const session = await getStaffSession();
  return NextResponse.json(session);
}
