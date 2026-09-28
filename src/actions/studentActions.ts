'use server';

import { prisma } from '@/lib/db';
import { appCache } from '@/lib/cache';
import { revalidatePath } from 'next/cache';

export interface StudentRecord {
  id: string;
  name: string;
  department: string;
  year: number;
  email: string;
  phone: string | null;
  status: 'Active' | 'Inactive';
  projects: string[];
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
          projectMemberships: true,
        },
      });

      return list.map((s: any) => ({
        id: s.id,
        name: s.name,
        department: s.department,
        year: s.year,
        email: s.email,
        phone: s.phone,
        status: s.status,
        projects: (s.projectMemberships || []).map((pm: any) => pm.projectCode),
      }));
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }, ['students']);
}

export async function getStudentById(idInput: string) {
  const id = idInput.trim().toUpperCase();
  try {
    return await prisma.student.findUnique({
      where: { id },
      include: {
        projectMemberships: true,
      },
    });
  } catch (error) {
    console.error('Error fetching student by ID:', error);
    return null;
  }
}

export async function createStudent(data: {
  id: string;
  name: string;
  department: string;
  year: number;
  email: string;
  phone?: string;
  status?: string;
}): Promise<{ success: boolean; message: string; student?: StudentRecord }> {
  const id = data.id.trim().toUpperCase();
  const name = data.name.trim();
  const email = data.email.trim();

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

    const created = await prisma.student.create({
      data: {
        id,
        name,
        department: data.department || 'CSE',
        year: Number(data.year) || 1,
        email,
        phone: data.phone || null,
        status: data.status || 'Active',
      },
    });

    appCache.invalidateTags(['students', 'dashboard']);
    revalidatePath('/students');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: `Student ${name} (${id}) registered successfully.`,
      student: {
        id: created.id,
        name: created.name,
        department: created.department,
        year: created.year,
        email: created.email,
        phone: created.phone,
        status: created.status,
        projects: [],
      },
    };
  } catch (error) {
    console.error('Error creating student:', error);
    return { success: false, message: 'Server error while creating student.' };
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
  const date = dateInput || new Date().toISOString().split('T')[0];
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

      return {
        date,
        listStatus: foodList?.status || 'Draft',
        finalizedBy: foodList?.finalizedBy || null,
        eligibleCount: eligibilities.length,
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

    // Explicitly delete child records first to satisfy foreign key constraints
    await prisma.projectMember.deleteMany({ where: { studentId } });
    await prisma.foodToken.deleteMany({ where: { studentId } });
    await prisma.dailyFoodEligibility.deleteMany({ where: { studentId } });
    await prisma.student.delete({ where: { id: studentId } });

    appCache.invalidateTags(['students', 'projects', 'dashboard', 'food-list']);
    revalidatePath('/students');
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    revalidatePath('/daily-food-list');

    return { success: true, message: `Student ${student.name} (${studentId}) removed successfully.` };
  } catch (error) {
    console.error('Error deleting student:', error);
    return { success: false, message: 'Server error while deleting student record.' };
  }
}

export async function deleteProject(projectCodeInput: string): Promise<{ success: boolean; message: string }> {
  const code = projectCodeInput.trim().toUpperCase();
  try {
    const project = await prisma.project.findUnique({ where: { code } });
    if (!project) {
      return { success: false, message: `Project code "${code}" not found.` };
    }

    await prisma.projectMember.deleteMany({ where: { projectCode: code } });
    await prisma.project.delete({ where: { code } });

    appCache.invalidateTags(['projects', 'students', 'dashboard']);
    revalidatePath('/projects');
    revalidatePath('/students');
    revalidatePath('/dashboard');

    return { success: true, message: `Project ${project.name} (${code}) deleted successfully.` };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { success: false, message: 'Server error while deleting project.' };
  }
}
