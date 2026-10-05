'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Badge from '@/components/Badge';
import { getFoodTokens } from '@/actions/tokenActions';
import { getDailyFoodList, type FoodListDetails } from '@/actions/foodListActions';
import { getStudents, getProjects, getDashboardBundle, type StudentRecord, type ProjectRecord } from '@/actions/studentActions';
import {
  getMealSession,
  getTokenEffectiveSession,
  getTodayISTDateString,
  getPreviousISTDateString,
  getNextISTDateString,
  formatISTDateDMY,
  formatISTDateShort,
  formatISTDateWithDay,
  formatISTTime,
  SESSION_TIMINGS,
  getSessionStatus,
  type MealSession,
} from '@/utils/timeUtils';

interface CachedDashboardPayload {
  date: string;
  foodList: FoodListDetails | null;
  tokens: any[];
  students: StudentRecord[];
  projects: ProjectRecord[];
  overnightStayCount?: number;
  yesterdayDinnerTokensCount?: number;
  yesterdayLastDinnerTime?: string | null;
  timestamp: number;
}

let memoryDashboardCache: CachedDashboardPayload | null = null;

function getInitialDashboardData(todayStr: string): CachedDashboardPayload | null {
  if (memoryDashboardCache && memoryDashboardCache.date === todayStr) {
    return memoryDashboardCache;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('incubation_dashboard_cache');
      if (stored) {
        const parsed = JSON.parse(stored) as CachedDashboardPayload;
        if (parsed.date === todayStr && Date.now() - parsed.timestamp < 1000 * 60 * 30) {
          memoryDashboardCache = parsed;
          return parsed;
        }
      }
    } catch { }
  }
  return null;
}

