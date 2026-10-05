'use server';

import { prisma, ensureDefaultStaffUser } from '@/lib/db';
import { appCache } from '@/lib/cache';
import { revalidatePath } from 'next/cache';
import { normalizeDepartmentName } from '@/utils/departmentUtils';
import {
  getTodayISTDateString,
  getNextISTDateString,
  getPreviousISTDateString,
  getMealSession,
  formatISTTime,
} from '@/utils/timeUtils';

export interface FoodListEntry {
  studentId: string;
  studentName: string;
  department: string;
  year: number;
  projectCode: string;
  projectName: string;
  addedBy: string;
  status: string;
}

export interface FoodListDetails {
  date: string;
  status: 'Draft' | 'Finalized';
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  entries: FoodListEntry[];
}

export async function getDailyFoodList(dateInput?: string): Promise<FoodListDetails> {
  const date = dateInput || getTodayISTDateString();

  try {
    const [list, eligibilities] = await Promise.all([
      prisma.dailyFoodList.findUnique({
        where: { date },
        select: { status: true, finalizedBy: true, finalizedAt: true },
      }),
      prisma.dailyFoodEligibility.findMany({
        where: { date },
        include: {
          student: true,
          project: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const entries: FoodListEntry[] = eligibilities.map((e: any) => ({
      studentId: e.studentId,
      studentName: e.student?.name || e.studentId,
      department: normalizeDepartmentName(e.student?.department),
      year: e.student?.year || 0,
      projectCode: e.projectCode,
      projectName: e.project?.name || e.projectCode,
      addedBy: e.addedBy || 'Staff',
      status: e.status || 'Eligible',
    }));

    return {
      date,
      status: list?.status === 'Finalized' ? 'Finalized' : 'Draft',
      finalizedBy: list?.finalizedBy || null,
      finalizedAt: list?.finalizedAt instanceof Date
        ? list.finalizedAt.toLocaleString('en-IN')
        : (list?.finalizedAt ? String(list.finalizedAt) : null),
      entries,
    };
  } catch (error) {
    console.error('Error fetching daily food list:', error);
    return {
      date,
      status: 'Draft',
      entries: [],
    };
  }
}

export interface LetterMealCounts {
  breakfastConsumed: number;
  lunchConsumed: number;
  dinnerToConsume: number;
}

export async function getLetterMealSessionCounts(dateInput?: string): Promise<LetterMealCounts> {
  const date = dateInput || getTodayISTDateString();
  try {
    const [breakfastCount, lunchCount, eligibilityCount, dinnerTokensCount] = await Promise.all([
      prisma.foodToken.count({
        where: {
          date,
          session: { in: ['BREAKFAST', 'Breakfast', 'breakfast'] },
        },
      }),
      prisma.foodToken.count({
        where: {
          date,
          session: { in: ['LUNCH', 'Lunch', 'lunch'] },
        },
      }),
      prisma.dailyFoodEligibility.count({
        where: { date },
      }),
      prisma.foodToken.count({
        where: {
          date,
          session: { in: ['DINNER', 'Dinner', 'dinner'] },
        },
      }),
    ]);

    return {
      breakfastConsumed: breakfastCount,
      lunchConsumed: lunchCount,
      dinnerToConsume: eligibilityCount > 0 ? eligibilityCount : dinnerTokensCount,
    };
  } catch (error) {
    console.error('Error fetching letter meal session counts:', error);
    return {
      breakfastConsumed: 0,
      lunchConsumed: 0,
      dinnerToConsume: 0,
    };
  }
}

export async function scanStudentIntoDailyFoodList(
  studentIdInput: string,
  targetDate?: string,
  addedBy: string = 'Scanner / Desk'
): Promise<{
  success: boolean;
  message: string;
  alreadyAdded?: boolean;
  notFound?: boolean;
  student?: { id: string; name: string; department: string; year: number };
  project?: string;
  entry?: FoodListEntry;
}> {
  const studentId = (studentIdInput || '').trim().toUpperCase();
  const date = targetDate || getTodayISTDateString();

  if (!studentId) {
    return { success: false, message: 'Student ID cannot be empty.' };
  }

  try {
    // 1. Ultra-fast parallelized fetch of student, existing eligibility, and project membership in 1 network roundtrip
    const [student, existing, pm] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
      }),
      prisma.dailyFoodEligibility.findUnique({
        where: {
          date_studentId: {
            date,
            studentId,
          },
        },
        include: { project: true },
      }),
      prisma.projectMember.findFirst({
        where: { studentId },
        include: { project: true },
      }),
    ]);

    if (!student) {
      return { success: false, notFound: true, message: `Student ID "${studentId}" not found in institutional registry.` };
    }

    if (existing) {
      return {
        success: false,
        alreadyAdded: true,
        student: {
          id: student.id,
          name: student.name,
          department: student.department,
          year: student.year,
        },
        project: existing.project?.name || existing.projectCode,
        message: `${student.name} (${studentId}) is already on the food list for ${date}.`,
      };
    }

    // 2. Determine assigned project
    let projectCode = '';
    let projectName = '';
    if (pm && pm.project) {
      projectCode = pm.projectCode;
      projectName = pm.project.name;
    } else {
      const firstProject = await prisma.project.findFirst({ where: { status: 'Active' } });
      projectCode = firstProject ? firstProject.code : 'INC-GENERAL';
      projectName = firstProject ? firstProject.name : 'Incubation Team';
    }

    // 3. Ensure daily food list header exists
    const createdById = await ensureDefaultStaffUser();
    await prisma.dailyFoodList.upsert({
      where: { date },
      update: {},
      create: {
        date,
        status: 'Draft',
        createdById,
      },
    });

    // 4. Create food eligibility entry (STRICTLY NO TOKEN ISSUED)
    await prisma.dailyFoodEligibility.create({
      data: {
        date,
        studentId,
        projectCode,
        addedBy,
        status: 'Eligible',
      },
    });

    appCache.invalidateTags(['foodlist', 'dashboard']);
    appCache.invalidateKey(`dash_bundle_${date}`);
    appCache.invalidateKey(`foodlist_${date}`);
    revalidatePath('/daily-food-list');
    revalidatePath('/dashboard');
    revalidatePath('/scan-token');

    const createdEntry: FoodListEntry = {
      studentId: student.id,
      studentName: student.name,
      department: normalizeDepartmentName(student.department),
      year: student.year,
      projectCode,
      projectName,
      addedBy,
      status: 'Eligible',
    };

    return {
      success: true,
      message: `✓ Added ${student.name} (${studentId}) to Food List.`,
      student: {
        id: student.id,
        name: student.name,
        department: student.department,
        year: student.year,
      },
      project: projectName,
      entry: createdEntry,
    };
  } catch (error) {
    console.error('Error scanning student into daily list:', error);
    return { success: false, message: 'Server error while adding student to food list.' };
  }
}

export async function addStudentToDailyList(
  date: string,
  studentIdInput: string,
  projectCodeInput: string,
  addedBy: string = 'Staff'
): Promise<{ success: boolean; message: string }> {
  const studentId = studentIdInput.trim().toUpperCase();
  const projectCode = projectCodeInput.trim().toUpperCase();

  try {
    // 1. Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      return { success: false, message: `Student ID "${studentId}" not found in institutional registry.` };
    }

    // 2. Ensure daily food list header exists with valid staffUser FK
    const createdById = await ensureDefaultStaffUser();
    await prisma.dailyFoodList.upsert({
      where: { date },
      update: {},
      create: {
        date,
        status: 'Draft',
        createdById,
      },
    });

    // 3. Check if already added
    const existing = await prisma.dailyFoodEligibility.findUnique({
      where: {
        date_studentId: {
          date,
          studentId,
        },
      },
    });

    if (existing) {
      return { success: false, message: `Student ${student.name} (${studentId}) is already on the food list for ${date}.` };
    }

    // 4. Create eligibility record
    await prisma.dailyFoodEligibility.create({
      data: {
        date,
        studentId,
        projectCode,
        addedBy,
        status: 'Eligible',
      },
    });

    appCache.invalidateTags(['foodlist', 'dashboard']);
    appCache.invalidateKey(`dash_bundle_${date}`);
    appCache.invalidateKey(`foodlist_${date}`);
    revalidatePath('/daily-food-list');
    revalidatePath('/dashboard');
    revalidatePath('/scan-token');
    return { success: true, message: `Student ${student.name} added to food list.` };
  } catch (error) {
    console.error('Error adding student to daily list:', error);
    return { success: false, message: 'Server error while adding student to food list.' };
  }
}

