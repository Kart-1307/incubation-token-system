// Time Zone & Meal Session Utilities (India Standard Time / Local Time Zone)

export type MealSession = 'BREAKFAST' | 'LUNCH' | 'DINNER';

/**
 * Automatically determine meal session based on current time
 * - Morning (00:00 to 11:59 AM): BREAKFAST
 * - Afternoon (12:00 PM to 04:59 PM): LUNCH
 * - Evening/Night (05:00 PM to 11:59 PM): DINNER
 */
export function getMealSession(dateObj: Date = new Date()): MealSession {
  const hours = dateObj.getHours();
  if (hours < 12) {
    return 'BREAKFAST';
  } else if (hours < 17) {
    return 'LUNCH';
  } else {
    return 'DINNER';
  }
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
