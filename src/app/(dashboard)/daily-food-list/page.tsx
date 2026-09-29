'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Badge from '@/components/Badge';
import FoodRequestLetterModal from '@/components/FoodRequestLetterModal';
import TokenPrintSlip from '@/components/TokenPrintSlip';
import {
  getDailyFoodList,
  addStudentToDailyList,
  addBulkStudentsToDailyList,
  removeStudentFromDailyList,
  finalizeFoodList,
  getDatewiseFoodLogs,
  type FoodListDetails,
  type DatewiseLogSummary,
} from '@/actions/foodListActions';
import { getFoodTokens } from '@/actions/tokenActions';
import { getStudents, getProjects, type StudentRecord, type ProjectRecord } from '@/actions/studentActions';
import { getMealSession } from '@/utils/timeUtils';

type ActiveTab = 'list' | 'tokens' | 'logs';

export default function DailyFoodListPage() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-sm text-slate-500">Loading food list & tokens...</p>
      </div>
    }>
      <DailyFoodListContent />
    </Suspense>
  );
}

function DailyFoodListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const todayStr = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'tokens') return 'tokens';
    if (tabParam === 'logs') return 'logs';
    return 'list';
  });

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [currentList, setCurrentList] = useState<FoodListDetails | null>(null);
  const [studentRegistry, setStudentRegistry] = useState<StudentRecord[]>([]);
  const [projectRegistry, setProjectRegistry] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Tokens state
  const [tokens, setTokens] = useState<any[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [tokenDateFilter, setTokenDateFilter] = useState(todayStr);
  const [tokenSessionFilter, setTokenSessionFilter] = useState('ALL');
  const [selectedPrintToken, setSelectedPrintToken] = useState<any | null>(null);

  // Datewise logs state
  const [datewiseLogs, setDatewiseLogs] = useState<DatewiseLogSummary[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Modals state for daily list
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
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

  // Sync tab with URL
  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'list') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
  };

  // Load Daily Food List data
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

  // Load Tokens data
  const loadTokens = useCallback(async (date?: string) => {
    setTokensLoading(true);
    try {
      const data = await getFoodTokens(date || undefined);
      setTokens(data);
    } catch (e) {
      console.error('Error fetching tokens:', e);
    } finally {
      setTokensLoading(false);
    }
  }, []);

  // Load Datewise Logs data
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const logs = await getDatewiseFoodLogs();
      setDatewiseLogs(logs);
    } catch (e) {
      console.error('Error loading logs:', e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, loadData]);

  useEffect(() => {
    if (activeTab === 'tokens') {
      loadTokens(tokenDateFilter);
    }
  }, [activeTab, tokenDateFilter, loadTokens]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, loadLogs]);

  // Daily list actions
  const searchStudent = () => {
    const query = searchId.trim().toUpperCase();
    const s = studentRegistry.find(st => st.id.toUpperCase() === query);
    if (!s) {
      setFoundStudent('not-found');
      return;
    }
    setFoundStudent(s);
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

  const bulkProjectMembers = bulkProject
    ? (projectRegistry.find(p => p.code === bulkProject)?.members.map(m => studentRegistry.find(s => s.id === m.studentId)).filter(Boolean) as StudentRecord[] ?? [])
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

  // Filtered tokens
  const filteredTokens = tokens.filter(t => {
    const q = tokenSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      t.tokenNumber?.toLowerCase().includes(q) ||
      t.studentId?.toLowerCase().includes(q) ||
      t.studentName?.toLowerCase().includes(q) ||
      t.project?.toLowerCase().includes(q);

    const matchSession =
      tokenSessionFilter === 'ALL' ||
      (t.session || '').toUpperCase() === tokenSessionFilter;

    return matchSearch && matchSession;
  });

  return (
    <div className="space-y-6">
      {/* Thermal Receipt Print Slip Portal */}
      <TokenPrintSlip token={selectedPrintToken} />

      {/* Page Title & Top Navigation Tabs */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Food Management</h1>
            <p className="text-sm text-slate-500 mt-1">
              Approve student mess eligibility, monitor live issued tokens, and review historical datewise logs.
            </p>
          </div>

          {/* Segmented Subtab Switcher */}
          <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 self-start sm:self-auto">
            <button
              onClick={() => switchTab('list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>▤</span>
              <span>Daily Food List</span>
              {currentList && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700">
                  {currentList.entries.length}
                </span>
              )}
            </button>

            <button
              onClick={() => switchTab('tokens')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'tokens'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>▣</span>
              <span>Food Tokens</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {tokens.length}
              </span>
            </button>

            <button
              onClick={() => switchTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📅</span>
              <span>Datewise Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY FOOD LIST (ELIGIBILITY & MESS APPROVAL)                       */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {selectedDate === todayStr && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  Today
                </span>
              )}

              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Open & Dynamic List</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowBulkAdd(true)}
                className="border border-indigo-300 text-indigo-700 text-sm px-3.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium cursor-pointer"
              >
                + Add by Project
              </button>
              <button
                onClick={() => setShowAddStudent(true)}
                className="bg-indigo-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium shadow-xs cursor-pointer"
              >
                + Add Student
              </button>

              <button
                onClick={() => {
                  if (!currentList || currentList.entries.length === 0) {
                    showToast('No students added yet for this date. Please add students first.');
                    return;
                  }
                  setShowLetterModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
                title="Generate and download official PDF request letter for college mess"
              >
                <svg className="w-4 h-4 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Mess Letter (PDF)
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading food list for {selectedDate}...
              </div>
            ) : !currentList || currentList.entries.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">🍽️</div>
                <div className="font-medium text-slate-700">No students in food list for this date</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Click &ldquo;+ Add Student&rdquo; or &ldquo;+ Add by Project&rdquo; above to approve students for today&rsquo;s mess food.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Roll No / ID</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Dept & Year</th>
                      <th className="px-4 py-3">Incubation Project</th>
                      <th className="px-4 py-3">Added By</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentList.entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                          {entry.studentId}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {entry.studentName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {entry.department} {entry.year ? `· Yr ${entry.year}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {entry.projectName || entry.projectCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {entry.addedBy || 'Staff'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status="Eligible" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveEntry(entry.studentId)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ISSUED FOOD TOKENS (WITH REALTIME FILTER, SEARCH & THERMAL PRINT)   */}
      {/* ========================================================================= */}
      {activeTab === 'tokens' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={tokenSearch}
                onChange={e => setTokenSearch(e.target.value)}
                placeholder="Search token #, roll no, name, project…"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 bg-white"
              />

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={tokenDateFilter}
                  onChange={e => setTokenDateFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                {tokenDateFilter && (
                  <button
                    onClick={() => setTokenDateFilter('')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1.5 cursor-pointer font-medium"
                  >
                    Show All Dates
                  </button>
                )}
              </div>
            </div>

            {/* Session Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              {(['ALL', 'BREAKFAST', 'LUNCH', 'DINNER'] as const).map(sess => (
                <button
                  key={sess}
                  onClick={() => setTokenSessionFilter(sess)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    tokenSessionFilter === sess
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sess === 'ALL' ? 'All Sessions' : sess}
                </button>
              ))}
            </div>
          </div>

          {/* Tokens Count & Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {filteredTokens.length} Token{filteredTokens.length !== 1 ? 's' : ''} Generated
                {tokenDateFilter ? ` for ${tokenDateFilter}` : ' (All Dates)'}
              </h3>
              <span className="text-xs text-slate-400">
                Sorted by most recent issue time
              </span>
            </div>

            {tokensLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading tokens...
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">🎫</div>
                <div className="font-medium text-slate-700">No food tokens found</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No tokens have been issued matching the selected date and filters. Scan student ID cards at the terminal to issue tokens.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Token Number</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Roll No / ID</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTokens.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700 text-xs">
                          {t.tokenNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {t.studentName}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {t.studentId}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                            {t.project}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              (t.session || '').toLowerCase().includes('breakfast')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {t.session}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {t.date} · {t.time}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedPrintToken(t)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                          >
                            View Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DATEWISE HISTORICAL LOGS & AUDIT                                   */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Historical Mess Turnout & Token Log</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit student turnout, eligible allocations, and tokens claimed date-by-date.
              </p>
            </div>
            <button
              onClick={loadLogs}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              ↻ Refresh Logs
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {logsLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Analyzing historical logs...
              </div>
            ) : datewiseLogs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">📅</div>
                <div className="font-medium text-slate-700">No historical logs found</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Historical food lists and issued token logs will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Eligible Students</th>
                      <th className="px-4 py-3 text-center">Tokens Claimed</th>
                      <th className="px-4 py-3">Turnout Rate</th>
                      <th className="px-4 py-3">Sessions (B / L / D)</th>
                      <th className="px-4 py-3 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datewiseLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 text-sm">
                          {log.date}
                          {log.date === todayStr && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                              Today
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={log.status === 'Finalized' ? 'Finalized' : 'Draft'} />
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                          {log.totalEligible}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-indigo-700">
                          {log.totalTokensIssued}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                              <div
                                className="bg-indigo-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, log.turnoutPercentage)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">
                              {log.turnoutPercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono font-medium mr-1">
                            B: {log.breakfastCount}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-medium mr-1">
                            L: {log.lunchCount}
                          </span>
                          {log.dinnerCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-mono font-medium">
                              D: {log.dinnerCount}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedDate(log.date);
                              setTokenDateFilter(log.date);
                              switchTab('tokens');
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2.5 py-1 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                          >
                            View Tokens →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS & OVERLAYS                                                         */}
      {/* ========================================================================= */}

      {/* Add Single Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 text-lg">Add Student to Daily Food List</h3>
            <p className="text-xs text-slate-500">
              Enter college student roll ID (e.g. SEC24CS110 or 23CS101) to verify eligibility.
            </p>
            <div className="flex gap-2">
              <input
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchStudent()}
                placeholder="Student Roll No / ID..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                autoFocus
              />
              <button
                onClick={searchStudent}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>

            {foundStudent === 'not-found' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                Student ID not found in system registry. Please register student first.
              </div>
            )}

            {foundStudent && foundStudent !== 'not-found' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="font-medium text-slate-800 text-sm">{foundStudent.name}</div>
                <div className="text-slate-500 font-mono">ID: {foundStudent.id} | {foundStudent.department} Yr {foundStudent.year}</div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Assign Project:</label>
                  <select
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {projectRegistry.map(p => (
                      <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => { setShowAddStudent(false); setFoundStudent(null); setSearchId(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={!foundStudent || foundStudent === 'not-found'}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Confirm Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add by Project Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-lg">Add All Project Members</h3>
              <p className="text-xs text-slate-500 mt-0.5">Select an incubation project to batch-add all members.</p>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Select Incubation Project:</label>
                <select
                  value={bulkProject}
                  onChange={e => {
                    setBulkProject(e.target.value);
                    const members = projectRegistry.find(p => p.code === e.target.value)?.members ?? [];
                    setBulkSelected(members.map(m => m.studentId));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Project --</option>
                  {projectRegistry.map(p => (
                    <option key={p.code} value={p.code}>{p.code} — {p.name} ({p.members.length} members)</option>
                  ))}
                </select>
              </div>

              {bulkProject && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">Select Members:</span>
                    <button
                      onClick={() => setBulkSelected(bulkSelected.length === bulkProjectMembers.length ? [] : bulkProjectMembers.map(s => s.id))}
                      className="text-xs text-indigo-600 hover:underline cursor-pointer"
                    >
                      {bulkSelected.length === bulkProjectMembers.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2.5">
                    {bulkProjectMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No registered members in this project.</p>
                    ) : (
                      bulkProjectMembers.map(s => {
                        const alreadyIn = currentList?.entries.some(e => e.studentId === s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bulkSelected.includes(s.id)}
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