export async function addBulkStudentsToDailyList(
  date: string,
  studentIds: string[],
  projectCodeInput: string,
  addedBy: string = 'Staff'
): Promise<{ success: boolean; message: string; count: number }> {
  const projectCode = projectCodeInput.trim().toUpperCase();
  let addedCount = 0;

  try {
    // Ensure header with valid staffUser FK
    const createdById = await ensureDefaultStaffUser();
    await prisma.dailyFoodList.upsert({
      where: { date },
      update: {},
      create: { date, status: 'Draft', createdById },
    });

    for (const rawId of studentIds) {
      const studentId = rawId.trim().toUpperCase();
      const existing = await prisma.dailyFoodEligibility.findUnique({
        where: { date_studentId: { date, studentId } },
      });
      if (!existing) {
        await prisma.dailyFoodEligibility.create({
          data: {
            date,
            studentId,
            projectCode,
            addedBy,
            status: 'Eligible',
          },
        });
        addedCount++;
      }
    }

    appCache.invalidateTags(['foodlist', 'dashboard']);
    appCache.invalidateKey(`dash_bundle_${date}`);
    appCache.invalidateKey(`foodlist_${date}`);
    revalidatePath('/daily-food-list');
    revalidatePath('/dashboard');
    revalidatePath('/scan-token');
    return {
      success: true,
      message: `${addedCount} student(s) added to the food list.`,
      count: addedCount,
    };
  } catch (error) {
    console.error('Error bulk adding students:', error);
    return { success: false, message: 'Server error during bulk addition.', count: 0 };
  }
}

