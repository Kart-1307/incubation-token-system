// Time Zone & Meal Session Utilities (Strictly Indian Standard Time - Asia/Kolkata)

export type MealSession = 'BREAKFAST' | 'LUNCH' | 'DINNER';

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Extract exact date, hour, minute in Indian Standard Time (IST, UTC+5:30)
 * regardless of whether the server runs in UTC (Next.js/Vercel/Docker) or local machine.
 */
export function getISTDateParts(dateInput?: Date | string | number | null) {
  let dateObj: Date;
  if (!dateInput) {
    dateObj = new Date();
  } else if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else {
    dateObj = new Date(dateInput);
  }

  // Safety fallback if invalid date passed
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  const seconds = parseInt(get('second'), 10);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hours, minutes, seconds, dateStr };
}

/**
 * Return current today's date in Indian Standard Time as YYYY-MM-DD.
 * Prevents night-stay date rollback bugs between 00:00 and 05:30 AM IST.
 */
export function getTodayISTDateString(dateInput?: Date | string | number | null): string {
  return getISTDateParts(dateInput).dateStr;
}

/**
 * Automatically determine meal session strictly based on Indian Standard Time (IST):
 * - Morning (00:00 to 11:59 AM IST): BREAKFAST
 * - Afternoon (12:00 PM to 04:59 PM IST): LUNCH
 * - Evening/Night (05:00 PM to 11:59 PM IST): DINNER
 */
export function getMealSession(dateInput?: Date | string | number | null): MealSession {
  const { hours } = getISTDateParts(dateInput);
  if (hours < 12) {
    return 'BREAKFAST';
  } else if (hours < 17) {
    return 'LUNCH';
  } else {
    return 'DINNER';
  }
}

/**
 * Format timestamp strictly in Indian Standard Time (e.g. "09:09 pm" or "09:39 pm").
 * Avoids UTC server offset confusion where 9:09 PM IST is wrongly shown as 03:39 PM.
 */
export function formatISTTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return 'Now';
  let dateObj: Date;
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else {
    dateObj = new Date(dateInput);
  }

  if (isNaN(dateObj.getTime())) {
    return 'Now';
  }

  return dateObj.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Derive effective meal session from token metadata or timestamp using IST.
 */
export function getTokenEffectiveSession(token: { session?: string | null; issuedAt?: Date | string }): MealSession {
  const timeBased = getMealSession(token?.issuedAt);
  if (token?.session && ['BREAKFAST', 'LUNCH', 'DINNER'].includes(token.session.toUpperCase())) {
    return token.session.toUpperCase() as MealSession;
  }
  return timeBased;
}

/**
 * Generate friendly guidance message when a student tries to request a token
 * after already receiving one for a specific meal session.
 */
export function getDuplicateTokenMessage(
  session: string,
  timeStr: string,
  studentName: string
): string {
  const normalizedSession = (session || getMealSession()).toUpperCase();

  if (normalizedSession === 'BREAKFAST') {
    return `Token already issued for BREAKFAST for ${studentName} at ${timeStr}. Please come back during the LUNCH session!`;
  }
  
  if (normalizedSession === 'LUNCH') {
    return `Token already issued for LUNCH for ${studentName} at ${timeStr}. Please come back during the DINNER session!`;
  }

  return `Token already issued for DINNER for ${studentName} at ${timeStr}. All meal sessions for today are complete!`;
}
