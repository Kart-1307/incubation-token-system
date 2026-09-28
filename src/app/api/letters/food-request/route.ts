import { NextRequest, NextResponse } from 'next/server';
import { getDailyFoodList } from '@/actions/foodListActions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const foodList = await getDailyFoodList(date);

    return NextResponse.json({
      success: true,
      institution: 'Sri Sairam Engineering College',
      department: 'Incubation Centre',
      date: foodList.date,
      status: foodList.status,
      finalizedBy: foodList.finalizedBy,
      finalizedAt: foodList.finalizedAt,
      totalCount: foodList.entries.length,
      students: foodList.entries.map((e, index) => ({
        sNo: index + 1,
        studentId: e.studentId,
        studentName: e.studentName,
        department: e.department,
        year: e.year,
        projectName: e.projectName,
      })),
    });
  } catch (error) {
    console.error('API food request letter error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching letter data.' },
      { status: 500 }
    );
  }
}
