import { NextRequest, NextResponse } from 'next/server';
import { getFoodTokens } from '@/actions/tokenActions';
import { getDailyFoodList } from '@/actions/foodListActions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const format = searchParams.get('format') || 'json';

    const [foodList, tokens] = await Promise.all([
      getDailyFoodList(date),
      getFoodTokens(date),
    ]);

    if (format === 'csv') {
      const headers = ['Token Number', 'Student ID', 'Student Name', 'Project', 'Date', 'Time', 'Status'];
      const rows = tokens.map((t: any) => [
        t.tokenNumber,
        t.studentId,
        `"${t.studentName}"`,
        `"${t.project}"`,
        t.date,
        t.time,
        t.status,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="food-tokens-${date}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      date,
      listStatus: foodList.status,
      eligibleStudentsCount: foodList.entries.length,
      tokensIssuedCount: tokens.length,
      foodListEntries: foodList.entries,
      tokens,
    });
  } catch (error) {
    console.error('API report export error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while exporting report.' },
      { status: 500 }
    );
  }
}
