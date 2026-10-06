'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Badge from '@/components/Badge';
import {
  getStudentsBundle,
  createStudent,
  createIntern,
  updateStudent,
  deleteStudent,
  createMentor,
  updateMentor,
  deleteMentor,
  assignMentor,
  type StudentRecord,
  type ProjectRecord,
  type MentorRecord,
} from '@/actions/studentActions';

import {
  UNDERGRAD_DEPARTMENTS,
  POSTGRAD_DEPARTMENTS,
} from '@/utils/departmentUtils';

const years = ['All', '1', '2', '3', '4', '5'];

type View = 'list' | 'detail';

interface CachedStudentsPayload {
  students: StudentRecord[];
  projects: ProjectRecord[];
  mentors?: MentorRecord[];
  timestamp: number;
}

let memoryStudentsCache: CachedStudentsPayload | null = null;

function getInitialStudentsData(): CachedStudentsPayload | null {
  if (memoryStudentsCache && Date.now() - memoryStudentsCache.timestamp < 1000 * 60 * 15) {
    return memoryStudentsCache;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('incubation_students_cache');
      if (stored) {
        const parsed = JSON.parse(stored) as CachedStudentsPayload;
        if (Date.now() - parsed.timestamp < 1000 * 60 * 15) {
          memoryStudentsCache = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

export default function Students() {
  const initialCache = useMemo(() => getInitialStudentsData(), []);

  const [studentList, setStudentList] = useState<StudentRecord[]>(() => initialCache?.students ?? []);
  const [projectList, setProjectList] = useState<ProjectRecord[]>(() => initialCache?.projects ?? []);
  const [mentorList, setMentorList] = useState<MentorRecord[]>(() => initialCache?.mentors ?? []);
  const [loading, setLoading] = useState(() => !initialCache);
  
  // Navigation & Category tabs
  const [categoryTab, setCategoryTab] = useState<'all' | 'students' | 'interns' | 'mentors'>('all');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<StudentRecord | null>(null);

  // Add Member Modal states
  const [showAdd, setShowAdd] = useState(false);
  const [memberType, setMemberType] = useState<'student' | 'intern'>('student');
  const [form, setForm] = useState({
    id: '',
    name: '',
    courseType: 'Bachelor',
    department: 'Computer Science and Engineering',
    year: '1',
    email: '',
    phone: '',
    status: 'Active',
    mentorCode: '',
  });
  const [internForm, setInternForm] = useState({
    name: '',
    email: '',
    phone: '',
    startupName: '',
    mentorCode: '',
  });
  const [formError, setFormError] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Inline Add Mentor states for Add Member modal
  const [isAddingNewMentorInline, setIsAddingNewMentorInline] = useState(false);
  const [inlineMentorName, setInlineMentorName] = useState('');
  const [inlineMentorDept, setInlineMentorDept] = useState('');

  // Add Mentor Modal states
  const [showAddMentor, setShowAddMentor] = useState(false);
  const [mentorForm, setMentorForm] = useState({
    name: '',
    department: 'Incubation Center',
    designation: 'Faculty Mentor',
  });
  const [mentorFormError, setMentorFormError] = useState('');
  const [isSavingMentor, setIsSavingMentor] = useState(false);

  // Edit & Delete Mentor states
  const [mentorToEdit, setMentorToEdit] = useState<MentorRecord | null>(null);
  const [editMentorForm, setEditMentorForm] = useState({
    name: '',
    department: 'Incubation Center',
    designation: 'Faculty Mentor',
    phone: '',
    email: '',
    status: 'Active' as 'Active' | 'Inactive',
  });
  const [editMentorFormError, setEditMentorFormError] = useState('');
  const [isSavingMentorEdit, setIsSavingMentorEdit] = useState(false);
  const [mentorToDelete, setMentorToDelete] = useState<MentorRecord | null>(null);
  const [isDeletingMentor, setIsDeletingMentor] = useState(false);

  // View Mentor Mentees modal state
  const [selectedMentorForMentees, setSelectedMentorForMentees] = useState<MentorRecord | null>(null);

  // Edit Member Modal states
  const [studentToDelete, setStudentToDelete] = useState<StudentRecord | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<StudentRecord | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    courseType: 'Bachelor',
    department: 'Computer Science and Engineering',
    year: '1',
    email: '',
    phone: '',
    status: 'Active',
    mentorCode: '',
  });
  const [editFormError, setEditFormError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editIsAddingNewMentorInline, setEditIsAddingNewMentorInline] = useState(false);
  const [editInlineMentorName, setEditInlineMentorName] = useState('');
  const [editInlineMentorDept, setEditInlineMentorDept] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleOpenAddModal = (type: 'student' | 'intern') => {
    setMemberType(type);
    setShowAdd(true);
    setIsAddingNewMentorInline(false);
    setInlineMentorName('');
    setInlineMentorDept('');
    setFormError('');
  };

  const handleCloseAddModal = () => {
    setShowAdd(false);
    setIsAddingNewMentorInline(false);
    setInlineMentorName('');
    setInlineMentorDept('');
    setFormError('');
  };

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const bundle = await getStudentsBundle();
      setStudentList(bundle.students);
      setProjectList(bundle.projects);
      setMentorList(bundle.mentors || []);

      const payload: CachedStudentsPayload = {
        students: bundle.students,
        projects: bundle.projects,
        mentors: bundle.mentors,
        timestamp: Date.now(),
      };
      memoryStudentsCache = payload;
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('incubation_students_cache', JSON.stringify(payload));
        } catch {}
      }
    } catch (e) {
      console.error(e);
      showToast('Error loading registry records.');
    } finally {
      setLoading(false);
    }
  }, []);

  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadData(Boolean(initialCache));
    }
  }, [loadData, initialCache]);

  // Derived Preview ID for intern registration
  const internCleanDigits = internForm.phone.replace(/\D/g, '');
  const internPreviewId = internCleanDigits.length >= 4 ? `INT-${internCleanDigits.slice(-4)}` : 'INT-XXXX';

  const filtered = studentList.filter(s => {
    const isIntern = s.category === 'Intern' || s.courseType === 'Intern' || s.id.startsWith('INT-');

    if (categoryTab === 'students' && isIntern) return false;
    if (categoryTab === 'interns' && !isIntern) return false;

    const q = search.toLowerCase();
    const matchQ =
      !q ||
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q)) ||
      (s.startupName && s.startupName.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.mentorName && s.mentorName.toLowerCase().includes(q));

    const matchCourse = courseFilter === 'All' || (s.courseType || 'Bachelor') === courseFilter;
    const matchDept =
      deptFilter === 'All' ||
      s.department === deptFilter ||
      (deptFilter === 'Computer Science and Engineering' && s.department === 'CSE') ||
      (deptFilter === 'Mechanical Engineering' && s.department === 'ME') ||
      (deptFilter === 'Electronics and Communication Engineering' && s.department === 'ECE') ||
      (deptFilter === 'Electrical and Electronics Engineering' && s.department === 'EEE') ||
      (deptFilter === 'Civil Engineering' && s.department === 'Civil');
    const matchYear = yearFilter === 'All' || String(s.year) === yearFilter;
    return matchQ && matchCourse && matchDept && matchYear;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, courseFilter, deptFilter, yearFilter, categoryTab]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedStudents = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  // Save Student or Intern
  const handleSaveMember = async () => {
    setFormError('');
    setIsSavingMember(true);

    try {
      let resolvedMentorCode: string | undefined = undefined;
      if (isAddingNewMentorInline) {
        if (!inlineMentorName.trim()) {
          setFormError('Please enter the Mentor Name or click "Cancel" to select an existing mentor.');
          return;
        }
        try {
          const mRes = await createMentor({
            name: inlineMentorName.trim(),
            department: inlineMentorDept.trim() || 'Incubation Center',
            designation: 'Faculty Mentor',
          });
          if (!mRes.success || !mRes.mentor) {
            setFormError(mRes.message || 'Error creating new mentor.');
            return;
          }
          resolvedMentorCode = mRes.mentor.id || mRes.mentor.code;
        } catch (err: any) {
          setFormError(err?.message || 'Failed to create mentor.');
          return;
        }
      } else {
        resolvedMentorCode = (memberType === 'intern' ? undefined : form.mentorCode) || undefined;
      }

      if (memberType === 'intern') {
        if (!internForm.name.trim()) {
          setFormError('Intern Full Name is required.');
          return;
        }
        if (internCleanDigits.length < 4) {
          setFormError('Please enter a valid phone number (at least 4 digits needed for ID).');
          return;
        }
        if (!internForm.email.trim()) {
          setFormError('Intern Email Address is required.');
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(internForm.email.trim())) {
          setFormError('Please enter a valid email address (e.g. name@startup.com).');
          return;
        }
        if (!internForm.startupName.trim()) {
          setFormError('Startup / Company Name is required.');
          return;
        }

        const res = await createIntern({
          name: internForm.name,
          email: internForm.email,
          phone: internForm.phone,
          startupName: internForm.startupName,
        });

        if (res.success && res.student) {
          showToast(res.message);
          const newStudent = res.student;

          // Instant optimistic UI update (0ms)
          setStudentList(prev => [newStudent, ...prev.filter(s => s.id !== newStudent.id)]);

          // Synchronize in-memory & sessionStorage cache immediately
          if (typeof window !== 'undefined') {
            try {
              const currentCached = memoryStudentsCache?.students || [];
              const updatedCache = [newStudent, ...currentCached.filter(s => s.id !== newStudent.id)];
              const payload = {
                students: updatedCache,
                projects: projectList,
                mentors: mentorList,
                timestamp: Date.now(),
              };
              memoryStudentsCache = payload;
              sessionStorage.setItem('incubation_students_cache', JSON.stringify(payload));
            } catch {}
          }

          setInternForm({ name: '', email: '', phone: '', startupName: '', mentorCode: '' });
          setIsAddingNewMentorInline(false);
          setInlineMentorName('');
          setInlineMentorDept('');
          setShowAdd(false);

          // Background sync without blocking the UI
          loadData(true);
        } else {
          setFormError(res.message);
        }
      } else {
        // College Student
        if (!form.id || !form.name || !form.email) {
          setFormError('Student Roll ID, Name, and Email are required.');
          return;
        }

        const res = await createStudent({
          id: form.id,
          name: form.name,
          courseType: form.courseType,
          department: form.department,
          year: Number(form.year),
          email: form.email,
          phone: form.phone,
          status: form.status,
          mentorId: resolvedMentorCode,
        });

        if (res.success && res.student) {
          showToast(res.message);
          const newStudent = res.student;

          // Instant optimistic UI update (0ms)
          setStudentList(prev => [newStudent, ...prev.filter(s => s.id !== newStudent.id)]);

          // Synchronize in-memory & sessionStorage cache immediately
          if (typeof window !== 'undefined') {
            try {
              const currentCached = memoryStudentsCache?.students || [];
              const updatedCache = [newStudent, ...currentCached.filter(s => s.id !== newStudent.id)];
              const payload = {
                students: updatedCache,
                projects: projectList,
                mentors: mentorList,
                timestamp: Date.now(),
              };
              memoryStudentsCache = payload;
              sessionStorage.setItem('incubation_students_cache', JSON.stringify(payload));
            } catch {}
          }

          setForm({
            id: '',
            name: '',
            courseType: 'Bachelor',
            department: 'Computer Science and Engineering',
            year: '1',
            email: '',
            phone: '',
            status: 'Active',
            mentorCode: '',
          });
          setIsAddingNewMentorInline(false);
          setInlineMentorName('');
          setInlineMentorDept('');
          setShowAdd(false);

          // Background sync without blocking the UI
          loadData(true);
        } else {
          setFormError(res.message);
        }
      }
    } finally {
      setIsSavingMember(false);
    }
  };

  // Save Mentor
  const handleSaveMentor = async () => {
    if (!mentorForm.name.trim()) {
      setMentorFormError('Mentor Name is required.');
      return;
    }

    setIsSavingMentor(true);
    setMentorFormError('');
    try {
      const res = await createMentor({
        name: mentorForm.name,
        department: mentorForm.department,
        designation: mentorForm.designation,
      });

      if (res.success) {
        showToast(res.message);
        setMentorForm({ name: '', department: 'Incubation Center', designation: 'Faculty Mentor' });
        setShowAddMentor(false);
        await loadData();
      } else {
        setMentorFormError(res.message);
      }
    } catch (e: any) {
      setMentorFormError(e?.message || 'Error creating mentor.');
    } finally {
      setIsSavingMentor(false);
    }
  };

  const handleOpenEditMentor = (mentor: MentorRecord) => {
    setMentorToEdit(mentor);
    setEditMentorForm({
      name: mentor.name,
      department: mentor.department || 'Incubation Center',
      designation: mentor.designation || 'Faculty Mentor',
      phone: mentor.phone || '',
      email: mentor.email || '',
      status: (mentor.status as 'Active' | 'Inactive') || 'Active',
    });
    setEditMentorFormError('');
  };

  const handleSaveMentorEdit = async () => {
    if (!mentorToEdit) return;
    if (!editMentorForm.name.trim()) {
      setEditMentorFormError('Mentor Full Name is required.');
      return;
    }

    setIsSavingMentorEdit(true);
    setEditMentorFormError('');
    try {
      const res = await updateMentor(mentorToEdit.id, {
        name: editMentorForm.name,
        department: editMentorForm.department,
        designation: editMentorForm.designation,
        phone: editMentorForm.phone || undefined,
        email: editMentorForm.email || undefined,
        status: editMentorForm.status,
      });

      if (res.success) {
        showToast(res.message);
        setMentorToEdit(null);
        await loadData();
      } else {
        setEditMentorFormError(res.message);
      }
    } catch (e: any) {
      setEditMentorFormError(e?.message || 'Error updating mentor.');
    } finally {
      setIsSavingMentorEdit(false);
    }
  };

  const handleConfirmDeleteMentor = async () => {
    if (!mentorToDelete) return;
    setIsDeletingMentor(true);
    try {
      const res = await deleteMentor(mentorToDelete.id);
      showToast(res.message);
      setMentorToDelete(null);
      await loadData();
    } catch (e) {
      showToast('Error deleting mentor.');
    } finally {
      setIsDeletingMentor(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    const targetId = studentToDelete.id;
    const targetName = studentToDelete.name;

    // Instant optimistic UI removal: remove from list immediately
    setStudentList(prev => prev.filter(s => s.id !== targetId));
    setStudentToDelete(null);

    // Clear client-side cache so the deleted student does not resurface
    memoryStudentsCache = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('incubation_students_cache');
      } catch {}
    }

    try {
      const res = await deleteStudent(targetId);
      showToast(res.message);
      loadData(true);
    } catch (e) {
      showToast(`Error deleting ${targetName}.`);
      loadData(true);
    }
  };

  const handleOpenEdit = (student: StudentRecord) => {
    const isIntern = student.category === 'Intern' || student.courseType === 'Intern' || student.id.startsWith('INT-');
    setStudentToEdit(student);
    setEditForm({
      name: student.name,
      courseType: student.courseType || (isIntern ? 'Intern' : 'Bachelor'),
      department: student.startupName || student.department,
      year: String(student.year || 0),
      email: student.email,
      phone: student.phone || '',
      status: student.status,
      mentorCode: student.mentorCode || '',
    });
    setEditIsAddingNewMentorInline(false);
    setEditInlineMentorName('');
    setEditInlineMentorDept('');
    setEditFormError('');
  };

  const handleSaveEdit = async () => {
    if (!studentToEdit) return;
    const isIntern = studentToEdit.category === 'Intern' || studentToEdit.courseType === 'Intern' || studentToEdit.id.startsWith('INT-');

    if (!editForm.name.trim()) {
      setEditFormError('Full Name is required.');
      return;
    }
    if (!editForm.email.trim()) {
      setEditFormError('Email Address is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email.trim())) {
      setEditFormError('Please enter a valid email address.');
      return;
    }

    setIsSavingEdit(true);
    setEditFormError('');

    let resolvedEditMentorCode = editForm.mentorCode;
    if (editIsAddingNewMentorInline) {
      if (!editInlineMentorName.trim()) {
        setEditFormError('Please enter the Mentor Name or click "Cancel" to select an existing mentor.');
        setIsSavingEdit(false);
        return;
      }
      try {
        const mRes = await createMentor({
          name: editInlineMentorName.trim(),
          department: editInlineMentorDept.trim() || 'Incubation Center',
          designation: 'Faculty Mentor',
        });
        if (!mRes.success || !mRes.mentor) {
          setEditFormError(mRes.message || 'Error creating new mentor.');
          setIsSavingEdit(false);
          return;
        }
        resolvedEditMentorCode = mRes.mentor.id || mRes.mentor.code;
      } catch (err: any) {
        setEditFormError(err?.message || 'Failed to create mentor.');
        setIsSavingEdit(false);
        return;
      }
    }

    try {
      const res = await updateStudent(studentToEdit.id, {
        name: editForm.name,
        courseType: isIntern ? 'Intern' : editForm.courseType,
        department: editForm.department,
        year: isIntern ? 0 : Number(editForm.year) || 1,
        email: editForm.email || (isIntern ? `intern.${studentToEdit.id.toLowerCase()}@incubation.local` : ''),
        phone: editForm.phone || null,
        status: editForm.status,
        mentorId: resolvedEditMentorCode,
      });

      if (res.success && res.student) {
        showToast(res.message);
        const updated = res.student;

        setStudentList(prev => prev.map(s => (s.id === updated.id ? updated : s)));
        if (selected && selected.id === updated.id) {
          setSelected(updated);
        }

        if (memoryStudentsCache) {
          memoryStudentsCache.students = memoryStudentsCache.students.map(s =>
            s.id === updated.id ? updated : s
          );
        }
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('incubation_students_cache');
          } catch {}
        }

        setStudentToEdit(null);
        setEditIsAddingNewMentorInline(false);
        setEditInlineMentorName('');
        setEditInlineMentorDept('');
        await loadData(true);
      } else {
        setEditFormError(res.message || 'Error updating member.');
      }
    } catch (e: any) {
      setEditFormError(e?.message || 'Server error while saving changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (view === 'detail' && selected) {
    const isIntern = selected.category === 'Intern' || selected.courseType === 'Intern' || selected.id.startsWith('INT-');
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
            ← Back to Registry
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenEdit(selected)}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              ✏️ Edit Member
            </button>
            <button
              onClick={() => setStudentToDelete(selected)}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              🗑 Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-lg">
                {isIntern ? '💼' : selected.name[0]}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-lg leading-tight">{selected.name}</h3>
                <span className="font-mono text-xs text-indigo-700 font-bold">{selected.id}</span>
              </div>
            </div>

            <div className="text-xs space-y-2 pt-2 border-t border-slate-100">
              {[
                { l: 'Category', v: isIntern ? 'Startup Intern' : 'College Student' },
                { l: isIntern ? 'Startup / Company' : 'Department', v: selected.startupName || selected.department },
                { l: 'Assigned Mentor', v: selected.mentorName || 'Unassigned' },
                { l: isIntern ? 'Role' : 'Year of Study', v: isIntern ? 'Intern' : `Year ${selected.year}` },
                { l: 'Email', v: selected.email },
                { l: 'Phone', v: selected.phone || '—' },
              ].map(row => (
                <div key={row.l} className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">{row.l}</span>
                  <span className="text-slate-700 font-medium">{row.v}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Status</span>
                <Badge status={selected.status} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-semibold text-slate-800 mb-2">Mentor &amp; Incubation Alignment</h3>
              <p className="text-xs text-slate-500 mb-4">
                Assigned under <strong className="text-slate-800">{selected.mentorName || 'Unassigned Cohort'}</strong>.
              </p>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Affiliation:</span>
                  <span className="font-semibold text-slate-800">{selected.startupName || selected.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mess Eligibility:</span>
                  <span className="text-emerald-700 font-bold">Enabled for Night Stay Shifts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Category Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Members &amp; Students Registry</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage college students, startup interns, and assigned mentors in the incubation facility.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {categoryTab === 'mentors' ? (
            <button
              onClick={() => setShowAddMentor(true)}
              className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Add Mentor</span>
            </button>
          ) : categoryTab === 'students' ? (
            <button
              onClick={() => handleOpenAddModal('student')}
              className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Add Student</span>
            </button>
          ) : categoryTab === 'interns' ? (
            <button
              onClick={() => handleOpenAddModal('intern')}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Add Startup Intern</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenAddModal('student')}
                className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Add Student</span>
              </button>
              <button
                onClick={() => handleOpenAddModal('intern')}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Add Startup Intern</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Segmented Category Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => setCategoryTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            categoryTab === 'all'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Members ({studentList.length})
        </button>

        <button
          onClick={() => setCategoryTab('students')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            categoryTab === 'students'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🎓</span>
          <span>Students ({studentList.filter(s => s.category !== 'Intern' && s.courseType !== 'Intern').length})</span>
        </button>

        <button
          onClick={() => setCategoryTab('interns')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            categoryTab === 'interns'
              ? 'bg-white text-amber-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>💼</span>
          <span>Startup Interns ({studentList.filter(s => s.category === 'Intern' || s.courseType === 'Intern').length})</span>
        </button>

        <button
          onClick={() => setCategoryTab('mentors')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            categoryTab === 'mentors'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>👥</span>
          <span>Mentors ({mentorList.length})</span>
        </button>
      </div>

      {/* MENTORS VIEW TAB */}
      {categoryTab === 'mentors' ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800 text-base">Incubation Mentors</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mentors guide students and startup cohorts. Use &ldquo;+ Add Mentor&rdquo; above to register new mentors or manage existing mentors below.
              </p>
            </div>

            {mentorList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <div className="text-3xl mb-2">👥</div>
                <div className="font-semibold text-slate-700">No mentors configured yet</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Once you receive the list of mentors, click &ldquo;Add Mentor&rdquo; above to register them.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mentorList.map(m => {
                  const assignedCount = studentList.filter(s => s.mentorId === m.id || s.mentorCode === (m.id || m.code) || s.mentorName === m.name).length;
                  return (
                    <div
                      key={m.id || m.code}
                      onClick={() => setSelectedMentorForMentees(m)}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors flex items-center gap-1.5 truncate">
                              <span>{m.name}</span>
                              <span className="text-slate-400 group-hover:text-indigo-600 text-xs transition-colors">→</span>
                            </h4>
                            <span className="text-xs text-slate-500">{m.department} · {m.designation}</span>
                            {m.phone && <p className="text-[11px] text-slate-400 mt-0.5 font-mono">📞 {m.phone}</p>}
                          </div>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            {assignedCount} {assignedCount === 1 ? 'Mentee' : 'Mentees'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-600">{m.designation || 'Faculty Mentor'}</span>
                          <span className={`text-[11px] font-semibold ${m.status === 'Inactive' ? 'text-amber-600' : 'text-emerald-700'}`}>
                            {m.status || 'Active'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Edit Mentor"
                            onClick={() => handleOpenEditMentor(m)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Delete Mentor"
                            onClick={() => setMentorToDelete(m)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MEMBERS & STUDENTS TABLE VIEW */
        <>
          {/* Filters Bar */}
          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID / Last 4 digits, Name, Startup, or Mentor…"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-80 bg-white"
            />
            {categoryTab !== 'interns' && (
              <>
                <select
                  value={courseFilter}
                  onChange={e => setCourseFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="All">All Course Types</option>
                  <option value="Bachelor">Bachelor</option>
                  <option value="Master">Master</option>
                </select>
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white max-w-xs"
                >
                  <option value="All">All Departments</option>
                  <optgroup label="Bachelor Programs (B.E. / B.Tech)">
                    {UNDERGRAD_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Master & Integrated Programs (M.E. / M.Tech / MBA)">
                    {POSTGRAD_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                </select>
                <select
                  value={yearFilter}
                  onChange={e => setYearFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {years.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : `Year ${y}`}</option>)}
                </select>
              </>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading master registry...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">👤</div>
                <div className="font-medium text-slate-700">No members found</div>
                <div className="text-sm text-slate-400 mt-1">Try adjusting your search or filters.</div>
                {categoryTab === 'interns' ? (
                  <button
                    onClick={() => handleOpenAddModal('intern')}
                    className="mt-4 bg-amber-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span>Add Startup Intern</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenAddModal('student')}
                    className="mt-4 bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span>Add Student</span>
                  </button>
                )}
              </div>
            ) : (
              <div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-center py-3 px-3 w-12">S.No</th>
                      <th className="py-3 px-4">Member ID</th>
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Affiliation / Dept</th>
                      <th className="py-3 px-4">Mentor</th>
                      <th className="py-3 px-4">Year / Role</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedStudents.map((s, idx) => {
                      const isIntern = s.category === 'Intern' || s.courseType === 'Intern' || s.id.startsWith('INT-');
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-xs text-slate-500 font-medium text-center">{startIndex + idx + 1}</td>
                          <td className="py-3 px-4 text-xs font-mono font-bold">
                            <span className={isIntern ? 'text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200' : 'text-indigo-700'}>
                              {s.id}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {isIntern && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  💼 INTERN
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-slate-700">
                            {isIntern ? (
                              <span className="font-bold text-amber-900">{s.startupName || s.department}</span>
                            ) : (
                              <span>{s.department}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                              s.mentorName && s.mentorName !== 'Unassigned'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'text-slate-400 bg-slate-100 border border-slate-200 font-normal'
                            }`}>
                              {s.mentorName || 'Unassigned'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {isIntern ? (
                              <span className="text-slate-500 font-mono text-[11px]">Startup Intern</span>
                            ) : (
                              <span>Year {s.year} · {s.courseType}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            <div>{s.phone || '—'}</div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{s.email}</div>
                          </td>
                          <td className="py-3 px-4"><Badge status={s.status} /></td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="text-xs text-amber-700 hover:text-amber-900 font-semibold hover:underline mr-3 cursor-pointer inline-flex items-center gap-1"
                              title="Quick edit member details"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => { setSelected(s); setView('detail'); }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline mr-3 cursor-pointer"
                            >
                              Profile
                            </button>
                            <button
                              onClick={() => setStudentToDelete(s)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {filtered.length > 0 && (
                  <div className="px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
                    <div>
                      Showing <span className="font-semibold text-slate-800">{filtered.length > 0 ? startIndex + 1 : 0}</span> to{' '}
                      <span className="font-semibold text-slate-800">{Math.min(startIndex + PAGE_SIZE, filtered.length)}</span> of{' '}
                      <span className="font-semibold text-slate-800">{filtered.length}</span> members
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        ← Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              currentPage === p
                                ? 'bg-indigo-700 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-200/70'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* ADD MEMBER MODAL (Students & Startup Interns) */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{memberType === 'intern' ? '💼' : '🎓'}</span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg leading-tight">
                    {memberType === 'intern' ? 'Register Startup Intern' : 'Register College Student'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {memberType === 'intern'
                      ? 'Onboard incubation startup intern with mobile number lookup'
                      : 'Add a new student to institutional registry and assign an optional mentor'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseAddModal}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* STARTUP INTERN FORM */}
              {memberType === 'intern' ? (
                <div className="space-y-4 pt-1">
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
                    <strong className="font-semibold">Simple Intern Onboarding:</strong>
                    <p className="mt-0.5 text-slate-600">
                      Interns do not require college roll numbers. Their ID is automatically generated from the last 4 digits of their phone number!
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Intern Full Name *</label>
                    <input
                      type="text"
                      value={internForm.name}
                      onChange={e => setInternForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Praveen Kumar"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="text"
                      value={internForm.phone}
                      onChange={e => setInternForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="text-slate-500">Used for quick counter lookup</span>
                      <span className="font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 text-[11px]">
                        Assigned ID: {internPreviewId}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      value={internForm.email}
                      onChange={e => setInternForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="e.g. praveen@startup.com"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Startup / Company Name *</label>
                    <input
                      type="text"
                      value={internForm.startupName}
                      onChange={e => setInternForm(p => ({ ...p, startupName: e.target.value }))}
                      placeholder="e.g. SkyRobotics Hub, AgriTech Innovations"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                /* COLLEGE STUDENT FORM */
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Student Roll Number / ID *</label>
                    <input
                      type="text"
                      value={form.id}
                      onChange={e => setForm(p => ({ ...p, id: e.target.value.toUpperCase() }))}
                      placeholder="e.g. 23CS108"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Anand R"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Course Type *</label>
                      <select
                        value={form.courseType}
                        onChange={e => setForm(p => ({ ...p, courseType: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="Bachelor">Bachelor (B.E./B.Tech)</option>
                        <option value="Master">Master (M.E./MBA)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Year of Study *</label>
                      <select
                        value={form.year}
                        onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {['1', '2', '3', '4', '5'].map(y => (
                          <option key={y} value={y}>Year {y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                    <select
                      value={form.department}
                      onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {form.courseType === 'Master' ? (
                        <optgroup label="Master &amp; Integrated Programs">
                          {POSTGRAD_DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </optgroup>
                      ) : (
                        <optgroup label="Bachelor Programs">
                          {UNDERGRAD_DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Assigned Mentor (Optional)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewMentorInline(p => !p);
                          setInlineMentorName('');
                          setInlineMentorDept('');
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        {isAddingNewMentorInline ? '← Select Existing' : '+ Type New Mentor'}
                      </button>
                    </div>

                    {isAddingNewMentorInline ? (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                            <span>👥</span> Add Mentor On-the-Fly
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewMentorInline(false);
                              setInlineMentorName('');
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        <div>
                          <input
                            type="text"
                            value={inlineMentorName}
                            onChange={e => setInlineMentorName(e.target.value)}
                            placeholder="Mentor Full Name (e.g. Dr. S. Ramesh) *"
                            className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={inlineMentorDept}
                            onChange={e => setInlineMentorDept(e.target.value)}
                            placeholder="Department / Role (Optional, e.g. CSE / Guide)"
                            className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <p className="text-[10px] text-indigo-700">
                          ✨ Will be automatically registered in Mentors directory and assigned to this student upon saving.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={form.mentorCode}
                        onChange={e => {
                          if (e.target.value === '__NEW__') {
                            setIsAddingNewMentorInline(true);
                          } else {
                            setForm(p => ({ ...p, mentorCode: e.target.value }));
                          }
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="">Unassigned (Default)</option>
                        {mentorList.map(m => (
                          <option key={m.id || m.code} value={m.id || m.code}>
                            {m.name} ({m.department})
                          </option>
                        ))}
                        <option value="__NEW__">➕ + Type New Mentor...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Institutional Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="student@college.edu"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="9876543210"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMember}
                disabled={isSavingMember}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors font-medium shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                  memberType === 'intern' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-700 hover:bg-indigo-800'
                }`}
              >
                {isSavingMember ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  memberType === 'intern' ? 'Save Startup Intern' : 'Save Student'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MENTOR MODAL */}
      {showAddMentor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">👥</span>
                <h3 className="font-bold text-slate-900 text-lg">Add Faculty Mentor</h3>
              </div>
              <button
                onClick={() => { setShowAddMentor(false); setMentorFormError(''); }}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mentor Full Name *</label>
                <input
                  type="text"
                  value={mentorForm.name}
                  onChange={e => setMentorForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Dr. S. Ramesh"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department / Facility Area</label>
                <input
                  type="text"
                  value={mentorForm.department}
                  onChange={e => setMentorForm(p => ({ ...p, department: e.target.value }))}
                  placeholder="e.g. Computer Science / Incubation Lead"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={mentorForm.designation}
                  onChange={e => setMentorForm(p => ({ ...p, designation: e.target.value }))}
                  placeholder="e.g. Associate Professor / Start-up Advisor"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {mentorFormError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {mentorFormError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setShowAddMentor(false); setMentorFormError(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMentor}
                disabled={isSavingMentor}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSavingMentor ? 'Saving...' : 'Save Mentor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENTOR MENTEES & DETAILS MODAL */}
      {selectedMentorForMentees && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200 shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shrink-0">
                  👨‍🏫
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">{selectedMentorForMentees.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {studentList.filter(s => s.mentorId === selectedMentorForMentees.id || s.mentorCode === (selectedMentorForMentees.id || selectedMentorForMentees.code) || s.mentorName === selectedMentorForMentees.name).length} Mentees
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedMentorForMentees.department} · {selectedMentorForMentees.designation || 'Faculty Mentor'}
                    {selectedMentorForMentees.phone ? ` · 📞 ${selectedMentorForMentees.phone}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMentorForMentees(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none cursor-pointer p-1"
                title="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Body: Mentees List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {(() => {
                const mentees = studentList.filter(s =>
                  s.mentorId === selectedMentorForMentees.id ||
                  s.mentorCode === (selectedMentorForMentees.id || selectedMentorForMentees.code) ||
                  s.mentorName === selectedMentorForMentees.name
                );

                if (mentees.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400">
                      <div className="text-4xl mb-2">👥</div>
                      <div className="font-semibold text-slate-700 text-sm">No students currently assigned</div>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        There are currently no college students registered under {selectedMentorForMentees.name}. When registering students, assign them to this mentor to view them here.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                      Assigned Students ({mentees.length})
                    </div>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {mentees.map(student => (
                        <div
                          key={student.id}
                          className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                              🎓
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm truncate">{student.name}</span>
                                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                                  {student.id}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {student.department}{student.year ? ` · Year ${student.year}` : ''}
                                {student.phone ? ` · 📞 ${student.phone}` : ''}
                                {student.email ? ` · ✉️ ${student.email}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              student.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {student.status || 'Active'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMentorForMentees(null);
                                setSelected(student);
                                setView('detail');
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200/80 transition-colors cursor-pointer"
                            >
                              View Profile →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center px-6 py-3.5 border-t border-slate-200 bg-slate-50 shrink-0">
              <span className="text-xs text-slate-500">
                Incubation Food Management System
              </span>
              <button
                type="button"
                onClick={() => setSelectedMentorForMentees(null)}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK EDIT MEMBER MODAL */}
      {studentToEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-lg">Quick Edit Member</h3>
                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                  {studentToEdit.id}
                </span>
              </div>
              <button
                onClick={() => { setStudentToEdit(null); setEditFormError(''); }}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Member ID (Locked) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Unique Identifier</span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-normal">
                    🔒 Primary Identifier (Cannot be changed)
                  </span>
                </label>
                <input
                  type="text"
                  value={studentToEdit.id}
                  disabled
                  className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono font-semibold cursor-not-allowed"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Anand R"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Startup Name vs Academic Dept */}
              {studentToEdit.category === 'Intern' || studentToEdit.courseType === 'Intern' || studentToEdit.id.startsWith('INT-') ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Startup / Company Name *</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                    placeholder="e.g. SkyRobotics Hub"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                  <select
                    value={editForm.department}
                    onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <optgroup label="Bachelor Programs">
                      {UNDERGRAD_DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Master &amp; Integrated Programs">
                      {POSTGRAD_DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Assigned Mentor (Only for College Students, not Startup Interns) */}
              {!(studentToEdit.category === 'Intern' || studentToEdit.courseType === 'Intern' || studentToEdit.id.startsWith('INT-')) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Assigned Mentor</label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditIsAddingNewMentorInline(p => !p);
                        setEditInlineMentorName('');
                        setEditInlineMentorDept('');
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      {editIsAddingNewMentorInline ? '← Select Existing' : '+ Type New Mentor'}
                    </button>
                  </div>

                  {editIsAddingNewMentorInline ? (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                          <span>👥</span> Add Mentor On-the-Fly
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditIsAddingNewMentorInline(false);
                            setEditInlineMentorName('');
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={editInlineMentorName}
                          onChange={e => setEditInlineMentorName(e.target.value)}
                          placeholder="Mentor Full Name (e.g. Dr. S. Ramesh) *"
                          className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={editInlineMentorDept}
                          onChange={e => setEditInlineMentorDept(e.target.value)}
                          placeholder="Department / Role (Optional, e.g. CSE / Guide)"
                          className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <p className="text-[10px] text-indigo-700">
                        ✨ Will register mentor in directory and immediately link to this member upon saving.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={editForm.mentorCode}
                      onChange={e => {
                        if (e.target.value === '__NEW__') {
                          setEditIsAddingNewMentorInline(true);
                        } else {
                          setEditForm(p => ({ ...p, mentorCode: e.target.value }));
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="UNASSIGNED">Unassigned</option>
                      {mentorList.map(m => (
                        <option key={m.id || m.code} value={m.id || m.code}>
                          {m.name} ({m.department})
                        </option>
                      ))}
                      <option value="__NEW__">➕ + Type New Mentor...</option>
                    </select>
                  )}
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="e.g. member@sairam.edu.in or intern@startup.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="9876543210"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {editFormError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {editFormError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => { setStudentToEdit(null); setEditFormError(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 text-lg mb-2">Delete Member?</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <span className="font-bold text-slate-800">{studentToDelete.name}</span> (<span className="font-mono text-indigo-700">{studentToDelete.id}</span>)? The member will be removed from the registry, while all past token history and meal logs will remain permanently intact.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors cursor-pointer shadow-xs"
              >
                Delete Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MENTOR MODAL */}
      {mentorToEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800 text-lg">Edit Mentor Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update mentor profile information and affiliation.</p>
              </div>
              <button
                type="button"
                onClick={() => { setMentorToEdit(null); setEditMentorFormError(''); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mentor Full Name *</label>
                <input
                  type="text"
                  value={editMentorForm.name}
                  onChange={e => setEditMentorForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Dr. S. Ramesh"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department / Facility</label>
                <input
                  type="text"
                  value={editMentorForm.department}
                  onChange={e => setEditMentorForm(p => ({ ...p, department: e.target.value }))}
                  placeholder="e.g. ECE / Incubation Center"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={editMentorForm.designation}
                  onChange={e => setEditMentorForm(p => ({ ...p, designation: e.target.value }))}
                  placeholder="e.g. Faculty Mentor / Associate Professor"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editMentorForm.phone}
                    onChange={e => setEditMentorForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="9876543210"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={editMentorForm.status}
                    onChange={e => setEditMentorForm(p => ({ ...p, status: e.target.value as 'Active' | 'Inactive' }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editMentorForm.email}
                  onChange={e => setEditMentorForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="mentor@sairam.edu.in"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {editMentorFormError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {editMentorFormError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => { setMentorToEdit(null); setEditMentorFormError(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMentorEdit}
                disabled={isSavingMentorEdit}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSavingMentorEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MENTOR CONFIRMATION MODAL */}
      {mentorToDelete && (() => {
        const assignedMenteesCount = studentList.filter(s => s.mentorId === mentorToDelete.id || s.mentorCode === (mentorToDelete.id || mentorToDelete.code) || s.mentorName === mentorToDelete.name).length;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h3 className="font-semibold text-slate-800 text-lg mb-2">Delete Mentor?</h3>
              <p className="text-sm text-slate-500 mb-3">
                Are you sure you want to delete <span className="font-bold text-slate-800">{mentorToDelete.name}</span>?
              </p>
              {assignedMenteesCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-4">
                  ⚠️ <span className="font-bold">{assignedMenteesCount} active mentee(s)</span> are currently assigned to this mentor. Deleting will safely unassign them while permanently keeping all student profiles and historical tokens intact.
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-4">
                  This mentor has no mentees currently assigned.
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMentorToDelete(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteMentor}
                  disabled={isDeletingMentor}
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors cursor-pointer shadow-xs"
                >
                  {isDeletingMentor ? 'Deleting...' : 'Delete Mentor'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
