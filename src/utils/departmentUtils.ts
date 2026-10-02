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
  'Big Data Analytics (M.E.)',
  'CAD/CAM Engineering (M.E.)',
  'Communication Systems (M.E.)',
  'Computer Science and Engineering (M.E.)',
  'Power Electronics and Drives (M.E.)',
  'Industrial Safety Engineering (M.E.)',
  'Embedded System Technologies (M.E.)',
  'Computer Science and Engineering With Specialization in Networks (M.E.)',
  'Defence Technology (M.E.)',
  'Master of Business Administration (MBA)',
  'Computer Science and Engineering (5 Years Integrated)',
] as const;

export const ALL_DEPARTMENTS = [
  ...UNDERGRAD_DEPARTMENTS,
  ...POSTGRAD_DEPARTMENTS,
  'Integrated & Postgraduate Programs (M.E. / M.Tech)',
];

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
  FED: 'Foundational Engineering Department',

  // Master Programs
  BD: 'Big Data Analytics (M.E.)',
  CD: 'CAD/CAM Engineering (M.E.)',
  'CAD/CAM': 'CAD/CAM Engineering (M.E.)',
  CO: 'Communication Systems (M.E.)',
  COMM: 'Communication Systems (M.E.)',
  CS: 'Computer Science and Engineering (M.E.)',
  PE: 'Power Electronics and Drives (M.E.)',
  PED: 'Power Electronics and Drives (M.E.)',
  IS: 'Industrial Safety Engineering (M.E.)',
  ISE: 'Industrial Safety Engineering (M.E.)',
  ES: 'Embedded System Technologies (M.E.)',
  EST: 'Embedded System Technologies (M.E.)',
  CN: 'Computer Science and Engineering With Specialization in Networks (M.E.)',
  DT: 'Defence Technology (M.E.)',
  MBA: 'Master of Business Administration (MBA)',
  MG: 'Master of Business Administration (MBA)',
};

const FULL_NAME_TO_SHORT_CODE: Record<string, string> = {
  // Undergraduate Programs
  'Computer Science and Engineering': 'CSE',
  'Mechanical Engineering': 'MECH',
  'Electronics and Communication Engineering': 'ECE',
  'Electrical and Electronics Engineering': 'EEE',
  'Electronics and Instrumentation Engineering': 'EIE',
  'Civil Engineering': 'CIVIL',
  'Computer and Communication Engineering': 'CCE',
  'Information Technology (B.Tech)': 'IT',
  'Information Technology': 'IT',
  'Artificial Intelligence and Data Science (B.Tech)': 'AIDS',
  'Artificial Intelligence and Data Science': 'AIDS',
  'Computer Science and Business Systems (B.Tech)': 'CSBS',
  'Computer Science and Business Systems': 'CSBS',
  'Computer Science and Engineering (Artificial Intelligence and Machine Learning)': 'AIML',
  'Computer Science and Engineering (Cyber Security)': 'CYBER',
  'Computer Science and Engineering (Internet of Things)': 'IOT',
  'Mechatronics Engineering': 'MTRX',
  'Foundational Engineering Department': 'FED',
  'Integrated & Postgraduate Programs (M.E. / M.Tech)': 'PG',

  // 5 Years Integrated Program
  'Computer Science and Engineering (5 Years Integrated)': 'CJ',
  'Computer Science and Engineering (5 Years Integrated - M.Tech)': 'CJ',
  'Computer Science Engineering 5 Years Integrated': 'CJ',
  'M.Tech. Computer Science and Engineering (5 Years Integrated)': 'CJ',
  'M.Tech Computer Science and Engineering (5 Years Integrated)': 'CJ',

  // Master Programs (Official Mappings)
  'Big Data Analytics (M.E.)': 'BD',
  'Big Data Analytics': 'BD',
  'M.E. Big Data Analytics': 'BD',
  'CAD/CAM Engineering (M.E.)': 'CD',
  'CAD/CAM Engineering': 'CD',
  'CAD/CAM': 'CD',
  'M.E. CAD/CAM Engineering': 'CD',
  'Communication Systems (M.E.)': 'CO',
  'Communication Systems': 'CO',
  'M.E. Communication Systems': 'CO',
  'Computer Science and Engineering (M.E.)': 'CS',
  'M.E. Computer Science and Engineering': 'CS',
  'Power Electronics and Drives (M.E.)': 'PE',
  'Power Electronics and Drives': 'PE',
  'M.E. Power Electronics and Drives': 'PE',
  'Industrial Safety Engineering (M.E.)': 'IS',
  'Industrial Safety Engineering': 'IS',
  'M.E. Industrial Safety Engineering': 'IS',
  'Embedded System Technologies (M.E.)': 'ES',
  'Embedded System Technologies': 'ES',
  'M.E. Embedded System Technologies': 'ES',
  'Computer Science and Engineering With Specialization in Networks (M.E.)': 'CN',
  'Computer Science and Engineering With Specialization in Networks': 'CN',
  'Computer Science and Engineering (Networks)': 'CN',
  'M.E. Computer Science and Engineering With Specialization in Networks': 'CN',
  'Defence Technology (M.E.)': 'DT',
  'Defence Technology': 'DT',
  'M.E. Defence Technology': 'DT',
  'Master of Business Administration (MBA)': 'MBA',
  'Master of Business Administration': 'MBA',
  'MBA': 'MBA',
};

/**
 * Converts any department name into its clean, concise short representation (e.g., CSE, MECH, IT, AIML, FED, BD, CD, CO, PE, IS, ES, CN, DT, MBA).
 */
export function formatDepartmentShort(dept?: string | null): string {
  if (!dept) return '—';
  const clean = dept.trim();
  const upper = clean.toUpperCase();

  // If already a recognized short code (or short string like FED, IT, MECH, BD, CD, CO, PE, IS, ES, CN, DT, MBA)
  if (SHORT_CODE_TO_FULL_NAME[upper]) {
    if (upper === 'ME') return 'MECH';
    if (upper === 'MG') return 'MBA';
    return upper;
  }
  if (clean.length <= 5) {
    return upper;
  }

  // Check full name mapping
  const normalized = normalizeDepartmentName(clean);
  if (FULL_NAME_TO_SHORT_CODE[normalized]) {
    return FULL_NAME_TO_SHORT_CODE[normalized];
  }
  if (FULL_NAME_TO_SHORT_CODE[clean]) {
    return FULL_NAME_TO_SHORT_CODE[clean];
  }

  // Fallback: if ends with parenthetical short code e.g. "Information Technology (B.Tech)"
  return clean.length > 10 ? clean.split(' ')[0].toUpperCase() : clean;
}

/**
 * Converts numeric year (1, 2, 3, 4) to Roman numerals (I, II, III, IV) matching handwritten letters.
 */
export function formatYearRoman(year?: number | string | null): string {
  if (year === undefined || year === null || year === '' || year === 0) return '—';
  const str = String(year).trim().toUpperCase();
  const romanMap: Record<string, string> = {
    '1': 'I',
    '2': 'II',
    '3': 'III',
    '4': 'IV',
    '5': 'V',
    'YEAR 1': 'I',
    'YEAR 2': 'II',
    'YEAR 3': 'III',
    'YEAR 4': 'IV',
    'YEAR 5': 'V',
    'I': 'I',
    'II': 'II',
    'III': 'III',
    'IV': 'IV',
    'V': 'V',
  };
  return romanMap[str] || str;
}

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

