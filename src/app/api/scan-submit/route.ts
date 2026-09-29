import { NextRequest, NextResponse } from 'next/server';
import { issueFoodToken } from '@/actions/tokenActions';
import { scanStudentIntoDailyFoodList } from '@/actions/foodListActions';
import { broadcastTerminalEvent } from '@/lib/terminalEvents';
import { getMealSession } from '@/utils/timeUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const studentId = (body.studentId || '').trim().toUpperCase();
    const mode = body.mode === 'intake' ? 'intake' : 'token';
    const targetDate = body.date || new Date().toISOString().split('T')[0];

    if (!studentId) {
      return NextResponse.json({ success: false, message: 'Student ID is required.' }, { status: 400 });
    }

    // =========================================================================
    // MODE 1: INTAKE MODE (Add student to Daily Food List ONLY, ZERO TOKENS)
    // =========================================================================
    if (mode === 'intake') {
      const intakeRes = await scanStudentIntoDailyFoodList(studentId, targetDate, 'Mobile Intake Scanner');

      if (intakeRes.notFound) {
        broadcastTerminalEvent({
          type: 'NOT_FOUND',
          mode: 'intake',
          studentId,
          message: intakeRes.message,
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
          success: false,
          status: 'NOT_FOUND',
          message: intakeRes.message,
        });
      }

      if (intakeRes.alreadyAdded) {
        broadcastTerminalEvent({
          type: 'FOOD_LIST_DUPLICATE',
          mode: 'intake',
          studentId,
          studentName: intakeRes.student?.name,
          department: intakeRes.student?.department,
          year: intakeRes.student?.year,
          project: intakeRes.project,
          date: targetDate,
          message: intakeRes.message,
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
          success: false,
          status: 'FOOD_LIST_DUPLICATE',
          message: intakeRes.message,
          student: intakeRes.student,
          project: intakeRes.project,
        });
      }

      if (!intakeRes.success) {
        broadcastTerminalEvent({
          type: 'ERROR',
          mode: 'intake',
          studentId,
          studentName: intakeRes.student?.name,
          message: intakeRes.message,
          timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
          success: false,
          status: 'ERROR',
          message: intakeRes.message,
        });
      }

      // Broadcast FOOD_LIST_ADDED event to open food list desk screen
      broadcastTerminalEvent({
        type: 'FOOD_LIST_ADDED',
        mode: 'intake',
        studentId,
        studentName: intakeRes.student?.name,
        department: intakeRes.student?.department,
        year: intakeRes.student?.year,
        project: intakeRes.project,
        date: targetDate,
        message: intakeRes.message,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        status: 'FOOD_LIST_ADDED',
        message: intakeRes.message,
        student: intakeRes.student,
        project: intakeRes.project,
      });
    }

    // =========================================================================
    // MODE 2: TOKEN MODE (Mess Terminal - Verify eligibility and issue Meal Token)
    // =========================================================================
    const currentSession = getMealSession();

    // Single-pass atomic verification and token issuance in ONE database trip!
    const issueRes = await issueFoodToken(studentId);

    if (issueRes.notFound) {
      broadcastTerminalEvent({
        type: 'NOT_FOUND',
        mode: 'token',
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
        mode: 'token',
        studentId,
        studentName: issueRes.student?.name,
        department: issueRes.student?.department,
        year: issueRes.student?.year,
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
        mode: 'token',
        studentId,
        studentName: issueRes.student?.name,
        department: issueRes.student?.department,
        year: issueRes.student?.year,
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
        mode: 'token',
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
      mode: 'token',
      studentId: t.studentId,
      studentName: t.studentName,
      department: issueRes.student?.department,
      year: issueRes.student?.year,
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
