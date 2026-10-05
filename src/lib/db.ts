import { PrismaClient } from '@prisma/client';

// Default Institutional Seed Data
const initialStaff = [
  {
    id: 'staff-001',
    username: 'staff',
    email: 'incubation@sairam.edu.in',
    name: 'Incubation Centre Staff',
    passwordHash: '$2b$10$w09ZkZ7pZ1j3iI2/zD386uvLhHkJgQ0eCgG0nK3zR87m1oZ5l1u4u',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const initialMentors = [
  {
    id: 'b109a501-0000-4000-8000-000000000001',
    name: 'Biogas Plant Mentor',
    department: 'ECE / Incubation',
    designation: 'Faculty Mentor',
    status: 'Active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const initialStudents = [
  {
    id: 'SECP24ES01',
    name: 'Karthick A',
    category: 'Student',
    department: 'Electronics and Communication Engineering',
    courseType: 'Bachelor',
    year: 2,
    email: 'secp24es01@sairamtap.edu.in',
    phone: '7305634366',
    status: 'Active',
    mentorId: 'b109a501-0000-4000-8000-000000000001',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'SECP24ES02',
    name: 'Tharunkumar P',
    category: 'Student',
    department: 'Electronics and Communication Engineering',
    courseType: 'Bachelor',
    year: 2,
    email: 'secp24es02@sairamtap.edu.in',
    phone: '7305634366',
    status: 'Active',
    mentorId: 'b109a501-0000-4000-8000-000000000001',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'INT-0488',
    name: 'Karthik',
    category: 'Intern',
    startupName: 'SkyRobotics',
    department: 'SkyRobotics',
    courseType: 'Intern',
    year: 0,
    email: 'intern.9025670488@incubation.local',
    phone: '9025670488',
    status: 'Active',
    mentorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const todayStr = new Date().toISOString().split('T')[0];

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
];

const initialEligibilities = [
  {
    id: 'el-1',
    date: todayStr,
    studentId: 'SECP24ES01',
    mentorId: 'b109a501-0000-4000-8000-000000000001',
    addedBy: 'Staff',
    status: 'Eligible',
    createdAt: new Date(),
  },
];

const initialTokens: any[] = [];

// In-Memory Data Store (Persisted across hot reloads using globalThis)
interface Store {
  staffUsers: typeof initialStaff;
  mentors: typeof initialMentors;
  students: typeof initialStudents;
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
    mentors: [...initialMentors],
    students: [...initialStudents],
    dailyFoodLists: [...initialFoodLists],
    dailyFoodEligibilities: [...initialEligibilities],
    foodTokens: [...initialTokens],
  };
}

const store = globalStore._incubationStore;

// Check if valid PostgreSQL DATABASE_URL is configured
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
        if (
          msg.includes('10054') ||
          msg.includes('10053') ||
          msg.includes('ConnectionReset') ||
          msg.includes('forcibly closed') ||
          msg.includes('closed the connection') ||
          msg.includes('wsarecv') ||
          msg.includes('aborted') ||
          msg.includes('WSAECONNABORTED') ||
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

  mentor: {
    findUnique: async ({ where, include }: any) => {
      const m = store.mentors.find(men => men.id === where.id);
      if (!m) return null;
      const res: any = { ...m };
      if (include?.students) {
        res.students = store.students.filter(s => s.mentorId === m.id);
      }
      return res;
    },
    findMany: async (args: any = {}) => {
      let list = [...store.mentors];
      if (args.where?.status) {
        list = list.filter(m => m.status === args.where.status);
      }
      if (args.include?.students) {
        return list.map(m => ({
          ...m,
          students: store.students.filter(s => s.mentorId === m.id),
        }));
      }
      return list;
    },
    create: async ({ data }: { data: any }) => {
      const newMentor = {
        id: data.id || `mentor-${Date.now()}`,
        name: data.name,
        department: data.department || 'Incubation Center',
        designation: data.designation || 'Faculty Mentor',
        status: data.status || 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.mentors.push(newMentor);
      return newMentor;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const m = store.mentors.find(men => men.id === where.id);
      if (!m) throw new Error('Mentor not found');
      Object.assign(m, data, { updatedAt: new Date() });
      return m;
    },
    delete: async ({ where }: any) => {
      const idx = store.mentors.findIndex(m => m.id === where.id);
      if (idx !== -1) {
        store.students.forEach(s => {
          if (s.mentorId === where.id) s.mentorId = null;
        });
        return store.mentors.splice(idx, 1)[0];
      }
      return null;
    },
    count: async () => store.mentors.length,
    upsert: async ({ where, create, update }: any) => {
      const existing = await memoryPrisma.mentor.findUnique({ where });
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      return memoryPrisma.mentor.create({ data: create });
    },
  },

  student: {
    findUnique: async ({ where, include }: any) => {
      const s = store.students.find(st => (where.id && st.id.toUpperCase() === where.id.toUpperCase()) || (where.email && st.email === where.email));
      if (!s) return null;
      const res: any = { ...s };
      if (include?.mentor && s.mentorId) {
        res.mentor = store.mentors.find(m => m.id === s.mentorId) || null;
      }
      return res;
    },
    findFirst: async ({ where, include }: any = {}) => {
      const s = store.students.find(st => {
        if (where?.id && st.id.toUpperCase() === where.id.toUpperCase()) return true;
        if (where?.phone && st.phone && st.phone.includes(where.phone.contains || where.phone)) return true;
        if (where?.OR) {
          return where.OR.some((clause: any) => {
            if (clause.id === st.id) return true;
            if (clause.phone?.endsWith && st.phone?.endsWith(clause.phone.endsWith)) return true;
            return false;
          });
        }
        return false;
      });
      if (!s) return null;
      const res: any = { ...s };
      if (include?.mentor && s.mentorId) {
        res.mentor = store.mentors.find(m => m.id === s.mentorId) || null;
      }
      return res;
    },
    findMany: async (args: any = {}) => {
      let list = [...store.students];
      if (args.where?.category) {
        list = list.filter(s => s.category === args.where.category);
      }
      if (args.where?.department) {
        list = list.filter(s => s.department === args.where.department);
      }
      if (args.where?.status) {
        if (typeof args.where.status === 'object' && args.where.status.not) {
          list = list.filter(s => s.status !== args.where.status.not);
        } else {
          list = list.filter(s => s.status === args.where.status);
        }
      }
      if (args.where?.NOT?.status) {
        list = list.filter(s => s.status !== args.where.NOT.status);
      }
      if (args.include?.mentor) {
        return list.map(s => ({
          ...s,
          mentor: s.mentorId ? store.mentors.find(m => m.id === s.mentorId) || null : null,
        }));
      }
      return list;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      store.students.forEach(s => {
        let match = true;
        if (where?.mentorId && s.mentorId !== where.mentorId) match = false;
        if (where?.status && s.status !== where.status) match = false;
        if (match) {
          Object.assign(s, data, { updatedAt: new Date() });
          count++;
        }
      });
      return { count };
    },
    create: async ({ data }: { data: any }) => {
      const existing = store.students.find(s => s.id.toUpperCase() === data.id.toUpperCase());
      if (existing) throw new Error(`Student ${data.id} already exists`);
      const newStudent = {
        id: data.id.toUpperCase(),
        name: data.name,
        category: data.category || 'Student',
        startupName: data.startupName || null,
        department: data.department,
        courseType: data.courseType || 'Bachelor',
        year: Number(data.year) || 0,
        email: data.email,
        phone: data.phone || null,
        status: data.status || 'Active',
        mentorId: data.mentorId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.students.push(newStudent);
      return newStudent;
    },
    update: async ({ where, data, include }: any) => {
      const student = store.students.find(s => s.id.toUpperCase() === where.id.toUpperCase());
      if (!student) throw new Error('Student not found');
      Object.assign(student, data, { updatedAt: new Date() });
      const res: any = { ...student };
      if (include?.mentor && student.mentorId) {
        res.mentor = store.mentors.find(m => m.id === student.mentorId) || null;
      }
      return res;
    },
    delete: async ({ where }: any) => {
      const idx = store.students.findIndex(s => s.id.toUpperCase() === where.id.toUpperCase());
      if (idx !== -1) {
        return store.students.splice(idx, 1)[0];
      }
      return null;
    },
    count: async () => store.students.length,
    upsert: async ({ where, create, update }: any) => {
      const existing = await memoryPrisma.student.findUnique({ where });
      if (existing) {
        return memoryPrisma.student.update({ where, data: update });
      }
      return memoryPrisma.student.create({ data: create });
    },
  },

  dailyFoodList: {
    findUnique: async ({ where, include }: any) => {
      const list = store.dailyFoodLists.find(l => l.date === where.date);
      if (!list) return null;
      const res: any = { ...list };
      if (include?.entries) {
        res.entries = store.dailyFoodEligibilities
          .filter(e => e.date === list.date)
          .map(e => ({
            ...e,
            student: store.students.find(s => s.id === e.studentId),
            mentor: e.mentorId ? store.mentors.find(m => m.id === e.mentorId) : null,
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
              mentor: e.mentorId ? store.mentors.find(m => m.id === e.mentorId) : null,
            })),
        }));
      }
      return lists;
    },
    create: async ({ data }: any) => {
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
    update: async ({ where, data }: any) => {
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
    findUnique: async ({ where, include }: any) => {
      const el = store.dailyFoodEligibilities.find(e => {
        if (where.date_studentId) {
          return e.date === where.date_studentId.date && e.studentId.toUpperCase() === where.date_studentId.studentId.toUpperCase();
        }
        return e.id === where.id;
      });
      if (!el) return null;
      const res: any = { ...el };
      if (include?.mentor && el.mentorId) {
        res.mentor = store.mentors.find(m => m.id === el.mentorId) || null;
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
      if (args.include?.mentor || args.include?.student) {
        return list.map(e => ({
          ...e,
          mentor: e.mentorId ? store.mentors.find(m => m.id === e.mentorId) : null,
          student: args.include?.student ? store.students.find(s => s.id === e.studentId) : undefined,
        }));
      }
      return list;
    },
    create: async ({ data }: any) => {
      const studentId = data.studentId.toUpperCase();
      const existing = store.dailyFoodEligibilities.find(
        e => e.date === data.date && e.studentId === studentId
      );
      if (existing) return existing;
      const newEntry = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: data.date,
        studentId,
        mentorId: data.mentorId || null,
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
        return store.dailyFoodEligibilities.splice(idx, 1)[0];
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
    count: async (args: any = {}) => {
      let list = store.dailyFoodEligibilities;
      if (args.where?.date) list = list.filter(e => e.date === args.where.date);
      if (args.where?.studentId) list = list.filter(e => e.studentId.toUpperCase() === args.where.studentId.toUpperCase());
      return list.length;
    },
  },

  foodToken: {
    findUnique: async ({ where, include }: any) => {
      const t = store.foodTokens.find(tok => {
        if (where.date_studentId_session) {
          return tok.date === where.date_studentId_session.date &&
                 tok.studentId.toUpperCase() === where.date_studentId_session.studentId.toUpperCase() &&
                 (tok.session || 'LUNCH').toUpperCase() === where.date_studentId_session.session.toUpperCase();
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
      const res: any = { ...t, session: t.session || 'LUNCH' };
      if (include?.student) {
        res.student = store.students.find(s => s.id === t.studentId);
      }
      if (include?.mentor && t.mentorId) {
        res.mentor = store.mentors.find(m => m.id === t.mentorId) || null;
      }
      return res;
    },
    findFirst: async ({ where, include, orderBy }: any = {}) => {
      let list = [...store.foodTokens];
      if (where) {
        if (where.date) list = list.filter(t => t.date === where.date);
        if (where.studentId) list = list.filter(t => t.studentId.toUpperCase() === where.studentId.toUpperCase());
        if (where.session) list = list.filter(t => (t.session || 'LUNCH').toUpperCase() === where.session.toUpperCase());
        if (where.tokenNumber) list = list.filter(t => t.tokenNumber.toUpperCase() === where.tokenNumber.toUpperCase());
      }
      if (orderBy?.issuedAt === 'desc') {
        list.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      }
      const t = list[0] || null;
      if (!t) return null;
      const res: any = { ...t, session: t.session || 'LUNCH' };
      if (include?.student) {
        res.student = store.students.find(s => s.id === t.studentId);
      }
      if (include?.mentor && t.mentorId) {
        res.mentor = store.mentors.find(m => m.id === t.mentorId) || null;
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
        list = list.filter(t => (t.session || 'LUNCH').toUpperCase() === args.where.session.toUpperCase());
      }
      if (args.orderBy?.issuedAt === 'desc') {
        list.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      }
      if (args.include?.student || args.include?.mentor) {
        return list.map(t => ({
          ...t,
          session: t.session || 'LUNCH',
          student: args.include?.student ? store.students.find(s => s.id === t.studentId) : undefined,
          mentor: t.mentorId ? store.mentors.find(m => m.id === t.mentorId) : null,
        }));
      }
      return list;
    },
    count: async (args: any = {}) => {
      let list = store.foodTokens;
      if (args.where?.date) list = list.filter(t => t.date === args.where.date);
      if (args.where?.session) list = list.filter(t => (t.session || 'LUNCH').toUpperCase() === args.where.session.toUpperCase());
      return list.length;
    },
    create: async ({ data }: any) => {
      const newToken = {
        id: `tok-${Date.now()}`,
        tokenNumber: data.tokenNumber,
        date: data.date,
        studentId: data.studentId.toUpperCase(),
        mentorId: data.mentorId || null,
        session: data.session || 'LUNCH',
        status: data.status || 'Generated',
        issuedAt: new Date(),
        issuedById: data.issuedById || 'staff-001',
      };
      store.foodTokens.push(newToken);
      return newToken;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      store.foodTokens = store.foodTokens.filter(t => {
        if (where?.date && t.date !== where.date) return true;
        if (where?.studentId && t.studentId !== where.studentId) return true;
        count++;
        return false;
      });
      return { count };
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
    code === 'P2024' ||
    msg.includes('connection pool') ||
    msg.includes('Timed out fetching a new connection') ||
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
              console.warn(`[Prisma ${modelName}.${method}] Connection reset. Reconnecting to database...`);
              if (globalStore._prismaClient) {
                try {
                  await globalStore._prismaClient.$disconnect().catch(() => {});
                } catch {}
              }
              globalStore._prismaClient = undefined;
              
              await new Promise(r => setTimeout(r, 250));
              const freshClient = getRealPrisma();
              if (freshClient && (freshClient as any)[modelName] && typeof (freshClient as any)[modelName][method] === 'function') {
                try {
                  const retryRes = await (freshClient as any)[modelName][method](...args);
                  console.log(`[Prisma ${modelName}.${method}] ✓ Reconnect successful, query recovered.`);
                  return retryRes;
                } catch (retryErr: any) {
                  console.warn(`[Prisma ${modelName}.${method}] Database transiently unreachable, serving from local store.`);
                }
              }
            } else {
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
                  console.warn('[Prisma $transaction] Database transiently unreachable, serving from local store.');
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
