'use server';

import { prisma } from '@/lib/db';
import { appCache } from '@/lib/cache';
import { revalidatePath } from 'next/cache';
import { normalizeDepartmentName } from '@/utils/departmentUtils';
import { getTodayISTDateString, formatISTTime, getTokenEffectiveSession, getMealSession, getPreviousISTDateString } from '@/utils/timeUtils';

export interface StudentRecord {
  id: string;
  name: string;
  category?: 'Student' | 'Intern';
  courseType: string;
  department: string;
  startupName?: string;
  year: number;
  email: string;
  phone: string | null;
  status: 'Active' | 'Inactive';
  mentorName?: string;
  mentorCode?: string;
  projects: string[];
}

export interface MentorRecord {
  code: string;
  name: string;
  department?: string;
  designation?: string;
  phone?: string;
  status: 'Active' | 'Inactive';
  memberCount: number;
}

export interface ProjectRecord {
  code: string;
  name: string;
  description: string | null;
  status: 'Active' | 'Completed' | 'Inactive';
  createdDate: string;
  members: { studentId: string; role: string; studentName?: string; department?: string; year?: number }[];
}

export async function getStudents(): Promise<StudentRecord[]> {
  return appCache.get('students_all', 30, async () => {
    try {
      const list = await prisma.student.findMany({
        include: {
          projectMemberships: {
            include: { project: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      return list.map((s: any) => {
        const isIntern = s.courseType === 'Intern' || s.id.startsWith('INT-');
        const primaryPm = s.projectMemberships?.[0];
        const mentorName = primaryPm?.project?.name || 'Unassigned';
        const mentorCode = primaryPm?.projectCode || undefined;

        return {
          id: s.id,
          name: s.name,
          category: (isIntern ? 'Intern' : 'Student') as 'Student' | 'Intern',
          courseType: s.courseType || (isIntern ? 'Intern' : 'Bachelor'),
          department: isIntern ? s.department : normalizeDepartmentName(s.department),
          startupName: isIntern ? s.department : undefined,
          year: s.year || 0,
          email: s.email,
          phone: s.phone,
          status: s.status,
          mentorName,
          mentorCode,
          projects: (s.projectMemberships || []).map((pm: any) => pm.projectCode),
        };
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }, ['students', 'projects']);
}

export async function getStudentById(idInput: string) {
  const query = (idInput || '').trim();
  if (!query) return null;
  const upper = query.toUpperCase();
  const digits = query.replace(/\D/g, '');

  try {
    // 1. Direct ID match (e.g. 23CS101 or INT-3210)
    let student = await prisma.student.findUnique({
      where: { id: upper },
      include: {
        projectMemberships: {
          include: { project: true },
        },
      },
    });

    // 2. If not found and input is 4-6 digits (Intern phone suffix)
    if (!student && digits.length >= 4 && digits.length <= 6) {
      student = await prisma.student.findFirst({
        where: {
          OR: [
            { id: `INT-${digits}` },
            { id: { contains: digits } },
            { phone: { endsWith: digits } },
          ],
        },
        include: {
          projectMemberships: {
            include: { project: true },
          },
        },
      });
    }

    // 3. If input is a 10-digit phone number
    if (!student && digits.length >= 10) {
      student = await prisma.student.findFirst({
        where: {
          phone: { contains: digits },
        },
        include: {
          projectMemberships: {
            include: { project: true },
          },
        },
      });
    }

    // 4. Search by name (at least 3 characters)
    if (!student && query.length >= 3) {
      student = await prisma.student.findFirst({
        where: {
          name: { contains: query, mode: 'insensitive' },
        },
        include: {
          projectMemberships: {
            include: { project: true },
          },
        },
      });
    }

    return student;
  } catch (error) {
    console.error('Error fetching student by ID:', error);
    return null;
  }
}

export async function createStudent(data: {
  id: string;
  name: string;
  courseType?: string;
  department: string;
  year: number;
  email: string;
  phone?: string;
  status?: string;
  mentorCode?: string;
}): Promise<{ success: boolean; message: string; student?: StudentRecord }> {
  const id = data.id.trim().toUpperCase();
  const name = data.name.trim();
  const email = data.email.trim();
  const courseType = data.courseType ? data.courseType.trim() : 'Bachelor';

  if (!id || !name || !email) {
    return { success: false, message: 'Student ID, Name, and Email are required.' };
  }

  try {
    const existing = await prisma.student.findUnique({
      where: { id },
    });

    if (existing) {
      return { success: false, message: `Student ID ${id} already exists in registry.` };
    }

    const canonicalDept = normalizeDepartmentName(data.department);

    const created = await prisma.student.create({
      data: {
        id,
        name,
        courseType,
        department: canonicalDept,
        year: Number(data.year) || 1,
        email,
        phone: data.phone || null,
        status: data.status || 'Active',
      },
    });

    const mentorCode = (data.mentorCode || '').trim();
    if (mentorCode) {
      try {
        await prisma.projectMember.create({
          data: {
            studentId: id,
            projectCode: mentorCode,
            role: 'Mentee',
          },
        });
      } catch (e) {
        console.warn('Failed to assign mentor to student', e);
      }
    }

    appCache.invalidateTags(['students', 'dashboard', 'projects']);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: `Student ${name} (${id}) registered successfully.`,
      student: {
        id: created.id,
        name: created.name,
        category: 'Student',
        courseType: created.courseType,
        department: created.department,
        year: created.year,
        email: created.email,
        phone: created.phone,
        status: created.status as 'Active' | 'Inactive',
        mentorName: mentorCode || 'Unassigned',
        mentorCode: mentorCode || undefined,
        projects: mentorCode ? [mentorCode] : [],
      },
    };
  } catch (error) {
    console.error('Error creating student:', error);
    return { success: false, message: 'Server error while creating student.' };
  }
}

export async function createIntern(data: {
  name: string;
  phone: string;
  startupName: string;
  mentorCode?: string;
}): Promise<{ success: boolean; message: string; student?: StudentRecord }> {
  const name = (data.name || '').trim();
  const rawPhone = (data.phone || '').trim();
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const startupName = (data.startupName || '').trim() || 'Incubation Startup Intern';

  if (!name) {
    return { success: false, message: 'Intern full name is required.' };
  }
  if (cleanPhone.length < 4) {
    return { success: false, message: 'Please provide a valid phone number (at least 4 digits for ID derivation).' };
  }

  const last4 = cleanPhone.slice(-4);
  const baseId = `INT-${last4}`;

  try {
    let finalId = baseId;
    const existingWithSamePhone = await prisma.student.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { id: baseId },
        ],
      },
    });

    if (existingWithSamePhone) {
      if (existingWithSamePhone.phone === cleanPhone) {
        return {
          success: false,
          message: `An attendee with phone ${cleanPhone} is already registered (${existingWithSamePhone.name} - ${existingWithSamePhone.id}).`,
        };
      }
      let counter = 2;
      while (await prisma.student.findUnique({ where: { id: `${baseId}-${counter}` } })) {
        counter++;
      }
      finalId = `${baseId}-${counter}`;
    }

    let email = `intern.${cleanPhone}@incubation.local`;
    const emailCollision = await prisma.student.findUnique({ where: { email } });
    if (emailCollision) {
      email = `intern.${finalId.toLowerCase()}.${Date.now().toString().slice(-4)}@incubation.local`;
    }

    const created = await prisma.student.create({
      data: {
        id: finalId,
        name,
        courseType: 'Intern',
        department: startupName,
        year: 0,
        email,
        phone: cleanPhone,
        status: 'Active',
      },
    });

    const mentorCode = (data.mentorCode || '').trim();
    if (mentorCode) {
      try {
        await prisma.projectMember.create({
          data: {
            studentId: finalId,
            projectCode: mentorCode,
            role: 'Intern',
          },
        });
      } catch (e) {
        console.warn('Failed to assign mentor to intern', e);
      }
    }

    appCache.invalidateTags(['students', 'dashboard', 'projects']);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    revalidatePath('/daily-food-list');

    return {
      success: true,
      message: `✓ Registered Intern ${name} with ID ${finalId} (${startupName}).`,
      student: {
        id: created.id,
        name: created.name,
        category: 'Intern',
        courseType: 'Intern',
        department: created.department,
        startupName: created.department,
        year: 0,
        email: created.email,
        phone: created.phone,
        status: 'Active',
        mentorName: mentorCode || 'Unassigned',
        mentorCode: mentorCode || undefined,
        projects: mentorCode ? [mentorCode] : [],
      },
    };
  } catch (error) {
    console.error('Error creating intern:', error);
    return { success: false, message: 'Server error while registering intern.' };
  }
}

export async function updateStudent(
  idInput: string,
  data: {
    name: string;
    courseType?: string;
    department: string;
    year: number;
    email: string;
    phone?: string | null;
    status?: string;
    mentorCode?: string;
  }
): Promise<{ success: boolean; message: string; student?: StudentRecord }> {
  const id = (idInput || '').trim().toUpperCase();
  const name = (data.name || '').trim();
  const email = (data.email || '').trim();
  const courseType = data.courseType ? data.courseType.trim() : 'Bachelor';

  if (!id) {
    return { success: false, message: 'Member ID is required.' };
  }
  if (!name || !email) {
    return { success: false, message: 'Name and Email are required.' };
  }

  try {
    const existing = await prisma.student.findUnique({
      where: { id },
      include: {
        projectMemberships: {
          include: { project: true },
        },
      },
    });

    if (!existing) {
      return { success: false, message: `Member with ID "${id}" not found.` };
    }

    // Check if email conflicts with another student
    const emailConflict = await prisma.student.findFirst({
      where: {
        email,
        NOT: { id },
      },
    });

    if (emailConflict) {
      return {
        success: false,
        message: `Email "${email}" is already used by another member (${emailConflict.name} - ${emailConflict.id}).`,
      };
    }

    const isIntern = (data.courseType === 'Intern') || existing.courseType === 'Intern' || id.startsWith('INT-');
    const canonicalDept = isIntern ? data.department : normalizeDepartmentName(data.department);

    const updated = await prisma.student.update({
      where: { id },
      data: {
        name,
        courseType: isIntern ? 'Intern' : courseType,
        department: canonicalDept,
        year: isIntern ? 0 : (Number(data.year) || existing.year),
        email,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        status: data.status || existing.status,
      },
      include: {
        projectMemberships: {
          include: { project: true },
        },
      },
    });

    if (data.mentorCode !== undefined) {
      await prisma.projectMember.deleteMany({ where: { studentId: id } });
      if (data.mentorCode && data.mentorCode !== 'UNASSIGNED') {
        try {
          await prisma.projectMember.create({
            data: {
              studentId: id,
              projectCode: data.mentorCode,
              role: isIntern ? 'Intern' : 'Mentee',
            },
          });
        } catch (e) {
          console.warn('Failed to update mentor assignment', e);
        }
      }
    }

    appCache.invalidateTags(['students', 'dashboard', 'projects', 'food-list']);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    revalidatePath('/daily-food-list');

    const primaryPm = updated.projectMemberships?.[0];

    return {
      success: true,
      message: `Member ${name} (${id}) updated successfully.`,
      student: {
        id: updated.id,
        name: updated.name,
        category: (isIntern ? 'Intern' : 'Student') as 'Student' | 'Intern',
        courseType: updated.courseType,
        department: updated.department,
        startupName: isIntern ? updated.department : undefined,
        year: updated.year,
        email: updated.email,
        phone: updated.phone,
        status: updated.status as 'Active' | 'Inactive',
        mentorName: primaryPm?.project?.name || 'Unassigned',
        mentorCode: primaryPm?.projectCode || undefined,
        projects: (updated.projectMemberships || []).map((pm: any) => pm.projectCode),
      },
    };
  } catch (error) {
    console.error('Error updating student:', error);
    return { success: false, message: 'Server error while updating member.' };
  }
}

export async function getMentors(): Promise<MentorRecord[]> {
  return appCache.get('mentors_all', 30, async () => {
    try {
      const projects = await prisma.project.findMany({
        include: {
          members: {
            include: { student: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      return projects.map((p: any) => ({
        code: p.code,
        name: p.name,
        department: p.description?.includes('·') ? p.description.split('·')[0].trim() : 'Incubation Facility',
        designation: p.description?.includes('·') ? p.description.split('·')[1].trim() : 'Faculty Mentor / Lead',
        phone: undefined,
        status: p.status === 'Completed' ? 'Inactive' : 'Active',
        memberCount: p.members?.length || 0,
      }));
    } catch (error) {
      console.error('Error fetching mentors:', error);
      return [];
    }
  }, ['projects', 'students']);
}

export async function createMentor(data: {
  name: string;
  department?: string;
  designation?: string;
  phone?: string;
}): Promise<{ success: boolean; message: string; mentor?: MentorRecord }> {
  const name = (data.name || '').trim();
  const department = (data.department || '').trim() || 'Incubation Facility';
  const designation = (data.designation || '').trim() || 'Faculty Mentor';

  if (!name) {
    return { success: false, message: 'Mentor name is required.' };
  }

  const slug = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'MENTOR';
  let code = `MTR-${slug}`;
  let count = 1;
  while (await prisma.project.findUnique({ where: { code } })) {
    count++;
    code = `MTR-${slug}-${count}`;
  }

  try {
    const created = await prisma.project.create({
      data: {
        code,
        name,
        description: `${department} · ${designation}`,
        status: 'Active',
      },
    });

    appCache.invalidateTags(['projects', 'dashboard', 'students']);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    revalidatePath('/daily-food-list');

    return {
      success: true,
      message: `Mentor "${name}" added successfully.`,
      mentor: {
        code: created.code,
        name: created.name,
        department,
        designation,
        status: 'Active',
        memberCount: 0,
      },
    };
  } catch (error) {
    console.error('Error creating mentor:', error);
    return { success: false, message: 'Server error while creating mentor.' };
  }
}

export async function assignMentor(
  studentIdInput: string,
  mentorCodeInput: string
): Promise<{ success: boolean; message: string }> {
  const studentId = studentIdInput.trim().toUpperCase();
  const mentorCode = mentorCodeInput.trim().toUpperCase();

  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return { success: false, message: `Member ${studentId} not found.` };

    // Remove old mentor memberships
    await prisma.projectMember.deleteMany({ where: { studentId } });

    if (mentorCode && mentorCode !== 'UNASSIGNED') {
      await prisma.projectMember.create({
        data: {
          studentId,
          projectCode: mentorCode,
          role: student.courseType === 'Intern' ? 'Intern' : 'Mentee',
        },
      });
    }

    appCache.invalidateTags(['students', 'projects', 'dashboard']);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    revalidatePath('/daily-food-list');

    return { success: true, message: `Mentor updated for ${student.name}.` };
  } catch (error) {
    console.error('Error assigning mentor:', error);
    return { success: false, message: 'Server error while assigning mentor.' };
  }
}

export async function getProjects(): Promise<ProjectRecord[]> {
  return appCache.get('projects_all', 30, async () => {
    try {
      const list = await prisma.project.findMany({
        include: {
          members: {
            include: {
              student: true,
            },
          },
        },
      });

      return list.map((p: any) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        status: p.status,
        createdDate: p.createdAt instanceof Date ? p.createdAt.toISOString().slice(0, 10) : '2025-08-01',
        members: (p.members || []).map((m: any) => ({
          studentId: m.studentId,
          role: m.role || 'Member',
          studentName: m.student?.name,
          department: m.student?.department,
          year: m.student?.year,
        })),
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }, ['projects']);
}

export async function createProject(data: {
  code: string;
  name: string;
  description?: string;
  status?: string;
}): Promise<{ success: boolean; message: string; project?: ProjectRecord }> {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  if (!code || !name) {
    return { success: false, message: 'Project code and name are required.' };
  }

  try {
    const existing = await prisma.project.findUnique({
      where: { code },
    });
    if (existing) {
      return { success: false, message: `Project code ${code} already exists.` };
    }

    const created = await prisma.project.create({
      data: {
        code,
        name,
        description: data.description || null,
        status: data.status || 'Active',
      },
    });

    appCache.invalidateTags(['projects', 'dashboard']);
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: `Project ${name} created.`,
      project: {
        code: created.code,
        name: created.name,
        description: created.description,
        status: created.status,
        createdDate: new Date().toISOString().slice(0, 10),
        members: [],
      },
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return { success: false, message: 'Server error while creating project.' };
  }
}

export async function addProjectMember(
  projectCodeInput: string,
  studentIdInput: string,
  role: string = 'Member'
): Promise<{ success: boolean; message: string }> {
  const projectCode = projectCodeInput.trim().toUpperCase();
  const studentId = studentIdInput.trim().toUpperCase();

  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return { success: false, message: `Student ID "${studentId}" not found in institutional registry.` };
    }

    // Check if student is already a member of this project
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        studentId_projectCode: {
          studentId,
          projectCode,
        },
      },
    });

    if (existingMember) {
      return {
        success: false,
        message: `Student ${student.name} (${studentId}) is already assigned to project ${projectCode}.`,
      };
    }

    await prisma.projectMember.create({
      data: {
        projectCode,
        studentId,
        role,
      },
    });

    appCache.invalidateTags(['projects', 'students', 'dashboard']);
    revalidatePath('/projects');
    revalidatePath('/students');
    return { success: true, message: `${student.name} added to project with role: ${role}.` };
  } catch (error: any) {
    console.error('Error adding project member:', error);
    if (error?.code === 'P2002') {
      return { success: false, message: `Student ID "${studentId}" is already a member of project ${projectCode}.` };
    }
    return { success: false, message: 'Server error while adding member to project.' };
  }
}

export async function getDashboardStats(dateInput?: string) {
  const date = dateInput || getTodayISTDateString();
  return appCache.get(`dashboard_${date}`, 30, async () => {
    try {
      // Parallelize queries across PostgreSQL network roundtrips
      const [students, projects, foodList, eligibilities, tokens] = await Promise.all([
        prisma.student.findMany(),
        prisma.project.findMany(),
        prisma.dailyFoodList.findUnique({
          where: { date },
          include: { entries: true },
        }),
        prisma.dailyFoodEligibility.findMany({
          where: { date },
        }),
        prisma.foodToken.findMany({
          where: { date },
          include: { student: true, project: true },
          orderBy: { issuedAt: 'desc' },
        }),
      ]);

      const session = getMealSession();
      const yesterdayStr = getPreviousISTDateString(date);
      let overnightStayCount = 0;
      if (session === 'BREAKFAST' || session === 'LUNCH') {
        overnightStayCount = await prisma.dailyFoodEligibility.count({
          where: { date: yesterdayStr },
        });
      }

      return {
        date,
        listStatus: foodList?.status || 'Draft',
        finalizedBy: foodList?.finalizedBy || null,
        eligibleCount: eligibilities.length > 0 ? eligibilities.length : overnightStayCount,
        todayEligibleCount: eligibilities.length,
        overnightStayCount,
        tokensGeneratedCount: tokens.length,
        totalStudents: students.length,
        activeStudents: students.filter((s: any) => s.status === 'Active').length,
        activeProjects: projects.filter((p: any) => p.status === 'Active').length,
        tokens,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        date,
        listStatus: 'Draft',
        finalizedBy: null,
        eligibleCount: 0,
        tokensGeneratedCount: 0,
        totalStudents: 0,
        activeStudents: 0,
        activeProjects: 0,
        tokens: [],
      };
    }
  }, ['dashboard']);
}

export async function deleteStudent(studentIdInput: string): Promise<{ success: boolean; message: string }> {
  const studentId = studentIdInput.trim().toUpperCase();
  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return { success: false, message: `Student ID "${studentId}" not found.` };
    }

    // Check if student has historical tokens or night-stay eligibility records
    const [tokenCount, eligibilityCount] = await Promise.all([
      prisma.foodToken.count({ where: { studentId } }),
      prisma.dailyFoodEligibility.count({ where: { studentId } }),
    ]);

    if (tokenCount > 0 || eligibilityCount > 0) {
      // SOFT DELETE / ARCHIVE:
      // Institutional meal tokens and night-stay audit records are immutable financial logs.
      // We detach active project memberships and mark the student as 'Inactive'.
      await prisma.projectMember.deleteMany({ where: { studentId } });
      await prisma.student.update({
        where: { id: studentId },
        data: { status: 'Inactive' },
      });

      appCache.invalidateTags(['students', 'projects', 'dashboard', 'food-list', 'foodtokens']);
      revalidatePath('/students');
      revalidatePath('/projects');
      revalidatePath('/dashboard');
      revalidatePath('/daily-food-list');

      return {
        success: true,
        message: `Student ${student.name} (${studentId}) archived as Inactive. Historical meal tokens (${tokenCount}) and night-stay logs are permanently preserved.`,
      };
    }

    // If student has 0 tokens and 0 eligibilities (e.g. newly created typo), clean hard delete is safe
    await prisma.projectMember.deleteMany({ where: { studentId } });
    await prisma.student.delete({ where: { id: studentId } });

    appCache.invalidateTags(['students', 'projects', 'dashboard', 'food-list']);
    revalidatePath('/students');
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    revalidatePath('/daily-food-list');

    return { success: true, message: `Student ${student.name} (${studentId}) deleted successfully.` };
  } catch (error) {
    console.error('Error deleting student:', error);
    return { success: false, message: 'Server error while deleting student record.' };
  }
}

export async function removeProjectMember(
  projectCodeInput: string,
  studentIdInput: string
): Promise<{ success: boolean; message: string }> {
  const projectCode = projectCodeInput.trim().toUpperCase();
  const studentId = studentIdInput.trim().toUpperCase();

  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    const studentName = student?.name || studentId;

    // Delete membership row only. Never touch food tokens or daily food lists!
    await prisma.projectMember.deleteMany({
      where: {
        projectCode,
        studentId,
      },
    });

    appCache.invalidateTags(['projects', 'students', 'dashboard']);
    revalidatePath('/projects');
    revalidatePath('/students');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `${studentName} (${studentId}) removed from project ${projectCode}. Historical meal tokens and logs remain preserved.`,
    };
  } catch (error) {
    console.error('Error removing project member:', error);
    return { success: false, message: 'Server error while removing member from project.' };
  }
}

