import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentScan, issueFoodToken } from '@/actions/tokenActions';
import { getTodayISTDateString } from '@/utils/timeUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = body.studentId || body.rollNumber || body.id;
    const action = body.action || 'verify'; // 'verify' | 'issue'
    const date = body.date || getTodayISTDateString();

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student roll number or ID is required.' },
        { status: 400 }
      );
    }

    if (action === 'issue') {
      const issueResult = await issueFoodToken(studentId, body.staffUserId || 'staff-001');
      return NextResponse.json(issueResult, { status: issueResult.success ? 200 : 400 });
    }

    // Default verify action
    const verifyResult = await verifyStudentScan(studentId, date);
    return NextResponse.json({ success: true, ...verifyResult });
  } catch (error) {
    console.error('API token scan error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while scanning token.' },
      { status: 500 }
    );
  }
}
