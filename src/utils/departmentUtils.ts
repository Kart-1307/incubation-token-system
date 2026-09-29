/**
 * Institutional Engineering Department Registry & Normalizer
 * Guarantees consistent full-form department names across the entire application.
 */

export const UNDERGRAD_DEPARTMENTS = [
  'Civil Engineering',
  'Computer Science and Engineering',
  'Electrical and Electronics Engineering',
  'Electronics and Communication Engineering',
  'Electronics and Instrumentation Engineering',
  'Mechanical Engineering',
  'Mechatronics Engineering',
  'Computer and Communication Engineering',
  'Computer Science and Engineering (Artificial Intelligence and Machine Learning)',
  'Computer Science and Engineering (Cyber Security)',
  'Computer Science and Engineering (Internet of Things)',
  'Information Technology (B.Tech)',
  'Artificial Intelligence and Data Science (B.Tech)',
  'Computer Science and Business Systems (B.Tech)',
] as const;

export const POSTGRAD_DEPARTMENTS = [
  'Integrated & Postgraduate Programs (M.E. / M.Tech)',
] as const;

export const ALL_DEPARTMENTS = [...UNDERGRAD_DEPARTMENTS, ...POSTGRAD_DEPARTMENTS];

const SHORT_CODE_TO_FULL_NAME: Record<string, string> = {
  CSE: 'Computer Science and Engineering',
  ME: 'Mechanical Engineering',
  MECH: 'Mechanical Engineering',
  MECHANICAL: 'Mechanical Engineering',
  ECE: 'Electronics and Communication Engineering',
  EEE: 'Electrical and Electronics Engineering',
  EIE: 'Electronics and Instrumentation Engineering',
  CIVIL: 'Civil Engineering',
  CCE: 'Computer and Communication Engineering',
  IT: 'Information Technology (B.Tech)',
  AIDS: 'Artificial Intelligence and Data Science (B.Tech)',
  'AI&DS': 'Artificial Intelligence and Data Science (B.Tech)',
  'AI & DS': 'Artificial Intelligence and Data Science (B.Tech)',
  CSBS: 'Computer Science and Business Systems (B.Tech)',
  AIML: 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)',
  'CSE(AIML)': 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)',
  'CSE (AIML)': 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)',
  CYBER: 'Computer Science and Engineering (Cyber Security)',
  IOT: 'Computer Science and Engineering (Internet of Things)',
  MTRX: 'Mechatronics Engineering',
  MTS: 'Mechatronics Engineering',
};

/**
 * Normalizes any department input (abbreviation, short code, or partial) to its canonical full form.
 */
export function normalizeDepartmentName(dept?: string | null): string {
  if (!dept) return 'Computer Science and Engineering';
  const clean = dept.trim();
  const upper = clean.toUpperCase();

  // 1. Direct match with standard full name
  const exactMatch = ALL_DEPARTMENTS.find(d => d.toLowerCase() === clean.toLowerCase());
  if (exactMatch) return exactMatch;

  // 2. Short code mapping
  if (SHORT_CODE_TO_FULL_NAME[upper]) {
    return SHORT_CODE_TO_FULL_NAME[upper];
  }

  // 3. Fallback to clean string
  return clean;
}