export async function removeStudentFromDailyList(
  date: string,
  studentIdInput: string
): Promise<{ success: boolean; message: string }> {
  const studentId = studentIdInput.trim().toUpperCase();
  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    const studentName = student?.name || studentId;

    // Check if tokens were ALREADY issued for this student for this date/cycle
    const nextDate = getNextISTDateString(date);
    const [tokensOnDate, nextDayTokens] = await Promise.all([
      prisma.foodToken.findMany({
        where: { date, studentId },
        select: { session: true, tokenNumber: true },
      }),
      prisma.foodToken.findMany({
        where: {
          date: nextDate,
          studentId,
          session: { in: ['BREAKFAST', 'Breakfast', 'breakfast', 'LUNCH', 'Lunch', 'lunch'] },
        },
        select: { session: true, tokenNumber: true },
      }),
    ]);

    const allIssuedTokens = [...tokensOnDate, ...nextDayTokens];

    if (allIssuedTokens.length > 0) {
      const sessionNames = allIssuedTokens.map(t => (t.session || 'Meal').toUpperCase()).join(', ');
      return {
        success: false,
        message: `Cannot remove ${studentName}: meal token(s) (${sessionNames}) have already been issued for this date. Tokens must be revoked first.`,
      };
    }

    const res = await prisma.dailyFoodEligibility.deleteMany({
      where: {
        date,
        studentId,
      },
    });

    appCache.invalidateTags(['foodlist', 'dashboard']);
    appCache.invalidateKey(`dash_bundle_${date}`);
    appCache.invalidateKey(`foodlist_${date}`);
    revalidatePath('/daily-food-list');
    revalidatePath('/dashboard');
    revalidatePath('/scan-token');

    if (res.count === 0) {
      return { success: true, message: 'Student was already removed from food list.' };
    }

    return { success: true, message: `Student ${studentName} removed from food list.` };
  } catch (error) {
    console.error('Error removing student from daily list:', error);
    return { success: false, message: 'Server error while removing student.' };
  }
}

