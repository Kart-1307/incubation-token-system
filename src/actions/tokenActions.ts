'use server';

import { prisma, ensureDefaultStaffUser } from '@/lib/db';
import { appCache } from '@/lib/cache';
import { getMealSession, getDuplicateTokenMessage, getTokenEffectiveSession } from '@/utils/timeUtils';
import { revalidatePath } from 'next/cache';

export interface IssueTokenResult {
  success: boolean;
  message: string;
  token?: {
    id: string;
    tokenNumber: string;
    studentId: string;
    studentName: string;
    project: string;
    date: string;
    time: string;
    session: string;
    status: string;
  };
}

export interface VerificationResult {
  found: boolean;
  student?: {
    id: string;
    name: string;
    department: string;
    year: number;
    status: string;
  };
  isEligible: boolean;
  project?: string;
  isDuplicate: boolean;
  existingToken?: {
    id: string;
    tokenNumber: string;
    time: string;
    date: string;
    session?: string;
  };
  message: string;
}

export async function verifyStudentScan(studentIdInput: string, targetDate?: string): Promise<VerificationResult> {
  const studentId = (studentIdInput || '').trim().toUpperCase();
  const date = targetDate || new Date().toISOString().split('T')[0];

  if (!studentId) {
    return {
      found: false,
      isEligible: false,
      isDuplicate: false,
      message: 'Student ID cannot be empty.',
    };
  }

  try {
    // 1. Check if student exists in registry
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return {
        found: false,
        isEligible: false,
        isDuplicate: false,
        message: `Student ID "${studentId}" not found in institutional registry.`,
      };
    }

    // 2. Check if student is in eligibility list for the date
    const eligibility = await prisma.dailyFoodEligibility.findUnique({
      where: {
        date_studentId: {
          date,
          studentId: student.id,
        },
      },
      include: { project: true },
    });

    // Also check if any project membership exists to show project name
    let projectName = eligibility?.project?.name || eligibility?.projectCode;
    if (!projectName) {
      const pm = await prisma.projectMember.findFirst?.({
        where: { studentId: student.id },
      });
      if (pm) {
        const proj = await prisma.project.findUnique({ where: { code: pm.projectCode } });
        projectName = proj?.name || pm.projectCode;
      }
    }

    if (!eligibility) {
      return {
        found: true,
        student: {
          id: student.id,
          name: student.name,
          department: student.department,
          year: student.year,
          status: student.status,
        },
        project: projectName || 'Unassigned',
        isEligible: false,
        isDuplicate: false,
        message: `Student "${student.name}" (${student.id}) is NOT on the approved food list for ${date}.`,
      };
    }

    const currentSession = getMealSession();

    // 3. Check if token was already issued for this date AND current session
    const studentTokensToday = await prisma.foodToken.findMany({
      where: {
        date,
        studentId: student.id,
      },
      orderBy: { issuedAt: 'desc' },
    });

    const existingToken = (studentTokensToday || []).find(
      (t: any) =>
        (t.session || '').toUpperCase() === currentSession.toUpperCase() ||
        getTokenEffectiveSession(t) === currentSession
    );

    if (existingToken) {
      const timeStr = existingToken.issuedAt instanceof Date
        ? existingToken.issuedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : 'Earlier';

      const smartMessage = getDuplicateTokenMessage(currentSession, timeStr, student.name);

      return {
        found: true,
        student: {
          id: student.id,
          name: student.name,
          department: student.department,
          year: student.year,
          status: student.status,
        },
        project: projectName,
        isEligible: true,
        isDuplicate: true,
        existingToken: {
          id: existingToken.id,
          tokenNumber: existingToken.tokenNumber,
          time: timeStr,
          date: existingToken.date,
          session: currentSession,
        },
        message: smartMessage,
      };
    }

    return {
      found: true,
      student: {
        id: student.id,
        name: student.name,
        department: student.department,
        year: student.year,
        status: student.status,
      },
      project: projectName,
      isEligible: true,
      isDuplicate: false,
      message: `Student "${student.name}" is eligible for ${currentSession} token.`,
    };
  } catch (error) {
    console.error('Error verifying scan:', error);
    return {
      found: false,
      isEligible: false,
      isDuplicate: false,
      message: 'System error during student verification.',
    };
  }
}

