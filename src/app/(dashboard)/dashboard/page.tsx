'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Badge from '@/components/Badge';
import { getFoodTokens } from '@/actions/tokenActions';
import { getDailyFoodList, type FoodListDetails } from '@/actions/foodListActions';
import { getStudents, getProjects, type StudentRecord, type ProjectRecord } from '@/actions/studentActions';

export default function Dashboard() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');
  const [todayList, setTodayList] = useState<FoodListDetails | null>(null);
  const [tokensList, setTokensList] = useState<any[]>([]);
  const [studentRegistry, setStudentRegistry] = useState<StudentRecord[]>([]);
  const [projectRegistry, setProjectRegistry] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [foodList, tokens, students, projects] = await Promise.all([
          getDailyFoodList(todayStr),
          getFoodTokens(todayStr),
          getStudents(),
          getProjects(),
        ]);
        setTodayList(foodList);
        setTokensList(tokens);
        setStudentRegistry(students);
        setProjectRegistry(projects);
      } catch (e) {
        console.error('Error loading dashboard:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [todayStr]);

  const eligibleCount = todayList?.entries.length ?? 0;
  const tokensGeneratedCount = tokensList.length;

  // Project distribution
  const projectStats = useMemo(() => {
    return projectRegistry.map(proj => {
      const eligibleInProj = (todayList?.entries ?? []).filter(e => e.projectCode === proj.code || e.projectName === proj.name).length;
      const tokensInProj = tokensList.filter(t => t.project === proj.name || t.project === proj.code);
      return {
        project: proj,
        eligible: eligibleInProj,
        tokensIssued: tokensInProj.length,
      };
    });
  }, [todayList, tokensList, projectRegistry]);

  // Filtered token feed
  const filteredTokens = useMemo(() => {
    return tokensList.filter(t => {
      const s = studentRegistry.find(st => st.id === t.studentId);
      const matchesSearch =
        searchTerm === '' ||
        t.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.studentName && t.studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s?.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.project.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [tokensList, searchTerm, studentRegistry]);

  const issuanceRate = eligibleCount > 0 ? Math.round((tokensGeneratedCount / eligibleCount) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">Overview of incubation students and today's food activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.href = `/api/reports/export?date=${todayStr}&format=csv`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            title="Download today's food token report as CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>
          <Link
            href="/scan-token"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span>Scan & Issue Token</span>
          </Link>
          <Link
            href="/daily-food-list"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg transition-colors shadow-xs"
          >
            <span>Food List</span>
          </Link>
        </div>
      </div>

      {/* 2. Primary KPI Metric Cards in Structured Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Eligible Students */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Eligible Today</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{eligibleCount}</span>
            <span className="text-xs text-slate-500">students approved</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">List Status:</span>
            <Badge status={todayList?.status ?? 'Draft'} />
          </div>
        </div>

        {/* Metric 2: Tokens Issued */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tokens Generated</span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              🎫
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-700">{tokensGeneratedCount}</span>
            <span className="text-xs font-medium text-emerald-600">{issuanceRate}% of eligible</span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${issuanceRate}%` }}
              ></div>
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              <span>{tokensGeneratedCount} generated</span>
              <span>{Math.max(0, eligibleCount - tokensGeneratedCount)} remaining</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Incubation Registry */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Students Registry</span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm">
              👥
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{studentRegistry.length}</span>
            <span className="text-xs text-slate-500">{studentRegistry.filter(s => s.status === 'Active').length} active</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Active Projects:</span>
            <span className="font-semibold text-slate-700">{projectRegistry.filter(p => p.status === 'Active').length} teams</span>
          </div>
        </div>
      </div>

      {/* 3. Operational Overview & Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Food Service Pipeline & Pending Alerts */}
        <div className="space-y-6">
          {/* Service Flow Pipeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                Daily Service Lifecycle
              </h3>
              <span className="text-xs text-slate-400 font-mono">{todayStr}</span>
            </div>

            <div className="space-y-3.5">
              {/* Step 1: List Eligibility */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Approved List</div>
                    <div className="text-[11px] text-slate-500">Students pre-cleared by staff</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-800">{eligibleCount}</span>
              </div>

              {/* Step 2: Tokens Generated */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-900">Tokens Generated</div>
                    <div className="text-[11px] text-emerald-700">Tokens ready for eligible students</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-700">{tokensGeneratedCount}</span>
              </div>
            </div>
          </div>

          {/* Incubation Projects Quota & Status */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Project Breakdown</h3>
              <Link href="/projects" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>

            <div className="space-y-3">
              {projectStats.map(({ project, eligible, tokensIssued }) => (
                <div key={project.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{project.name}</span>
                    <span className="text-slate-500 text-[11px]">{tokensIssued} / {eligible} tokens generated</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full"
                      style={{ width: `${eligible > 0 ? (tokensIssued / eligible) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Token Activity Feed with Filter & Search */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            {/* Header + Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Today's Token Activity</h3>
                <p className="text-xs text-slate-400 mt-0.5">Live log of tokens generated for food service</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-100">
                  {tokensList.length} Generated
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="py-3 flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter by Student ID, Name, or Token #..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Table Stream */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2.5 pr-3 font-semibold">Token No</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Student</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Project</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Time</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Status</th>
                    <th className="text-right py-2.5 pl-3 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        Loading today's activity...
                      </td>
                    </tr>
                  ) : filteredTokens.length > 0 ? (
                    filteredTokens.map(token => {
                      const student = studentRegistry.find(s => s.id === token.studentId);
                      return (
                        <tr key={token.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pr-3 font-semibold text-indigo-700 tracking-wide font-mono tabular-nums">
                            {token.tokenNumber}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-800">{token.studentName || student?.name || 'Student'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{token.studentId} · {student?.department || ''}</div>
                          </td>
                          <td className="py-3 pr-3 text-slate-600">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700">
                              {token.project}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-slate-500">
                            <div>{token.time}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <Badge status={token.status} />
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <Link
                              href="/food-tokens"
                              className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px] inline-flex items-center gap-0.5"
                            >
                              View
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No tokens found matching the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Showing {filteredTokens.length} of {tokensList.length} total tokens</span>
              <Link href="/food-tokens" className="text-indigo-600 hover:text-indigo-800 font-medium">
                Manage All Food Tokens →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