export async function finalizeFoodList(
  date: string,
  finalizedBy: string = 'Staff Member'
): Promise<{ success: boolean; message: string }> {
  try {
    const createdById = await ensureDefaultStaffUser();
    await prisma.dailyFoodList.upsert({
      where: { date },
      update: {
        status: 'Finalized',
        finalizedBy,
        finalizedAt: new Date(),
      },
      create: {
        date,
        status: 'Finalized',
        finalizedBy,
        finalizedAt: new Date(),
        createdById,
      },
    });

    appCache.invalidateTags(['foodlist', 'dashboard']);
    appCache.invalidateKey(`dash_bundle_${date}`);
    appCache.invalidateKey(`foodlist_${date}`);
    revalidatePath('/daily-food-list');
    revalidatePath('/dashboard');
    revalidatePath('/scan-token');
    return { success: true, message: `Food eligibility list for ${date} finalized successfully.` };
  } catch (error) {
    console.error('Error finalizing food list:', error);
    return { success: false, message: 'Server error while finalizing food list.' };
  }
}

export interface DatewiseLogSummary {
  date: string; // The Night-Stay date (e.g. 2026-09-29)
  nextDate: string; // The morning/afternoon date (e.g. 2026-09-30)
  status: 'Draft' | 'Finalized' | 'No Stay';
  cycleStatus: 'Upcoming' | 'In Progress' | 'Completed' | 'No Stay Cohort';
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  totalEligible: number; // Students registered for overnight stay on Date D

  // 3-Meal Night-Stay Cycle Tokens
  dinnerCount: number; // Meal 1: Dinner on Date D
  breakfastCount: number; // Meal 2: Breakfast on Date D+1
  lunchCount: number; // Meal 3: Lunch on Date D+1
  totalMealsServed: number; // Dinner + Breakfast + Lunch for this cohort
  totalTokensIssued: number; // Backward-compatible alias for totalMealsServed
  maxPossibleMeals: number; // totalEligible * 3
  turnoutPercentage: number; // (totalMealsServed / maxPossibleMeals) * 100 (capped at 100%)

  // Kitchen Calendar Day Serving (Alternative perspective for catering)
  kitchenBreakfastCount: number; // Breakfast plates served on calendar Date D
  kitchenLunchCount: number; // Lunch plates served on calendar Date D
  kitchenDinnerCount: number; // Dinner plates served on calendar Date D
  kitchenTotalPlates: number; // Sum of B + L + D plates served on calendar Date D
}

export interface StudentMealAudit {
  studentId: string;
  studentName: string;
  department: string;
  year: number;
  projectCode: string;
  dinner: { issued: boolean; tokenNumber?: string; time?: string; date?: string };
  breakfast: { issued: boolean; tokenNumber?: string; time?: string; date?: string };
  lunch: { issued: boolean; tokenNumber?: string; time?: string; date?: string };
  mealsClaimed: number;
}

export interface NightStayBatchAuditDetails {
  date: string;
  nextDate: string;
  status: string;
  cycleStatus: string;
  totalEligible: number;
  dinnerCount: number;
  breakfastCount: number;
  lunchCount: number;
  totalMealsServed: number;
  maxPossibleMeals: number;
  turnoutPercentage: number;
  students: StudentMealAudit[];
}