export default function Dashboard() {
  const todayStr = getTodayISTDateString();
  const initialCache = useMemo(() => getInitialDashboardData(todayStr), [todayStr]);

  const [searchTerm, setSearchTerm] = useState('');
  const [todayList, setTodayList] = useState<FoodListDetails | null>(() => initialCache?.foodList ?? null);
  const [tokensList, setTokensList] = useState<any[]>(() => initialCache?.tokens ?? []);
  const [studentRegistry, setStudentRegistry] = useState<StudentRecord[]>(() => initialCache?.students ?? []);
  const [projectRegistry, setProjectRegistry] = useState<ProjectRecord[]>(() => initialCache?.projects ?? []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [overnightStayCount, setOvernightStayCount] = useState<number>(() => initialCache?.overnightStayCount ?? 0);
  const [yesterdayDinnerTokensCount, setYesterdayDinnerTokensCount] = useState<number>(() => initialCache?.yesterdayDinnerTokensCount ?? 0);
  const [yesterdayLastDinnerTime, setYesterdayLastDinnerTime] = useState<string | null>(() => initialCache?.yesterdayLastDinnerTime ?? null);

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const bundle = await getDashboardBundle(todayStr);
      setTodayList(bundle.foodList);
      setTokensList(bundle.tokens);
      setStudentRegistry(bundle.students);
      setProjectRegistry(bundle.projects);
      setOvernightStayCount(bundle.overnightStayCount || 0);
      setYesterdayDinnerTokensCount(bundle.yesterdayDinnerTokensCount || 0);
      setYesterdayLastDinnerTime(bundle.yesterdayLastDinnerTime || null);

      const payload: CachedDashboardPayload = {
        date: todayStr,
        foodList: bundle.foodList,
        tokens: bundle.tokens,
        students: bundle.students,
        projects: bundle.projects,
        overnightStayCount: bundle.overnightStayCount || 0,
        yesterdayDinnerTokensCount: bundle.yesterdayDinnerTokensCount || 0,
        yesterdayLastDinnerTime: bundle.yesterdayLastDinnerTime || null,
        timestamp: Date.now(),
      };
      memoryDashboardCache = payload;
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('incubation_dashboard_cache', JSON.stringify(payload));
        } catch { }
      }
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadData(Boolean(initialCache));
    }
  }, [loadData, initialCache]);

  // Live SSE listener: keep dashboard synced in real time when tokens are scanned
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/terminal-stream');
      eventSource.onmessage = e => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'TOKEN_ISSUED' || payload.type === 'FOOD_LIST_ADDED') {
            loadData(true);
          }
        } catch { }
      };
    } catch { }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [loadData]);

  const currentSession = getMealSession();
  const yesterdayStr = useMemo(() => getPreviousISTDateString(todayStr), [todayStr]);
  const tomorrowStr = useMemo(() => getNextISTDateString(todayStr), [todayStr]);

  const formattedDateStr = useMemo(() => {
    try {
      const [y, m, d] = todayStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return dt.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return todayStr;
    }
  }, [todayStr]);

  const isBreakfastOrLunch = currentSession === 'BREAKFAST' || currentSession === 'LUNCH';
  const rawEligibleCount = todayList?.entries.length ?? 0;
  const isCarriedOver = isBreakfastOrLunch;
  const eligibleCount = isCarriedOver ? overnightStayCount : rawEligibleCount;
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

  // Last token issued timestamp per session
  const lastTokenTime = useMemo(() => {
    const res: Record<string, string | null> = { BREAKFAST: null, LUNCH: null, DINNER: null };
    for (const t of tokensList) {
      const sess = getTokenEffectiveSession(t);
      if (!res[sess] && t.time) {
        res[sess] = t.time;
      }
    }
    return res;
  }, [tokensList]);

  // Detailed Meal Session Cards (Ordered strictly by Active 3-Meal Cycle: Dinner → Breakfast → Lunch)
  const sessionCards = useMemo(() => {
    const isCurrentlyDinner = currentSession === 'DINNER';
    const isCurrentlyLunch = currentSession === 'LUNCH';
    const isCurrentlyBreakfast = currentSession === 'BREAKFAST';

    if (!isCurrentlyDinner) {
      // -------------------------------------------------------------
      // DAYTIME (Breakfast or Lunch): Resolving Yesterday's Night Stay
      // Cycle: [1. Yesterday Dinner] -> [2. Today Breakfast] -> [3. Today Lunch]
      // -------------------------------------------------------------
      const activeApproved = overnightStayCount;
      const dinnerApprovedCount = overnightStayCount > 0 ? overnightStayCount : (yesterdayDinnerTokensCount > 0 ? yesterdayDinnerTokensCount : 0);
      const dinnerIssued = Math.min(yesterdayDinnerTokensCount, dinnerApprovedCount);
      const dinnerPending = Math.max(0, dinnerApprovedCount - dinnerIssued);
      const dinnerTurnout = dinnerApprovedCount > 0 ? Math.min(100, Math.round((dinnerIssued / dinnerApprovedCount) * 100)) : (dinnerIssued > 0 ? 100 : 0);

      const breakfastTokens = Math.min(mealSessionCounts.BREAKFAST, activeApproved);
      const breakfastPending = Math.max(0, activeApproved - breakfastTokens);
      const breakfastTurnout = activeApproved > 0 ? Math.min(100, Math.round((breakfastTokens / activeApproved) * 100)) : 0;

      const lunchTokens = Math.min(mealSessionCounts.LUNCH, activeApproved);
      const lunchPending = Math.max(0, activeApproved - lunchTokens);
      const lunchTurnout = activeApproved > 0 ? Math.min(100, Math.round((lunchTokens / activeApproved) * 100)) : 0;

      const dinnerCard = {
        id: 'DINNER',
        name: 'Dinner',
        icon: '🌙',
        timing: SESSION_TIMINGS.DINNER,
        targetDate: yesterdayStr,
        dateFormatted: formatISTDateDMY(yesterdayStr),
        dayBadge: 'Last Night',
        status: 'COMPLETED' as const,
        statusLabel: 'Completed (Last Night)',
        approved: dinnerApprovedCount,
        issued: dinnerIssued,
        pending: dinnerPending,
        turnout: dinnerTurnout,
        cycleLabel: `Night Stay (${formatISTDateDMY(yesterdayStr)})`,
        isNightCarryover: true,
        isFutureScheduled: false,
        lastTime: yesterdayLastDinnerTime,
      };

      const breakfastCard = {
        id: 'BREAKFAST',
        name: 'Breakfast',
        icon: '🌅',
        timing: SESSION_TIMINGS.BREAKFAST,
        targetDate: todayStr,
        dateFormatted: formatISTDateDMY(todayStr),
        dayBadge: 'This Morning',
        status: (isCurrentlyBreakfast ? 'ACTIVE' : 'COMPLETED') as 'ACTIVE' | 'COMPLETED',
        statusLabel: isCurrentlyBreakfast ? 'Active Now' : 'Completed',
        approved: activeApproved,
        issued: breakfastTokens,
        pending: breakfastPending,
        turnout: breakfastTurnout,
        cycleLabel: `Night Stay (${formatISTDateDMY(yesterdayStr)})`,
        isNightCarryover: true,
        isFutureScheduled: false,
        lastTime: lastTokenTime.BREAKFAST,
      };

      const lunchCard = {
        id: 'LUNCH',
        name: 'Lunch',
        icon: '☀️',
        timing: SESSION_TIMINGS.LUNCH,
        targetDate: todayStr,
        dateFormatted: formatISTDateDMY(todayStr),
        dayBadge: 'Today Afternoon',
        status: (isCurrentlyLunch ? 'ACTIVE' : 'UPCOMING') as 'ACTIVE' | 'UPCOMING',
        statusLabel: isCurrentlyLunch ? 'Active Now' : 'Opens Today 12:00 PM',
        approved: activeApproved,
        issued: lunchTokens,
        pending: lunchPending,
        turnout: lunchTurnout,
        cycleLabel: `Night Stay (${formatISTDateDMY(yesterdayStr)})`,
        isNightCarryover: true,
        isFutureScheduled: false,
        lastTime: lastTokenTime.LUNCH,
      };

      return [dinnerCard, breakfastCard, lunchCard];
    } else {
      // -------------------------------------------------------------
      // NIGHTTIME (Once Lunch is completed -> Dinner session onwards):
      // Cycle: [1. Today Dinner] -> [2. Tomorrow Breakfast] -> [3. Tomorrow Lunch]
      // -------------------------------------------------------------
      const dinnerTokens = Math.min(mealSessionCounts.DINNER, rawEligibleCount);
      const dinnerPending = Math.max(0, rawEligibleCount - dinnerTokens);
      const dinnerTurnout = rawEligibleCount > 0 ? Math.min(100, Math.round((dinnerTokens / rawEligibleCount) * 100)) : 0;

      const dinnerCard = {
        id: 'DINNER',
        name: 'Dinner',
        icon: '🌙',
        timing: SESSION_TIMINGS.DINNER,
        targetDate: todayStr,
        dateFormatted: formatISTDateDMY(todayStr),
        dayBadge: 'Tonight',
        status: 'ACTIVE' as const,
        statusLabel: 'Active Now',
        approved: rawEligibleCount,
        issued: dinnerTokens,
        pending: dinnerPending,
        turnout: dinnerTurnout,
        cycleLabel: rawEligibleCount > 0
          ? `Approved List (${formatISTDateDMY(todayStr)})`
          : `New List Required (${formatISTDateDMY(todayStr)})`,
        isNightCarryover: false,
        isFutureScheduled: false,
        lastTime: lastTokenTime.DINNER,
      };

      const breakfastCard = {
        id: 'BREAKFAST',
        name: 'Breakfast',
        icon: '🌅',
        timing: SESSION_TIMINGS.BREAKFAST,
        targetDate: tomorrowStr,
        dateFormatted: formatISTDateDMY(tomorrowStr),
        dayBadge: 'Tomorrow Morning',
        status: 'UPCOMING' as const,
        statusLabel: 'Opens Tomorrow 07:30 AM',
        approved: rawEligibleCount,
        issued: 0,
        pending: rawEligibleCount,
        turnout: 0,
        cycleLabel: `Night Stay (${formatISTDateDMY(todayStr)})`,
        isNightCarryover: true,
        isFutureScheduled: true,
        lastTime: null,
      };

      const lunchCard = {
        id: 'LUNCH',
        name: 'Lunch',
        icon: '☀️',
        timing: SESSION_TIMINGS.LUNCH,
        targetDate: tomorrowStr,
        dateFormatted: formatISTDateDMY(tomorrowStr),
        dayBadge: 'Tomorrow Afternoon',
        status: 'UPCOMING' as const,
        statusLabel: 'Opens Tomorrow 12:00 PM',
        approved: rawEligibleCount,
        issued: 0,
        pending: rawEligibleCount,
        turnout: 0,
        cycleLabel: `Night Stay (${formatISTDateDMY(todayStr)})`,
        isNightCarryover: true,
        isFutureScheduled: true,
        lastTime: null,
      };

      return [dinnerCard, breakfastCard, lunchCard];
    }
  }, [
    currentSession,
    rawEligibleCount,
    overnightStayCount,
    yesterdayDinnerTokensCount,
    yesterdayLastDinnerTime,
    mealSessionCounts,
    lastTokenTime,
    todayStr,
    yesterdayStr,
    tomorrowStr,
  ]);

  // Active Session Stats
  const activeSessionTokensCount = mealSessionCounts[currentSession] || 0;
  const activeSessionTurnout = eligibleCount > 0 ? Math.min(100, Math.round((activeSessionTokensCount / eligibleCount) * 100)) : 0;

  // Project distribution with meal breakdown
  const projectStats = useMemo(() => {
    return projectRegistry.map(proj => {
      const eligibleInProj = (todayList?.entries ?? []).filter(e => e.projectCode === proj.code || e.projectName === proj.name).length;
      const tokensInProj = tokensList.filter(t => t.project === proj.name || t.project === proj.code);
      const breakfastTokens = tokensInProj.filter(t => getTokenEffectiveSession(t) === 'BREAKFAST').length;
      const lunchTokens = tokensInProj.filter(t => getTokenEffectiveSession(t) === 'LUNCH').length;
      const dinnerTokens = tokensInProj.filter(t => getTokenEffectiveSession(t) === 'DINNER').length;
      const activeSessionTokensInProj = tokensInProj.filter(t => getTokenEffectiveSession(t) === currentSession).length;
      return {
        project: proj,
        eligible: eligibleInProj,
        activeSessionTokens: activeSessionTokensInProj,
        totalTokensIssued: tokensInProj.length,
        breakfastTokens,
        lunchTokens,
        dinnerTokens,
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

  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 10;

  useEffect(() => {
    setActivityPage(1);
  }, [searchTerm]);

  const totalActivityPages = Math.ceil(filteredTokens.length / ACTIVITY_PAGE_SIZE) || 1;
  const activityStartIndex = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedActivityTokens = filteredTokens.slice(activityStartIndex, activityStartIndex + ACTIVITY_PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Incubation Food Operations Dashboard</h2>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] font-bold rounded-full uppercase tracking-wider">
              Live IST
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time meal issuance, overnight night-stay tracking, and institutional attendance
          </p>
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

      {/* Date & Overnight Cycle Live Status Banner */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/60 rounded-2xl p-4 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-lg shadow-inner">
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-100">{formattedDateStr}</h3>
                <span className="text-[11px] font-mono text-indigo-300 bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-700/50">
                  {formatISTDateDMY(todayStr)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active Window: {currentSession} ({SESSION_TIMINGS[currentSession]})
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-amber-400 text-sm">🌙</span>
              <div>
                <span className="text-slate-400 text-[10px] block uppercase tracking-wider font-semibold">Overnight Stay Protocol</span>
                <span className="text-slate-200 font-medium text-[11px]">
                  {currentSession === 'DINNER'
                    ? `Dinner tonight (${formatISTDateDMY(todayStr)}) carries over to tomorrow's Breakfast & Lunch (${formatISTDateDMY(tomorrowStr)})`
                    : `Active 3-Meal Cycle: ${formatISTDateDMY(yesterdayStr)} Dinner → ${formatISTDateDMY(todayStr)} Breakfast & Lunch`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Eligible Students */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isCarriedOver ? 'Active Night Stay List' : 'Approved List Today'}
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{eligibleCount}</span>
            <span className="text-xs text-slate-500">
              {isCarriedOver ? 'students approved for night stay' : 'students approved'}
            </span>
          </div>
          {isCarriedOver ? (
            <div className="mt-2 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 font-medium flex items-center gap-1">
              <span>🌙</span>
              <span>Night Stay approved on {formatISTDateDMY(yesterdayStr)} (Carries into Breakfast & Lunch)</span>
            </div>
          ) : (
            <div className="mt-2 text-[10px] text-slate-400 font-medium">
              Daily Master List for {formatISTDateDMY(todayStr)}
            </div>
          )}
        </div>

        {/* Metric 2: Active Session Turnout */}
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              Detailed Meal Session Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specific meal schedules, eligibility cycle origins, and live turnout metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-lg uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Current Window: {currentSession}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {sessionCards.map(meal => {
            const isCurrent = meal.status === 'ACTIVE';
            const isCompleted = meal.status === 'COMPLETED';

            const cardBorder = isCurrent
              ? (meal.id === 'BREAKFAST'
                ? 'border-amber-400/80 bg-linear-to-b from-amber-50/70 to-white ring-2 ring-amber-400/20'
                : meal.id === 'LUNCH'
                  ? 'border-emerald-400/80 bg-linear-to-b from-emerald-50/70 to-white ring-2 ring-emerald-400/20'
                  : 'border-indigo-400/80 bg-linear-to-b from-indigo-50/70 to-white ring-2 ring-indigo-400/20')
              : (isCompleted
                ? 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300'
                : 'border-slate-200 bg-white hover:border-slate-300');

            const progressColor = meal.id === 'BREAKFAST'
              ? 'bg-amber-500'
              : meal.id === 'LUNCH'
                ? 'bg-emerald-600'
                : 'bg-indigo-600';

            return (
              <div
                key={meal.id}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-xs ${cardBorder}`}
              >
                <div>
                  {/* Top Bar: Icon, Name, Day Badge, and Status Badge */}
                  <div className="flex items-start justify-between gap-2.5 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0 leading-none">{meal.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-base tracking-tight">{meal.name}</h4>
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {meal.dayBadge}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 animate-pulse whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Active
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
                          ✓ {meal.statusLabel?.toLowerCase().includes('closed') ? 'Closed' : 'Completed'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                          ⏳ Upcoming
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dedicated Full Date & Meal Timing Row (Never Broken / Never Wrapped) */}
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-mono mb-3 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 whitespace-nowrap">{meal.dateFormatted}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">{meal.timing}</span>
                  </div>

                  {/* Specific Day Cycle Origin Pill (Full Date Displayed - Never Truncated) */}
                  <div className="mb-3.5">
                    <div className={`px-2.5 py-1.5 rounded-lg text-[11px] border font-medium flex items-center justify-between gap-2 ${meal.isNightCarryover
                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                      : meal.approved > 0
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0">{meal.isNightCarryover ? '🌙' : '📋'}</span>
                        <span className="font-semibold text-slate-700 whitespace-nowrap">
                          {meal.cycleLabel}
                        </span>
                      </div>
                      <span className="font-bold font-mono text-[10px] uppercase shrink-0 px-1.5 py-0.5 bg-white/90 rounded border border-slate-200/80 whitespace-nowrap">
                        {meal.approved} Approved
                      </span>
                    </div>
                  </div>

                  {/* Big Turnout Numbers */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        {meal.isFutureScheduled ? (
                          <>
                            <span className="text-3xl font-black text-slate-900 tabular-nums">{meal.approved}</span>
                            <span className="text-xs text-slate-500 font-medium">scheduled</span>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl font-black text-slate-900 tabular-nums">{meal.issued}</span>
                            <span className="text-xs text-slate-500 font-medium">/ {meal.approved} served</span>
                          </>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-700 tabular-nums">
                        {meal.isFutureScheduled ? 'Scheduled for Tomorrow' : `${meal.turnout}% Turnout`}
                      </span>
                    </div>

                    {/* Turnout Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${progressColor} h-2 rounded-full transition-all duration-500 ${meal.isFutureScheduled ? 'opacity-30' : ''}`}
                        style={{ width: meal.isFutureScheduled ? '100%' : `${meal.turnout}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Metrics: Pending + Last Issued Timestamp */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className={`font-semibold ${meal.isFutureScheduled ? 'text-indigo-700' : (meal.pending > 0 ? 'text-amber-700' : 'text-emerald-700')}`}>
                    {meal.isFutureScheduled ? `${meal.approved} eligible for tomorrow` : (meal.pending > 0 ? `${meal.pending} unclaimed` : 'All cleared ✓')}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {meal.lastTime
                      ? `Last: ${formatISTTime(meal.lastTime)}`
                      : (meal.statusLabel?.toLowerCase().startsWith('opens')
                          ? meal.statusLabel
                          : (meal.isFutureScheduled ? 'Opens tomorrow' : 'No tokens yet'))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Daytime Indicator for Tonight's Upcoming Night Stay */}
        {currentSession !== 'DINNER' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-sm shrink-0">
                🌙
              </span>
              <div>
                <span className="font-bold text-slate-800">
                  Tonight's Upcoming Night Stay ({formatISTDateDMY(todayStr)}):
                </span>{' '}
                <span className="text-slate-600">
                  {rawEligibleCount > 0
                    ? `${rawEligibleCount} students pre-approved for Dinner (Opens 07:30 PM) and tomorrow's Breakfast & Lunch (${formatISTDateDMY(tomorrowStr)})`
                    : `No students added yet for tonight's stay. Create tonight's list in Daily Food List.`}
                </span>
              </div>
            </div>
            <Link
              href="/daily-food-list"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold shrink-0"
            >
              <span>Manage Tonight's List</span>
              <span>→</span>
            </Link>
          </div>
        )}
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
              <span className="text-xs text-slate-400 font-mono">{formatISTDateDMY(todayStr)}</span>
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
              <h3 className="font-bold text-slate-800 text-sm">Mentors &amp; Cohorts Breakdown</h3>
              <Link href="/students" className="text-xs text-indigo-600 hover:underline">View all</Link>
            </div>

            <div className="space-y-3">
              {projectStats.map(({ project, eligible, activeSessionTokens, totalTokensIssued, breakfastTokens, lunchTokens, dinnerTokens }) => {
                const projectTurnout = eligible > 0 ? Math.min(100, Math.round((activeSessionTokens / eligible) * 100)) : 0;
                return (
                  <div key={project.code} className="space-y-1.5 p-2 rounded-lg bg-slate-50/60 border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{project.name}</span>
                      <span className="text-slate-500 text-[11px] font-mono">
                        {activeSessionTokens} / {eligible} served for {currentSession}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${projectTurnout}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="bg-amber-100/70 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200/60">🌅 {breakfastTokens} B</span>
                        <span className="bg-emerald-100/70 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-200/60">☀️ {lunchTokens} L</span>
                        <span className="bg-indigo-100/70 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-200/60">🌙 {dinnerTokens} D</span>
                      </div>
                      <span className="font-mono text-slate-500 font-semibold">{totalTokensIssued} total</span>
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
                    <th className="text-center py-2.5 px-3 font-semibold w-12">S.No</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Token No</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Student</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Mentor / Cohort</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Session & Time</th>
                    <th className="text-left py-2.5 pr-3 font-semibold">Status</th>
                    <th className="text-right py-2.5 pl-3 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        Loading today's activity...
                      </td>
                    </tr>
                  ) : filteredTokens.length > 0 ? (
                    paginatedActivityTokens.map((token, idx) => {
                      const student = studentRegistry.find(s => s.id === token.studentId);
                      const sessionLabel = getTokenEffectiveSession(token);
                      return (
                        <tr key={token.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-500 font-medium font-mono text-[11px]">
                            {activityStartIndex + idx + 1}
                          </td>
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
                            <div className="text-slate-400 text-[10px]">{formatISTTime(token.issuedAt || token.time)}</div>
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
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No tokens found matching the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredTokens.length > 0 && (
              <div className="pt-3.5 mt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div>
                  Showing <span className="font-semibold text-slate-800">{activityStartIndex + 1}</span> to{' '}
                  <span className="font-semibold text-slate-800">{Math.min(activityStartIndex + ACTIVITY_PAGE_SIZE, filteredTokens.length)}</span> of{' '}
                  <span className="font-semibold text-slate-800">{filteredTokens.length}</span> tokens
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={activityPage === 1}
                    onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-600 transition-colors cursor-pointer text-[11px]"
                  >
                    ← Prev
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalActivityPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setActivityPage(p)}
                        className={`w-6 h-6 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${activityPage === p
                          ? 'bg-indigo-700 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={activityPage === totalActivityPages}
                    onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}
                    className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-600 transition-colors cursor-pointer text-[11px]"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
