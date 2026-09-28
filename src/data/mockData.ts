export interface Student {
  id: string;
  name: string;
  department: string;
  year: number;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive';
  projects: string[];
}

export interface Project {
  code: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive' | 'Completed';
  createdDate: string;
  members: { studentId: string; role: string }[];
}

export interface FoodToken {
  id: string;
  tokenNumber: string;
  studentId: string;
  project: string;
  date: string;
  time: string;
  status: 'Generated' | 'Printed' | 'Used' | 'Cancelled' | 'Expired';
  generatedBy: string;
  printedTime?: string;
  usedTime?: string;
}

export interface EligibilityEntry {
  studentId: string;
  project: string;
  addedBy: string;
  status: 'Eligible';
}

export interface DailyFoodList {
  date: string;
  status: 'Draft' | 'Finalized';
  finalizedBy?: string;
  finalizedTime?: string;
  entries: EligibilityEntry[];
}

export const students: Student[] = [
  { id: '23CS101', name: 'Siddharth V', department: 'CSE', year: 3, email: 'siddharth@college.edu', phone: '9876543210', status: 'Active', projects: ['AGRI-01', 'SMRT-02'] },
  { id: '23CS102', name: 'Fayas K', department: 'CSE', year: 3, email: 'fayas@college.edu', phone: '9876543211', status: 'Active', projects: ['SMRT-02'] },
  { id: '23CS103', name: 'Nirmal E', department: 'CSE', year: 3, email: 'nirmal@college.edu', phone: '9876543212', status: 'Active', projects: ['AGRI-01'] },
  { id: '23CS104', name: 'Arun Kumar', department: 'CSE', year: 3, email: 'arun@college.edu', phone: '9876543213', status: 'Active', projects: ['HLTH-03'] },
  { id: '23CS105', name: 'Priya S', department: 'CSE', year: 3, email: 'priya@college.edu', phone: '9876543214', status: 'Active', projects: ['HLTH-03'] },
  { id: '23ME101', name: 'Rahul M', department: 'ME', year: 2, email: 'rahul@college.edu', phone: '9876543215', status: 'Active', projects: ['ECO-04'] },
  { id: '23EC101', name: 'Kavya R', department: 'ECE', year: 2, email: 'kavya@college.edu', phone: '9876543216', status: 'Active', projects: ['ECO-04'] },
  { id: '22CS201', name: 'Deepak N', department: 'CSE', year: 4, email: 'deepak@college.edu', phone: '9876543217', status: 'Inactive', projects: [] },
];

export const projects: Project[] = [
  {
    code: 'AGRI-01', name: 'AgriCheck', description: 'AI-powered crop disease detection system for small-scale farmers.',
    status: 'Active', createdDate: '2025-07-15',
    members: [
      { studentId: '23CS101', role: 'Lead Developer' },
      { studentId: '23CS103', role: 'Member' },
    ],
  },
  {
    code: 'SMRT-02', name: 'Smart Campus', description: 'IoT-based campus resource management and monitoring.',
    status: 'Active', createdDate: '2025-08-01',
    members: [
      { studentId: '23CS101', role: 'Developer' },
      { studentId: '23CS102', role: 'Member' },
    ],
  },
  {
    code: 'HLTH-03', name: 'HealthTrack', description: 'Student health monitoring and wellness tracking application.',
    status: 'Active', createdDate: '2025-08-20',
    members: [
      { studentId: '23CS104', role: 'Lead' },
      { studentId: '23CS105', role: 'Developer' },
    ],
  },
  {
    code: 'ECO-04', name: 'EcoMonitor', description: 'Environmental quality sensor network and data visualization.',
    status: 'Active', createdDate: '2025-09-05',
    members: [
      { studentId: '23ME101', role: 'Lead' },
      { studentId: '23EC101', role: 'Member' },
    ],
  },
];

export const todayStr = '2026-09-25';
export const tomorrowStr = '2026-09-26';

export const dailyFoodLists: DailyFoodList[] = [
  {
    date: todayStr,
    status: 'Finalized',
    finalizedBy: 'Admin User',
    finalizedTime: '2026-09-24 11:45 PM',
    entries: [
      { studentId: '23CS101', project: 'AgriCheck', addedBy: 'Admin User', status: 'Eligible' },
      { studentId: '23CS102', project: 'Smart Campus', addedBy: 'Admin User', status: 'Eligible' },
      { studentId: '23CS103', project: 'AgriCheck', addedBy: 'Admin User', status: 'Eligible' },
      { studentId: '23CS104', project: 'HealthTrack', addedBy: 'Admin User', status: 'Eligible' },
      { studentId: '23CS105', project: 'HealthTrack', addedBy: 'Admin User', status: 'Eligible' },
      { studentId: '23ME101', project: 'EcoMonitor', addedBy: 'Admin User', status: 'Eligible' },
    ],
  },
  {
    date: tomorrowStr,
    status: 'Draft',
    entries: [
      { studentId: '23CS101', project: 'AgriCheck', addedBy: 'Admin User', status: 'Eligible' },
      { studentId: '23CS102', project: 'Smart Campus', addedBy: 'Admin User', status: 'Eligible' },
    ],
  },
];

export const foodTokens: FoodToken[] = [
  { id: '1', tokenNumber: 'INC-250925-001', studentId: '23CS101', project: 'AgriCheck', date: todayStr, time: '12:15 PM', status: 'Generated', generatedBy: 'Scanner Staff' },
  { id: '2', tokenNumber: 'INC-250925-002', studentId: '23CS102', project: 'Smart Campus', date: todayStr, time: '12:18 PM', status: 'Generated', generatedBy: 'Scanner Staff' },
  { id: '3', tokenNumber: 'INC-250925-003', studentId: '23CS103', project: 'AgriCheck', date: todayStr, time: '12:22 PM', status: 'Generated', generatedBy: 'Scanner Staff' },
  { id: '4', tokenNumber: 'INC-250925-004', studentId: '23CS104', project: 'HealthTrack', date: todayStr, time: '12:30 PM', status: 'Generated', generatedBy: 'Scanner Staff' },
  { id: '5', tokenNumber: 'INC-250925-005', studentId: '23CS105', project: 'HealthTrack', date: todayStr, time: '12:35 PM', status: 'Generated', generatedBy: 'Scanner Staff' },
];
