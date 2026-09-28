'use client';

import { useState, useEffect, useCallback } from 'react';
import Badge from '@/components/Badge';
import FoodRequestLetterModal from '@/components/FoodRequestLetterModal';
import {
  getDailyFoodList,
  addStudentToDailyList,
  addBulkStudentsToDailyList,
  removeStudentFromDailyList,
  finalizeFoodList,
  type FoodListDetails,
} from '@/actions/foodListActions';
import { getStudents, getProjects, type StudentRecord, type ProjectRecord } from '@/actions/studentActions';

export default function DailyFoodList() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [currentList, setCurrentList] = useState<FoodListDetails | null>(null);
  const [studentRegistry, setStudentRegistry] = useState<StudentRecord[]>([]);
  const [projectRegistry, setProjectRegistry] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);

  const [searchId, setSearchId] = useState('');
  const [foundStudent, setFoundStudent] = useState<StudentRecord | null | 'not-found'>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [bulkProject, setBulkProject] = useState('');
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const [listData, studentsData, projectsData] = await Promise.all([
        getDailyFoodList(date),
        getStudents(),
        getProjects(),
      ]);
      setCurrentList(listData);
      setStudentRegistry(studentsData);
      setProjectRegistry(projectsData);
    } catch (e) {
      console.error(e);
      showToast('Failed to load food list data from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, loadData]);

  const searchStudent = () => {
    if (currentList?.status === 'Finalized') return;
    const query = searchId.trim().toUpperCase();
    const s = studentRegistry.find(st => st.id.toUpperCase() === query);
    if (!s) {
      setFoundStudent('not-found');
      return;
    }
    setFoundStudent(s);
    // Find project code associated with student if any
    const proj = projectRegistry.find(p => p.members.some(m => m.studentId === s.id));
    setSelectedProject(proj?.code || projectRegistry[0]?.code || 'AGRI-01');
  };

  const handleAddStudent = async () => {
    if (!foundStudent || foundStudent === 'not-found') return;
    if (currentList?.entries.some(e => e.studentId === foundStudent.id)) {
      showToast(`Student ${foundStudent.id} is already in the list for ${selectedDate}.`);
      setShowAddStudent(false);
      setFoundStudent(null);
      setSearchId('');
      return;
    }

    const res = await addStudentToDailyList(selectedDate, foundStudent.id, selectedProject || 'AGRI-01');
    if (res.success) {
      showToast(res.message);
      setShowAddStudent(false);
      setFoundStudent(null);
      setSearchId('');
      await loadData(selectedDate);
    } else {
      showToast(res.message);
    }
  };

  const handleRemoveEntry = async (studentId: string) => {
    const res = await removeStudentFromDailyList(selectedDate, studentId);
    if (res.success) {
      showToast(res.message);
      await loadData(selectedDate);
    } else {
      showToast(res.message);
    }
  };

  const handleFinalizeList = async () => {
    const res = await finalizeFoodList(selectedDate, 'Incubation Centre Staff');
    if (res.success) {
      setShowFinalizeConfirm(false);
      showToast(res.message);
      await loadData(selectedDate);
    } else {
      showToast(res.message);
    }
  };

  const bulkProjectMembers = bulkProject
    ? projectRegistry.find(p => p.code === bulkProject)?.members.map(m => studentRegistry.find(s => s.id === m.studentId)).filter(Boolean) as StudentRecord[] ?? []
    : [];

  const handleAddBulkStudents = async () => {
    if (bulkSelected.length === 0 || !bulkProject) return;
    const res = await addBulkStudentsToDailyList(selectedDate, bulkSelected, bulkProject);
    showToast(res.message);
    setBulkSelected([]);
    setBulkProject('');
    setShowBulkAdd(false);
    await loadData(selectedDate);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Daily Food Eligibility</h2>
          <p className="text-sm text-slate-500">Prepare and finalize the list of incubation students eligible for mess food.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowBulkAdd(true)}
            className="border border-indigo-300 text-indigo-700 text-sm px-3.5 py-2 rounded-lg hover:bg-indigo-50 transition-colors font-medium cursor-pointer"
          >
            + Add by Project
          </button>
          <button
            onClick={() => setShowAddStudent(true)}
            className="bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-800 transition-colors font-medium shadow-xs cursor-pointer"
          >
            + Add Student
          </button>

          {/* Official Food Request Letter Button */}
          <button
            onClick={() => {
              if (!currentList || currentList.entries.length === 0) {
                showToast('No students added yet for this date. Please add students first.');
                return;
              }
              setShowLetterModal(true);
            }}
            className="border border-indigo-400 bg-white hover:bg-indigo-50 text-indigo-700 text-sm px-3.5 py-2 rounded-lg transition-colors font-medium flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Generate official 2-page food request letter for night-stay students"
          >
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Generate Food Request Letter</span>
          </button>
        </div>
      </div>

      {/* Date selector + status */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-700">Food Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>
        {currentList && (
          <div className="flex items-center gap-2.5 text-sm border-l border-slate-200 pl-4">
            <span className="text-xs text-slate-500">Status:</span>
            <Badge status="Active" />
            <span className="ml-auto text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
              {currentList.entries.length} Eligible Student{currentList.entries.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading daily eligibility list...
          </div>
        ) : !currentList || currentList.entries.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">▤</div>
            <div className="font-medium text-slate-700">No food eligibility list for this date</div>
            <div className="text-sm text-slate-400 mt-1">Add students to create the list for {selectedDate}.</div>
            <button
              onClick={() => setShowAddStudent(true)}
              className="mt-4 bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-800 transition-colors shadow-xs cursor-pointer font-medium"
            >
              + Add Student
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['#', 'Student ID', 'Name', 'Dept', 'Year', 'Project', 'Eligibility', 'Added By', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentList.entries.map((entry, i) => (
                <tr key={entry.studentId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-400 text-xs font-mono">{i + 1}</td>
                  <td className="py-3 px-4 text-xs text-indigo-700 font-semibold tracking-wide font-mono">{entry.studentId}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{entry.studentName}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{entry.department}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{entry.year ? `Yr ${entry.year}` : '—'}</td>
                  <td className="py-3 px-4 text-slate-700 font-medium text-xs">{entry.projectName || entry.projectCode}</td>
                  <td className="py-3 px-4"><Badge status="Eligible" /></td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{entry.addedBy}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleRemoveEntry(entry.studentId)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Add Student to Food List</h3>
              <button onClick={() => { setShowAddStudent(false); setFoundStudent(null); setSearchId(''); }} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Student Roll Number / ID</label>
                <div className="flex gap-2">
                  <input
                    value={searchId}
                    onChange={e => { setSearchId(e.target.value); setFoundStudent(null); }}
                    placeholder="e.g. 23CS101..."
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
                  Student ID not found in institutional registry. Please add student in Students master.
                </div>
              )}

              {foundStudent && foundStudent !== 'not-found' && (
                <>
                  <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3.5 space-y-1">
                    <div className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider">Student Verified</div>
                    <div className="font-bold text-slate-800 text-sm">{foundStudent.name}</div>
                    <div className="text-xs text-slate-600 font-mono">{foundStudent.id} · {foundStudent.department} · Year {foundStudent.year}</div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Incubation Project</label>
                    <select
                      value={selectedProject}
                      onChange={e => setSelectedProject(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {projectRegistry.map(p => (
                        <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-slate-100">
              <button onClick={() => { setShowAddStudent(false); setFoundStudent(null); setSearchId(''); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={!foundStudent || foundStudent === 'not-found'}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Add to List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Add Students by Project Team</h3>
              <button onClick={() => { setShowBulkAdd(false); setBulkProject(''); setBulkSelected([]); }} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Project</label>
                <select
                  value={bulkProject}
                  onChange={e => {
                    const code = e.target.value;
                    setBulkProject(code);
                    const members = projectRegistry.find(p => p.code === code)?.members ?? [];
                    setBulkSelected(members.map(m => m.studentId));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select a project —</option>
                  {projectRegistry.map(p => (
                    <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              {bulkProject && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Select members to include:</span>
                    <button
                      onClick={() => setBulkSelected(bulkSelected.length === bulkProjectMembers.length ? [] : bulkProjectMembers.map(m => m.id))}
                      className="text-indigo-600 hover:underline cursor-pointer font-medium"
                    >
                      {bulkSelected.length === bulkProjectMembers.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2.5">
                    {bulkProjectMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No students assigned to this project yet.</p>
                    ) : (
                      bulkProjectMembers.map(s => {
                        const alreadyIn = currentList?.entries.some(e => e.studentId === s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer ${
                              alreadyIn ? 'opacity-50 bg-slate-50' : 'hover:bg-indigo-50/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={alreadyIn}
                              checked={alreadyIn || bulkSelected.includes(s.id)}
                              onChange={e => {
                                if (e.target.checked) setBulkSelected(prev => [...prev, s.id]);
                                else setBulkSelected(prev => prev.filter(id => id !== s.id));
                              }}
                              className="accent-indigo-600 rounded"
                            />
                            <span className="font-mono text-indigo-700 font-semibold">{s.id}</span>
                            <span className="text-slate-800 font-medium">{s.name}</span>
                            <span className="text-slate-400">({s.department})</span>
                            {alreadyIn && <span className="ml-auto text-[10px] text-amber-600 font-medium">Already on list</span>}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-slate-100">
              <button onClick={() => { setShowBulkAdd(false); setBulkProject(''); setBulkSelected([]); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleAddBulkStudents}
                disabled={!bulkProject || bulkSelected.length === 0}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Add {bulkSelected.length} Student{bulkSelected.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Confirm Modal */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 text-lg mb-2">Finalize Food List?</h3>
            <p className="text-sm text-slate-500 mb-2">Once finalized, the list is locked for scanner stations and token issuance.</p>
            <p className="text-sm font-semibold text-indigo-700 mb-5">{currentList?.entries.length} students approved.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowFinalizeConfirm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={handleFinalizeList} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-xs cursor-pointer">
                Confirm & Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Food Request Letter Modal */}
      <FoodRequestLetterModal
        isOpen={showLetterModal}
        onClose={() => setShowLetterModal(false)}
        foodDate={selectedDate}
        studentsList={(currentList?.entries ?? []).map(entry => ({
          studentId: entry.studentId,
          name: entry.studentName,
        }))}
      />

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-xl z-50 border border-slate-700">
          {toast}
        </div>
      )}
    </div>
  );
}
