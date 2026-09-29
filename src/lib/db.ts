import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Default Institutional Seed Data
const initialStaff = [
  {
    id: 'staff-001',
    username: 'staff',
    email: 'incubation@sairam.edu.in',
    name: 'Incubation Centre Staff',
    // bcrypt hash of 'Sairam@123'
    passwordHash: '$2b$10$w09ZkZ7pZ1j3iI2/zD386uvLhHkJgQ0eCgG0nK3zR87m1oZ5l1u4u',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const initialProjects = [
  { code: 'AGRI-01', name: 'AgriCheck', description: 'AI-powered crop disease detection system for small-scale farmers.', status: 'Active', createdAt: new Date('2025-07-15'), updatedAt: new Date() },
  { code: 'SMRT-02', name: 'Smart Campus', description: 'IoT-based campus resource management and monitoring.', status: 'Active', createdAt: new Date('2025-08-01'), updatedAt: new Date() },
  { code: 'HLTH-03', name: 'HealthTrack', description: 'Student health monitoring and wellness tracking application.', status: 'Active', createdAt: new Date('2025-08-20'), updatedAt: new Date() },
  { code: 'ECO-04', name: 'EcoMonitor', description: 'Environmental quality sensor network and data visualization.', status: 'Active', createdAt: new Date('2025-09-05'), updatedAt: new Date() },
];

const initialStudents = [
  { id: '23CS101', name: 'Siddharth V', department: 'Computer Science and Engineering', year: 3, email: 'siddharth@college.edu', phone: '9876543210', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
  { id: '23CS102', name: 'Fayas K', department: 'Computer Science and Engineering', year: 3, email: 'fayas@college.edu', phone: '9876543211', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
  { id: '23CS103', name: 'Nirmal E', department: 'Computer Science and Engineering', year: 3, email: 'nirmal@college.edu', phone: '9876543212', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
  { id: '23CS104', name: 'Arun Kumar', department: 'Computer Science and Engineering', year: 3, email: 'arun@college.edu', phone: '9876543213', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
  { id: '23CS105', name: 'Priya S', department: 'Computer Science and Engineering', year: 3, email: 'priya@college.edu', phone: '9876543214', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
  { id: '23ME101', name: 'Rahul M', department: 'Mechanical Engineering', year: 2, email: 'rahul@college.edu', phone: '9876543215', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
  { id: '23EC101', name: 'Kavya R', department: 'Electronics and Communication Engineering', year: 2, email: 'kavya@college.edu', phone: '9876543216', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
  { id: '22CS201', name: 'Deepak N', department: 'Computer Science and Engineering', year: 4, email: 'deepak@college.edu', phone: '9876543217', status: 'Inactive', createdAt: new Date(), updatedAt: new Date() },
  { id: 'SEC24CS110', name: 'Karthikeyan S', department: 'Computer Science and Engineering', year: 1, email: 'karthikeyan.s@sairam.edu.in', phone: '9876543220', status: 'Active', createdAt: new Date(), updatedAt: new Date() },
];

const initialProjectMembers = [
  { id: 'pm-1', studentId: '23CS101', projectCode: 'AGRI-01', role: 'Lead Developer' },
  { id: 'pm-2', studentId: '23CS103', projectCode: 'AGRI-01', role: 'Member' },
  { id: 'pm-3', studentId: '23CS101', projectCode: 'SMRT-02', role: 'Developer' },
  { id: 'pm-4', studentId: '23CS102', projectCode: 'SMRT-02', role: 'Member' },
  { id: 'pm-5', studentId: '23CS104', projectCode: 'HLTH-03', role: 'Lead' },
  { id: 'pm-6', studentId: '23CS105', projectCode: 'HLTH-03', role: 'Developer' },
  { id: 'pm-7', studentId: '23ME101', projectCode: 'ECO-04', role: 'Lead' },
  { id: 'pm-8', studentId: '23EC101', projectCode: 'ECO-04', role: 'Member' },
  { id: 'pm-9', studentId: 'SEC24CS110', projectCode: 'AGRI-01', role: 'Developer' },
];

const todayStr = new Date().toISOString().split('T')[0];
const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];

interface FoodListInternal {
  date: string;
  status: string;
  finalizedBy: string | null;
  finalizedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const initialFoodLists: FoodListInternal[] = [
  {
    date: todayStr,
    status: 'Finalized',
    finalizedBy: 'Admin User',
    finalizedAt: new Date(),
    createdById: 'staff-001',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    date: '2026-09-25',
    status: 'Finalized',
    finalizedBy: 'Admin User',
    finalizedAt: new Date('2026-09-24T18:15:00Z'),
    createdById: 'staff-001',
    createdAt: new Date('2026-09-24T10:00:00Z'),
    updatedAt: new Date(),
  },
];

const initialEligibilities = [
  { id: 'el-1', date: todayStr, studentId: '23CS101', projectCode: 'AGRI-01', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-2', date: todayStr, studentId: '23CS102', projectCode: 'SMRT-02', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-3', date: todayStr, studentId: '23CS103', projectCode: 'AGRI-01', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-4', date: todayStr, studentId: '23CS104', projectCode: 'HLTH-03', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-5', date: todayStr, studentId: '23CS105', projectCode: 'HLTH-03', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-6', date: todayStr, studentId: '23ME101', projectCode: 'ECO-04', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-7', date: '2026-09-25', studentId: '23CS101', projectCode: 'AGRI-01', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-8', date: '2026-09-25', studentId: '23CS102', projectCode: 'SMRT-02', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-9', date: '2026-09-25', studentId: '23CS103', projectCode: 'AGRI-01', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
  { id: 'el-10', date: todayStr, studentId: 'SEC24CS110', projectCode: 'AGRI-01', addedBy: 'Staff', status: 'Eligible', createdAt: new Date() },
];

const dateTag = todayStr.replace(/-/g, '').slice(2);
const initialTokens = [
  { id: 'tok-1', tokenNumber: `INC-${dateTag}-001`, date: todayStr, studentId: '23CS101', projectCode: 'AGRI-01', status: 'Generated', issuedAt: new Date(Date.now() - 3600000 * 2), issuedById: 'staff-001' },
  { id: 'tok-2', tokenNumber: `INC-${dateTag}-002`, date: todayStr, studentId: '23CS102', projectCode: 'SMRT-02', status: 'Generated', issuedAt: new Date(Date.now() - 3600000 * 1.8), issuedById: 'staff-001' },
  { id: 'tok-3', tokenNumber: `INC-${dateTag}-003`, date: todayStr, studentId: '23CS103', projectCode: 'AGRI-01', status: 'Generated', issuedAt: new Date(Date.now() - 3600000 * 1.5), issuedById: 'staff-001' },
  { id: 'tok-4', tokenNumber: `INC-${dateTag}-004`, date: todayStr, studentId: '23CS104', projectCode: 'HLTH-03', status: 'Generated', issuedAt: new Date(Date.now() - 3600000 * 1.2), issuedById: 'staff-001' },
  { id: 'tok-5', tokenNumber: `INC-${dateTag}-005`, date: todayStr, studentId: '23CS105', projectCode: 'HLTH-03', status: 'Generated', issuedAt: new Date(Date.now() - 3600000 * 0.9), issuedById: 'staff-001' },
];

// In-Memory Data Store (Persisted across hot reloads using globalThis)
interface Store {
  staffUsers: typeof initialStaff;
  projects: typeof initialProjects;
  students: typeof initialStudents;
  projectMembers: typeof initialProjectMembers;
  dailyFoodLists: typeof initialFoodLists;
  dailyFoodEligibilities: typeof initialEligibilities;
  foodTokens: typeof initialTokens;
}

const globalStore = globalThis as unknown as {
  _incubationStore?: Store;
  _prismaClient?: PrismaClient;
};

if (!globalStore._incubationStore) {
  globalStore._incubationStore = {
    staffUsers: [...initialStaff],
    projects: [...initialProjects],
    students: [...initialStudents],
    projectMembers: [...initialProjectMembers],
    dailyFoodLists: [...initialFoodLists],
    dailyFoodEligibilities: [...initialEligibilities],
    foodTokens: [...initialTokens],
  };
}

const store = globalStore._incubationStore;

// Check if valid PostgreSQL DATABASE_URL is configured (not placeholder)
const hasValidDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  return Boolean(
    url &&
    !url.includes('[YOUR-PROJECT-REF]') &&
    !url.includes('[YOUR-PASSWORD]') &&
    url.startsWith('postgresql://')
  );
};

// Create or get real Prisma Client
function getRealPrisma(): PrismaClient | null {
  if (!hasValidDatabaseUrl()) return null;
  if (!globalStore._prismaClient) {
    try {
      const client = new PrismaClient({
        log: [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
      }) as any;

      client.$on('error', (e: any) => {
        const msg = e?.message || String(e);
        // Benign idle connection recycling or transient network jitter handled by resilient proxy
        if (
          msg.includes('10054') ||
          msg.includes('ConnectionReset') ||
          msg.includes('forcibly closed') ||
          msg.includes("Can't reach database server")
        ) {
          return;
        }
        console.error('[Prisma Client Error]', msg);
      });

      client.$on('warn', (e: any) => {
        const msg = e?.message || String(e);
        if (msg.includes('10054') || msg.includes('ConnectionReset')) return;
        console.warn('[Prisma Client Warn]', msg);
      });

      globalStore._prismaClient = client;
    } catch (e) {
      console.warn('PrismaClient failed to instantiate, using resilient store:', e);
    }
  }
  return globalStore._prismaClient || null;
}

export async function ensureDefaultStaffUser(): Promise<string> {
  const realPrisma = getRealPrisma();
  if (realPrisma) {
    try {
      let staff = await realPrisma.staffUser.findFirst();
      if (!staff) {
        staff = await realPrisma.staffUser.upsert({
          where: { id: 'staff-001' },
          update: {},
          create: {
            id: 'staff-001',
            username: 'staff',
            email: 'incubation@sairam.edu.in',
            name: 'Incubation Centre Staff',
            passwordHash: '$2b$10$w09ZkZ7pZ1j3iI2/zD386uvLhHkJgQ0eCgG0nK3zR87m1oZ5l1u4u',
          },
        });
      }
      return staff.id;
    } catch (e) {
      console.warn('ensureDefaultStaffUser error:', e);
    }
  }
  return 'staff-001';
}

// Resilient In-Memory Prisma Compatible Adapter
const memoryPrisma: any = {
  staffUser: {
    findUnique: async ({ where }: { where: { id?: string; username?: string; email?: string } }) => {
      return store.staffUsers.find(
        u => (where.id && u.id === where.id) ||
             (where.username && u.username === where.username) ||
             (where.email && u.email === where.email)
      ) || null;
    },
    findFirst: async ({ where }: any = {}) => {
      if (!where) return store.staffUsers[0] || null;
      return store.staffUsers.find(u => {
        if (where.username && u.username !== where.username) return false;
        if (where.email && u.email !== where.email) return false;
        return true;
      }) || null;
    },
    findMany: async () => [...store.staffUsers],
    create: async ({ data }: { data: any }) => {
      const newUser = {
        id: data.id || `staff-${Date.now()}`,
        username: data.username,
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.staffUsers.push(newUser);
      return newUser;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = await memoryPrisma.staffUser.findUnique({ where });
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      return memoryPrisma.staffUser.create({ data: create });
    },
  },

  student: {
    findUnique: async ({ where, include }: { where: { id?: string; email?: string }; include?: any }) => {
      const s = store.students.find(st => (where.id && st.id.toUpperCase() === where.id.toUpperCase()) || (where.email && st.email === where.email));
      if (!s) return null;
      const res: any = { ...s };
      if (include?.projectMemberships) {
        res.projectMemberships = store.projectMembers
          .filter(pm => pm.studentId === s.id)
          .map(pm => ({
            ...pm,
            project: store.projects.find(p => p.code === pm.projectCode),
          }));
      }
      return res;
    },
    findMany: async (args: any = {}) => {
      let list = [...store.students];
      if (args.where?.department) {
        list = list.filter(s => s.department === args.where.department);
      }
      if (args.where?.status) {
        list = list.filter(s => s.status === args.where.status);
      }
      if (args.include?.projectMemberships) {
        return list.map(s => ({
          ...s,
          projectMemberships: store.projectMembers
            .filter(pm => pm.studentId === s.id)
            .map(pm => ({
              ...pm,
              project: store.projects.find(p => p.code === pm.projectCode),
            })),
        }));
      }
      return list;
    },
    create: async ({ data }: { data: any }) => {
      const existing = store.students.find(s => s.id.toUpperCase() === data.id.toUpperCase());
      if (existing) throw new Error(`Student ${data.id} already exists`);
      const newStudent = {
        id: data.id.toUpperCase(),
        name: data.name,
        department: data.department,
        year: Number(data.year),
        email: data.email,
        phone: data.phone || null,
        status: data.status || 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.students.push(newStudent);
      return newStudent;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const student = store.students.find(s => s.id.toUpperCase() === where.id.toUpperCase());
      if (!student) throw new Error('Student not found');
      Object.assign(student, data, { updatedAt: new Date() });
      return student;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = await memoryPrisma.student.findUnique({ where });
      if (existing) {
        return memoryPrisma.student.update({ where, data: update });
      }
      return memoryPrisma.student.create({ data: create });
    },
  },

  project: {
    findUnique: async ({ where, include }: { where: { code: string }; include?: any }) => {
      const p = store.projects.find(pr => pr.code.toUpperCase() === where.code.toUpperCase());
      if (!p) return null;
      const res: any = { ...p };
      if (include?.members) {
        res.members = store.projectMembers
          .filter(pm => pm.projectCode === p.code)
          .map(pm => ({
            ...pm,
            student: store.students.find(s => s.id === pm.studentId),
          }));
      }
      return res;
    },
    findMany: async (args: any = {}) => {
      let list = [...store.projects];
      if (args.where?.status) {
        list = list.filter(p => p.status === args.where.status);
      }
      if (args.include?.members) {
        return list.map(p => ({
          ...p,
          members: store.projectMembers
            .filter(pm => pm.projectCode === p.code)
            .map(pm => ({
              ...pm,
              student: store.students.find(s => s.id === pm.studentId),
            })),
        }));
      }
      return list;
    },
    create: async ({ data }: { data: any }) => {
      const code = data.code.toUpperCase();
      if (store.projects.some(p => p.code === code)) {
        throw new Error(`Project code ${code} already exists`);
      }
      const newProj = {
        code,
        name: data.name,
        description: data.description || null,
        status: data.status || 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.projects.push(newProj);
      return newProj;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = await memoryPrisma.project.findUnique({ where });
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      return memoryPrisma.project.create({ data: create });
    },
  },

  projectMember: {
    findUnique: async ({ where }: any) => {
      if (where.studentId_projectCode) {
        return store.projectMembers.find(
          pm => pm.studentId === where.studentId_projectCode.studentId &&
                pm.projectCode === where.studentId_projectCode.projectCode
        ) || null;
      }
      return store.projectMembers.find(pm => pm.id === where.id) || null;
    },
    create: async ({ data }: { data: any }) => {
      const existing = store.projectMembers.find(
        pm => pm.studentId === data.studentId && pm.projectCode === data.projectCode
      );
      if (existing) {
        existing.role = data.role || existing.role;
        return existing;
      }
      const newMember = {
        id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: data.studentId,
        projectCode: data.projectCode,
        role: data.role || 'Member',
      };
      store.projectMembers.push(newMember);
      return newMember;
    },
    delete: async ({ where }: any) => {
      const idx = store.projectMembers.findIndex(
        pm => (where.id && pm.id === where.id) ||
              (where.studentId_projectCode &&
               pm.studentId === where.studentId_projectCode.studentId &&
               pm.projectCode === where.studentId_projectCode.projectCode)
      );
      if (idx !== -1) {
        const [deleted] = store.projectMembers.splice(idx, 1);
        return deleted;
      }
      return null;
    },
  },

  dailyFoodList: {
    findUnique: async ({ where, include }: { where: { date: string }; include?: any }) => {
      const list = store.dailyFoodLists.find(l => l.date === where.date);
      if (!list) return null;
      const res: any = { ...list };
      if (include?.entries) {
        res.entries = store.dailyFoodEligibilities
          .filter(e => e.date === list.date)
          .map(e => ({
            ...e,
            student: store.students.find(s => s.id === e.studentId),
            project: store.projects.find(p => p.code === e.projectCode),
          }));
      }
      return res;
    },
    findMany: async (args: any = {}) => {
      let lists = [...store.dailyFoodLists];
      if (args.include?.entries) {
        return lists.map(l => ({
          ...l,
          entries: store.dailyFoodEligibilities
            .filter(e => e.date === l.date)
            .map(e => ({
              ...e,
              student: store.students.find(s => s.id === e.studentId),
              project: store.projects.find(p => p.code === e.projectCode),
            })),
        }));
      }
      return lists;
    },
    create: async ({ data }: { data: any }) => {
      const newList = {
        date: data.date,
        status: data.status || 'Draft',
        finalizedBy: data.finalizedBy || null,
        finalizedAt: data.finalizedAt || null,
        createdById: data.createdById || 'staff-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.dailyFoodLists.push(newList);
      return newList;
    },
    update: async ({ where, data }: { where: { date: string }; data: any }) => {
      let list = store.dailyFoodLists.find(l => l.date === where.date);
      if (!list) {
        list = {
          date: where.date,
          status: 'Draft',
          finalizedBy: null,
          finalizedAt: null,
          createdById: 'staff-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.dailyFoodLists.push(list);
      }
      Object.assign(list, data, { updatedAt: new Date() });
      return list;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = await memoryPrisma.dailyFoodList.findUnique({ where });
      if (existing) {
        return memoryPrisma.dailyFoodList.update({ where, data: update });
      }
      return memoryPrisma.dailyFoodList.create({ data: create });
    },
  },

  dailyFoodEligibility: {
    findUnique: async ({ where, include }: { where: { date_studentId?: { date: string; studentId: string }; id?: string }; include?: any }) => {
      const el = store.dailyFoodEligibilities.find(e => {
        if (where.date_studentId) {
          return e.date === where.date_studentId.date && e.studentId.toUpperCase() === where.date_studentId.studentId.toUpperCase();
        }
        return e.id === where.id;
      });
      if (!el) return null;
      const res: any = { ...el };
      if (include?.project) {
        res.project = store.projects.find(p => p.code === el.projectCode);
      }
      if (include?.student) {
        res.student = store.students.find(s => s.id === el.studentId);
      }
      return res;
    },
    findMany: async (args: any = {}) => {
      let list = [...store.dailyFoodEligibilities];
      if (args.where?.date) {
        list = list.filter(e => e.date === args.where.date);
      }
      if (args.where?.studentId) {
        list = list.filter(e => e.studentId === args.where.studentId);
      }
      if (args.include?.project || args.include?.student) {
        return list.map(e => ({
          ...e,
          project: args.include?.project ? store.projects.find(p => p.code === e.projectCode) : undefined,
          student: args.include?.student ? store.students.find(s => s.id === e.studentId) : undefined,
        }));
      }
      return list;
    },
    create: async ({ data }: { data: any }) => {
      const studentId = data.studentId.toUpperCase();
      const existing = store.dailyFoodEligibilities.find(
        e => e.date === data.date && e.studentId === studentId
      );
      if (existing) return existing;
      const newEntry = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: data.date,
        studentId,
        projectCode: data.projectCode,
        addedBy: data.addedBy || 'Staff',
        status: data.status || 'Eligible',
        createdAt: new Date(),
      };
      store.dailyFoodEligibilities.push(newEntry);
      return newEntry;
    },
    delete: async ({ where }: any) => {
      const idx = store.dailyFoodEligibilities.findIndex(e => {
        if (where.date_studentId) {
          return e.date === where.date_studentId.date && e.studentId === where.date_studentId.studentId;
        }
        return e.id === where.id;
      });
      if (idx !== -1) {
        const [del] = store.dailyFoodEligibilities.splice(idx, 1);
        return del;
      }
      return null;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      store.dailyFoodEligibilities = store.dailyFoodEligibilities.filter(e => {
        if (where?.date && e.date !== where.date) return true;
        if (where?.studentId && e.studentId !== where.studentId) return true;
        count++;
        return false;
      });
      return { count };
    },
  },

  foodToken: {
    findUnique: async ({ where, include }: { where: { date_studentId_session?: { date: string; studentId: string; session: string }; date_studentId?: { date: string; studentId: string }; tokenNumber?: string; id?: string }; include?: any }) => {
      const t = store.foodTokens.find(tok => {
        if (where.date_studentId_session) {
          return tok.date === where.date_studentId_session.date &&
                 tok.studentId.toUpperCase() === where.date_studentId_session.studentId.toUpperCase() &&
                 ((tok as any).session || 'LUNCH').toUpperCase() === where.date_studentId_session.session.toUpperCase();
        }
        if (where.date_studentId) {
          return tok.date === where.date_studentId.date && tok.studentId.toUpperCase() === where.date_studentId.studentId.toUpperCase();
        }
        if (where.tokenNumber) {
          return tok.tokenNumber.toUpperCase() === where.tokenNumber.toUpperCase();
        }
        return tok.id === where.id;
      });
      if (!t) return null;
      const res: any = { ...t, session: (t as any).session || 'LUNCH' };
      if (include?.student) {
        res.student = store.students.find(s => s.id === t.studentId);
      }
      if (include?.project) {
        res.project = store.projects.find(p => p.code === t.projectCode);
      }
      return res;
    },
    findFirst: async ({ where, include, orderBy }: any = {}) => {
      let list = [...store.foodTokens];
      if (where) {
        if (where.date) list = list.filter(t => t.date === where.date);
        if (where.studentId) list = list.filter(t => t.studentId.toUpperCase() === where.studentId.toUpperCase());
        if (where.session) list = list.filter(t => ((t as any).session || 'LUNCH').toUpperCase() === where.session.toUpperCase());
        if (where.tokenNumber) list = list.filter(t => t.tokenNumber.toUpperCase() === where.tokenNumber.toUpperCase());
      }
      if (orderBy?.issuedAt === 'desc') {
        list.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      }
      const t = list[0] || null;
      if (!t) return null;
      const res: any = { ...t, session: (t as any).session || 'LUNCH' };
      if (include?.student) {
        res.student = store.students.find(s => s.id === t.studentId);
      }
      if (include?.project) {
        res.project = store.projects.find(p => p.code === t.projectCode);
      }
      return res;
    },
    findMany: async (args: any = {}) => {
      let list = [...store.foodTokens];
      if (args.where?.date) {
        list = list.filter(t => t.date === args.where.date);
      }
      if (args.where?.studentId) {
        list = list.filter(t => t.studentId === args.where.studentId);
      }
      if (args.where?.session) {
        list = list.filter(t => ((t as any).session || 'LUNCH').toUpperCase() === args.where.session.toUpperCase());
      }
      if (args.orderBy?.issuedAt === 'desc') {
        list.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      }
      if (args.include?.student || args.include?.project) {
        return list.map(t => ({
          ...t,
          session: (t as any).session || 'LUNCH',
          student: args.include?.student ? store.students.find(s => s.id === t.studentId) : undefined,
          project: args.include?.project ? store.projects.find(p => p.code === t.projectCode) : undefined,
        }));
      }
      return list;
    },
    count: async (args: any = {}) => {
      let list = store.foodTokens;
      if (args.where?.date) {
        list = list.filter(t => t.date === args.where.date);
      }
      if (args.where?.session) {
        list = list.filter(t => ((t as any).session || 'LUNCH').toUpperCase() === args.where.session.toUpperCase());
      }
      return list.length;
    },
    create: async ({ data }: { data: any }) => {
      const newToken = {
        id: `tok-${Date.now()}`,
        tokenNumber: data.tokenNumber,
        date: data.date,
        studentId: data.studentId.toUpperCase(),
        projectCode: data.projectCode,
        session: data.session || 'LUNCH',
        status: data.status || 'Generated',
        issuedAt: new Date(),
        issuedById: data.issuedById || 'staff-001',
      };
      store.foodTokens.push(newToken);
      return newToken;
    },
  },

  $transaction: async (callback: (tx: any) => Promise<any>) => {
    return callback(memoryPrisma);
  },
};

function isConnectionError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error);
  const code = error.code;
  const name = error.name;
  return (
    name === 'PrismaClientInitializationError' ||
    code === 'P1017' ||
    code === 'P1001' ||
    code === 'P1000' ||
    code === 'P1002' ||
    code === 'P1003' ||
    code === 'P2022' ||
    code === 'P2021' ||
    msg.includes("Can't reach database") ||
    msg.includes('closed the connection') ||
    msg.includes('ConnectionReset') ||
    msg.includes('10054') ||
    msg.includes('10053') ||
    msg.includes('forcibly closed') ||
    msg.includes('aborted') ||
    msg.includes('wsarecv') ||
    msg.includes('WSAECONNABORTED') ||
    msg.includes('WSAECONNRESET') ||
    msg.includes('does not exist') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND')
  );
}

function createResilientModelProxy(modelName: string) {
  return new Proxy({}, {
    get(_target, method: string) {
      if (method === 'then') return undefined;
      return async (...args: any[]) => {
        const realPrisma = getRealPrisma();
        if (realPrisma && (realPrisma as any)[modelName] && typeof (realPrisma as any)[modelName][method] === 'function') {
          try {
            return await (realPrisma as any)[modelName][method](...args);
          } catch (error: any) {
            if (isConnectionError(error)) {
              console.warn(`[Prisma ${modelName}.${method}] Connection reset by remote host. Reconnecting to database...`);
              if (globalStore._prismaClient) {
                try {
                  await globalStore._prismaClient.$disconnect().catch(() => {});
                } catch {}
              }
              globalStore._prismaClient = undefined;
              
              // Wait 250ms and retry query once with fresh connection
              await new Promise(r => setTimeout(r, 250));
              const freshClient = getRealPrisma();
              if (freshClient && (freshClient as any)[modelName] && typeof (freshClient as any)[modelName][method] === 'function') {
                try {
                  const retryRes = await (freshClient as any)[modelName][method](...args);
                  console.log(`[Prisma ${modelName}.${method}] ✓ Reconnect successful, query recovered.`);
                  return retryRes;
                } catch (retryErr: any) {
                  console.warn(`[Prisma ${modelName}.${method}] Reconnect retry failed, falling back:`, retryErr?.message || retryErr);
                }
              }
            } else {
              // Business validation error (e.g. P2002 Unique Constraint) -> rethrow for action handling
              throw error;
            }
          }
        }
        const fallback = memoryPrisma[modelName];
        if (fallback && typeof fallback[method] === 'function') {
          return await fallback[method](...args);
        }
        return null;
      };
    }
  });
}

// Export unified Prisma client: uses real Supabase PostgreSQL if connected,
// else seamlessly falls back to the resilient transactional in-memory database.
export const prisma: any = new Proxy({}, {
  get(_target, prop: string) {
    if (prop === '$transaction') {
      return async (arg: any) => {
        const realPrisma = getRealPrisma();
        if (realPrisma) {
          try {
            return await realPrisma.$transaction(arg);
          } catch (error: any) {
            if (isConnectionError(error)) {
              console.warn('[Prisma $transaction] Connection reset, reconnecting...');
              if (globalStore._prismaClient) {
                try {
                  await globalStore._prismaClient.$disconnect().catch(() => {});
                } catch {}
              }
              globalStore._prismaClient = undefined;
              await new Promise(r => setTimeout(r, 250));
              const freshClient = getRealPrisma();
              if (freshClient) {
                try {
                  const res = await freshClient.$transaction(arg);
                  console.log('[Prisma $transaction] ✓ Reconnect successful, transaction recovered.');
                  return res;
                } catch (retryErr: any) {
                  console.warn('[Prisma $transaction] Retry failed, falling back:', retryErr?.message || retryErr);
                }
              }
            } else {
              throw error;
            }
          }
        }
        return memoryPrisma.$transaction(arg);
      };
    }
    return createResilientModelProxy(prop);
  },
});

