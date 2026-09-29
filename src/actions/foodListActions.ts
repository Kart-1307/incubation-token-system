'use server';

import { prisma, ensureDefaultStaffUser } from '@/lib/db';
import { appCache } from '@/lib/cache';
import { revalidatePath } from 'next/cache';
import { normalizeDepartmentName } from '@/utils/departmentUtils';
import { getTodayISTDateString } from '@/utils/timeUtils';

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

  return appCache.get(`foodlist_${date}`, 30, async () => {
    try {
      // Parallelize queries across database roundtrips
      const [list, eligibilities] = await Promise.all([
        prisma.dailyFoodList.findUnique({
          where: { date },
          include: { entries: true },
        }),
        prisma.dailyFoodEligibility.findMany({
          where: { date },
          include: {
            student: true,
            project: true,
          },
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
  }, ['foodlist']);
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
}> {
  const studentId = (studentIdInput || '').trim().toUpperCase();
  const date = targetDate || getTodayISTDateString();

  if (!studentId) {
    return { success: false, message: 'Student ID cannot be empty.' };
  }

  try {
    // 1. Verify student exists in student master
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      return { success: false, notFound: true, message: `Student ID "${studentId}" not found in institutional registry.` };
    }

    // 2. Check if already on today's food list
    const existing = await prisma.dailyFoodEligibility.findUnique({
      where: {
        date_studentId: {
          date,
          studentId,
        },
      },
      include: { project: true },
    });

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

    // 3. Find student's assigned project automatically
    let projectCode = '';
    let projectName = '';
    const pm = await prisma.projectMember.findFirst({
      where: { studentId },
      include: { project: true },
    });

    if (pm && pm.project) {
      projectCode = pm.projectCode;
      projectName = pm.project.name;
    } else {
      const firstProject = await prisma.project.findFirst({ where: { status: 'Active' } });
      projectCode = firstProject ? firstProject.code : 'INC-GENERAL';
      projectName = firstProject ? firstProject.name : 'Incubation Team';
    }

    // 4. Ensure daily food list header exists
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

    // 5. Create food eligibility entry (STRICTLY NO TOKEN ISSUED)
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
    revalidatePath('/daily-food-list');
    revalidatePath('/dashboard');
    revalidatePath('/scan-token');

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
    const res = await prisma.dailyFoodEligibility.deleteMany({
      where: {
        date,
        studentId,
      },
    });

    appCache.invalidateTags(['foodlist', 'dashboard']);
    revalidatePath('/daily-food-list');
    revalidatePath('/dashboard');
    revalidatePath('/scan-token');

    if (res.count === 0) {
      return { success: true, message: 'Student was already removed from food list.' };
    }

    return { success: true, message: 'Student removed from food list.' };
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
  date: string;
  status: 'Draft' | 'Finalized';
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  totalEligible: number;
  totalTokensIssued: number;
  breakfastCount: number;
  lunchCount: number;
  dinnerCount: number;
  turnoutPercentage: number;
}

export async function getDatewiseFoodLogs(): Promise<DatewiseLogSummary[]> {
  return appCache.get('datewise_food_logs', 30, async () => {
    try {
      const [allLists, allEligibilities, allTokens] = await Promise.all([
        prisma.dailyFoodList.findMany(),
        prisma.dailyFoodEligibility.findMany({ select: { date: true, studentId: true } }),
        prisma.foodToken.findMany({ select: { date: true, session: true, tokenNumber: true } }),
      ]);

      const dateSet = new Set<string>();
      (allLists || []).forEach((l: any) => { if (l.date) dateSet.add(l.date); });
      (allEligibilities || []).forEach((e: any) => { if (e.date) dateSet.add(e.date); });
      (allTokens || []).forEach((t: any) => { if (t.date) dateSet.add(t.date); });

      // Always include today's date if not already present
      const todayStr = getTodayISTDateString();
      dateSet.add(todayStr);

      const logs: DatewiseLogSummary[] = Array.from(dateSet).map(date => {
        const list = (allLists || []).find((l: any) => l.date === date);
        const dayEligibilities = (allEligibilities || []).filter((e: any) => e.date === date);
        const dayTokens = (allTokens || []).filter((t: any) => t.date === date);

        const breakfastCount = dayTokens.filter((t: any) => (t.session || '').toLowerCase().includes('breakfast')).length;
        const lunchCount = dayTokens.filter((t: any) => (t.session || '').toLowerCase().includes('lunch')).length;
        const dinnerCount = dayTokens.filter((t: any) => (t.session || '').toLowerCase().includes('dinner')).length;

        const totalEligible = dayEligibilities.length;
        const totalTokensIssued = dayTokens.length;

        let turnoutPercentage = 0;
        if (totalEligible > 0) {
          turnoutPercentage = Math.min(100, Math.round((totalTokensIssued / totalEligible) * 100));
        } else if (totalTokensIssued > 0) {
          turnoutPercentage = 100;
        }

        return {
          date,
          status: list?.status === 'Finalized' ? 'Finalized' : 'Draft',
          finalizedBy: list?.finalizedBy || null,
          finalizedAt: list?.finalizedAt ? new Date(list.finalizedAt).toLocaleString('en-IN') : null,
          totalEligible,
          totalTokensIssued,
          breakfastCount,
          lunchCount,
          dinnerCount,
          turnoutPercentage,
        };
      });

      // Sort descending by date
      return logs.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error('Error fetching datewise food logs:', error);
      return [];
    }
  }, ['foodlist', 'foodtokens']);
}

