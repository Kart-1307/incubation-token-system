'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Badge from '@/components/Badge';
import { getFoodTokens } from '@/actions/tokenActions';
import { getDailyFoodList, type FoodListDetails } from '@/actions/foodListActions';
import { getStudents, getProjects, type StudentRecord, type ProjectRecord } from '@/actions/studentActions';
import { getMealSession, getTokenEffectiveSession } from '@/utils/timeUtils';

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

  const currentSession = getMealSession();
  const eligibleCount = todayList?.entries.length ?? 0;
  const tokensGeneratedCount = tokensList.length;

  // Meal Session Breakdown Counts
  const mealSessionCounts = useMemo(() => {
    const breakfast = tokensList.filter(t => getTokenEffectiveSession(t) === 'BREAKFAST');
    const lunch = tokensList.filter(t => getTokenEffectiveSession(t) === 'LUNCH');
    const dinner = tokensList.filter(t => getTokenEffectiveSession(t) === 'DINNER');

    return {
      BREAKFAST: breakfast.length,
      LUNCH: lunch.length,
      DINNER: dinner.length,
    };
  }, [tokensList]);

  // Active Session Stats
  const activeSessionTokensCount = mealSessionCounts[currentSession] || 0;
  const activeSessionTurnout = eligibleCount > 0 ? Math.min(100, Math.round((activeSessionTokensCount / eligibleCount) * 100)) : 0;

  // Project distribution
  const projectStats = useMemo(() => {
    return projectRegistry.map(proj => {
      const eligibleInProj = (todayList?.entries ?? []).filter(e => e.projectCode === proj.code || e.projectName === proj.name).length;
      const tokensInProj = tokensList.filter(t => t.project === proj.name || t.project === proj.code);
      const activeSessionTokensInProj = tokensInProj.filter(t => getTokenEffectiveSession(t) === currentSession).length;
      return {
        project: proj,
        eligible: eligibleInProj,
        activeSessionTokens: activeSessionTokensInProj,
        totalTokensIssued: tokensInProj.length,
      };
    });
  }, [todayList, tokensList, projectRegistry, currentSession]);

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

      {/* 1. Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Eligible Students */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approved List Today</span>
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

        {/* Metric 2: Active Session Turnout (Replaces misleading 167%) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Session ({currentSession})</span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              🎫
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-700">{activeSessionTokensCount} <span className="text-base text-slate-400 font-normal">/ {eligibleCount}</span></span>
            <span className="text-xs font-semibold text-emerald-600">{activeSessionTurnout}% turnout</span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${activeSessionTurnout}%` }}
              ></div>
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              <span>{activeSessionTokensCount} served for {currentSession}</span>
              <span>{Math.max(0, eligibleCount - activeSessionTokensCount)} pending</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Total Meal Servings Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Servings Today</span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm">
              🍱
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{tokensGeneratedCount}</span>
            <span className="text-xs text-slate-500">total tokens issued</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <span>🌅 {mealSessionCounts.BREAKFAST} B</span>
            <span>☀️ {mealSessionCounts.LUNCH} L</span>
            <span>🌙 {mealSessionCounts.DINNER} D</span>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED MEAL-WISE TOKEN BREAKDOWN PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              Meal-Wise Token Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Live turnout statistics across Breakfast, Lunch & Dinner sessions</p>
          </div>
          <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-bold rounded-full uppercase">
            Active Session: {currentSession}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Breakfast Session Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            currentSession === 'BREAKFAST'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-slate-50/80 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌅</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Breakfast</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                currentSession === 'BREAKFAST' ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {currentSession === 'BREAKFAST' ? 'Active' : 'Morning'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{mealSessionCounts.BREAKFAST} <span className="text-xs font-normal text-slate-500">/ {eligibleCount}</span></span>
              <span className="text-xs font-bold text-slate-700">
                {eligibleCount > 0 ? Math.min(100, Math.round((mealSessionCounts.BREAKFAST / eligibleCount) * 100)) : 0}% Turnout
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${eligibleCount > 0 ? Math.min(100, Math.round((mealSessionCounts.BREAKFAST / eligibleCount) * 100)) : 0}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
              <span>{mealSessionCounts.BREAKFAST} tokens issued</span>
              <span>{Math.max(0, eligibleCount - mealSessionCounts.BREAKFAST)} pending</span>
            </div>
          </div>

          {/* Lunch Session Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            currentSession === 'LUNCH'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/20'
              : 'bg-slate-50/80 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">☀️</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Lunch</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                currentSession === 'LUNCH' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {currentSession === 'LUNCH' ? 'Active' : 'Afternoon'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{mealSessionCounts.LUNCH} <span className="text-xs font-normal text-slate-500">/ {eligibleCount}</span></span>
              <span className="text-xs font-bold text-emerald-700">
                {eligibleCount > 0 ? Math.min(100, Math.round((mealSessionCounts.LUNCH / eligibleCount) * 100)) : 0}% Turnout
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${eligibleCount > 0 ? Math.min(100, Math.round((mealSessionCounts.LUNCH / eligibleCount) * 100)) : 0}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
              <span>{mealSessionCounts.LUNCH} tokens issued</span>
              <span>{Math.max(0, eligibleCount - mealSessionCounts.LUNCH)} pending</span>
            </div>
          </div>

          {/* Dinner Session Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            currentSession === 'DINNER'
              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-400/20'
              : 'bg-slate-50/80 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌙</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Dinner</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                currentSession === 'DINNER' ? 'bg-indigo-200 text-indigo-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {currentSession === 'DINNER' ? 'Active' : 'Evening'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{mealSessionCounts.DINNER} <span className="text-xs font-normal text-slate-500">/ {eligibleCount}</span></span>
              <span className="text-xs font-bold text-indigo-700">
                {eligibleCount > 0 ? Math.min(100, Math.round((mealSessionCounts.DINNER / eligibleCount) * 100)) : 0}% Turnout
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${eligibleCount > 0 ? Math.min(100, Math.round((mealSessionCounts.DINNER / eligibleCount) * 100)) : 0}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
              <span>{mealSessionCounts.DINNER} tokens issued</span>
              <span>{Math.max(0, eligibleCount - mealSessionCounts.DINNER)} pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational Overview & Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Food Service Pipeline & Project Breakdown */}
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
                    <div className="text-xs font-semibold text-emerald-900">Total Servings Issued</div>
                    <div className="text-[11px] text-emerald-700">Tokens generated across all sessions</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-700">{tokensGeneratedCount}</span>
              </div>
            </div>
          </div>

          {/* Incubation Projects Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Project Breakdown</h3>
              <Link href="/projects" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>

            <div className="space-y-3">
              {projectStats.map(({ project, eligible, activeSessionTokens, totalTokensIssued }) => {
                const projectTurnout = eligible > 0 ? Math.min(100, Math.round((activeSessionTokens / eligible) * 100)) : 0;
                return (
                  <div key={project.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{project.name}</span>
                      <span className="text-slate-500 text-[11px]">
                        {activeSessionTokens} / {eligible} served for {currentSession}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${projectTurnout}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{eligible} approved students</span>
                      <span>{totalTokensIssued} total meal tokens</span>
                    </div>
                  </div>
                );
              })}
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
                    <th className="text-left py-2.5 pr-3 font-semibold">Session & Time</th>
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
                      const sessionLabel = getTokenEffectiveSession(token);
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
                          <td className="py-3 pr-3 text-slate-600">
                            <div className="font-semibold text-[11px] text-indigo-900">{sessionLabel}</div>
                            <div className="text-slate-400 text-[10px]">{token.time}</div>
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