export async function deleteProject(projectCodeInput: string): Promise<{ success: boolean; message: string }> {
  const code = projectCodeInput.trim().toUpperCase();
  try {
    const project = await prisma.project.findUnique({ where: { code } });
    if (!project) {
      return { success: false, message: `Project code "${code}" not found.` };
    }

    // Check if any tokens or food eligibilities exist under this project
    const [tokenCount, eligibilityCount] = await Promise.all([
      prisma.foodToken.count({ where: { projectCode: code } }),
      prisma.dailyFoodEligibility.count({ where: { projectCode: code } }),
    ]);

    if (tokenCount > 0 || eligibilityCount > 0) {
      // Archive project instead of hard-deleting to preserve token and eligibility audit history
      await prisma.projectMember.deleteMany({ where: { projectCode: code } });
      await prisma.project.update({
        where: { code },
        data: { status: 'Completed' },
      });

      appCache.invalidateTags(['projects', 'students', 'dashboard', 'food-list', 'foodtokens']);
      revalidatePath('/projects');
      revalidatePath('/students');
      revalidatePath('/dashboard');
      revalidatePath('/daily-food-list');

      return {
        success: true,
        message: `Project ${project.name} (${code}) archived as Completed. Historical meal tokens (${tokenCount}) and night-stay logs are permanently preserved.`,
      };
    }

    // If 0 tokens and 0 eligibilities, hard delete is safe
    await prisma.projectMember.deleteMany({ where: { projectCode: code } });
    await prisma.project.delete({ where: { code } });

    appCache.invalidateTags(['projects', 'students', 'dashboard', 'food-list']);
    revalidatePath('/projects');
    revalidatePath('/students');
    revalidatePath('/dashboard');
    revalidatePath('/daily-food-list');

    return { success: true, message: `Project ${project.name} (${code}) deleted successfully.` };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { success: false, message: 'Server error while deleting project.' };
  }
}

