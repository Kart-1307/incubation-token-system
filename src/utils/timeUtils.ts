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
 * Return previous calendar date string (YYYY-MM-DD) in Indian Standard Time.
 * Used for night-stay cycle resolution (connecting Day D Dinner to Day D+1 Breakfast & Lunch).
 */
export function getPreviousISTDateString(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const prev = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(prev.getUTCDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
}

/**
 * Return next calendar date string (YYYY-MM-DD) in Indian Standard Time.
 * Used for simulated testing of tomorrow's breakfast & lunch cycle.
 */
export function getNextISTDateString(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const next = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  const py = next.getUTCFullYear();
  const pm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(next.getUTCDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
}

export const SESSION_TIMINGS: Record<MealSession, string> = {
  BREAKFAST: '07:30 AM – 10:00 AM IST',
  LUNCH: '12:00 PM – 03:00 PM IST',
  DINNER: '07:30 PM – 10:30 PM IST',
};

/**
 * Automatically determine meal session strictly based on Indian Standard Time (IST):
 * - Morning (00:00 to 11:29 AM IST): BREAKFAST (serving 07:30 AM - 10:00 AM)
 * - Afternoon (11:30 AM to 04:29 PM IST): LUNCH (serving 12:00 PM - 03:00 PM)
 * - Evening/Night (04:30 PM to 11:59 PM IST): DINNER (serving 07:30 PM - 10:30 PM)
 */
export function getMealSession(dateInput?: Date | string | number | null): MealSession {
  const { hours, minutes } = getISTDateParts(dateInput);
  const totalMinutes = hours * 60 + minutes;

  // 11:30 AM = 690 minutes
  // 04:30 PM = 990 minutes
  if (totalMinutes < 690) {
    return 'BREAKFAST';
  } else if (totalMinutes < 990) {
    return 'LUNCH';
  } else {
    return 'DINNER';
  }
}

/**
 * Get active/upcoming/completed status and human-readable timing label for each meal session.
 */
export function getSessionStatus(session: MealSession, dateInput?: Date | string | number | null): {
  status: 'ACTIVE' | 'COMPLETED' | 'UPCOMING';
  statusLabel: string;
} {
  const { hours, minutes } = getISTDateParts(dateInput);
  const totalMinutes = hours * 60 + minutes;

  // Breakfast: Service 07:30 AM (450m) - 10:00 AM (600m), active buffer up to 10:45 AM (645m)
  // Lunch: Service 12:00 PM (720m) - 03:00 PM (900m), active buffer up to 03:30 PM (930m)
  // Dinner: Service 07:30 PM (1170m) - 10:30 PM (1350m), active buffer up to 11:00 PM (1380m)
  if (session === 'BREAKFAST') {
    if (totalMinutes < 420) return { status: 'UPCOMING', statusLabel: 'Opens 07:30 AM' };
    if (totalMinutes <= 645) return { status: 'ACTIVE', statusLabel: 'Active Now' };
    return { status: 'COMPLETED', statusLabel: 'Completed' };
  } else if (session === 'LUNCH') {
    if (totalMinutes < 690) return { status: 'UPCOMING', statusLabel: 'Opens 12:00 PM' };
    if (totalMinutes <= 930) return { status: 'ACTIVE', statusLabel: 'Active Now' };
    return { status: 'COMPLETED', statusLabel: 'Completed' };
  } else {
    if (totalMinutes < 1140) return { status: 'UPCOMING', statusLabel: 'Opens 07:30 PM' };
    if (totalMinutes <= 1380) return { status: 'ACTIVE', statusLabel: 'Active Now' };
    return { status: 'COMPLETED', statusLabel: 'Completed' };
  }
}

/**
 * Format timestamp strictly in Indian Standard Time with uppercase meridiem (e.g. "10:31 PM").
 * Avoids UTC server offset confusion where 9:09 PM IST is wrongly shown as 03:39 PM.
 */
export function formatISTTime(dateInput?: Date | string | number | null): string {
  // If already formatted in 12-hour format: "10:31 PM", "10:31 pm", "7:30 am"
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const twelveHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
    if (twelveHourMatch) {
      let h = parseInt(twelveHourMatch[1], 10);
      const m = twelveHourMatch[2];
      const meridiem = twelveHourMatch[3].toUpperCase();
      return `${String(h).padStart(2, '0')}:${m} ${meridiem}`;
    }

    // Matches 24-hour "HH:MM" or "HH:MM:SS" like "22:55"
    const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (twentyFourHourMatch) {
      let h = parseInt(twentyFourHourMatch[1], 10);
      const m = twentyFourHourMatch[2];
      const meridiem = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${m} ${meridiem}`;
    }
  }

  let dateObj: Date;
  if (!dateInput) {
    dateObj = new Date();
  } else if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else {
    dateObj = new Date(dateInput);
  }

  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  const raw = dateObj.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Standardize meridiem to uppercase: "10:31 PM"
  return raw.replace(/\s*(am|pm)/i, match => ` ${match.trim().toUpperCase()}`);
}

/**
 * Format date in standard Indian calendar format: DD-MM-YYYY (e.g. "29-09-2026").
 * Accepts Date object, ISO timestamp, or "YYYY-MM-DD" string.
 */
export function formatISTDateDMY(dateInput?: Date | string | number | null): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-');
    return `${d}-${m}-${y}`;
  }
  const parts = getISTDateParts(dateInput);
  return `${String(parts.day).padStart(2, '0')}-${String(parts.month).padStart(2, '0')}-${parts.year}`;
}

/**
 * Format date in friendly Indian format: DD MMM YYYY (e.g. "29 Sep 2026").
 */
export function formatISTDateShort(dateInput?: Date | string | number | null): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return dt.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const { year, month, day } = getISTDateParts(dateInput);
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return dt.toLocaleDateString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date with Day of the Week: e.g. "Tuesday, 29-09-2026"
 */
export function formatISTDateWithDay(dateInput?: Date | string | number | null): string {
  let year: number, month: number, day: number;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    [year, month, day] = dateInput.trim().split('-').map(Number);
  } else {
    const parts = getISTDateParts(dateInput);
    year = parts.year;
    month = parts.month;
    day = parts.day;
  }
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = dt.toLocaleDateString('en-IN', { timeZone: IST_TIMEZONE, weekday: 'long' });
  const dmy = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  return `${weekday}, ${dmy}`;
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
