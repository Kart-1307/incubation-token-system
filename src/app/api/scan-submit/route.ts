import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentScan, issueFoodToken } from '@/actions/tokenActions';
import { broadcastTerminalEvent } from '@/lib/terminalEvents';
import { getMealSession } from '@/utils/timeUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const studentId = (body.studentId || '').trim().toUpperCase();

    if (!studentId) {
      return NextResponse.json({ success: false, message: 'Student ID is required.' }, { status: 400 });
    }

    const currentSession = getMealSession();

    // Single-pass atomic verification and token issuance in ONE database trip!
    const issueRes = await issueFoodToken(studentId);

    if (issueRes.notFound) {
      broadcastTerminalEvent({
        type: 'NOT_FOUND',
        studentId,
        message: issueRes.message,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: false,
        status: 'NOT_FOUND',
        message: issueRes.message,
      });
    }

    if (issueRes.isDuplicate && issueRes.existingToken) {
      broadcastTerminalEvent({
        type: 'DUPLICATE',
        studentId,
        studentName: issueRes.student?.name,
        department: issueRes.student?.department,
        project: issueRes.project,
        tokenNumber: issueRes.existingToken.tokenNumber,
        session: issueRes.existingToken.session || currentSession,
        date: issueRes.existingToken.date,
        time: issueRes.existingToken.time,
        message: issueRes.message,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: false,
        status: 'DUPLICATE',
        message: issueRes.message,
        existingToken: issueRes.existingToken,
        student: issueRes.student,
      });
    }

    if (issueRes.isEligible === false) {
      broadcastTerminalEvent({
        type: 'INELIGIBLE',
        studentId,
        studentName: issueRes.student?.name,
        department: issueRes.student?.department,
        project: issueRes.project,
        session: currentSession,
        message: issueRes.message,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: false,
        status: 'INELIGIBLE',
        message: issueRes.message,
        student: issueRes.student,
      });
    }

    if (!issueRes.success || !issueRes.token) {
      broadcastTerminalEvent({
        type: 'ERROR',
        studentId,
        studentName: issueRes.student?.name,
        message: issueRes.message,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: false,
        status: 'ERROR',
        message: issueRes.message,
      });
    }

    const t = issueRes.token;

    // Broadcast Success Event to active Laptop Terminal
    broadcastTerminalEvent({
      type: 'TOKEN_ISSUED',
      studentId: t.studentId,
      studentName: t.studentName,
      department: issueRes.student?.department,
      project: t.project,
      tokenNumber: t.tokenNumber,
      session: t.session || currentSession,
      date: t.date,
      time: t.time,
      message: issueRes.message,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      status: 'TOKEN_ISSUED',
      message: issueRes.message,
      token: t,
      student: issueRes.student,
    });
  } catch (err: any) {
    console.error('Scan submission error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error processing scan.' },
      { status: 500 }
    );
  }
}
