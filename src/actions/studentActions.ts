'use server';

import { prisma } from '@/lib/db';
import { appCache } from '@/lib/cache';
import { revalidatePath } from 'next/cache';
import { normalizeDepartmentName } from '@/utils/departmentUtils';
import { getTodayISTDateString, formatISTTime, getTokenEffectiveSession, getMealSession, getPreviousISTDateString } from '@/utils/timeUtils';

function safeRevalidate(_path: string) {
  // Pruned blocking multi-page revalidation in server actions; state and appCache.invalidateTags provide instant updates
}

export interface StudentRecord {
  id: string;
  name: string;
  category: 'Student' | 'Intern';
  courseType: string;
  department: string;
  startupName?: string;
  year: number;
  email: string;
  phone: string | null;
  status: 'Active' | 'Inactive';
  mentorId?: string;
  mentorName?: string;
  mentorDept?: string;
  mentorCode?: string; // Compatibility alias to mentorId
  projects: string[];
}

export interface MentorRecord {
  id: string;
  code: string; // Compatibility alias to id
  name: string;
  department?: string;
  designation?: string;
  phone?: string;
  email?: string;
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
  return appCache.get('students_all', 120, async () => {
    try {
      const list = await prisma.student.findMany({
        where: {
          status: { not: 'Deleted' },
        },
        include: { mentor: true },
        orderBy: { name: 'asc' },
      });

      return list.map((s: any) => {
        const isIntern = s.category === 'Intern' || s.courseType === 'Intern' || s.id.startsWith('INT-');
        const mentorName = s.mentor?.name || 'Unassigned';
        const mentorId = s.mentorId || undefined;

        return {
          id: s.id,
          name: s.name,
          category: (isIntern ? 'Intern' : 'Student') as 'Student' | 'Intern',
          courseType: s.courseType || (isIntern ? 'Intern' : 'Bachelor'),
          department: isIntern ? s.department : normalizeDepartmentName(s.department),
          startupName: isIntern ? (s.startupName || s.department) : undefined,
          year: s.year || 0,
          email: s.email,
          phone: s.phone,
          status: s.status,
          mentorId,
          mentorName,
          mentorDept: s.mentor?.department,
          mentorCode: mentorId,
          projects: mentorName !== 'Unassigned' ? [mentorName] : [],
        };
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }, ['students', 'mentors']);
}

export async function getStudentById(idInput: string): Promise<StudentRecord | null> {
  const query = (idInput || '').trim();
  if (!query) return null;
  const upper = query.toUpperCase();
  const digits = query.replace(/\D/g, '');

  try {
    // 1. Direct ID match
    let student = await prisma.student.findUnique({
      where: { id: upper },
      include: { mentor: true },
    });

    // 2. Prefixed INT- ID
    if (!student && upper.startsWith('INT')) {
      const cleanInt = 'INT-' + upper.replace(/^INT[-_\s]*/, '');
      student = await prisma.student.findUnique({
        where: { id: cleanInt },
        include: { mentor: true },
      });
    }

    // 3. 4-6 digits: Intern ID suffix or phone suffix
    if (!student && digits.length >= 4 && digits.length <= 6) {
      student = await prisma.student.findFirst({
        where: {
          OR: [
            { id: `INT-${digits}` },
            { id: { contains: digits } },
            { phone: { endsWith: digits } },
          ],
        },
        include: { mentor: true },
      });
    }

    // 4. 10-digit phone
    if (!student && digits.length >= 10) {
      student = await prisma.student.findFirst({
        where: {
          phone: { contains: digits },
        },
        include: { mentor: true },
      });
    }

    // 5. Name match (at least 3 characters)
    if (!student && query.length >= 3) {
      student = await prisma.student.findFirst({
        where: {
          name: { contains: query, mode: 'insensitive' },
        },
        include: { mentor: true },
      });
    }

    if (!student || student.status === 'Deleted') return null;

    const isIntern = student.category === 'Intern' || student.courseType === 'Intern' || student.id.startsWith('INT-');
    const mentorName = student.mentor?.name || 'Unassigned';
    const mentorId = student.mentorId || undefined;

    return {
      id: student.id,
      name: student.name,
      category: (isIntern ? 'Intern' : 'Student') as 'Student' | 'Intern',
      courseType: student.courseType,
      department: student.department,
      startupName: isIntern ? (student.startupName || student.department) : undefined,
      year: student.year,
      email: student.email,
      phone: student.phone,
      status: student.status as 'Active' | 'Inactive',
      mentorId,
      mentorName,
      mentorDept: student.mentor?.department,
      mentorCode: mentorId,
      projects: mentorName !== 'Unassigned' ? [mentorName] : [],
    };
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
  mentorId?: string;
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
      if (existing.status === 'Deleted') {
        const canonicalDept = normalizeDepartmentName(data.department);
        const rawMentorId = data.mentorId || data.mentorCode;
        const mentorId = rawMentorId && rawMentorId !== 'UNASSIGNED' ? rawMentorId.trim() : null;

        const updated = await prisma.student.update({
          where: { id },
          data: {
            name,
            category: 'Student',
            courseType,
            department: canonicalDept,
            year: Number(data.year) || 1,
            email,
            phone: data.phone || null,
            status: data.status || 'Active',
            mentorId,
          },
          include: { mentor: true },
        });

        appCache.invalidateTags(['students', 'dashboard', 'mentors']);
        safeRevalidate('/students');
        safeRevalidate('/dashboard');

        return {
          success: true,
          message: `Student ${name} (${id}) registered successfully.`,
          student: {
            id: updated.id,
            name: updated.name,
            category: 'Student',
            courseType: updated.courseType,
            department: updated.department,
            year: updated.year,
            email: updated.email,
            phone: updated.phone,
            status: 'Active',
            mentorId: updated.mentorId || undefined,
            mentorName: updated.mentor?.name || 'Unassigned',
            mentorDept: updated.mentor?.department,
            mentorCode: updated.mentorId || undefined,
            projects: updated.mentor?.name ? [updated.mentor.name] : [],
          },
        };
      }
      return { success: false, message: `Student ID ${id} already exists in registry.` };
    }

    const canonicalDept = normalizeDepartmentName(data.department);
    const rawMentorId = data.mentorId || data.mentorCode;
    const mentorId = rawMentorId && rawMentorId !== 'UNASSIGNED' ? rawMentorId.trim() : null;

    const created = await prisma.student.create({
      data: {
        id,
        name,
        category: 'Student',
        courseType,
        department: canonicalDept,
        year: Number(data.year) || 1,
        email,
        phone: data.phone || null,
        status: data.status || 'Active',
        mentorId: mentorId,
      },
      include: { mentor: true },
    });

    appCache.invalidateTags(['students', 'dashboard', 'mentors']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');

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
        mentorId: created.mentorId || undefined,
        mentorName: created.mentor?.name || 'Unassigned',
        mentorDept: created.mentor?.department,
        mentorCode: created.mentorId || undefined,
        projects: created.mentor?.name ? [created.mentor.name] : [],
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
  mentorId?: string;
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
      if (existingWithSamePhone.status === 'Deleted') {
        finalId = existingWithSamePhone.id;
        const rawMentorId = data.mentorId || data.mentorCode;
        const mentorId = rawMentorId && rawMentorId !== 'UNASSIGNED' ? rawMentorId.trim() : null;

        const updated = await prisma.student.update({
          where: { id: finalId },
          data: {
            name,
            category: 'Intern',
            startupName,
            courseType: 'Intern',
            department: startupName,
            year: 0,
            phone: cleanPhone,
            status: 'Active',
            mentorId,
          },
          include: { mentor: true },
        });

        appCache.invalidateTags(['students', 'dashboard', 'mentors', 'food-list']);
        safeRevalidate('/students');
        safeRevalidate('/dashboard');
        safeRevalidate('/daily-food-list');

        return {
          success: true,
          message: `✓ Registered Intern ${name} with ID ${finalId} (${startupName}).`,
          student: {
            id: updated.id,
            name: updated.name,
            category: 'Intern',
            courseType: 'Intern',
            department: updated.department,
            startupName: updated.startupName || undefined,
            year: 0,
            email: updated.email || '',
            phone: updated.phone,
            status: 'Active',
            mentorId: updated.mentorId || undefined,
            mentorName: updated.mentor?.name || 'Unassigned',
            mentorDept: updated.mentor?.department,
            mentorCode: updated.mentorId || undefined,
            projects: updated.mentor?.name ? [updated.mentor.name] : [],
          },
        };
      }
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

    const email = `intern.${finalId.toLowerCase()}@incubation.local`;

    const rawMentorId = data.mentorId || data.mentorCode;
    const mentorId = rawMentorId && rawMentorId !== 'UNASSIGNED' ? rawMentorId.trim() : null;

    const created = await prisma.student.create({
      data: {
        id: finalId,
        name,
        category: 'Intern',
        startupName,
        courseType: 'Intern',
        department: startupName,
        year: 0,
        email,
        phone: cleanPhone,
        status: 'Active',
        mentorId,
      },
      include: { mentor: true },
    });

    appCache.invalidateTags(['students', 'dashboard', 'mentors', 'food-list']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');
    safeRevalidate('/daily-food-list');

    return {
      success: true,
      message: `✓ Registered Intern ${name} with ID ${finalId} (${startupName}).`,
      student: {
        id: created.id,
        name: created.name,
        category: 'Intern',
        courseType: 'Intern',
        department: created.department,
        startupName: created.startupName || created.department,
        year: 0,
        email: created.email,
        phone: created.phone,
        status: 'Active',
        mentorId: created.mentorId || undefined,
        mentorName: created.mentor?.name || 'Unassigned',
        mentorDept: created.mentor?.department,
        mentorCode: created.mentorId || undefined,
        projects: created.mentor?.name ? [created.mentor.name] : [],
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
    mentorId?: string;
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
    });

    if (!existing) {
      return { success: false, message: `Member with ID "${id}" not found.` };
    }

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

    const isIntern = existing.category === 'Intern' || data.courseType === 'Intern' || existing.courseType === 'Intern' || id.startsWith('INT-');
    const canonicalDept = isIntern ? data.department : normalizeDepartmentName(data.department);

    let mentorIdUpdate: string | null | undefined = undefined;
    const rawMentorId = data.mentorId !== undefined ? data.mentorId : data.mentorCode;
    if (rawMentorId !== undefined) {
      mentorIdUpdate = rawMentorId === 'UNASSIGNED' || !rawMentorId.trim() ? null : rawMentorId.trim();
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        name,
        category: isIntern ? 'Intern' : 'Student',
        startupName: isIntern ? canonicalDept : null,
        courseType: isIntern ? 'Intern' : courseType,
        department: canonicalDept,
        year: isIntern ? 0 : (Number(data.year) || existing.year),
        email,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        status: data.status || existing.status,
        ...(mentorIdUpdate !== undefined ? { mentorId: mentorIdUpdate } : {}),
      },
      include: { mentor: true },
    });

    appCache.invalidateTags(['students', 'dashboard', 'mentors', 'food-list']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');
    safeRevalidate('/daily-food-list');

    return {
      success: true,
      message: `Member ${name} (${id}) updated successfully.`,
      student: {
        id: updated.id,
        name: updated.name,
        category: (isIntern ? 'Intern' : 'Student') as 'Student' | 'Intern',
        courseType: updated.courseType,
        department: updated.department,
        startupName: isIntern ? (updated.startupName || updated.department) : undefined,
        year: updated.year,
        email: updated.email,
        phone: updated.phone,
        status: updated.status as 'Active' | 'Inactive',
        mentorId: updated.mentorId || undefined,
        mentorName: updated.mentor?.name || 'Unassigned',
        mentorDept: updated.mentor?.department,
        mentorCode: updated.mentorId || undefined,
        projects: updated.mentor?.name ? [updated.mentor.name] : [],
      },
    };
  } catch (error) {
    console.error('Error updating student:', error);
    return { success: false, message: 'Server error while updating member.' };
  }
}

export async function getMentors(): Promise<MentorRecord[]> {
  return appCache.get('mentors_all', 120, async () => {
    try {
      const mentors = await prisma.mentor.findMany({
        orderBy: { name: 'asc' },
      });

      const activeStudents = await prisma.student.findMany({
        where: {
          status: { not: 'Deleted' },
          mentorId: { not: null },
        },
        select: { mentorId: true },
      });

      const countMap = new Map<string, number>();
      activeStudents.forEach((s: any) => {
        if (s.mentorId) {
          countMap.set(s.mentorId, (countMap.get(s.mentorId) || 0) + 1);
        }
      });

      return mentors.map((m: any) => ({
        id: m.id,
        code: m.id, // Alias for backward compatibility
        name: m.name,
        department: m.department || 'Incubation Center',
        designation: m.designation || 'Faculty Mentor',
        phone: m.phone || undefined,
        email: m.email || undefined,
        status: m.status as 'Active' | 'Inactive',
        memberCount: countMap.get(m.id) || 0,
      }));
    } catch (error) {
      console.error('Error fetching mentors:', error);
      return [];
    }
  }, ['mentors', 'students']);
}

export async function createMentor(data: {
  name: string;
  department?: string;
  designation?: string;
  phone?: string;
  email?: string;
}): Promise<{ success: boolean; message: string; mentor?: MentorRecord }> {
  const name = (data.name || '').trim();
  const department = (data.department || '').trim() || 'Incubation Center';
  const designation = (data.designation || '').trim() || 'Faculty Mentor';
  const phone = (data.phone || '').trim() || null;
  const email = (data.email || '').trim() || null;

  if (!name) {
    return { success: false, message: 'Mentor name is required.' };
  }

  try {
    const created = await prisma.mentor.create({
      data: {
        name,
        department,
        designation,
        phone,
        email,
        status: 'Active',
      },
    });

    appCache.invalidateTags(['mentors', 'dashboard', 'students']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');
    safeRevalidate('/daily-food-list');

    return {
      success: true,
      message: `Mentor "${name}" added successfully.`,
      mentor: {
        id: created.id,
        code: created.id,
        name: created.name,
        department: created.department,
        designation: created.designation || 'Faculty Mentor',
        phone: created.phone || undefined,
        email: created.email || undefined,
        status: 'Active',
        memberCount: 0,
      },
    };
  } catch (error) {
    console.error('Error creating mentor:', error);
    return { success: false, message: 'Server error while creating mentor.' };
  }
}

export async function updateMentor(
  mentorIdInput: string,
  data: {
    name?: string;
    department?: string;
    designation?: string;
    phone?: string;
    email?: string;
    status?: string;
  }
): Promise<{ success: boolean; message: string; mentor?: MentorRecord }> {
  const mentorId = mentorIdInput.trim();
  const name = data.name !== undefined ? data.name.trim() : undefined;
  if (name !== undefined && !name) {
    return { success: false, message: 'Mentor name cannot be empty.' };
  }

  try {
    const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      return { success: false, message: 'Mentor not found.' };
    }

    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name;
    if (data.department !== undefined) updatePayload.department = data.department.trim() || 'Incubation Center';
    if (data.designation !== undefined) updatePayload.designation = data.designation.trim() || 'Faculty Mentor';
    if (data.phone !== undefined) updatePayload.phone = data.phone.trim() || null;
    if (data.email !== undefined) updatePayload.email = data.email.trim() || null;
    if (data.status !== undefined) updatePayload.status = data.status;

    const updated = await prisma.mentor.update({
      where: { id: mentorId },
      data: updatePayload,
    });

    appCache.invalidateTags(['mentors', 'students', 'dashboard', 'food-list']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');
    safeRevalidate('/daily-food-list');

    return {
      success: true,
      message: `Mentor "${updated.name}" updated successfully.`,
      mentor: {
        id: updated.id,
        code: updated.id,
        name: updated.name,
        department: updated.department,
        designation: updated.designation || 'Faculty Mentor',
        phone: updated.phone || undefined,
        email: updated.email || undefined,
        status: updated.status as 'Active' | 'Inactive',
        memberCount: 0,
      },
    };
  } catch (error) {
    console.error('Error updating mentor:', error);
    return { success: false, message: 'Server error while updating mentor.' };
  }
}

export async function deleteMentor(mentorIdInput: string): Promise<{ success: boolean; message: string }> {
  const mentorId = mentorIdInput.trim();
  try {
    const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      return { success: false, message: 'Mentor not found.' };
    }

    // Unassign all mentees currently assigned to this mentor
    await prisma.student.updateMany({
      where: { mentorId },
      data: { mentorId: null },
    });

    // Delete mentor
    await prisma.mentor.delete({ where: { id: mentorId } });

    appCache.invalidateTags(['mentors', 'students', 'dashboard', 'food-list']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');
    safeRevalidate('/daily-food-list');

    return {
      success: true,
      message: `Mentor "${mentor.name}" deleted successfully. Assigned mentees have been unassigned.`,
    };
  } catch (error) {
    console.error('Error deleting mentor:', error);
    return { success: false, message: 'Server error while deleting mentor.' };
  }
}

export async function assignMentor(
  studentIdInput: string,
  mentorIdInput: string
): Promise<{ success: boolean; message: string }> {
  const studentId = studentIdInput.trim().toUpperCase();
  const mentorId = mentorIdInput.trim();

  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return { success: false, message: `Member ${studentId} not found.` };

    const effectiveMentorId = mentorId && mentorId !== 'UNASSIGNED' ? mentorId : null;

    await prisma.student.update({
      where: { id: studentId },
      data: { mentorId: effectiveMentorId },
    });

    appCache.invalidateTags(['students', 'mentors', 'dashboard']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');
    safeRevalidate('/daily-food-list');

    return { success: true, message: `Mentor updated for ${student.name}.` };
  } catch (error) {
    console.error('Error assigning mentor:', error);
    return { success: false, message: 'Server error while assigning mentor.' };
  }
}

export async function deleteStudent(studentIdInput: string): Promise<{ success: boolean; message: string }> {
  const studentId = studentIdInput.trim().toUpperCase();
  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return { success: false, message: `Student ID "${studentId}" not found.` };
    }

    const tokenCount = await prisma.foodToken.count({ where: { studentId } });

    // Clean up any unredeemed food eligibilities for today or future dates so they don't linger in today's pending mess food queue
    await prisma.dailyFoodEligibility.deleteMany({
      where: {
        studentId,
        status: 'Eligible',
      },
    }).catch(() => {});

    if (tokenCount > 0) {
      // Mark as Deleted and remove mentor link; preserves full row in PostgreSQL so foodTokens relations stay intact
      await prisma.student.update({
        where: { id: studentId },
        data: { status: 'Deleted', mentorId: null },
      });

      appCache.invalidateTags(['students', 'mentors', 'dashboard', 'food-list', 'foodtokens']);
      safeRevalidate('/students');
      safeRevalidate('/dashboard');
      safeRevalidate('/daily-food-list');
      safeRevalidate('/scan-token');

      return {
        success: true,
        message: `Member ${student.name} (${studentId}) removed from registry. Past meal tokens (${tokenCount}) permanently preserved.`,
      };
    }

    // No historical tokens issued: clean up any remaining eligibilities and delete student record completely
    await prisma.dailyFoodEligibility.deleteMany({ where: { studentId } }).catch(() => {});
    await prisma.student.delete({ where: { id: studentId } });

    appCache.invalidateTags(['students', 'mentors', 'dashboard', 'food-list', 'foodtokens']);
    safeRevalidate('/students');
    safeRevalidate('/dashboard');
    safeRevalidate('/daily-food-list');
    safeRevalidate('/scan-token');

    return { success: true, message: `Member ${student.name} (${studentId}) deleted successfully.` };
  } catch (error) {
    console.error('Error deleting student:', error);
    return { success: false, message: 'Server error while deleting student record.' };
  }
}

// ---------------------------------------------------------------------------
// Dashboard Bundle & Stats
// ---------------------------------------------------------------------------
export async function getDashboardStats(dateInput?: string) {
  const date = dateInput || getTodayISTDateString();
  return appCache.get(`dashboard_${date}`, 60, async () => {
    try {
      const session = getMealSession();
      const yesterdayStr = getPreviousISTDateString(date);
      const needYesterday = session === 'BREAKFAST' || session === 'LUNCH';

      const [students, mentors, foodList, eligibilities, tokens, overnightStayCount] = await Promise.all([
        prisma.student.findMany({
          where: { status: { not: 'Deleted' } },
          select: { id: true, status: true },
        }),
        prisma.mentor.findMany({
          select: { id: true, status: true },
        }),
        prisma.dailyFoodList.findUnique({
          where: { date },
          select: { status: true, finalizedBy: true },
        }),
        prisma.dailyFoodEligibility.findMany({
          where: { date },
          select: { id: true },
        }),
        prisma.foodToken.findMany({
          where: { date },
          include: { student: true, mentor: true },
          orderBy: { issuedAt: 'desc' },
        }),
        needYesterday
          ? prisma.dailyFoodEligibility.count({ where: { date: yesterdayStr } })
          : Promise.resolve(0),
      ]);

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
        activeMentors: mentors.filter((m: any) => m.status === 'Active').length,
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
        activeMentors: 0,
        tokens: [],
      };
    }
  }, ['dashboard']);
}

export interface DashboardBundleData {
  foodList: any;
  tokens: any[];
  students: StudentRecord[];
  projects: ProjectRecord[];
  mentors: MentorRecord[];
  overnightStayCount?: number;
  yesterdayDinnerTokensCount?: number;
  yesterdayLastDinnerTime?: string | null;
}

export async function getDashboardBundle(dateInput?: string): Promise<DashboardBundleData> {
  const date = dateInput || getTodayISTDateString();
  return appCache.get(`dash_bundle_${date}`, 60, async () => {
    try {
      const session = getMealSession();
      const yesterdayStr = getPreviousISTDateString(date);
      const needYesterday = session === 'BREAKFAST' || session === 'LUNCH';

      const [list, eligibilities, rawTokens, students, mentors, oCount, yTokens] = await Promise.all([
        prisma.dailyFoodList.findUnique({
          where: { date },
          select: { status: true, finalizedBy: true, finalizedAt: true },
        }),
        prisma.dailyFoodEligibility.findMany({
          where: { date },
          include: { student: true, mentor: true },
        }),
        prisma.foodToken.findMany({
          where: { date },
          include: { student: true, mentor: true },
          orderBy: { issuedAt: 'desc' },
        }),
        getStudents(),
        getMentors(),
        needYesterday
          ? prisma.dailyFoodEligibility.count({ where: { date: yesterdayStr } })
          : Promise.resolve(0),
        needYesterday
          ? prisma.foodToken.findMany({
              where: {
                date: yesterdayStr,
                session: { in: ['DINNER', 'Dinner', 'dinner'] },
              },
              select: { id: true, issuedAt: true },
              orderBy: { issuedAt: 'desc' },
            })
          : Promise.resolve([]),
      ]);

      let overnightStayCount = oCount;
      let yesterdayDinnerTokensCount = Array.isArray(yTokens) ? yTokens.length : 0;
      let yesterdayLastDinnerTime: string | null = null;
      if (Array.isArray(yTokens) && yTokens.length > 0 && yTokens[0].issuedAt) {
        yesterdayLastDinnerTime = formatISTTime(yTokens[0].issuedAt);
      }

      const entries = eligibilities.map((e: any) => {
        const mentorName = e.mentor?.name || 'Unassigned';
        return {
          studentId: e.studentId,
          studentName: e.student?.name || e.studentId,
          department: normalizeDepartmentName(e.student?.department),
          year: e.student?.year || 0,
          projectCode: e.mentorId || 'UNASSIGNED',
          projectName: mentorName,
          mentorName,
          addedBy: e.addedBy || 'Staff',
          status: e.status || 'Eligible',
        };
      });

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
        const effectiveSession = getTokenEffectiveSession(t);
        const mentorName = t.mentor?.name || 'General';
        return {
          id: t.id,
          tokenNumber: t.tokenNumber,
          studentId: t.studentId,
          studentName: t.student?.name || t.studentId,
          department: normalizeDepartmentName(t.student?.department),
          year: t.student?.year ? `Year ${t.student.year}` : '—',
          project: mentorName,
          date: t.date,
          time: formatISTTime(issuedDate),
          session: effectiveSession,
          status: t.status,
          generatedBy: t.issuedById || 'Staff',
        };
      });

      // Dummy project array for backward compatibility
      const legacyProjects: ProjectRecord[] = mentors.map(m => ({
        code: m.id,
        name: m.name,
        description: `${m.department} · ${m.designation}`,
        status: m.status === 'Active' ? 'Active' : 'Inactive',
        createdDate: '2026-10-01',
        members: [],
      }));

      return {
        foodList,
        tokens,
        students,
        projects: legacyProjects,
        mentors,
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
        mentors: [],
        overnightStayCount: 0,
        yesterdayDinnerTokensCount: 0,
        yesterdayLastDinnerTime: null,
      };
    }
  }, ['dashboard', 'foodlist', 'foodtokens', 'students', 'mentors']);
}

