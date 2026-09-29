import { NextRequest, NextResponse } from 'next/server';
import { getFoodTokens } from '@/actions/tokenActions';
import { getDailyFoodList, getDatewiseFoodLogs } from '@/actions/foodListActions';

// Format date into human-readable text that never triggers Excel '#####' column overflow
function formatExcelDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (!isNaN(monthIdx) && monthIdx >= 0 && monthIdx < 12) {
        return `${day < 10 ? '0' + day : day}-${months[monthIdx]}-${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    }
  } catch {}
  return dateStr;
}

// Escape cell values for CSV and prevent Excel auto-conversion issues
function escapeCsv(val: any, forceText = false): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).trim();
  if (forceText && str && str !== '—') {
    // Formula syntax ="VALUE" forces Excel to display verbatim text without scientific notation or date casting
    const escaped = str.replace(/"/g, '""');
    return `="""${escaped}"""`;
  }
  // Standard CSV cell escaping
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const format = searchParams.get('format') || 'csv';
    const type = searchParams.get('type') || 'tokens'; // 'tokens' | 'foodlist' | 'logs'
    const sessionFilter = (searchParams.get('session') || 'ALL').toUpperCase();

    // 1. Export Food Tokens
    if (type === 'tokens') {
      const tokens = await getFoodTokens(date === 'all' ? undefined : date);
      const filteredTokens = sessionFilter === 'ALL'
        ? tokens
        : tokens.filter((t: any) => (t.session || '').toUpperCase() === sessionFilter);

      if (format === 'csv') {
        const headers = [
          'S.No',
          'Token Number',
          'Roll / Student ID',
          'Student Name',
          'Department',
          'Academic Year',
          'Incubation Project',
          'Meal Session',
          'Date',
          'Issue Time',
          'Token Status',
          'Issued By',
        ];

        const rows = filteredTokens.map((t: any, idx: number) => [
          idx + 1,
          escapeCsv(t.tokenNumber, true),
          escapeCsv(t.studentId, true),
          escapeCsv(t.studentName),
          escapeCsv(t.department),
          escapeCsv(t.year),
          escapeCsv(t.project),
          escapeCsv(t.session),
          escapeCsv(formatExcelDate(t.date)),
          escapeCsv(t.time, true),
          escapeCsv(t.status || 'Active'),
          escapeCsv(t.generatedBy || 'Staff Desk'),
        ]);

        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\r\n');
        const filename = date === 'all' ? `food-tokens-all-dates.csv` : `food-tokens-${date}.csv`;

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        type: 'tokens',
        date,
        count: filteredTokens.length,
        tokens: filteredTokens,
      });
    }

    // 2. Export Daily Food List (Approved Students for Mess)
    if (type === 'foodlist') {
      const [foodList, tokens] = await Promise.all([
        getDailyFoodList(date),
        getFoodTokens(date),
      ]);

      // Map tokens by studentId for turnout cross-referencing
      const tokenMap = new Map<string, any>();
      for (const t of tokens) {
        tokenMap.set(t.studentId.toUpperCase(), t);
      }

      if (format === 'csv') {
        const headers = [
          'S.No',
          'Roll / Student ID',
          'Student Name',
          'Department',
          'Academic Year',
          'Incubation Project',
          'Added By',
          'Approval Status',
          'Date Approved',
          'Token Claimed',
          'Claimed Token #',
          'Claimed Session',
          'Claimed Time',
        ];

        const rows = foodList.entries.map((entry, idx) => {
          const claimedToken = tokenMap.get(entry.studentId.toUpperCase());
          return [
            idx + 1,
            escapeCsv(entry.studentId, true),
            escapeCsv(entry.studentName),
            escapeCsv(entry.department),
            escapeCsv(entry.year ? `Year ${entry.year}` : '—'),
            escapeCsv(entry.projectName || entry.projectCode),
            escapeCsv(entry.addedBy || 'Staff'),
            escapeCsv(entry.status || 'Eligible'),
            escapeCsv(formatExcelDate(date)),
            escapeCsv(claimedToken ? 'YES' : 'NO'),
            escapeCsv(claimedToken ? claimedToken.tokenNumber : '—', true),
            escapeCsv(claimedToken ? claimedToken.session : '—'),
            escapeCsv(claimedToken ? claimedToken.time : '—', true),
          ];
        });

        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\r\n');

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="daily-food-list-${date}.csv"`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        type: 'foodlist',
        date,
        status: foodList.status,
        count: foodList.entries.length,
        entries: foodList.entries,
      });
    }

    // 3. Export Historical Datewise Logs
    if (type === 'logs') {
      const logs = await getDatewiseFoodLogs();

      if (format === 'csv') {
        const headers = [
          'S.No',
          'Date',
          'Status',
          'Total Eligible Students',
          'Total Tokens Claimed',
          'Turnout Percentage',
          'Breakfast Count',
          'Lunch Count',
          'Dinner Count',
          'Finalized By',
          'Finalized At',
        ];

        const rows = logs.map((log, idx) => [
          idx + 1,
          escapeCsv(formatExcelDate(log.date)),
          escapeCsv(log.status),
          log.totalEligible,
          log.totalTokensIssued,
          escapeCsv(`${log.turnoutPercentage}%`),
          log.breakfastCount,
          log.lunchCount,
          log.dinnerCount,
          escapeCsv(log.finalizedBy || '—'),
          escapeCsv(log.finalizedAt || '—'),
        ]);

        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\r\n');

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="food-turnout-historical-logs.csv"`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        type: 'logs',
        logs,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown export type' }, { status: 400 });
  } catch (error) {
    console.error('API report export error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while exporting report.' },
      { status: 500 }
    );
  }
}