export interface DashboardBundleData {
  foodList: any;
  tokens: any[];
  students: StudentRecord[];
  projects: ProjectRecord[];
  overnightStayCount?: number;
  yesterdayDinnerTokensCount?: number;
  yesterdayLastDinnerTime?: string | null;
}

export async function getDashboardBundle(dateInput?: string): Promise<DashboardBundleData> {
  const date = dateInput || getTodayISTDateString();
  return appCache.get(`dash_bundle_${date}`, 60, async () => {
    try {
      const [list, eligibilities, rawTokens, students, projects] = await Promise.all([
        prisma.dailyFoodList.findUnique({
          where: { date },
          include: { entries: true },
        }),
        prisma.dailyFoodEligibility.findMany({
          where: { date },
          include: { student: true, project: true },
        }),
        prisma.foodToken.findMany({
          where: { date },
          include: { student: true, project: true },
          orderBy: { issuedAt: 'desc' },
        }),
        getStudents(),
        getProjects(),
      ]);

      const session = getMealSession();
      const yesterdayStr = getPreviousISTDateString(date);
      let overnightStayCount = 0;
      let yesterdayDinnerTokensCount = 0;
      let yesterdayLastDinnerTime: string | null = null;
      if (session === 'BREAKFAST' || session === 'LUNCH') {
        const [oCount, yTokens] = await Promise.all([
          prisma.dailyFoodEligibility.count({
            where: { date: yesterdayStr },
          }),
          prisma.foodToken.findMany({
            where: {
              date: yesterdayStr,
              session: { in: ['DINNER', 'Dinner', 'dinner'] },
            },
            select: { id: true, issuedAt: true },
            orderBy: { issuedAt: 'desc' },
          }),
        ]);
        overnightStayCount = oCount;
        yesterdayDinnerTokensCount = yTokens.length;
        if (yTokens.length > 0 && yTokens[0].issuedAt) {
          yesterdayLastDinnerTime = formatISTTime(yTokens[0].issuedAt);
        }
      }

      const entries = eligibilities.map((e: any) => ({
        studentId: e.studentId,
        studentName: e.student?.name || e.studentId,
        department: normalizeDepartmentName(e.student?.department),
        year: e.student?.year || 0,
        projectCode: e.projectCode,
        projectName: e.project?.name || e.projectCode,
        addedBy: e.addedBy || 'Staff',
        status: e.status || 'Eligible',
      }));

      const foodList = {
        date,
        status: list?.status === 'Finalized' ? 'Finalized' : 'Draft',
        finalizedBy: list?.finalizedBy || null,
        finalizedAt: list?.finalizedAt instanceof Date
          ? list.finalizedAt.toLocaleString('en-IN')
          : (list?.finalizedAt ? String(list.finalizedAt) : null),
        entries,
      };

      const tokens = rawTokens.map((t: any) => {
        const issuedDate = t.issuedAt instanceof Date ? t.issuedAt : new Date();
        const session = getTokenEffectiveSession(t);
        return {
          id: t.id,
          tokenNumber: t.tokenNumber,
          studentId: t.studentId,
          studentName: t.student?.name || t.studentId,
          department: normalizeDepartmentName(t.student?.department),
          year: t.student?.year ? `Year ${t.student.year}` : '—',
          project: t.project?.name || t.projectCode || '—',
          date: t.date,
          time: formatISTTime(issuedDate),
          session,
          status: t.status,
          generatedBy: t.issuedById || 'Staff',
        };
      });

      const formattedStudents: StudentRecord[] = students.map((s: any) => {
        const isIntern = s.courseType === 'Intern' || s.id.startsWith('INT-');
        return {
          id: s.id,
          name: s.name,
          category: (isIntern ? 'Intern' : 'Student') as 'Student' | 'Intern',
          courseType: s.courseType || (isIntern ? 'Intern' : 'Bachelor'),
          department: isIntern ? s.department : normalizeDepartmentName(s.department),
          startupName: isIntern ? s.department : undefined,
          year: s.year || 0,
          email: s.email,
          phone: s.phone,
          status: s.status,
          mentorName: s.mentorName || 'Unassigned',
          mentorCode: s.mentorCode || undefined,
          projects: s.projects || (s.projectMemberships || []).map((pm: any) => pm.projectCode),
        };
      });

      const formattedProjects: ProjectRecord[] = projects.map((p: any) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        status: p.status,
        createdDate: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        members: (p.members || []).map((m: any) => ({
          studentId: m.studentId,
          role: m.role,
          studentName: m.student?.name,
          department: m.student?.department ? normalizeDepartmentName(m.student.department) : undefined,
          year: m.student?.year,
        })),
      }));

      return {
        foodList,
        tokens,
        students: formattedStudents,
        projects: formattedProjects,
        overnightStayCount,
        yesterdayDinnerTokensCount,
        yesterdayLastDinnerTime,
      };
    } catch (err) {
      console.error('getDashboardBundle error:', err);
      return {
        foodList: { date, status: 'Draft', entries: [] },
        tokens: [],
        students: [],
        projects: [],
        overnightStayCount: 0,
        yesterdayDinnerTokensCount: 0,
        yesterdayLastDinnerTime: null,
      };
    }
  }, ['dashboard', 'foodlist', 'foodtokens', 'students', 'projects']);
}

