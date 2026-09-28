'use client';

import { useState, useEffect, useCallback } from 'react';
import Badge from '@/components/Badge';
import {
  getProjects,
  createProject,
  addProjectMember,
  getStudents,
  deleteProject,
  type ProjectRecord,
  type StudentRecord,
} from '@/actions/studentActions';

type View = 'list' | 'detail';

export default function Projects() {
  const [projectList, setProjectList] = useState<ProjectRecord[]>([]);
  const [studentRegistry, setStudentRegistry] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<ProjectRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectRecord | null>(null);
  const [searchId, setSearchId] = useState('');
  const [foundStudent, setFoundStudent] = useState<StudentRecord | null | 'not-found' | 'already-added'>(null);
  const [memberRole, setMemberRole] = useState('Member');
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({ code: '', name: '', description: '', status: 'Active' });
  const [formError, setFormError] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projects, students] = await Promise.all([
        getProjects(),
        getStudents(),
      ]);
      setProjectList(projects);
      setStudentRegistry(students);
      if (selected) {
        const refreshed = projects.find(p => p.code === selected.code);
        if (refreshed) setSelected(refreshed);
      }
    } catch (e) {
      console.error(e);
      showToast('Error loading projects.');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const searchStudent = () => {
    const q = searchId.trim().toUpperCase();
    const s = studentRegistry.find(st => st.id.toUpperCase() === q);
    if (!s) { setFoundStudent('not-found'); return; }
    if (selected?.members.some(m => m.studentId.toUpperCase() === s.id.toUpperCase())) {
      setFoundStudent('already-added');
      return;
    }
    setFoundStudent(s);
  };

  const handleAddMember = async () => {
    if (!selected || !foundStudent || foundStudent === 'not-found' || foundStudent === 'already-added') return;
    const res = await addProjectMember(selected.code, foundStudent.id, memberRole);
    if (res.success) {
      showToast(res.message);
      setSearchId('');
      setFoundStudent(null);
      setMemberRole('Member');
      setShowAddMember(false);
      await loadData();
    } else {
      showToast(res.message);
    }
  };

  const handleSaveProject = async () => {
    if (!form.code || !form.name) {
      setFormError('Project code and name are required.');
      return;
    }
    const res = await createProject(form);
    if (res.success) {
      showToast(res.message);
      setForm({ code: '', name: '', description: '', status: 'Active' });
      setFormError('');
      setShowCreate(false);
      await loadData();
    } else {
      setFormError(res.message);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    const res = await deleteProject(projectToDelete.code);
    if (res.success) {
      showToast(res.message);
      setProjectToDelete(null);
      if (selected?.code === projectToDelete.code) {
        setSelected(null);
        setView('list');
      }
      await loadData();
    } else {
      showToast(res.message);
    }
  };

  if (view === 'detail' && selected) {
    const proj = projectList.find(p => p.code === selected.code) ?? selected;
    return (
      <div className="space-y-6">
        <button
          onClick={() => setView('list')}
          className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1 font-medium"
        >
          ← Back to Projects
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{proj.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-400 font-mono font-medium tracking-wide">{proj.code}</span>
              <Badge status={proj.status} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setProjectToDelete(proj)}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Delete Project
            </button>
            <button
              onClick={() => setShowAddMember(true)}
              className="bg-indigo-700 hover:bg-indigo-800 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium shadow-xs cursor-pointer"
            >
              + Add Student to Project
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-semibold text-slate-800 mb-3">Project Information</h3>
            <div className="space-y-2 text-sm">
              {[
                { l: 'Project Name', v: proj.name },
                { l: 'Project Code', v: proj.code },
                { l: 'Registered Date', v: proj.createdDate },
              ].map(r => (
                <div key={r.l} className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">{r.l}</span>
                  <span className="text-slate-800 font-medium text-right">{r.v}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Status</span>
                <Badge status={proj.status} />
              </div>
              {proj.description && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-1 text-xs">Description</span>
                  <p className="text-slate-700 text-xs leading-relaxed">{proj.description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Project Members ({proj.members.length})</h3>
            </div>
            {proj.members.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-400 text-sm">No students assigned to this project yet.</p>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="mt-3 text-sm text-indigo-600 hover:underline cursor-pointer font-medium"
                >
                  + Add Student
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Student ID', 'Name', 'Department', 'Year', 'Role'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proj.members.map(m => {
                    const s = studentRegistry.find(st => st.id === m.studentId);
                    return (
                      <tr key={m.studentId} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 pr-4 text-xs text-indigo-700 font-semibold font-mono tracking-wide">{m.studentId}</td>
                        <td className="py-2.5 pr-4 font-medium text-slate-700">{s?.name || m.studentName || m.studentId}</td>
                        <td className="py-2.5 pr-4 text-slate-500 text-xs">{s?.department || m.department || '—'}</td>
                        <td className="py-2.5 pr-4 text-slate-500 text-xs">{s?.year ? `Year ${s.year}` : '—'}</td>
                        <td className="py-2.5 pr-4 text-slate-600 text-xs font-medium">{m.role}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add Member Modal */}
        {showAddMember && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Add Student to {proj.name}</h3>
                <button onClick={() => { setShowAddMember(false); setFoundStudent(null); setSearchId(''); }} className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer">×</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Student Roll No / ID</label>
                  <div className="flex gap-2">
                    <input
                      value={searchId}
                      onChange={e => { setSearchId(e.target.value); setFoundStudent(null); }}
                      placeholder="e.g. 23CS101"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                      onKeyDown={e => e.key === 'Enter' && searchStudent()}
                    />
                    <button onClick={searchStudent} className="bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-indigo-800 font-medium cursor-pointer">
                      Search
                    </button>
                  </div>
                </div>

                {foundStudent === 'not-found' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700">
                    Student not found. Please add to Student Master first.
                  </div>
                )}
                {foundStudent === 'already-added' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    This student is already a member of this project.
                  </div>
                )}
                {foundStudent && foundStudent !== 'not-found' && foundStudent !== 'already-added' && (
                  <>
                    <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-1">
                      <div className="text-[10px] text-emerald-600 font-semibold uppercase">Verified Student</div>
                      <div className="font-bold text-slate-800 text-sm">{foundStudent.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{foundStudent.id} · {foundStudent.department}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Project Role</label>
                      <select
                        value={memberRole}
                        onChange={e => setMemberRole(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {['Lead', 'Lead Developer', 'Developer', 'Member', 'Researcher'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100">
                <button onClick={() => { setShowAddMember(false); setFoundStudent(null); setSearchId(''); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={!foundStudent || foundStudent === 'not-found' || foundStudent === 'already-added'}
                  className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Add to Project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Incubation Projects</h2>
          <p className="text-sm text-slate-500">{projectList.length} innovation projects active</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-700 hover:bg-indigo-800 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium cursor-pointer shadow-xs"
        >
          + Create Project
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          Loading projects...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projectList.map(p => (
            <div key={p.code} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-400 font-mono font-medium tracking-wide mb-1">{p.code}</div>
                <div className="font-bold text-slate-800 text-base">{p.name}</div>
                {p.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 font-medium">{p.members.length} student{p.members.length !== 1 ? 's' : ''}</span>
                  <Badge status={p.status} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelected(p); setView('detail'); }}
                    className="flex-1 text-xs text-indigo-700 border border-indigo-200 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => setProjectToDelete(p)}
                    className="px-3 text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 text-lg">Create Incubation Project</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Code *</label>
                <input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AGRI-01, SMRT-02"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. AgriCheck"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of the project and goals…"
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {formError && <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{formError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSaveProject} className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-medium transition-colors shadow-xs cursor-pointer">
                Save Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 text-lg mb-2">Delete Incubation Project?</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete project <span className="font-bold text-slate-800">{projectToDelete.name}</span> (<span className="font-mono text-indigo-700">{projectToDelete.code}</span>)? This will remove team memberships for this project.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteProject}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors cursor-pointer shadow-xs"
              >
                Delete Project
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