export interface StudentsBundleData {
  students: StudentRecord[];
  projects: ProjectRecord[];
  mentors: MentorRecord[];
}

export async function getStudentsBundle(): Promise<StudentsBundleData> {
  return appCache.get('students_bundle', 120, async () => {
    try {
      const [students, mentors] = await Promise.all([
        getStudents(),
        getMentors(),
      ]);

      const legacyProjects: ProjectRecord[] = mentors.map(m => ({
        code: m.id,
        name: m.name,
        description: `${m.department} · ${m.designation}`,
        status: m.status === 'Active' ? 'Active' : 'Inactive',
        createdDate: '2026-10-01',
        members: [],
      }));

      return {
        students,
        projects: legacyProjects,
        mentors,
      };
    } catch (err) {
      console.error('getStudentsBundle error:', err);
      return { students: [], projects: [], mentors: [] };
    }
  }, ['students', 'mentors']);
}

// ---------------------------------------------------------------------------
// Backward-compatible project stubs
// ---------------------------------------------------------------------------
export async function getProjects(): Promise<ProjectRecord[]> {
  const mentors = await getMentors();
  return mentors.map(m => ({
    code: m.id,
    name: m.name,
    description: `${m.department} · ${m.designation}`,
    status: m.status === 'Active' ? 'Active' : 'Inactive',
    createdDate: '2026-10-01',
    members: [],
  }));
}

export async function createProject(data: { code: string; name: string; description?: string }) {
  const m = await createMentor({ name: data.name, department: data.description });
  return { success: m.success, message: m.message, project: m.mentor ? { code: m.mentor.id, name: m.mentor.name, description: m.mentor.department || null, status: 'Active', createdDate: '2026-10-01', members: [] } : undefined };
}

export async function deleteProject(_code: string) {
  return { success: true, message: 'Project deprecated.' };
}

export async function addProjectMember(_code: string, _studentId: string) {
  return { success: true, message: 'Member updated.' };
}

export async function removeProjectMember(_code: string, _studentId: string) {
  return { success: true, message: 'Member removed.' };
}