export interface StudentsBundleData {
  students: StudentRecord[];
  projects: ProjectRecord[];
  mentors: MentorRecord[];
}

export async function getStudentsBundle(): Promise<StudentsBundleData> {
  return appCache.get('students_bundle', 20, async () => {
    try {
      const [students, projects] = await Promise.all([
        prisma.student.findMany({
          include: {
            projectMemberships: {
              include: { project: true },
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.project.findMany({
          include: {
            members: {
              include: { student: true },
            },
          },
          orderBy: { name: 'asc' },
        }),
      ]);

      const formattedStudents: StudentRecord[] = students.map((s: any) => {
        const isIntern = s.courseType === 'Intern' || s.id.startsWith('INT-');
        const primaryPm = s.projectMemberships?.[0];
        const mentorName = primaryPm?.project?.name || 'Unassigned';
        const mentorCode = primaryPm?.projectCode || undefined;

        return {
          id: s.id,
          name: s.name,
          category: (isIntern ? 'Intern' : 'Student') as 'Student' | 'Intern',
          courseType: s.courseType || (isIntern ? 'Intern' : 'Bachelor'),
          department: isIntern ? s.department : normalizeDepartmentName(s.department),
          startupName: isIntern ? s.department : undefined,
          year: s.year || 0,
          email: s.email,
          phone: s.phone,
          status: s.status,
          mentorName,
          mentorCode,
          projects: (s.projectMemberships || []).map((pm: any) => pm.projectCode),
        };
      });

      const formattedProjects: ProjectRecord[] = projects.map((p: any) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        status: p.status,
        createdDate: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        members: (p.members || []).map((m: any) => ({
          studentId: m.studentId,
          role: m.role,
          studentName: m.student?.name,
          department: m.student?.department ? normalizeDepartmentName(m.student.department) : undefined,
          year: m.student?.year,
        })),
      }));

      const mentors: MentorRecord[] = projects.map((p: any) => ({
        code: p.code,
        name: p.name,
        department: p.description?.includes('·') ? p.description.split('·')[0].trim() : 'Incubation Facility',
        designation: p.description?.includes('·') ? p.description.split('·')[1].trim() : 'Faculty Mentor / Lead',
        phone: undefined,
        status: p.status === 'Completed' ? 'Inactive' : 'Active',
        memberCount: p.members?.length || 0,
      }));

      return {
        students: formattedStudents,
        projects: formattedProjects,
        mentors,
      };
    } catch (err) {
      console.error('getStudentsBundle error:', err);
      return { students: [], projects: [], mentors: [] };
    }
  }, ['students', 'projects']);
}
