import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeDepartmentName } from '@/utils/departmentUtils';
import { getTodayISTDateString } from '@/utils/timeUtils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getTodayISTDateString();
    const knownCountStr = searchParams.get('knownCount');
    const knownCount = knownCountStr !== null ? parseInt(knownCountStr, 10) : -1;

    // 1. Ultra-fast index count query (<2ms)
    const currentCount = await prisma.dailyFoodEligibility.count({
      where: { date },
    });

    if (knownCount >= 0 && currentCount === knownCount) {
      return NextResponse.json({
        changed: false,
        date,
        count: currentCount,
      });
    }

    // 2. Count changed or initial check: fetch full entries for this date
    const [listRecord, eligibilities] = await Promise.all([
      prisma.dailyFoodList.findUnique({
        where: { date },
        select: { status: true, finalizedBy: true, finalizedAt: true },
      }),
      prisma.dailyFoodEligibility.findMany({
        where: { date },
        include: {
          student: true,
          mentor: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const entries = eligibilities.map((e: any) => {
      const mentorName = e.mentor?.name || 'Unassigned';
      return {
        studentId: e.studentId,
        studentName: e.student?.name || e.studentId,
        department: normalizeDepartmentName(e.student?.department),
        year: e.student?.year || 0,
        mentorId: e.mentorId || 'UNASSIGNED',
        mentorName,
        projectCode: e.mentorId || 'UNASSIGNED',
        projectName: mentorName,
        addedBy: e.addedBy || 'Staff',
        status: e.status || 'Eligible',
      };
    });

    return NextResponse.json({
      changed: true,
      date,
      count: currentCount,
      status: listRecord?.status === 'Finalized' ? 'Finalized' : 'Draft',
      finalizedBy: listRecord?.finalizedBy || null,
      finalizedAt: listRecord?.finalizedAt instanceof Date
        ? listRecord.finalizedAt.toLocaleString('en-IN')
        : (listRecord?.finalizedAt ? String(listRecord.finalizedAt) : null),
      entries,
    });
  } catch (error: any) {
    console.error('Error in food-list-sync:', error);
    return NextResponse.json(
      { changed: false, error: error?.message || 'Sync error' },
      { status: 500 }
    );
  }
}