export async function getDatewiseFoodLogs(): Promise<DatewiseLogSummary[]> {
  return appCache.get('datewise_food_logs', 30, async () => {
    try {
      const [allLists, allEligibilities, allTokens] = await Promise.all([
        prisma.dailyFoodList.findMany(),
        prisma.dailyFoodEligibility.findMany({ select: { date: true, studentId: true } }),
        prisma.foodToken.findMany({ select: { date: true, studentId: true, session: true, tokenNumber: true, issuedAt: true } }),
      ]);

      const dateSet = new Set<string>();
      (allLists || []).forEach((l: any) => { if (l.date) dateSet.add(l.date); });
      (allEligibilities || []).forEach((e: any) => { if (e.date) dateSet.add(e.date); });
      (allTokens || []).forEach((t: any) => { if (t.date) dateSet.add(t.date); });

      const todayStr = getTodayISTDateString();
      dateSet.add(todayStr);

      // Continuous Calendar Date Range Generation:
      // Find the earliest recorded date (or at least 7 days before today)
      let earliestDate = todayStr;
      for (const d of dateSet) {
        if (d && d < earliestDate) earliestDate = d;
      }

      // Fill in all continuous calendar dates from earliestDate up to todayStr
      let cursor = earliestDate;
      let iterations = 0;
      while (cursor <= todayStr && iterations < 90) {
        dateSet.add(cursor);
        cursor = getNextISTDateString(cursor);
        iterations++;
      }

      const currentSession = getMealSession();

      const logs: DatewiseLogSummary[] = Array.from(dateSet).map(date => {
        const nextDate = getNextISTDateString(date);
        const list = (allLists || []).find((l: any) => l.date === date);

        // Eligible students who stayed overnight on Date D
        const dayEligibilities = (allEligibilities || []).filter((e: any) => e.date === date);
        const eligibleStudentIds = new Set(dayEligibilities.map((e: any) => e.studentId));

        // 3-Meal Night-Stay Cycle Tokens:
        // Meal 1: Dinner on Date D (night of stay) - strictly matched against eligible cohort
        const dinnerTokens = (allTokens || []).filter((t: any) =>
          t.date === date && (t.session || '').toUpperCase().includes('DINNER') && eligibleStudentIds.has(t.studentId)
        );

        // Meal 2: Breakfast on Date D+1 (morning after stay) - strictly matched against eligible cohort
        const breakfastTokens = (allTokens || []).filter((t: any) =>
          t.date === nextDate && (t.session || '').toUpperCase().includes('BREAKFAST') && eligibleStudentIds.has(t.studentId)
        );

        // Meal 3: Lunch on Date D+1 (afternoon after stay) - strictly matched against eligible cohort
        const lunchTokens = (allTokens || []).filter((t: any) =>
          t.date === nextDate && (t.session || '').toUpperCase().includes('LUNCH') && eligibleStudentIds.has(t.studentId)
        );

        const totalEligible = dayEligibilities.length;
        const dinnerCount = Math.min(dinnerTokens.length, totalEligible);
        const breakfastCount = Math.min(breakfastTokens.length, totalEligible);
        const lunchCount = Math.min(lunchTokens.length, totalEligible);
        const totalMealsServed = dinnerCount + breakfastCount + lunchCount;
        const maxPossibleMeals = totalEligible * 3;

        const turnoutPercentage = maxPossibleMeals > 0
          ? Math.min(100, Math.round((totalMealsServed / maxPossibleMeals) * 100))
          : 0;

        // Kitchen Service on Calendar Date D
        const kitchenBreakfastCount = (allTokens || []).filter((t: any) =>
          t.date === date && (t.session || '').toUpperCase().includes('BREAKFAST')
        ).length;
        const kitchenLunchCount = (allTokens || []).filter((t: any) =>
          t.date === date && (t.session || '').toUpperCase().includes('LUNCH')
        ).length;
        const kitchenDinnerCount = (allTokens || []).filter((t: any) =>
          t.date === date && (t.session || '').toUpperCase().includes('DINNER')
        ).length;
        const kitchenTotalPlates = kitchenBreakfastCount + kitchenLunchCount + kitchenDinnerCount;

        // Cycle Status
        let cycleStatus: 'Upcoming' | 'In Progress' | 'Completed' | 'No Stay Cohort' = 'Upcoming';
        if (totalEligible === 0 && date !== todayStr) {
          cycleStatus = 'No Stay Cohort';
        } else if (date > todayStr) {
          cycleStatus = 'Upcoming';
        } else if (date === todayStr) {
          cycleStatus = 'In Progress';
        } else if (nextDate === todayStr) {
          cycleStatus = (currentSession === 'BREAKFAST' || currentSession === 'LUNCH')
            ? 'In Progress'
            : 'Completed';
        } else {
          cycleStatus = 'Completed';
        }

        const listStatus: 'Draft' | 'Finalized' | 'No Stay' = list?.status === 'Finalized'
          ? 'Finalized'
          : (list?.status === 'Draft' || totalEligible > 0)
          ? 'Draft'
          : 'No Stay';

        return {
          date,
          nextDate,
          status: listStatus,
          cycleStatus,
          finalizedBy: list?.finalizedBy || null,
          finalizedAt: list?.finalizedAt ? new Date(list.finalizedAt).toLocaleString('en-IN') : null,
          totalEligible,
          dinnerCount,
          breakfastCount,
          lunchCount,
          totalMealsServed,
          totalTokensIssued: totalMealsServed,
          maxPossibleMeals,
          turnoutPercentage,
          kitchenBreakfastCount,
          kitchenLunchCount,
          kitchenDinnerCount,
          kitchenTotalPlates,
        };
      });

      // Sort descending by night-stay date
      return logs.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error('Error fetching datewise food logs:', error);
      return [];
    }
  }, ['foodlist', 'foodtokens']);
}

