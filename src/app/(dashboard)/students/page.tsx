'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Badge from '@/components/Badge';
import { getStudentsBundle, createStudent, deleteStudent, type StudentRecord, type ProjectRecord } from '@/actions/studentActions';

const UNDERGRAD_DEPARTMENTS = [
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
];

const POSTGRAD_DEPARTMENTS = [
  'Integrated & Postgraduate Programs (M.E. / M.Tech)',
];

const ALL_DEPARTMENTS = [...UNDERGRAD_DEPARTMENTS, ...POSTGRAD_DEPARTMENTS];

const years = ['All', '1', '2', '3', '4'];

type View = 'list' | 'detail';

interface CachedStudentsPayload {
  students: StudentRecord[];
  projects: ProjectRecord[];
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
  const [loading, setLoading] = useState(() => !initialCache);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentRecord | null>(null);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    id: '',
    name: '',
    department: 'Computer Science and Engineering',
    year: '3',
    email: '',
    phone: '',
    status: 'Active',
  });
  const [formError, setFormError] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const bundle = await getStudentsBundle();
      setStudentList(bundle.students);
      setProjectList(bundle.projects);

      const payload: CachedStudentsPayload = {
        students: bundle.students,
        projects: bundle.projects,
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
      showToast('Error loading student records.');
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

  const filtered = studentList.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchDept =
      deptFilter === 'All' ||
      s.department === deptFilter ||
      (deptFilter === 'Computer Science and Engineering' && s.department === 'CSE') ||
      (deptFilter === 'Mechanical Engineering' && s.department === 'ME') ||
      (deptFilter === 'Electronics and Communication Engineering' && s.department === 'ECE') ||
      (deptFilter === 'Electrical and Electronics Engineering' && s.department === 'EEE') ||
      (deptFilter === 'Civil Engineering' && s.department === 'Civil');
    const matchYear = yearFilter === 'All' || String(s.year) === yearFilter;
    return matchQ && matchDept && matchYear;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, deptFilter, yearFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedStudents = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const saveStudent = async () => {
    if (!form.id || !form.name || !form.email) {
      setFormError('Student Roll ID, Name, and Email are required.');
      return;
    }

    const res = await createStudent({
      id: form.id,
      name: form.name,
      department: form.department,
      year: Number(form.year),
      email: form.email,
      phone: form.phone,
      status: form.status,
    });

    if (res.success) {
      showToast(res.message);
      setForm({ id: '', name: '', department: 'Computer Science and Engineering', year: '3', email: '', phone: '', status: 'Active' });
      setFormError('');
      setShowAdd(false);
      await loadData();
    } else {
      setFormError(res.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    const res = await deleteStudent(studentToDelete.id);
    if (res.success) {
      showToast(res.message);
      setStudentToDelete(null);
      if (selected?.id === studentToDelete.id) {
        setSelected(null);
        setView('list');
      }
      await loadData();
    } else {
      showToast(res.message);
    }
  };

  if (view === 'detail' && selected) {
    const studentProjects = projectList.filter(p => p.members.some(m => m.studentId === selected.id));
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
            ← Back to Students
          </button>
          <button
            onClick={() => setStudentToDelete(selected)}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Delete Student
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xl font-bold">
                {selected.name[0]}
              </div>
              <div>
                <div className="font-bold text-slate-800 text-lg">{selected.name}</div>
                <div className="text-sm text-slate-500 font-mono font-medium tracking-wide">{selected.id}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { l: 'Department', v: selected.department },
                { l: 'Year', v: `Year ${selected.year}` },
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
              <h3 className="font-semibold text-slate-800 mb-3">Project Memberships</h3>
              {studentProjects.length === 0 ? (
                <p className="text-sm text-slate-400">Not assigned to any project team yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Project Name', 'Code', 'Role', 'Status'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentProjects.map(p => {
                      const member = p.members.find(m => m.studentId === selected.id);
                      return (
                        <tr key={p.code} className="border-b border-slate-50">
                          <td className="py-2.5 pr-4 font-medium text-slate-700">{p.name}</td>
                          <td className="py-2.5 pr-4 text-xs text-slate-400 font-mono font-medium">{p.code}</td>
                          <td className="py-2.5 pr-4 text-slate-600 text-xs">{member?.role || 'Member'}</td>
                          <td className="py-2.5"><Badge status={p.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Student Master Registry</h2>
          <p className="text-sm text-slate-500">{studentList.length} students registered in incubation database</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAdd(true)}
            className="bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            + Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by Roll No / ID, name, or email…"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72 bg-white"
        />
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white max-w-xs"
        >
          <option value="All">All Departments</option>
          <optgroup label="Undergraduate Programs (B.E. / B.Tech)">
            {UNDERGRAD_DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </optgroup>
          <optgroup label="Integrated & Postgraduate Programs (M.E. / M.Tech)">
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
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading students registry...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-3">👤</div>
            <div className="font-medium text-slate-700">No students found</div>
            <div className="text-sm text-slate-400 mt-1">Try adjusting your search or filters.</div>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer"
            >
              + Add Student
            </button>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">S.No</th>
                  {['Roll No / ID', 'Name', 'Department', 'Year', 'Email', 'Projects', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((s, idx) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-xs text-slate-500 font-medium text-center">{startIndex + idx + 1}</td>
                    <td className="py-3 px-4 text-xs text-indigo-700 font-semibold tracking-wide font-mono">{s.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{s.name}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{s.department}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">Year {s.year}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs font-mono">{s.email}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {s.projects.length > 0 ? (
                        <span className="font-semibold text-slate-700">{s.projects.join(', ')}</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4"><Badge status={s.status} /></td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => { setSelected(s); setView('detail'); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline mr-3 cursor-pointer"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={() => setStudentToDelete(s)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div className="px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
                <div>
                  Showing <span className="font-semibold text-slate-800">{filtered.length > 0 ? startIndex + 1 : 0}</span> to{' '}
                  <span className="font-semibold text-slate-800">{Math.min(startIndex + PAGE_SIZE, filtered.length)}</span> of{' '}
                  <span className="font-semibold text-slate-800">{filtered.length}</span> students
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

      {/* Add Student Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 text-lg">Add Student to Registry</h3>
              <button onClick={() => { setShowAdd(false); setFormError(''); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer">×</button>
            </div>
            <div className="p-6 space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Institutional Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="anand@college.edu"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                  <select
                    value={form.department}
                    onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <optgroup label="Undergraduate Programs (B.E. / B.Tech)">
                      {UNDERGRAD_DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Integrated & Postgraduate Programs (M.E. / M.Tech)">
                      {POSTGRAD_DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year *</label>
                  <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['1', '2', '3', '4'].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
              </div>
              {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{formError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setShowAdd(false); setFormError(''); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={saveStudent} className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg transition-colors font-medium shadow-xs cursor-pointer">
                Save to Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 text-lg mb-2">Delete or Archive Student?</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to remove <span className="font-bold text-slate-800">{studentToDelete.name}</span> (<span className="font-mono text-indigo-700">{studentToDelete.id}</span>)? Active project assignments will be removed. All historical meal tokens and night-stay logs will be safely preserved.
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
                Delete Student
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
