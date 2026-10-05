'use server';

import { prisma, ensureDefaultStaffUser } from '@/lib/db';
import { appCache } from '@/lib/cache';
import { getMealSession, getDuplicateTokenMessage, getTokenEffectiveSession, getTodayISTDateString, formatISTTime, formatISTDateDMY, getPreviousISTDateString } from '@/utils/timeUtils';
import { normalizeDepartmentName } from '@/utils/departmentUtils';

export interface IssueTokenResult {
  success: boolean;
  message: string;
  notFound?: boolean;
  isEligible?: boolean;
  isDuplicate?: boolean;
  existingToken?: {
    id: string;
    tokenNumber: string;
    time: string;
    date: string;
    session?: string;
  };
  student?: {
    id: string;
    name: string;
    department: string;
    year: number;
    status: string;
    category?: 'Student' | 'Intern';
    startupName?: string;
    phone?: string;
  };
  project?: string;
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
    category?: 'Student' | 'Intern';
    startupName?: string;
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
    category?: 'Student' | 'Intern';
    startupName?: string;
    phone?: string;
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

/**
 * Flexible student lookup: handles Roll No, INT-xxxx, 4-6 digit phone suffix, 10-digit phone, or name.
 */
async function resolveStudent(dbOrTx: any, idInput: string) {
  const query = (idInput || '').trim();
  if (!query) return null;
  const upper = query.toUpperCase();
  const digits = query.replace(/\D/g, '');

  // 1. Exact ID
  let student = await dbOrTx.student.findUnique({
    where: { id: upper },
    include: { mentor: true },
  });

  // 2. Prefixed INT- ID if input was "INT 3210" or "INT3210"
  if (!student && upper.startsWith('INT')) {
    const cleanInt = 'INT-' + upper.replace(/^INT[-_\s]*/, '');
    student = await dbOrTx.student.findUnique({
      where: { id: cleanInt },
      include: { mentor: true },
    });
  }

  // 3. 4-6 digits: Intern ID suffix or phone suffix
  if (!student && digits.length >= 4 && digits.length <= 6) {
    student = await dbOrTx.student.findFirst({
      where: {
        OR: [
          { id: `INT-${digits}` },
          { id: { contains: digits } },
          { phone: { endsWith: digits } },
        ],
      },
      include: { mentor: true },
    });
  }

  // 4. 10-digit phone
  if (!student && digits.length >= 10) {
    student = await dbOrTx.student.findFirst({
      where: {
        phone: { contains: digits },
      },
      include: { mentor: true },
    });
  }

  if (student && student.status === 'Deleted') {
    return null;
  }

  return student;
}

export async function verifyStudentScan(
  studentIdInput: string,
  targetDate?: string,
  sessionOverride?: 'BREAKFAST' | 'LUNCH' | 'DINNER'
): Promise<VerificationResult> {
  const inputQuery = (studentIdInput || '').trim();
  const date = targetDate || getTodayISTDateString();

  if (!inputQuery) {
    return {
      found: false,
      isEligible: false,
      isDuplicate: false,
      message: 'Student / Intern ID cannot be empty.',
    };
  }

  try {
    const student = await resolveStudent(prisma, inputQuery);

    if (!student) {
      return {
        found: false,
        isEligible: false,
        isDuplicate: false,
        message: `ID "${inputQuery}" not found in institutional registry.`,
      };
    }

    const isIntern = student.category === 'Intern' || student.id.startsWith('INT-') || student.courseType === 'Intern';
    const category: 'Student' | 'Intern' = isIntern ? 'Intern' : 'Student';
    const startupName = isIntern ? (student.startupName || student.department) : undefined;

    const currentSession = sessionOverride || getMealSession();
    const yesterdayStr = getPreviousISTDateString(date);

    const isMorningOrAfternoon = currentSession === 'BREAKFAST' || currentSession === 'LUNCH';
    const listToRefer = isMorningOrAfternoon ? yesterdayStr : date;

    let eligibility = await prisma.dailyFoodEligibility.findUnique({
      where: {
        date_studentId: {
          date: listToRefer,
          studentId: student.id,
        },
      },
      include: { mentor: true },
    });

    let projectName = eligibility?.mentor?.name || student.mentor?.name;
    if (isIntern && (!projectName || projectName === 'General')) {
      projectName = startupName ? `Startup: ${startupName}` : 'Startup Intern';
    }

    const studentInfo = {
      id: student.id,
      name: student.name,
      department: student.department,
      year: student.year,
      status: student.status,
      category,
      startupName,
      phone: student.phone || undefined,
    };

    if (!eligibility) {
      if (isMorningOrAfternoon) {
        const registeredTonight = await prisma.dailyFoodEligibility.findUnique({
          where: {
            date_studentId: {
              date,
              studentId: student.id,
            },
          },
          include: { mentor: true },
        });

        if (registeredTonight) {
          return {
            found: true,
            student: studentInfo,
            project: registeredTonight.mentor?.name || projectName || 'General',
            isEligible: false,
            isDuplicate: false,
            message: `${category} "${student.name}" (${student.id}) is approved on the ${formatISTDateDMY(date)} list (first meal is Dinner tonight at 07:30 PM). They are NOT on the ${formatISTDateDMY(yesterdayStr)} list for today's ${currentSession}.`,
          };
        }
      }

      const notEligibleMsg = currentSession === 'DINNER'
        ? `${category} "${student.name}" (${student.id}) is NOT on the approved Dinner list for ${formatISTDateDMY(date)}.`
        : `${category} "${student.name}" (${student.id}) is NOT on the ${formatISTDateDMY(yesterdayStr)} Night-Stay list for today's ${currentSession}.`;

      return {
        found: true,
        student: studentInfo,
        project: projectName || 'General',
        isEligible: false,
        isDuplicate: false,
        message: notEligibleMsg,
      };
    }

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
      const timeStr = formatISTTime(existingToken.issuedAt);

      let isRegisteredTonight = false;
      if (currentSession === 'LUNCH') {
        const tonightCheck = await prisma.dailyFoodEligibility.findUnique({
          where: {
            date_studentId: {
              date,
              studentId: student.id,
            },
          },
        });
        isRegisteredTonight = Boolean(tonightCheck);
      }

      const smartMessage = getDuplicateTokenMessage(currentSession, timeStr, student.name, { isRegisteredTonight });

      return {
        found: true,
        student: studentInfo,
        project: projectName || 'General',
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
      student: studentInfo,
      project: projectName || 'General',
      isEligible: true,
      isDuplicate: false,
      message: `${category} "${student.name}" is eligible for ${currentSession} token.`,
    };
  } catch (error) {
    console.error('Error verifying scan:', error);
    return {
      found: false,
      isEligible: false,
      isDuplicate: false,
      message: 'System error during verification.',
    };
  }
}

export async function issueFoodToken(
  studentIdInput: string,
  staffUserIdInput?: string,
  targetDate?: string,
  sessionOverride?: 'BREAKFAST' | 'LUNCH' | 'DINNER'
): Promise<IssueTokenResult> {
  const inputQuery = (studentIdInput || '').trim();
  const todayStr = targetDate || getTodayISTDateString();

  if (!inputQuery) {
    return { success: false, notFound: true, message: 'Student / Intern ID cannot be empty.' };
  }

  try {
    const validStaffId = await ensureDefaultStaffUser();

    return await prisma.$transaction(async (tx: any) => {
      const student = await resolveStudent(tx, inputQuery);
      if (!student) {
        return { success: false, notFound: true, message: `ID "${inputQuery}" not found in institutional registry.` };
      }

      const isIntern = student.category === 'Intern' || student.id.startsWith('INT-') || student.courseType === 'Intern';
      const category: 'Student' | 'Intern' = isIntern ? 'Intern' : 'Student';
      const startupName = isIntern ? (student.startupName || student.department) : undefined;

      const studentInfo = {
        id: student.id,
        name: student.name,
        department: student.department,
        year: student.year,
        status: student.status,
        category,
        startupName,
        phone: student.phone || undefined,
      };

      const session = sessionOverride || getMealSession();
      const yesterdayStr = getPreviousISTDateString(todayStr);

      const isMorningOrAfternoon = session === 'BREAKFAST' || session === 'LUNCH';
      const listToRefer = isMorningOrAfternoon ? yesterdayStr : todayStr;

      let eligibility = await tx.dailyFoodEligibility.findUnique({
        where: {
          date_studentId: {
            date: listToRefer,
            studentId: student.id,
          },
        },
        include: { mentor: true },
      });

      const isNightStayCycle = isMorningOrAfternoon && Boolean(eligibility);

      if (!eligibility) {
        if (isMorningOrAfternoon) {
          const registeredTonight = await tx.dailyFoodEligibility.findUnique({
            where: {
              date_studentId: {
                date: todayStr,
                studentId: student.id,
              },
            },
          });

          if (registeredTonight) {
            return {
              success: false,
              isEligible: false,
              student: studentInfo,
              message: `${category} "${student.name}" (${student.id}) is approved on the ${formatISTDateDMY(todayStr)} list (first meal is Dinner tonight at 07:30 PM). They are NOT on the ${formatISTDateDMY(yesterdayStr)} list for today's ${session}.`,
            };
          }
        }

        const notApprovedMsg = session === 'DINNER'
          ? `${category} "${student.name}" (${student.id}) is NOT approved for tonight's food list (${formatISTDateDMY(todayStr)}).`
          : `${category} "${student.name}" (${student.id}) is NOT approved on the ${formatISTDateDMY(yesterdayStr)} Night-Stay list for today's ${session}.`;

        return {
          success: false,
          isEligible: false,
          student: studentInfo,
          message: notApprovedMsg,
        };
      }

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

      let projectName = eligibility.mentor?.name || student.mentor?.name || 'General';
      if (isIntern && (!projectName || projectName === 'General')) {
        projectName = startupName ? `Startup: ${startupName}` : 'Startup Intern';
      }

      if (existingToken) {
        const timeStr = formatISTTime(existingToken.issuedAt);

        let isRegisteredTonight = false;
        if (session === 'LUNCH') {
          const tonightCheck = await prisma.dailyFoodEligibility.findUnique({
            where: {
              date_studentId: {
                date: todayStr,
                studentId: student.id,
              },
            },
          });
          isRegisteredTonight = Boolean(tonightCheck);
        }

        const smartMessage = getDuplicateTokenMessage(session, timeStr, student.name, { isRegisteredTonight });

        return {
          success: false,
          isDuplicate: true,
          existingToken: {
            id: existingToken.id,
            tokenNumber: existingToken.tokenNumber,
            time: timeStr,
            date: existingToken.date,
            session,
          },
          student: studentInfo,
          project: projectName,
          message: smartMessage,
        };
      }

      const dateTag = todayStr.replace(/-/g, '').slice(2);
      const existingTodayTokens = await tx.foodToken.findMany({
        where: {
          date: todayStr,
          tokenNumber: { startsWith: `INC-${dateTag}-` },
        },
        select: { tokenNumber: true },
      });

      let maxSeq = 0;
      for (const t of (existingTodayTokens || [])) {
        const parts = (t.tokenNumber || '').split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }

      let nextSeqNum = Math.max(maxSeq + 1, 1);
      let tokenNumber = `INC-${dateTag}-${String(nextSeqNum).padStart(3, '0')}`;

      while (await tx.foodToken.findUnique({ where: { tokenNumber } })) {
        nextSeqNum++;
        tokenNumber = `INC-${dateTag}-${String(nextSeqNum).padStart(3, '0')}`;
      }

      const mentorId = eligibility.mentorId || student.mentorId || null;

      try {
        const token = await tx.foodToken.create({
          data: {
            tokenNumber,
            date: todayStr,
            studentId: student.id,
            mentorId,
            session,
            status: 'Generated',
            issuedById: validStaffId,
          },
        });

        appCache.invalidateTags(['dashboard', 'foodtokens', 'foodlist']);

        const timeFormatted = formatISTTime(token.issuedAt);

        return {
          success: true,
          message: isNightStayCycle
            ? `Token ${token.tokenNumber} generated successfully for ${student.name} (${session} - Overnight Stay Cycle).`
            : `Token ${token.tokenNumber} generated successfully for ${student.name} (${session}).`,
          student: studentInfo,
          project: projectName,
          token: {
            id: token.id,
            tokenNumber: token.tokenNumber,
            studentId: student.id,
            studentName: student.name,
            project: projectName,
            date: todayStr,
            time: timeFormatted,
            session,
            status: token.status,
            category,
            startupName,
          },
        };
      } catch (createErr: any) {
        if (createErr.code === 'P2002') {
          return {
            success: false,
            isDuplicate: true,
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
  return appCache.get(cacheKey, 60, async () => {
    try {
      const where = date ? { date } : undefined;
      const tokens = await prisma.foodToken.findMany({
        where,
        include: {
          student: true,
          mentor: true,
        },
        orderBy: { issuedAt: 'desc' },
      });

      return tokens.map((t: any) => {
        const issuedDate = t.issuedAt instanceof Date ? t.issuedAt : new Date();
        const session = getTokenEffectiveSession(t);
        const isIntern = t.student?.category === 'Intern' || t.student?.id?.startsWith('INT-') || t.student?.courseType === 'Intern';
        const category = isIntern ? 'Intern' : 'Student';
        const startupName = isIntern ? (t.student?.startupName || t.student?.department) : undefined;
        let projectDisplay = t.mentor?.name || 'General';
        if (isIntern && (!t.mentor?.name || projectDisplay === 'General')) {
          projectDisplay = startupName ? `Startup: ${startupName}` : 'Startup Intern';
        }

        return {
          id: t.id,
          tokenNumber: t.tokenNumber,
          studentId: t.studentId,
          studentName: t.student?.name || t.studentId,
          department: isIntern ? (startupName || 'Startup') : normalizeDepartmentName(t.student?.department),
          year: isIntern ? 'Intern' : (t.student?.year ? `Year ${t.student.year}` : '—'),
          category,
          startupName,
          project: projectDisplay,
          date: t.date,
          time: formatISTTime(issuedDate),
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

export async function resetTestTokens(targetDate?: string, studentIdInput?: string): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const whereClause: any = {};
    if (targetDate) whereClause.date = targetDate;
    if (studentIdInput) whereClause.studentId = studentIdInput.trim().toUpperCase();

    const deleteRes = await prisma.foodToken.deleteMany({
      where: whereClause,
    });

    appCache.invalidateTags(['dashboard', 'foodtokens', 'foodlist']);

    return {
      success: true,
      count: deleteRes.count,
      message: `Deleted ${deleteRes.count} token(s).`,
    };
  } catch (error) {
    console.error('Error resetting test tokens:', error);
    return { success: false, count: 0, message: 'Failed to reset test tokens.' };
  }
}