export async function getNightStayBatchAudit(dateInput: string): Promise<NightStayBatchAuditDetails | null> {
  const date = dateInput;
  const nextDate = getNextISTDateString(date);

  return appCache.get(`batch_audit_${date}`, 20, async () => {
    try {
      const [list, eligibilities, dinnerTokens, nextDayTokens] = await Promise.all([
        prisma.dailyFoodList.findUnique({ where: { date } }),
        prisma.dailyFoodEligibility.findMany({
          where: { date },
          include: { student: true, project: true },
          orderBy: { studentId: 'asc' },
        }),
        prisma.foodToken.findMany({
          where: {
            date,
            session: { in: ['DINNER', 'Dinner', 'dinner'] },
          },
          include: { student: true, project: true },
        }),
        prisma.foodToken.findMany({
          where: {
            date: nextDate,
            session: { in: ['BREAKFAST', 'Breakfast', 'breakfast', 'LUNCH', 'Lunch', 'lunch'] },
          },
          include: { student: true, project: true },
        }),
      ]);

      if (!list && eligibilities.length === 0 && dinnerTokens.length === 0 && nextDayTokens.length === 0) return null;

      const dinnerMap = new Map<string, any>();
      dinnerTokens.forEach((t: any) => dinnerMap.set(t.studentId, t));

      const breakfastMap = new Map<string, any>();
      const lunchMap = new Map<string, any>();
      nextDayTokens.forEach((t: any) => {
        const sess = (t.session || '').toUpperCase();
        if (sess.includes('BREAKFAST')) breakfastMap.set(t.studentId, t);
        if (sess.includes('LUNCH')) lunchMap.set(t.studentId, t);
      });

      const eligibilityStudentIds = new Set(eligibilities.map((e: any) => e.studentId));

      const students: StudentMealAudit[] = eligibilities.map((e: any) => {
        const dToken = dinnerMap.get(e.studentId);
        const bToken = breakfastMap.get(e.studentId);
        const lToken = lunchMap.get(e.studentId);

        let mealsClaimed = 0;
        if (dToken) mealsClaimed++;
        if (bToken) mealsClaimed++;
        if (lToken) mealsClaimed++;

        return {
          studentId: e.studentId,
          studentName: e.student?.name || e.studentId,
          department: e.student?.department || '—',
          year: e.student?.year || 1,
          projectCode: e.projectCode || '—',
          dinner: {
            issued: Boolean(dToken),
            tokenNumber: dToken?.tokenNumber,
            time: dToken?.issuedAt ? formatISTTime(dToken.issuedAt) : undefined,
            date: dToken?.date || date,
          },
          breakfast: {
            issued: Boolean(bToken),
            tokenNumber: bToken?.tokenNumber,
            time: bToken?.issuedAt ? formatISTTime(bToken.issuedAt) : undefined,
            date: bToken?.date || nextDate,
          },
          lunch: {
            issued: Boolean(lToken),
            tokenNumber: lToken?.tokenNumber,
            time: lToken?.issuedAt ? formatISTTime(lToken.issuedAt) : undefined,
            date: lToken?.date || nextDate,
          },
          mealsClaimed,
        };
      });

      // Include any students who were issued tokens for this cycle even if unlinked from draft list
      const extraTokenMap = new Map<string, any>();
      [...dinnerTokens, ...nextDayTokens].forEach((t: any) => {
        if (!eligibilityStudentIds.has(t.studentId) && !extraTokenMap.has(t.studentId)) {
          extraTokenMap.set(t.studentId, t);
        }
      });

      for (const [stId, sampleTok] of extraTokenMap.entries()) {
        const dToken = dinnerMap.get(stId);
        const bToken = breakfastMap.get(stId);
        const lToken = lunchMap.get(stId);

        let mealsClaimed = 0;
        if (dToken) mealsClaimed++;
        if (bToken) mealsClaimed++;
        if (lToken) mealsClaimed++;

        students.push({
          studentId: stId,
          studentName: sampleTok.student?.name || stId,
          department: sampleTok.student?.department || '—',
          year: sampleTok.student?.year || 1,
          projectCode: sampleTok.projectCode || sampleTok.project?.code || '—',
          dinner: {
            issued: Boolean(dToken),
            tokenNumber: dToken?.tokenNumber,
            time: dToken?.issuedAt ? formatISTTime(dToken.issuedAt) : undefined,
            date: dToken?.date || date,
          },
          breakfast: {
            issued: Boolean(bToken),
            tokenNumber: bToken?.tokenNumber,
            time: bToken?.issuedAt ? formatISTTime(bToken.issuedAt) : undefined,
            date: bToken?.date || nextDate,
          },
          lunch: {
            issued: Boolean(lToken),
            tokenNumber: lToken?.tokenNumber,
            time: lToken?.issuedAt ? formatISTTime(lToken.issuedAt) : undefined,
            date: lToken?.date || nextDate,
          },
          mealsClaimed,
        });
      }

      students.sort((a, b) => a.studentId.localeCompare(b.studentId));

      const todayStr = getTodayISTDateString();
      const currentSession = getMealSession();
      let cycleStatus = 'Upcoming';
      if (date > todayStr) {
        cycleStatus = 'Upcoming';
      } else if (date === todayStr) {
        cycleStatus = currentSession === 'DINNER' ? 'In Progress (Dinner Active)' : 'Upcoming (Tonight)';
      } else if (nextDate === todayStr) {
        if (currentSession === 'BREAKFAST') cycleStatus = 'In Progress (Breakfast Active)';
        else if (currentSession === 'LUNCH') cycleStatus = 'In Progress (Lunch Active)';
        else cycleStatus = 'Cycle Completed';
      } else {
        cycleStatus = 'Completed';
      }

      const totalEligible = eligibilities.length;
      const dinnerCount = dinnerTokens.length;
      const breakfastCount = breakfastMap.size;
      const lunchCount = lunchMap.size;
      const totalMealsServed = dinnerCount + breakfastCount + lunchCount;
      const maxPossibleMeals = totalEligible * 3;
      const turnoutPercentage = maxPossibleMeals > 0
        ? Math.min(100, Math.round((totalMealsServed / maxPossibleMeals) * 100))
        : 0;

      return {
        date,
        nextDate,
        status: list?.status === 'Finalized' ? 'Finalized' : 'Draft',
        cycleStatus,
        totalEligible,
        dinnerCount,
        breakfastCount,
        lunchCount,
        totalMealsServed,
        maxPossibleMeals,
        turnoutPercentage,
        students,
      };
    } catch (err) {
      console.error('Error fetching night stay batch audit:', err);
      return null;
    }
  });
}