export async function issueFoodToken(studentIdInput: string, staffUserIdInput?: string): Promise<IssueTokenResult> {
  const studentId = studentIdInput.trim().toUpperCase();
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const validStaffId = await ensureDefaultStaffUser();

    return await prisma.$transaction(async (tx: any) => {
      // 1. Verify Student exists
      const student = await tx.student.findUnique({
        where: { id: studentId },
      });
      if (!student) {
        return { success: false, message: `Student ID "${studentId}" not found in registry.` };
      }

      // 2. Verify Eligibility in Today's Food List
      const eligibility = await tx.dailyFoodEligibility.findUnique({
        where: {
          date_studentId: {
            date: todayStr,
            studentId: student.id,
          },
        },
        include: { project: true },
      });

      if (!eligibility) {
        return {
          success: false,
          message: `Student "${student.name}" (${student.id}) is NOT approved for today's food list (${todayStr}).`,
        };
      }

      const session = getMealSession();

      // 3. Check for Duplicate Token for current session Today
      const studentTokensToday = await tx.foodToken.findMany({
        where: {
          date: todayStr,
          studentId: student.id,
        },
        orderBy: { issuedAt: 'desc' },
      });

      const existingToken = (studentTokensToday || []).find(
        (t: any) =>
          (t.session || '').toUpperCase() === session.toUpperCase() ||
          getTokenEffectiveSession(t) === session
      );

      if (existingToken) {
        const timeStr = existingToken.issuedAt instanceof Date
          ? existingToken.issuedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : 'earlier today';

        const smartMessage = getDuplicateTokenMessage(session, timeStr, student.name);

        return {
          success: false,
          message: smartMessage,
        };
      }

      // 4. Generate Consecutive Daily Token Sequence (Collision-free)
      const existingTokensToday = await tx.foodToken.findMany({
        where: { date: todayStr },
        select: { tokenNumber: true },
      });
      const dateTag = todayStr.replace(/-/g, '').slice(2);

      const usedNumbers = new Set((existingTokensToday || []).map((t: any) => t.tokenNumber));
      let nextSeqNum = (existingTokensToday || []).length + 1;
      let tokenNumber = `INC-${dateTag}-${String(nextSeqNum).padStart(3, '0')}`;

      while (usedNumbers.has(tokenNumber)) {
        nextSeqNum++;
        tokenNumber = `INC-${dateTag}-${String(nextSeqNum).padStart(3, '0')}`;
      }

      // 5. Create Token Record
      try {
        const token = await tx.foodToken.create({
          data: {
            tokenNumber,
            date: todayStr,
            studentId: student.id,
            projectCode: eligibility.projectCode,
            session,
            status: 'Generated',
            issuedById: validStaffId,
          },
        });

        // 6. Refresh cached Dashboard and Food Token views
        appCache.invalidateTags(['dashboard', 'foodtokens', 'foodlist']);

        const timeFormatted = token.issuedAt instanceof Date
          ? token.issuedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        return {
          success: true,
          message: `Token ${token.tokenNumber} generated successfully for ${student.name} (${session}).`,
          token: {
            id: token.id,
            tokenNumber: token.tokenNumber,
            studentId: student.id,
            studentName: student.name,
            project: eligibility.project?.name || eligibility.projectCode,
            date: todayStr,
            time: timeFormatted,
            session,
            status: token.status,
          },
        };
      } catch (createErr: any) {
        if (createErr.code === 'P2002') {
          return {
            success: false,
            message: `Token already generated for ${student.name} for today's ${session} session.`,
          };
        }
        throw createErr;
      }
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return { success: false, message: 'Server error occurred while issuing token.' };
  }
}

export async function getFoodTokens(date?: string) {
  const cacheKey = date ? `tokens_${date}` : 'tokens_all';
  return appCache.get(cacheKey, 30, async () => {
    try {
      const where = date ? { date } : undefined;
      const tokens = await prisma.foodToken.findMany({
        where,
        include: {
          student: true,
          project: true,
        },
        orderBy: { issuedAt: 'desc' },
      });

      return tokens.map((t: any) => {
        const issuedDate = t.issuedAt instanceof Date ? t.issuedAt : new Date();
        const session = getTokenEffectiveSession(t);
        return {
          id: t.id,
          tokenNumber: t.tokenNumber,
          studentId: t.studentId,
          studentName: t.student?.name || t.studentId,
          project: t.project?.name || t.projectCode || '—',
          date: t.date,
          time: issuedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          session,
          status: t.status,
          generatedBy: t.issuedById || 'Staff',
        };
      });
    } catch (error) {
      console.error('Error fetching food tokens:', error);
      return [];
    }
  }, ['foodtokens']);
}
